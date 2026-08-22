import { CATALOG } from "@/lib/data/catalog";
import { ROLES } from "@/lib/data/roles";
import { SKILL_BY_ID } from "@/lib/data/skills";
import type { Resource } from "@/lib/types";

/**
 * Lexical-semantic retrieval model.
 *
 * We build a TF-IDF vector space over the catalog and score a learner's
 * natural-language goal against it with cosine similarity. This is deliberately
 * local and deterministic: retrieval quality does not depend on a network call,
 * so the recommender behaves identically with or without an API key. Claude
 * layers *on top* of this (understanding messy phrasing, explaining results),
 * it does not replace it.
 */

// ---------------------------------------------------------------------------
// Tokenisation
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "but", "by", "can", "do",
  "for", "from", "get", "has", "have", "how", "i", "if", "in", "into", "is",
  "it", "its", "me", "my", "of", "on", "or", "so", "that", "the", "their",
  "them", "then", "there", "these", "they", "this", "to", "up", "want", "was",
  "we", "what", "when", "which", "who", "will", "with", "would", "you", "your",
  "am", "become", "becoming", "like", "make", "need", "really", "some", "very",
  "also", "just", "more", "most", "much", "over", "than", "too", "any", "all",
  // Domain stopwords. In a catalog of learning resources these appear almost
  // everywhere and carry no discriminative signal. "learn" matters especially:
  // the stemmer folds "learning" into it, so without this every "I want to
  // learn X" would match the Machine *Learning* role.
  "learn", "learning", "course", "study", "skill", "training", "tutorial",
  "resource", "lesson", "class", "topic", "level", "start", "goal",
]);

/** Light suffix stripping — enough to fold obvious inflections together. */
function stem(word: string): string {
  if (word.length <= 3) return word;
  for (const suffix of ["ingly", "edly", "ing", "ers", "er", "ies", "es", "ed", "s"]) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3) {
      const base = word.slice(0, word.length - suffix.length);
      return suffix === "ies" ? `${base}y` : base;
    }
  }
  return word;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/[\s\-_.]+/)
    // Filter before stemming (catches inflected stopwords like "learning")…
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(stem)
    // …and again after, since stemming can produce a stopword ("learns" → "learn").
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

// ---------------------------------------------------------------------------
// Vector helpers
// ---------------------------------------------------------------------------

export type SparseVector = Map<string, number>;

function termFrequency(tokens: string[]): SparseVector {
  const tf: SparseVector = new Map();
  for (const token of tokens) tf.set(token, (tf.get(token) ?? 0) + 1);
  return tf;
}

function l2Normalize(vec: SparseVector): SparseVector {
  let sumSq = 0;
  for (const value of vec.values()) sumSq += value * value;
  const norm = Math.sqrt(sumSq);
  if (norm === 0) return vec;
  const out: SparseVector = new Map();
  for (const [key, value] of vec) out.set(key, value / norm);
  return out;
}

export function cosine(a: SparseVector, b: SparseVector): number {
  // Iterate the smaller vector for speed; both are already L2-normalised.
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [key, value] of small) {
    const other = large.get(key);
    if (other !== undefined) dot += value * other;
  }
  return dot;
}

// ---------------------------------------------------------------------------
// Corpus construction
// ---------------------------------------------------------------------------

/** The searchable text of a resource, with important fields repeated to weight them. */
function resourceDocument(resource: Resource): string {
  const skillNames = resource.teaches
    .map((t) => SKILL_BY_ID[t.skillId]?.name ?? t.skillId)
    .join(" ");
  // Title and tags are repeated so they dominate the longer description.
  return [
    resource.title,
    resource.title,
    resource.tags.join(" "),
    resource.tags.join(" "),
    skillNames,
    skillNames,
    resource.domain,
    resource.kind,
    resource.description,
    resource.provider,
  ].join(" ");
}

interface VectorSpace {
  idf: Map<string, number>;
  vectors: Map<string, SparseVector>;
}

