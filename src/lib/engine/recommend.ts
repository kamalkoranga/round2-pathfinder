import { CATALOG, RESOURCE_BY_ID } from "@/lib/data/catalog";
import { ROLE_BY_ID } from "@/lib/data/roles";
import { skillName } from "@/lib/data/skills";
import {
  buildLearnerVector,
  computeGaps,
  levelFit,
  missingPrerequisites,
} from "@/lib/engine/gap";
import { scoreResourcesAgainstQuery } from "@/lib/engine/vectorize";
import {
  adjustmentFor,
  effectiveLevel,
  type AdaptationState,
  EMPTY_ADAPTATION,
} from "@/lib/engine/adapt";
import type { LearnerProfile, Resource, ScoredResource } from "@/lib/types";

/**
 * The ranking model.
 *
 * Final score is a weighted sum of six interpretable components. Every one is
 * retained on the result so the UI (and the AI assistant) can explain exactly
 * why a resource surfaced — no black box.
 */
export const WEIGHTS = {
  relevance: 0.24,
  gapCoverage: 0.34,
  levelFit: 0.16,
  styleFit: 0.10,
  quality: 0.10,
  feedback: 0.06,
} as const;

export interface RecommendOptions {
  adaptation?: AdaptationState;
  /** Exclude resources whose prerequisites the learner does not yet meet. */
  reachableOnly?: boolean;
  /** Restrict to a resource kind. */
  kind?: Resource["kind"];
  limit?: number;
  /** Extra free-text to blend into the relevance query. */
  queryBoost?: string;
}

/** Style affinity between a resource and the learner's stated preference. */
function styleFit(resource: Resource, profile: LearnerProfile): number {
  if (profile.style === "mixed") return 0.8;
  if (resource.styles.includes(profile.style)) return 1;
  // Hands-on and interactive are near-substitutes.
  const adjacent: Record<string, string[]> = {
    "hands-on": ["interactive"],
    interactive: ["hands-on"],
    video: ["interactive"],
    reading: ["video"],
  };
  const near = adjacent[profile.style] ?? [];
  return resource.styles.some((s) => near.includes(s)) ? 0.7 : 0.4;
}

/**
 * How much of the learner's *prioritised* skill gap this resource closes.
 *
 * Weighted by gap priority, so a resource teaching one critical foundation
 * outranks one teaching three irrelevant extras.
 */
function gapCoverage(
  resource: Resource,
  gapBySkill: Map<string, number>,
  maxPriority: number,
): { score: number; closes: string[] } {
  if (maxPriority === 0) return { score: 0, closes: [] };

  let total = 0;
  const closes: string[] = [];
  for (const { skillId, depth } of resource.teaches) {
    const priority = gapBySkill.get(skillId);
    if (priority === undefined) continue;
    total += (priority / maxPriority) * depth;
    if (depth >= 0.4) closes.push(skillId);
  }
  // Saturating: three strong hits should not score 3x a single strong hit.
  return { score: 1 - Math.exp(-1.6 * total), closes };
}

