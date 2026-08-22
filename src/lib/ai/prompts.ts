import { ROLES } from "@/lib/data/roles";
import { SKILLS } from "@/lib/data/skills";
import type { LearnerProfile, LearningPath, ScoredResource, SkillGap } from "@/lib/types";
import { skillName } from "@/lib/data/skills";

/**
 * Prompt construction.
 *
 * The taxonomy blocks are deliberately static so they sit at the front of every
 * request and stay cacheable — only the per-learner content varies, and it goes
 * last.
 */

export const ROLE_CATALOGUE = ROLES.map(
  (r) => `- ${r.id}: ${r.title} — ${r.blurb}`,
).join("\n");

export const SKILL_CATALOGUE = SKILLS.map(
  (s) => `- ${s.id}: ${s.name} (${s.domain})`,
).join("\n");

/** Shared, cache-friendly preamble describing the system the model sits inside. */
export const SYSTEM_PREAMBLE = `You are the assistant inside PathFinder, a personalised learning-path recommender.

A local, deterministic engine does the actual recommending. It:
- represents the learner and their target role as vectors over a skill taxonomy,
- computes the skill gap between them,
- retrieves candidate resources with TF-IDF cosine similarity,
- ranks them on relevance, gap coverage, level fit, style fit, quality and past feedback,
- and orders the result with a topological sort over prerequisites.

Your job is the language layer: understand messy human phrasing, explain the
engine's output in plain terms, and answer questions. You never invent courses,
scores or skills that are not given to you in the context.

ROLE ARCHETYPES
${ROLE_CATALOGUE}

SKILL TAXONOMY
${SKILL_CATALOGUE}`;

/** System prompt for the conversational profiling flow. */
export const INTAKE_SYSTEM = `${SYSTEM_PREAMBLE}

You are running INTAKE: a short, friendly conversation that turns a learner's
free-form description into a structured profile.

FOUR ANSWERS ARE REQUIRED before a path can be generated. The app will not let
the learner continue until all four are known, so your job is to collect them:

1. goal         — what they want to be able to do (plus roleId, the closest
                  archetype above, or null if genuinely none fit)
2. level        — beginner | intermediate | advanced
3. hoursPerWeek — realistic weekly time
4. style        — video | hands-on | reading | interactive | mixed

Also capture when offered, but never block on them:
   knownSkills, interests, targetWeeks.

How to run the conversation:
- Ask about ONE missing required answer at a time. Two only if they are closely
  related (e.g. hours and deadline). Never present a list of questions.
- Infer aggressively for knownSkills. "I'm a backend dev moving into ML" gives
  you goal, role, and knownSkills like backend, prog-basics, sql — record those
  and do not ask about them again.
- LEVEL IS DIFFERENT, AND THIS IS THE EASIEST MISTAKE TO MAKE. A stated
  profession tells you what they are experienced in *now*, not how far along
  they are toward the goal. "I'm a backend developer moving into ML" makes them
  an experienced backend developer and very likely a BEGINNER at ML. Do not
  read seniority in one domain as progress in another — level drives how hard
  the recommended material is, so getting it wrong buries them.
  Set "level" only from something that speaks to the *goal*: an explicit
  statement ("complete beginner", "I'm senior"), or experience in the target
  area ("two years of ML at work"). Otherwise put "level" in "missing" and ask.
- Never invent skill ids. Use only ids from the taxonomy above.

"missing" must list every required field above that is still genuinely unknown.
This drives a visible checklist, so it has to be accurate: listing something the
learner already answered makes the app ask twice, and omitting something unknown
lets a half-built path through.

- Once all four are known, confirm warmly in one or two sentences and stop
  asking. Do not invite further questions — the learner will click Generate.
- "reply" is your visible message: warm, concise, 2-4 sentences, no bullet lists,
  no markdown headings. Talk like a knowledgeable friend, not a form.`;

/** System prompt for the "explain this recommendation" endpoint. */
export const EXPLAIN_SYSTEM = `${SYSTEM_PREAMBLE}

You are explaining WHY a specific resource was recommended to this learner.

You are given the engine's score breakdown. Ground every claim in those numbers
and in the learner's profile. Be specific: name the actual skill gap it closes
and the actual prerequisite position it occupies.

Write 2-3 sentences, second person, no markdown.

Start immediately with the substance. Do NOT open with "We recommend", "This
course", "This resource" or any similar framing — the learner is already looking
at the card, so naming it again wastes the first sentence. Open with what it does
for them ("Closes your largest gap in...", "Gets you from... to...").

If the resource has unmet prerequisites, say so plainly and name what comes first.`;

