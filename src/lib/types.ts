// ---------------------------------------------------------------------------
// Core domain types for PathFinder.
// ---------------------------------------------------------------------------

export type Level = "beginner" | "intermediate" | "advanced";

export const LEVEL_RANK: Record<Level, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

export type ResourceKind = "course" | "project" | "assessment" | "reading";

export type LearningStyle =
  | "video"
  | "hands-on"
  | "reading"
  | "interactive"
  | "mixed";

export type Pace = "relaxed" | "steady" | "intensive";

/** A single skill in the taxonomy. */
export interface Skill {
  id: string;
  name: string;
  domain: string;
  /** Skills that are conventionally learned before this one. */
  parents?: string[];
}

/** A learnable resource: course, project, assessment or reading. */
export interface Resource {
  id: string;
  title: string;
  provider: string;
  kind: ResourceKind;
  level: Level;
  hours: number;
  rating: number;
  /** 0–1 popularity signal, used as a mild prior in ranking. */
  popularity: number;
  domain: string;
  /** Skills this resource teaches, with 0–1 coverage depth. */
  teaches: { skillId: string; depth: number }[];
  /** Skill ids assumed known before starting. */
  requires: string[];
  /** Free-text used by the lexical retrieval model. */
  description: string;
  tags: string[];
  /** Which learning styles this resource suits. */
  styles: LearningStyle[];
  url?: string;
}

/** A career/goal archetype with its target skill profile. */
export interface RoleTarget {
  id: string;
  title: string;
  domain: string;
  blurb: string;
  /** Target mastery per skill, 0–1. */
  targets: { skillId: string; weight: number }[];
  keywords: string[];
}

/** Everything we know about the learner. */
export interface LearnerProfile {
  name: string;
  /** Raw natural-language goal, as the learner phrased it. */
  goalText: string;
  /** Resolved role target id, if one matched. */
  roleId: string | null;
  interests: string[];
  /** Self-reported or inferred overall level. */
  level: Level;
  /** Per-skill self-assessed mastery, 0–1. */
  skills: Record<string, number>;
  /** Resource ids the learner has already completed. */
  completed: string[];
  hoursPerWeek: number;
  style: LearningStyle;
  pace: Pace;
  /** Optional deadline in weeks. */
  targetWeeks: number | null;
  createdAt: string;
}

/** Per-resource feedback used by the adaptive re-ranker. */
export interface Feedback {
  resourceId: string;
  signal: "up" | "down";
  /** Reason tag, e.g. "too-easy", "too-hard", "not-relevant". */
  reason?: string;
  at: string;
}

/** A scored recommendation with a full, inspectable breakdown. */
export interface ScoredResource {
  resource: Resource;
  score: number;
  components: {
    /** Lexical/semantic match against the goal text. */
    relevance: number;
    /** How much of the learner's skill gap this closes. */
    gapCoverage: number;
    /** How well the difficulty matches current level. */
    levelFit: number;
    /** Learning-style and pace alignment. */
    styleFit: number;
    /** Quality prior from rating + popularity. */
    quality: number;
    /** Adjustment learned from thumbs up/down feedback. */
    feedbackAdj: number;
  };
  /** Skills this closes a meaningful gap in. */
  closesGaps: string[];
  /** Prerequisite skills the learner is still missing. */
  missingPrereqs: string[];
  /** Deterministic, human-readable rationale. */
  reason: string;
}

/** One step inside a milestone. */
export interface PathStep {
  resource: Resource;
  /** 1-indexed position in the whole path. */
  order: number;
  closesGaps: string[];
  reason: string;
  score: number;
}

/** A themed stage of the roadmap. */
export interface Milestone {
  id: string;
  title: string;
  summary: string;
  /** Skills this milestone is designed to unlock. */
  skills: string[];
  steps: PathStep[];
  hours: number;
  /** Cumulative week the milestone is projected to end on. */
  weekEnd: number;
}

export interface LearningPath {
  goal: string;
  roleId: string | null;
  roleTitle: string;
  milestones: Milestone[];
  totalHours: number;
  totalWeeks: number;
  /** Skill gaps at the moment the path was generated. */
  gaps: SkillGap[];
  /** Projected mastery per skill after completing the path. */
  projected: Record<string, number>;
  generatedAt: string;
}

export interface SkillGap {
  skillId: string;
  name: string;
  domain: string;
  current: number;
  target: number;
  gap: number;
  /** Ranked importance of closing this gap. */
  priority: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  at: string;
}

/** Structured profile fields extracted from free-form conversation. */
export interface ExtractedIntent {
  goal: string;
  roleId: string | null;
  interests: string[];
  level: Level;
  knownSkills: string[];
  hoursPerWeek: number | null;
  style: LearningStyle | null;
  targetWeeks: number | null;
  /** What the extractor still needs to ask about. */
  missing: string[];
  reply: string;
}