/** Deterministic rationale, used verbatim when no API key is configured. */
export function buildReason(
  resource: Resource,
  components: ScoredResource["components"],
  closes: string[],
  missing: string[],
  profile: LearnerProfile,
): string {
  const parts: string[] = [];

  if (closes.length > 0) {
    const names = closes.slice(0, 3).map(skillName);
    const list =
      names.length === 1
        ? names[0]
        : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
    parts.push(`closes your highest-priority gap in ${list}`);
  } else if (components.relevance > 0.15) {
    parts.push(`matches what you described wanting to learn`);
  }

  if (components.levelFit >= 0.9) {
    parts.push(`is pitched at your ${resource.level} level`);
  } else if (components.levelFit <= 0.4) {
    parts.push(`is a stretch at ${resource.level} level`);
  }

  if (components.styleFit >= 1 && profile.style !== "mixed") {
    parts.push(`is ${profile.style}, which you said you prefer`);
  }

  if (resource.kind === "project") {
    parts.push(`gives you something concrete for your portfolio`);
  } else if (resource.kind === "assessment") {
    parts.push(`verifies the skills before you move on`);
  }

  // Unmet prerequisites are surfaced by a dedicated callout in the UI, so they
  // are deliberately not repeated here.

  if (parts.length === 0) {
    return `A solid ${resource.level} ${resource.kind} in ${resource.domain}.`;
  }

  const sentence = parts.join("; ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + ".";
}

/**
 * Rank the full catalog for a learner.
 *
 * Completed resources are always excluded — recommending something already done
 * is the fastest way to lose a user's trust.
 */
export function recommend(
  profile: LearnerProfile,
  options: RecommendOptions = {},
): ScoredResource[] {
  const {
    adaptation = EMPTY_ADAPTATION,
    reachableOnly = false,
    kind,
    limit,
    queryBoost = "",
  } = options;

  const gaps = computeGaps(profile);
  const gapBySkill = new Map(gaps.map((g) => [g.skillId, g.priority]));
  const maxPriority = gaps.length > 0 ? gaps[0].priority : 0;

  const current = buildLearnerVector(profile);
  const learnerLevel = effectiveLevel(profile.level, adaptation);
  const completed = new Set(profile.completed);

  // The relevance query fuses the raw goal, the resolved role and stated
  // interests — so "I want to build AI products" also pulls in the LLM track.
  const role = profile.roleId ? ROLE_BY_ID[profile.roleId] : null;
  const query = [
    profile.goalText,
    role ? `${role.title} ${role.keywords.slice(0, 6).join(" ")}` : "",
    profile.interests.map(skillName).join(" "),
    queryBoost,
  ]
    .filter(Boolean)
    .join(" ");

  const relevanceScores = scoreResourcesAgainstQuery(query);

  const scored: ScoredResource[] = [];

  for (const resource of CATALOG) {
    if (completed.has(resource.id)) continue;
    if (kind && resource.kind !== kind) continue;

    const missing = missingPrerequisites(resource.id, current);
    if (reachableOnly && missing.length > 0) continue;

    const { score: coverage, closes } = gapCoverage(resource, gapBySkill, maxPriority);

    // Normalise cosine into a more usable range — raw TF-IDF cosine over short
    // queries rarely exceeds ~0.5, so we rescale rather than let it flatten.
    const relevance = Math.min(1, (relevanceScores.get(resource.id) ?? 0) * 2.4);
    const fit = levelFit(resource.level, learnerLevel);
    const style = styleFit(resource, profile);
    const quality = (resource.rating / 5) * 0.7 + resource.popularity * 0.3;
    const feedbackAdj = adjustmentFor(resource, adaptation);

    const components = {
      relevance,
      gapCoverage: coverage,
      levelFit: fit,
      styleFit: style,
      quality,
      feedbackAdj,
    };

    let score =
      relevance * WEIGHTS.relevance +
      coverage * WEIGHTS.gapCoverage +
      fit * WEIGHTS.levelFit +
      style * WEIGHTS.styleFit +
      quality * WEIGHTS.quality +
      feedbackAdj * WEIGHTS.feedback;

    // Unmet prerequisites are a real penalty, not a hard filter — the path
    // planner will schedule the prerequisite first rather than drop the goal.
    if (missing.length > 0) score *= 1 - Math.min(0.4, missing.length * 0.18);

    scored.push({
      resource,
      score,
      components,
      closesGaps: closes,
      missingPrereqs: missing,
      reason: buildReason(resource, components, closes, missing, profile),
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return limit ? scored.slice(0, limit) : scored;
}

/** Next best actions for the dashboard — cheap wrapper over `recommend`. */
export function nextActions(
  profile: LearnerProfile,
  adaptation: AdaptationState,
  limit = 3,
): ScoredResource[] {
  return recommend(profile, { adaptation, reachableOnly: true, limit });
}

/** Look up a scored recommendation for one specific resource. */
export function scoreOne(
  profile: LearnerProfile,
  resourceId: string,
  adaptation: AdaptationState = EMPTY_ADAPTATION,
): ScoredResource | null {
  if (!RESOURCE_BY_ID[resourceId]) return null;
  const all = recommend(profile, { adaptation });
  return all.find((s) => s.resource.id === resourceId) ?? null;
}
