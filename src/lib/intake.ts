import { ROLE_BY_ID } from "@/lib/data/roles";
import { skillName } from "@/lib/data/skills";
import type { ExtractedIntent, LearnerProfile } from "@/lib/types";

/**
 * What the guided intake must collect before a path can be generated.
 *
 * A path built from a half-answered profile is worse than no path: the planner
 * will happily produce something, but it will be pitched at the wrong level or
 * timed against a week the learner never agreed to. So generation is gated on
 * these four answers rather than firing as soon as a role is guessed.
 */

export type IntakeFieldKey = "goal" | "level" | "hoursPerWeek" | "style";

export interface IntakeField {
  key: IntakeFieldKey;
  label: string;
  /** Human-readable answer, or null when still unknown. */
  value: string | null;
  /** What the assistant should ask if this is still missing. */
  question: string;
}

const STYLE_LABELS: Record<string, string> = {
  video: "Video",
  "hands-on": "Hands-on",
  reading: "Reading",
  interactive: "Interactive",
  mixed: "Mixed",
};

/** Turn the extracted intent into a checklist the UI can render. */
export function intakeChecklist(intent: ExtractedIntent | null): IntakeField[] {
  const goalAnswered =
    Boolean(intent?.roleId) || Boolean(intent?.goal && intent.goal.trim().length > 8);

  return [
    {
      key: "goal",
      label: "Your goal",
      value: !intent
        ? null
        : intent.roleId
          ? (ROLE_BY_ID[intent.roleId]?.title ?? intent.goal)
          : goalAnswered
            ? intent.goal
            : null,
      question: "What do you want to be able to do?",
    },
    {
      key: "level",
      label: "Experience level",
      // The extractor always emits a level, but until the learner has actually
      // said something about their background it is a guess, not an answer.
      value:
        intent && goalAnswered && !intent.missing.includes("level")
          ? capitalise(intent.level)
          : null,
      question: "Roughly where are you starting from?",
    },
    {
      key: "hoursPerWeek",
      label: "Time per week",
      value: intent?.hoursPerWeek ? `${intent.hoursPerWeek}h per week` : null,
      question: "How many hours a week can you realistically give this?",
    },
    {
      key: "style",
      label: "How you learn best",
      value: intent?.style ? (STYLE_LABELS[intent.style] ?? intent.style) : null,
      question:
        "Do you learn best from video, reading, or building things hands-on?",
    },
  ];
}

export function isIntakeComplete(intent: ExtractedIntent | null): boolean {
  if (!intent) return false;
  return intakeChecklist(intent).every((field) => field.value !== null);
}

/** The next thing still worth asking about, or null when done. */
export function nextMissingField(intent: ExtractedIntent | null): IntakeField | null {
  return intakeChecklist(intent).find((field) => field.value === null) ?? null;
}

/** Optional extras — shown as captured, never blocking. */
export function intakeExtras(intent: ExtractedIntent | null): string[] {
  if (!intent) return [];
  const extras: string[] = [];
  if (intent.targetWeeks) extras.push(`${intent.targetWeeks}-week deadline`);
  if (intent.knownSkills.length > 0) {
    const names = intent.knownSkills.slice(0, 3).map(skillName);
    extras.push(
      `already has ${names.join(", ")}${intent.knownSkills.length > 3 ? ` +${intent.knownSkills.length - 3} more` : ""}`,
    );
  }
  if (intent.interests.length > 0) {
    extras.push(`interested in ${intent.interests.slice(0, 2).map(skillName).join(", ")}`);
  }
  return extras;
}

/** Fold a completed intake into a learner profile patch. */
export function intentToProfile(
  intent: ExtractedIntent,
  fallbackGoal: string,
): Partial<LearnerProfile> {
  const baseline =
    intent.level === "advanced" ? 0.75 : intent.level === "intermediate" ? 0.55 : 0.35;

  const skills: Record<string, number> = {};
  for (const skillId of intent.knownSkills) skills[skillId] = baseline;

  return {
    goalText: intent.goal || fallbackGoal,
    roleId: intent.roleId,
    interests: intent.interests,
    level: intent.level,
    skills,
    hoursPerWeek: intent.hoursPerWeek ?? 8,
    style: intent.style ?? "mixed",
    targetWeeks: intent.targetWeeks,
  };
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
