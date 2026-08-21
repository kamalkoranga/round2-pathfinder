import { RESOURCE_BY_ID } from "@/lib/data/catalog";
import { LEVEL_RANK, type Feedback, type Level, type Resource } from "@/lib/types";

/**
 * Feedback-driven adaptation.
 *
 * Every thumbs up/down is treated as evidence about *attributes*, not just the
 * one resource. Rejecting two advanced courses as "too hard" shifts the whole
 * ranking toward gentler material; liking three hands-on projects lifts every
 * hands-on resource. This is a lightweight online preference model — decayed,
 * bounded, and fully inspectable, so the assistant can always explain why the
 * ranking moved.
 */

export interface AdaptationState {
  /** Per-resource adjustment, in score units. */
  resource: Record<string, number>;
  /** Per-provider preference. */
  provider: Record<string, number>;
  /** Per-domain preference. */
  domain: Record<string, number>;
  /** Per-kind (course/project/assessment/reading) preference. */
  kind: Record<string, number>;
  /** Per-learning-style preference. */
  style: Record<string, number>;
  /** Signed difficulty nudge: positive = wants harder, negative = wants easier. */
  difficultyBias: number;
  /** Human-readable notes about what was learned, newest first. */
  notes: string[];
}

export const EMPTY_ADAPTATION: AdaptationState = {
  resource: {},
  provider: {},
  domain: {},
  kind: {},
  style: {},
  difficultyBias: 0,
  notes: [],
};

/** Exponential recency decay — older feedback counts less. */
function recencyWeight(at: string, now: number): number {
  const ageDays = (now - new Date(at).getTime()) / 86_400_000;
  if (!Number.isFinite(ageDays) || ageDays < 0) return 1;
  return Math.exp(-ageDays / 45); // ~half-life of one month
}

function bump(map: Record<string, number>, key: string, amount: number) {
  map[key] = clamp((map[key] ?? 0) + amount, -0.35, 0.35);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Fold a feedback log into an adaptation state. */
export function buildAdaptation(feedback: Feedback[]): AdaptationState {
  const state: AdaptationState = {
    resource: {},
    provider: {},
    domain: {},
    kind: {},
    style: {},
    difficultyBias: 0,
    notes: [],
  };
  if (feedback.length === 0) return state;

  const now = Date.now();
  const counts = { up: 0, down: 0 };
  const reasonCounts: Record<string, number> = {};

  for (const item of feedback) {
    const resource = RESOURCE_BY_ID[item.resourceId];
    if (!resource) continue;

    const direction = item.signal === "up" ? 1 : -1;
    const weight = recencyWeight(item.at, now);
    counts[item.signal] += 1;
    if (item.reason) reasonCounts[item.reason] = (reasonCounts[item.reason] ?? 0) + 1;

    // Direct signal on the resource itself is the strongest.
    state.resource[resource.id] = clamp(
      (state.resource[resource.id] ?? 0) + direction * 0.5 * weight,
      -1,
      0.5,
    );

    // Attribute generalisation, at a fraction of the direct strength.
    bump(state.provider, resource.provider, direction * 0.05 * weight);
    bump(state.domain, resource.domain, direction * 0.07 * weight);
    bump(state.kind, resource.kind, direction * 0.06 * weight);
    for (const style of resource.styles) {
      bump(state.style, style, (direction * 0.05 * weight) / resource.styles.length);
    }

    // Difficulty calibration from the reason tag.
    if (item.reason === "too-hard") state.difficultyBias -= 0.18 * weight;
    if (item.reason === "too-easy") state.difficultyBias += 0.18 * weight;
    // Even without a reason, rejecting advanced material is weak evidence.
    if (item.signal === "down" && resource.level === "advanced") {
      state.difficultyBias -= 0.04 * weight;
    }
    if (item.signal === "up" && resource.level === "advanced") {
      state.difficultyBias += 0.04 * weight;
    }
  }

  state.difficultyBias = clamp(state.difficultyBias, -0.6, 0.6);
  state.notes = describeAdaptation(state, counts, reasonCounts);
  return state;
}

function describeAdaptation(
  state: AdaptationState,
  counts: { up: number; down: number },
  reasons: Record<string, number>,
): string[] {
  const notes: string[] = [];

  const topKind = topEntry(state.kind);
  if (topKind && topKind[1] > 0.04) {
    notes.push(`Favouring ${pluralKind(topKind[0])} — you have rated them positively.`);
  }
  const worstKind = bottomEntry(state.kind);
  if (worstKind && worstKind[1] < -0.04) {
    notes.push(`Showing fewer ${pluralKind(worstKind[0])} based on your feedback.`);
  }

  const topStyle = topEntry(state.style);
  if (topStyle && topStyle[1] > 0.03) {
    notes.push(`Leaning toward ${topStyle[0]} material.`);
  }

  const topDomain = topEntry(state.domain);
  if (topDomain && topDomain[1] > 0.05) {
    notes.push(`Weighting ${topDomain[0]} more heavily.`);
  }

  if (state.difficultyBias < -0.1) {
    notes.push(
      reasons["too-hard"]
        ? "Stepping difficulty down — you flagged material as too hard."
        : "Stepping difficulty down slightly.",
    );
  } else if (state.difficultyBias > 0.1) {
    notes.push(
      reasons["too-easy"]
        ? "Raising difficulty — you flagged material as too easy."
        : "Raising difficulty slightly.",
    );
  }

  if (notes.length === 0 && counts.up + counts.down > 0) {
    notes.push(`Recorded ${counts.up + counts.down} rating(s); no strong pattern yet.`);
  }
  return notes;
}

function topEntry(map: Record<string, number>): [string, number] | null {
  const entries = Object.entries(map);
  if (entries.length === 0) return null;
  return entries.reduce((best, cur) => (cur[1] > best[1] ? cur : best));
}

function bottomEntry(map: Record<string, number>): [string, number] | null {
  const entries = Object.entries(map);
  if (entries.length === 0) return null;
  return entries.reduce((worst, cur) => (cur[1] < worst[1] ? cur : worst));
}

function pluralKind(kind: string): string {
  return kind === "reading" ? "readings" : `${kind}s`;
}

/** Total feedback adjustment for one resource, in score units. */
export function adjustmentFor(resource: Resource, state: AdaptationState): number {
  let adjustment = state.resource[resource.id] ?? 0;
  adjustment += state.provider[resource.provider] ?? 0;
  adjustment += state.domain[resource.domain] ?? 0;
  adjustment += state.kind[resource.kind] ?? 0;
  for (const style of resource.styles) {
    adjustment += (state.style[style] ?? 0) / resource.styles.length;
  }
  return clamp(adjustment, -1, 0.5);
}

/**
 * The learner's *effective* level after difficulty feedback — used so the
 * ranking's level-fit term reacts to "this was too hard" without the learner
 * having to edit their profile.
 */
export function effectiveLevel(level: Level, state: AdaptationState): Level {
  const rank = LEVEL_RANK[level] + (state.difficultyBias > 0.25 ? 1 : state.difficultyBias < -0.25 ? -1 : 0);
  const clamped = Math.min(3, Math.max(1, rank));
  return (["beginner", "intermediate", "advanced"] as const)[clamped - 1];
}
