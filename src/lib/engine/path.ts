import { CATALOG, RESOURCE_BY_ID } from "@/lib/data/catalog";
import { ROLE_BY_ID } from "@/lib/data/roles";
import { SKILL_BY_ID, skillName } from "@/lib/data/skills";
import { buildLearnerVector, computeGaps } from "@/lib/engine/gap";
import { buildReason, recommend } from "@/lib/engine/recommend";
import { EMPTY_ADAPTATION, type AdaptationState } from "@/lib/engine/adapt";
import {
  LEVEL_RANK,
  type LearnerProfile,
  type LearningPath,
  type Milestone,
  type PathStep,
  type Resource,
  type ScoredResource,
} from "@/lib/types";

/**
 * Learning-path generation.
 *
 * Four stages:
 *   1. SELECT   — greedy marginal-gain set cover over the ranked candidates,
 *                 chosen for gap closed per hour spent.
 *   2. CLOSE    — pull in prerequisite resources for anything unreachable,
 *                 recursively, so the path is always startable from day one.
 *   3. ORDER    — topological sort of the resulting dependency DAG.
 *   4. GROUP    — slice the ordered steps into themed, time-boxed milestones.
 */

const MAX_STEPS = 14;
const COVERAGE_TARGET = 0.85;

// ---------------------------------------------------------------------------
// Stage 1 + 2 — selection with prerequisite closure
// ---------------------------------------------------------------------------

/** Best resource in the catalog for acquiring a single skill. */
function bestResourceForSkill(
  skillId: string,
  candidates: ScoredResource[],
  exclude: Set<string>,
): ScoredResource | null {
  let best: ScoredResource | null = null;
  for (const candidate of candidates) {
    if (exclude.has(candidate.resource.id)) continue;
    const teaches = candidate.resource.teaches.find((t) => t.skillId === skillId);
    if (!teaches || teaches.depth < 0.5) continue;
    // Prefer depth, then the resource's own overall score, then brevity.
    const value = teaches.depth * 2 + candidate.score - candidate.resource.hours / 400;
    if (!best) {
      best = candidate;
      continue;
    }
    const bestTeaches = best.resource.teaches.find((t) => t.skillId === skillId)!;
    const bestValue = bestTeaches.depth * 2 + best.score - best.resource.hours / 400;
    if (value > bestValue) best = candidate;
  }
  return best;
}

/**
 * Recursively add the resources needed to satisfy a resource's prerequisites.
 * Returns them in dependency order (deepest prerequisite first).
 */
function resolvePrerequisites(
  resource: Resource,
  mastery: Record<string, number>,
  candidates: ScoredResource[],
  selected: Set<string>,
  depth = 0,
): ScoredResource[] {
  if (depth > 3) return []; // guard against pathological chains
  const added: ScoredResource[] = [];

  for (const skillId of resource.requires) {
    if ((mastery[skillId] ?? 0) >= 0.4) continue;

    const provider = bestResourceForSkill(skillId, candidates, selected);
    if (!provider) continue;

    selected.add(provider.resource.id);
    // Depth-first: this prerequisite may have prerequisites of its own.
    added.push(
      ...resolvePrerequisites(provider.resource, mastery, candidates, selected, depth + 1),
    );
    added.push(provider);

    for (const t of provider.resource.teaches) {
      mastery[t.skillId] = Math.max(mastery[t.skillId] ?? 0, t.depth * 0.85);
    }
  }

  return added;
}