/** Build the TF-IDF space once at module load — the catalog is static. */
function buildSpace(docs: { id: string; text: string }[]): VectorSpace {
  const tokenized = docs.map((doc) => ({ id: doc.id, tokens: tokenize(doc.text) }));

  const docFreq = new Map<string, number>();
  for (const { tokens } of tokenized) {
    for (const term of new Set(tokens)) {
      docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
    }
  }

  const total = tokenized.length;
  const idf = new Map<string, number>();
  for (const [term, freq] of docFreq) {
    // Smoothed IDF, always positive.
    idf.set(term, Math.log((total + 1) / (freq + 1)) + 1);
  }

  const vectors = new Map<string, SparseVector>();
  for (const { id, tokens } of tokenized) {
    const tf = termFrequency(tokens);
    const vec: SparseVector = new Map();
    for (const [term, count] of tf) {
      // Sub-linear TF damping so long descriptions do not dominate.
      vec.set(term, (1 + Math.log(count)) * (idf.get(term) ?? 1));
    }
    vectors.set(id, l2Normalize(vec));
  }

  return { idf, vectors };
}

const RESOURCE_SPACE = buildSpace(
  CATALOG.map((r) => ({ id: r.id, text: resourceDocument(r) })),
);

const ROLE_SPACE = buildSpace(
  ROLES.map((r) => ({
    id: r.id,
    text: [r.title, r.title, r.keywords.join(" "), r.keywords.join(" "), r.blurb, r.domain].join(" "),
  })),
);

/** Project an arbitrary query string into a space's vector basis. */
function queryVector(text: string, space: VectorSpace): SparseVector {
  const tf = termFrequency(tokenize(text));
  const vec: SparseVector = new Map();
  for (const [term, count] of tf) {
    const idf = space.idf.get(term);
    if (idf === undefined) continue; // out-of-vocabulary term
    vec.set(term, (1 + Math.log(count)) * idf);
  }
  return l2Normalize(vec);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Cosine relevance of every catalog resource to a free-text query, keyed by id. */
export function scoreResourcesAgainstQuery(query: string): Map<string, number> {
  const qv = queryVector(query, RESOURCE_SPACE);
  const scores = new Map<string, number>();
  for (const [id, vec] of RESOURCE_SPACE.vectors) {
    scores.set(id, cosine(qv, vec));
  }
  return scores;
}

export interface RoleMatch {
  roleId: string;
  score: number;
}

/**
 * Match free-text against the role archetypes.
 *
 * Combines TF-IDF cosine with an exact keyword-phrase bonus, because role names
 * ("data analyst") are short, high-precision signals that pure TF-IDF underweights.
 */
export function matchRoles(text: string): RoleMatch[] {
  const normalized = text.toLowerCase();
  const qv = queryVector(text, ROLE_SPACE);

  const matches: RoleMatch[] = ROLES.map((role) => {
    const vec = ROLE_SPACE.vectors.get(role.id);
    let score = vec ? cosine(qv, vec) : 0;

    // Exact phrase hits are strong evidence — a mention of "data analyst"
    // should beat a diffuse lexical overlap with three other roles.
    for (const keyword of role.keywords) {
      if (normalized.includes(keyword)) {
        score += keyword.includes(" ") ? 0.45 : 0.22;
      }
    }
    if (normalized.includes(role.title.toLowerCase())) score += 0.6;

    return { roleId: role.id, score };
  });

  return matches.sort((a, b) => b.score - a.score);
}

/** Best-matching role, or null when nothing clears the confidence floor. */
export function inferRole(text: string): string | null {
  const [best] = matchRoles(text);
  return best && best.score >= 0.25 ? best.roleId : null;
}

/** Resources most similar to a given resource — used for "related" suggestions. */
export function similarResources(resourceId: string, limit = 4): string[] {
  const target = RESOURCE_SPACE.vectors.get(resourceId);
  if (!target) return [];
  return Array.from(RESOURCE_SPACE.vectors.entries())
    .filter(([id]) => id !== resourceId)
    .map(([id, vec]) => ({ id, score: cosine(target, vec) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.id);
}