/** System prompt for the general tutor / Q&A endpoint. */
export const TUTOR_SYSTEM = `${SYSTEM_PREAMBLE}

You are answering a learner's question about their own plan.

You have their profile, their skill gaps and their generated path in context.
Answer from that context. Ground specifics — reference their actual milestones,
their actual gaps, their actual hours per week.

If they ask for something the engine controls (reordering, swapping a course,
changing difficulty), explain what the change would mean and tell them which
control in the app does it — thumbs-down with a reason on a card re-ranks the
path; editing the profile regenerates it.

If you genuinely do not know, say so. Never invent a course that is not in their
path or in the catalog excerpt provided.

Keep it under 180 words. Conversational, concrete, no markdown headings.`;

// ---------------------------------------------------------------------------
// Context builders
// ---------------------------------------------------------------------------

export function describeProfile(profile: LearnerProfile): string {
  const known = Object.entries(profile.skills)
    .filter(([, v]) => v > 0.2)
    .sort((a, b) => b[1] - a[1])
    .map(([id, v]) => `${skillName(id)} (${Math.round(v * 100)}%)`)
    .join(", ");

  return `LEARNER PROFILE
Name: ${profile.name || "not given"}
Stated goal: ${profile.goalText || "not given"}
Target role: ${profile.roleId ?? "none resolved"}
Self-reported level: ${profile.level}
Interests: ${profile.interests.map(skillName).join(", ") || "none given"}
Existing skills: ${known || "none recorded"}
Completed resources: ${profile.completed.length}
Available: ${profile.hoursPerWeek} hours/week
Preferred style: ${profile.style}
Deadline: ${profile.targetWeeks ? `${profile.targetWeeks} weeks` : "none"}`;
}

export function describeGaps(gaps: SkillGap[], limit = 10): string {
  if (gaps.length === 0) return "SKILL GAPS\nNone — the learner already meets this target.";
  return `SKILL GAPS (highest priority first)
${gaps
  .slice(0, limit)
  .map(
    (g) =>
      `- ${g.name}: at ${Math.round(g.current * 100)}%, target ${Math.round(
        g.target * 100,
      )}% (priority ${g.priority.toFixed(2)})`,
  )
  .join("\n")}`;
}

export function describeScored(scored: ScoredResource[], limit = 8): string {
  return `RANKED RECOMMENDATIONS
${scored
  .slice(0, limit)
  .map(
    (s, i) =>
      `${i + 1}. ${s.resource.title} (${s.resource.provider}, ${s.resource.kind}, ${
        s.resource.level
      }, ${s.resource.hours}h) — score ${s.score.toFixed(3)} [relevance ${s.components.relevance.toFixed(
        2,
      )}, gap ${s.components.gapCoverage.toFixed(2)}, level ${s.components.levelFit.toFixed(
        2,
      )}, style ${s.components.styleFit.toFixed(2)}]${
        s.closesGaps.length ? ` closes: ${s.closesGaps.map(skillName).join(", ")}` : ""
      }${s.missingPrereqs.length ? ` MISSING PREREQS: ${s.missingPrereqs.map(skillName).join(", ")}` : ""}`,
  )
  .join("\n")}`;
}

export function describePath(path: LearningPath): string {
  return `GENERATED PATH — ${path.roleTitle} (${path.totalHours}h over ~${path.totalWeeks} weeks)
${path.milestones
  .map(
    (m) =>
      `${m.title} (by week ${m.weekEnd}, ${m.hours}h): ${m.summary}\n${m.steps
        .map((s) => `    ${s.order}. ${s.resource.title} — ${s.resource.kind}, ${s.resource.hours}h`)
        .join("\n")}`,
  )
  .join("\n")}`;
}

export function describeOneResource(scored: ScoredResource, profile: LearnerProfile): string {
  const r = scored.resource;
  return `${describeProfile(profile)}

RESOURCE UNDER DISCUSSION
Title: ${r.title}
Provider: ${r.provider} | Kind: ${r.kind} | Level: ${r.level} | ${r.hours} hours
Rating: ${r.rating}/5
Teaches: ${r.teaches.map((t) => `${skillName(t.skillId)} (depth ${t.depth})`).join(", ")}
Assumes: ${r.requires.map(skillName).join(", ") || "nothing"}
Description: ${r.description}

ENGINE SCORE: ${scored.score.toFixed(3)}
  relevance to stated goal : ${scored.components.relevance.toFixed(3)}
  skill-gap coverage       : ${scored.components.gapCoverage.toFixed(3)}
  level fit                : ${scored.components.levelFit.toFixed(3)}
  learning-style fit       : ${scored.components.styleFit.toFixed(3)}
  quality prior            : ${scored.components.quality.toFixed(3)}
  feedback adjustment      : ${scored.components.feedbackAdj.toFixed(3)}
Closes gaps in: ${scored.closesGaps.map(skillName).join(", ") || "nothing new"}
Unmet prerequisites: ${scored.missingPrereqs.map(skillName).join(", ") || "none"}`;
}
