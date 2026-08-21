import { RESOURCE_BY_ID } from "@/lib/data/catalog";
import { ROLE_BY_ID } from "@/lib/data/roles";
import { SKILL_BY_ID, prerequisiteChain } from "@/lib/data/skills";
import { LEVEL_RANK, type LearnerProfile, type SkillGap } from "@/lib/types";

/**
 * Skill-gap analysis.
 *
 * The learner and the target role are both represented as vectors over the skill
 * taxonomy. The gap is the positive difference between them, weighted by how
 * central each skill is to the role. Prerequisite skills inherit priority from
 * their dependants, so foundations surface ahead of the flashy end goal.
 */

/**
 * Build the learner's mastery vector.
 *
 * Three signals are fused:
 *  1. explicit self-assessment (`profile.skills`)
 *  2. credit from completed resources, scaled by how deeply they teach a skill
 *  3. a floor implied by the learner's declared overall level
 */
export function buildLearnerVector(profile: LearnerProfile): Record<string, number> {
  const vector: Record<string, number> = { ...profile.skills };

  // (2) Completion credit. A completed course grants its teaching depth,
  // discounted slightly — finishing a course is not the same as mastery.
  for (const resourceId of profile.completed) {
    const resource = RESOURCE_BY_ID[resourceId];
    if (!resource) continue;
    for (const { skillId, depth } of resource.teaches) {
      const credit = depth * 0.85;
      vector[skillId] = Math.max(vector[skillId] ?? 0, credit);
    }
    // Finishing a resource implies its prerequisites were held.
    for (const skillId of resource.requires) {
      vector[skillId] = Math.max(vector[skillId] ?? 0, 0.55);
    }
  }

  // (3) Level floor: an "advanced" learner is assumed to hold foundations even
  // if they never explicitly listed them.
  const floor = { beginner: 0, intermediate: 0.2, advanced: 0.35 }[profile.level];
  if (floor > 0) {
    for (const skillId of Object.keys(vector)) {
      // Propagate a floor down the prerequisite chain of anything they claim.
      for (const parent of prerequisiteChain(skillId)) {
        vector[parent] = Math.max(vector[parent] ?? 0, floor);
      }
    }
  }

  // Clamp.
  for (const key of Object.keys(vector)) {
    vector[key] = Math.min(1, Math.max(0, vector[key]));
  }
  return vector;
}

/** The target mastery vector for the learner's goal. */
export function buildTargetVector(profile: LearnerProfile): Record<string, number> {
  const target: Record<string, number> = {};
  const role = profile.roleId ? ROLE_BY_ID[profile.roleId] : null;

  if (role) {
    for (const { skillId, weight } of role.targets) {
      target[skillId] = weight;
    }
    // Anything the role needs implicitly needs its prerequisites, at a level
    // proportional to the dependant's importance.
    for (const { skillId, weight } of role.targets) {
      for (const parent of prerequisiteChain(skillId)) {
        target[parent] = Math.max(target[parent] ?? 0, weight * 0.7);
      }
    }
  }

  // Interests the learner named that the role does not cover still get a target,
  // so a "data analyst who also wants some ML" gets both.
  for (const interest of profile.interests) {
    if (SKILL_BY_ID[interest]) {
      target[interest] = Math.max(target[interest] ?? 0, 0.6);
      for (const parent of prerequisiteChain(interest)) {
        target[parent] = Math.max(target[parent] ?? 0, 0.45);
      }
    }
  }

  return target;
}

/**
 * Compute the ranked skill gap.
 *
 * `priority` blends gap magnitude with the skill's weight in the target and a
 * "foundation bonus" — how many other needed skills depend on it. That last term
 * is what stops the planner recommending Transformers to someone who cannot yet
 * write a for-loop.
 */
export function computeGaps(profile: LearnerProfile): SkillGap[] {
  const current = buildLearnerVector(profile);
  const target = buildTargetVector(profile);

  // How many other target skills depend on each skill.
  const dependants = new Map<string, number>();
  for (const skillId of Object.keys(target)) {
    for (const parent of prerequisiteChain(skillId)) {
      dependants.set(parent, (dependants.get(parent) ?? 0) + 1);
    }
  }
  const maxDependants = Math.max(1, ...dependants.values());

  const gaps: SkillGap[] = [];
  for (const [skillId, targetLevel] of Object.entries(target)) {
    const currentLevel = current[skillId] ?? 0;
    const gap = targetLevel - currentLevel;
    if (gap <= 0.05) continue; // effectively closed

    const foundationBonus = (dependants.get(skillId) ?? 0) / maxDependants;
    const skill = SKILL_BY_ID[skillId];

    gaps.push({
      skillId,
      name: skill?.name ?? skillId,
      domain: skill?.domain ?? "General",
      current: currentLevel,
      target: targetLevel,
      gap,
      priority: gap * 0.5 + targetLevel * 0.3 + foundationBonus * 0.2,
    });
  }

  return gaps.sort((a, b) => b.priority - a.priority);
}

/** Overall readiness for the goal, 0–1 — the dashboard's headline number. */
export function computeReadiness(profile: LearnerProfile): number {
  const current = buildLearnerVector(profile);
  const target = buildTargetVector(profile);
  const entries = Object.entries(target);
  if (entries.length === 0) return 0;

  let achieved = 0;
  let possible = 0;
  for (const [skillId, targetLevel] of entries) {
    achieved += Math.min(current[skillId] ?? 0, targetLevel) * targetLevel;
    possible += targetLevel * targetLevel;
  }
  return possible === 0 ? 0 : achieved / possible;
}

/**
 * Whether a resource is currently *reachable* — i.e. the learner meets enough of
 * its prerequisites to start without drowning. Returns the missing skills.
 */
export function missingPrerequisites(
  resourceId: string,
  current: Record<string, number>,
): string[] {
  const resource = RESOURCE_BY_ID[resourceId];
  if (!resource) return [];
  return resource.requires.filter((skillId) => (current[skillId] ?? 0) < 0.4);
}

/** How well a resource's difficulty matches the learner, 0–1. */
export function levelFit(resourceLevel: keyof typeof LEVEL_RANK, learnerLevel: keyof typeof LEVEL_RANK): number {
  const delta = LEVEL_RANK[resourceLevel] - LEVEL_RANK[learnerLevel];
  // One step above the learner is the sweet spot for growth.
  if (delta === 0) return 1;
  if (delta === 1) return 0.9;
  if (delta === -1) return 0.55;
  if (delta === 2) return 0.35;
  return 0.2;
}