function selectResources(
  profile: LearnerProfile,
  adaptation: AdaptationState,
): ScoredResource[] {
  const gaps = computeGaps(profile);
  if (gaps.length === 0) return [];

  const candidates = recommend(profile, { adaptation });
  const mastery = buildLearnerVector(profile);
  const selected = new Set<string>();
  const chosen: ScoredResource[] = [];

  const totalGapWeight = gaps.reduce((sum, g) => sum + g.priority, 0);
  const remaining = new Map(gaps.map((g) => [g.skillId, g] as const));

  let coveredWeight = 0;

  while (chosen.length < MAX_STEPS && coveredWeight / totalGapWeight < COVERAGE_TARGET) {
    let best: { candidate: ScoredResource; gain: number } | null = null;

    for (const candidate of candidates) {
      if (selected.has(candidate.resource.id)) continue;

      // Marginal gain: how much *still-open* gap weight this closes, i.e. the
      // increase in capped mastery it would produce across open gaps.
      let gain = 0;
      for (const { skillId, depth } of candidate.resource.teaches) {
        const gap = remaining.get(skillId);
        if (!gap) continue;
        const before = mastery[skillId] ?? 0;
        const after = Math.max(before, depth * 0.85);
        const delta = Math.min(after, gap.target) - Math.min(before, gap.target);
        if (delta > 0) gain += delta * gap.priority;
      }
      if (gain <= 0) continue;

      // Cost-effectiveness: gap closed per hour, nudged by the ranking score so
      // a marginally-better-value resource does not beat a much better one.
      const efficiency = (gain / Math.sqrt(candidate.resource.hours)) * (0.6 + candidate.score);

      if (!best || efficiency > best.gain) best = { candidate, gain: efficiency };
    }

    if (!best) break;

    const { candidate } = best;
    selected.add(candidate.resource.id);

    // Pull in whatever this resource assumes but the learner lacks.
    const prereqs = resolvePrerequisites(
      candidate.resource,
      mastery,
      candidates,
      selected,
    );
    chosen.push(...prereqs, candidate);

    // Update simulated mastery and recompute covered weight.
    for (const t of candidate.resource.teaches) {
      mastery[t.skillId] = Math.max(mastery[t.skillId] ?? 0, t.depth * 0.85);
    }

    coveredWeight = 0;
    for (const gap of gaps) {
      const reached = Math.min(mastery[gap.skillId] ?? 0, gap.target);
      const startedAt = Math.min(gap.current, gap.target);
      const progress = gap.target > startedAt ? (reached - startedAt) / (gap.target - startedAt) : 1;
      coveredWeight += Math.max(0, Math.min(1, progress)) * gap.priority;
    }

    for (const [skillId, gap] of remaining) {
      if ((mastery[skillId] ?? 0) >= gap.target - 0.05) remaining.delete(skillId);
    }
  }

  // De-duplicate while preserving first-seen order.
  const seen = new Set<string>();
  return chosen.filter((c) => {
    if (seen.has(c.resource.id)) return false;
    seen.add(c.resource.id);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Stage 3 — topological ordering
// ---------------------------------------------------------------------------

/**
 * Order the selected resources so that every resource appears after whatever
 * teaches its prerequisites. Kahn's algorithm; ties broken by difficulty then
 * ranking score, which keeps foundations early and depth late.
 */
function topologicalOrder(
  selected: ScoredResource[],
  learnerMastery: Record<string, number>,
): ScoredResource[] {
  const byId = new Map(selected.map((s) => [s.resource.id, s]));

  // Which selected resources teach each skill to a usable depth.
  const teachers = new Map<string, string[]>();
  for (const { resource } of selected) {
    for (const { skillId, depth } of resource.teaches) {
      if (depth < 0.4) continue;
      const list = teachers.get(skillId) ?? [];
      list.push(resource.id);
      teachers.set(skillId, list);
    }
  }

  const edges = new Map<string, Set<string>>(); // node -> dependants
  const indegree = new Map<string, number>(selected.map((s) => [s.resource.id, 0]));

  for (const { resource } of selected) {
    for (const skillId of resource.requires) {
      // Already held — no ordering constraint.
      if ((learnerMastery[skillId] ?? 0) >= 0.4) continue;
      for (const teacherId of teachers.get(skillId) ?? []) {
        if (teacherId === resource.id) continue;
        const set = edges.get(teacherId) ?? new Set<string>();
        if (!set.has(resource.id)) {
          set.add(resource.id);
          indegree.set(resource.id, (indegree.get(resource.id) ?? 0) + 1);
        }
        edges.set(teacherId, set);
      }
    }
  }

  const rank = (s: ScoredResource) =>
    LEVEL_RANK[s.resource.level] * 100 -
    s.score * 10 +
    (s.resource.kind === "assessment" ? 50 : 0) +
    (s.resource.kind === "project" ? 20 : 0);

  const ready = selected
    .filter((s) => (indegree.get(s.resource.id) ?? 0) === 0)
    .sort((a, b) => rank(a) - rank(b));

  const ordered: ScoredResource[] = [];

  while (ready.length > 0) {
    const next = ready.shift()!;
    ordered.push(next);

    for (const dependantId of edges.get(next.resource.id) ?? []) {
      const remaining = (indegree.get(dependantId) ?? 0) - 1;
      indegree.set(dependantId, remaining);
      if (remaining === 0) {
        const dependant = byId.get(dependantId);
        if (dependant) {
          // Insert in sorted position rather than re-sorting the whole queue.
          const index = ready.findIndex((s) => rank(s) > rank(dependant));
          if (index === -1) ready.push(dependant);
          else ready.splice(index, 0, dependant);
        }
      }
    }
  }

  // A cycle would strand nodes; append them rather than silently dropping.
  if (ordered.length < selected.length) {
    const included = new Set(ordered.map((s) => s.resource.id));
    ordered.push(...selected.filter((s) => !included.has(s.resource.id)));
  }

  return ordered;
}

// ---------------------------------------------------------------------------
// Stage 4 — milestone grouping
// ---------------------------------------------------------------------------

/**
 * Skill names for use inside a compound title. Several taxonomy names already
 * contain an ampersand ("Statistics & Probability"), which reads badly when
 * joined to a second name — keep only the leading term.
 */
function shortSkill(skillId: string): string {
  return skillName(skillId).split(" & ")[0];
}

const MILESTONE_NAMES = [
  "Build the Foundations",
  "Core Skills",
  "Applied Practice",
  "Specialisation",
  "Mastery & Proof",
];

function milestoneTitle(index: number, total: number, steps: ScoredResource[]): string {
  // Prefer a title derived from what the milestone actually unlocks.
  const skillCounts = new Map<string, number>();
  for (const step of steps) {
    for (const { skillId, depth } of step.resource.teaches) {
      if (depth < 0.5) continue;
      skillCounts.set(skillId, (skillCounts.get(skillId) ?? 0) + depth);
    }
  }
  const ranked = Array.from(skillCounts.entries()).sort((a, b) => b[1] - a[1]);
  const generic = MILESTONE_NAMES[Math.min(index, MILESTONE_NAMES.length - 1)];
  if (ranked.length === 0) return generic;

  const [first, second] = ranked;

  if (index === 0 && total > 1) return `Foundations: ${skillName(first[0])}`;
  if (index === total - 1) {
    return `Proof of Skill: ${SKILL_BY_ID[first[0]]?.domain ?? skillName(first[0])}`;
  }

  // Naming a second skill reads better than pairing a skill with its own
  // domain, which produced things like "Data Wrangling & Data".
  if (second) return `${shortSkill(first[0])} & ${shortSkill(second[0])}`;
  return skillName(first[0]);
}

function milestoneSummary(steps: ScoredResource[], skills: string[]): string {
  const kinds = new Set(steps.map((s) => s.resource.kind));
  const names = skills.slice(0, 3).map(skillName);
  const skillPhrase =
    names.length === 0
      ? "the next set of skills"
      : names.length === 1
        ? names[0]
        : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

  const shape = kinds.has("project")
    ? "and prove it with a hands-on project"
    : kinds.has("assessment")
      ? "and verify it with a checkpoint assessment"
      : "through focused study";

  return `Develop ${skillPhrase} ${shape}.`;
}

function groupIntoMilestones(
  ordered: ScoredResource[],
  profile: LearnerProfile,
): Milestone[] {
  const hoursPerWeek = profile.hoursPerWeek;
  if (ordered.length === 0) return [];

  const targetCount = Math.min(5, Math.max(2, Math.round(ordered.length / 3)));
  const totalHours = ordered.reduce((sum, s) => sum + s.resource.hours, 0);
  const hoursPerMilestone = totalHours / targetCount;

  const groups: ScoredResource[][] = [];
  let current: ScoredResource[] = [];
  let currentHours = 0;

  for (const step of ordered) {
    current.push(step);
    currentHours += step.resource.hours;

    const isLastGroup = groups.length === targetCount - 1;
    if (!isLastGroup && currentHours >= hoursPerMilestone && current.length >= 2) {
      groups.push(current);
      current = [];
      currentHours = 0;
    }
  }
  if (current.length > 0) groups.push(current);

  let cumulativeHours = 0;
  let order = 0;

  return groups.map((group, index) => {
    const skillSet = new Set<string>();
    for (const step of group) {
      for (const { skillId, depth } of step.resource.teaches) {
        if (depth >= 0.5) skillSet.add(skillId);
      }
    }
    const skills = Array.from(skillSet);
    const hours = group.reduce((sum, s) => sum + s.resource.hours, 0);
    cumulativeHours += hours;

    const steps: PathStep[] = group.map((s) => ({
      resource: s.resource,
      order: ++order,
      closesGaps: s.closesGaps,
      // Inside a path the "you haven't covered X yet" caveat is wrong: the
      // planner has already scheduled X earlier. Rebuild without it.
      reason: buildReason(s.resource, s.components, s.closesGaps, [], profile),
      score: s.score,
    }));

    return {
      id: `milestone-${index + 1}`,
      title: milestoneTitle(index, groups.length, group),
      summary: milestoneSummary(group, skills),
      skills,
      steps,
      hours,
      weekEnd: Math.max(1, Math.ceil(cumulativeHours / Math.max(1, hoursPerWeek))),
    };
  });
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function generatePath(
  profile: LearnerProfile,
  adaptation: AdaptationState = EMPTY_ADAPTATION,
): LearningPath {
  const gaps = computeGaps(profile);
  const selected = selectResources(profile, adaptation);
  const mastery = buildLearnerVector(profile);
  const ordered = topologicalOrder(selected, mastery);
  const milestones = groupIntoMilestones(ordered, profile);

  // Projected mastery after completing everything on the path.
  const projected: Record<string, number> = { ...mastery };
  for (const step of ordered) {
    for (const { skillId, depth } of step.resource.teaches) {
      projected[skillId] = Math.max(projected[skillId] ?? 0, depth * 0.85);
    }
  }

  const totalHours = ordered.reduce((sum, s) => sum + s.resource.hours, 0);
  const role = profile.roleId ? ROLE_BY_ID[profile.roleId] : null;

  return {
    goal: profile.goalText,
    roleId: profile.roleId,
    roleTitle: role?.title ?? "Custom goal",
    milestones,
    totalHours,
    totalWeeks: Math.max(1, Math.ceil(totalHours / Math.max(1, profile.hoursPerWeek))),
    gaps,
    projected,
    generatedAt: new Date().toISOString(),
  };
}

export interface DeadlineCheck {
  /** The learner gave a deadline at all. */
  hasDeadline: boolean;
  /** The plan fits inside it at their current weekly hours. */
  feasible: boolean;
  targetWeeks: number;
  projectedWeeks: number;
  /** Weekly hours that *would* make it fit. */
  requiredHoursPerWeek: number;
  /** Hours to drop from the plan to fit at current pace. */
  excessHours: number;
}

/**
 * Does the generated path actually fit the learner's stated deadline?
 *
 * Worth surfacing loudly: a learner who says "in 6 months" and silently receives
 * a ten-month plan has been failed by the tool, not by themselves.
 */
export function checkDeadline(
  path: LearningPath,
  profile: LearnerProfile,
): DeadlineCheck {
  const targetWeeks = profile.targetWeeks ?? 0;
  const projectedWeeks = path.totalWeeks;

  if (!profile.targetWeeks) {
    return {
      hasDeadline: false,
      feasible: true,
      targetWeeks: 0,
      projectedWeeks,
      requiredHoursPerWeek: profile.hoursPerWeek,
      excessHours: 0,
    };
  }

  const feasible = projectedWeeks <= targetWeeks;
  return {
    hasDeadline: true,
    feasible,
    targetWeeks,
    projectedWeeks,
    requiredHoursPerWeek: Math.ceil(path.totalHours / Math.max(1, targetWeeks)),
    excessHours: Math.max(
      0,
      path.totalHours - targetWeeks * Math.max(1, profile.hoursPerWeek),
    ),
  };
}

/** Flatten a path back into an ordered step list. */
export function pathSteps(path: LearningPath): PathStep[] {
  return path.milestones.flatMap((m) => m.steps);
}

/** The next uncompleted step, or null when the path is finished. */
export function nextStep(path: LearningPath, completed: string[]): PathStep | null {
  const done = new Set(completed);
  return pathSteps(path).find((s) => !done.has(s.resource.id)) ?? null;
}

/** Fraction of the path's *hours* that are complete — fairer than counting steps. */
export function pathProgress(path: LearningPath, completed: string[]): number {
  const done = new Set(completed);
  const steps = pathSteps(path);
  if (steps.length === 0) return 0;
  const total = steps.reduce((sum, s) => sum + s.resource.hours, 0);
  const finished = steps
    .filter((s) => done.has(s.resource.id))
    .reduce((sum, s) => sum + s.resource.hours, 0);
  return total === 0 ? 0 : finished / total;
}

/** Whether every prerequisite step before this one is done. */
export function isStepUnlocked(
  path: LearningPath,
  step: PathStep,
  completed: string[],
): boolean {
  const done = new Set(completed);
  const resource = RESOURCE_BY_ID[step.resource.id];
  if (!resource) return true;

  const priorSteps = pathSteps(path).filter((s) => s.order < step.order);
  for (const skillId of resource.requires) {
    const taughtEarlier = priorSteps.some(
      (s) =>
        s.resource.teaches.some((t) => t.skillId === skillId && t.depth >= 0.4) &&
        !done.has(s.resource.id),
    );
    if (taughtEarlier) return false;
  }
  return true;
}

/** Every resource in the catalog that teaches a given skill, best first. */
export function resourcesTeaching(skillId: string): Resource[] {
  return CATALOG.filter((r) =>
    r.teaches.some((t) => t.skillId === skillId && t.depth >= 0.4),
  ).sort((a, b) => b.rating * b.popularity - a.rating * a.popularity);
}
