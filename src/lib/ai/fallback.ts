import { ROLE_BY_ID } from "@/lib/data/roles";
import { SKILLS } from "@/lib/data/skills";
import { inferRole } from "@/lib/engine/vectorize";
import type { ExtractedIntent, LearningStyle, Level } from "@/lib/types";

/**
 * Rule-based intent extraction.
 *
 * Used when no ANTHROPIC_API_KEY is configured, so the conversational intake
 * still works end to end in an offline demo. It is intentionally simple: keyword
 * and pattern matching over the same taxonomy Claude is given.
 */

const LEVEL_PATTERNS: [RegExp, Level][] = [
  [/\b(complete beginner|total beginner|no experience|never coded|never programmed|from scratch|brand new|just starting|zero experience)\b/i, "beginner"],
  [/\b(senior|expert|advanced|lead|architect|years of experience|experienced professional)\b/i, "advanced"],
  [/\b(intermediate|some experience|a bit of experience|familiar with|comfortable with|a few years|junior)\b/i, "intermediate"],
  [/\b(beginner|new to|starting out|fresher|student)\b/i, "beginner"],
];

/**
 * "I'm a backend developer", "working as a data analyst", "currently an SDE".
 * A stated profession is strong evidence of existing skill, and the skills named
 * inside the phrase are ones they already hold rather than ones they want.
 */
const PROFESSION_PATTERN =
  /\b(?:i'?m|i am|work(?:s|ing)? as|employed as|currently)\s+(?:an?\s+)?([\w\s+#.-]{2,40}?)\s*(developer|engineer|analyst|scientist|programmer|designer|administrator|architect)\b/gi;

function professionMatches(text: string): { phrase: string; skills: string[] }[] {
  const out: { phrase: string; skills: string[] }[] = [];
  for (const match of text.matchAll(PROFESSION_PATTERN)) {
    const phrase = `${match[1]} ${match[2]}`.trim();
    out.push({ phrase, skills: detectSkills(match[1]) });
  }
  return out;
}

/**
 * Learning-style detection.
 *
 * Every stem allows inflections. A trailing `\b` after a bare stem is a trap:
 * `\bread\b` does not match "reading", which is the single most likely way
 * someone answers "how do you learn best?".
 */
const STYLE_PATTERNS: [RegExp, LearningStyle][] = [
  [/\b(hands.?on|by doing|build\w*|project.based|practical|make things|learn by building)\b/i, "hands-on"],
  [/\b(video\w*|watch\w*|lecture\w*|youtube|visual\w*|course\w*)\b/i, "video"],
  [/\b(read\w*|book\w*|article\w*|documentation|docs|text\w*|written|blog\w*)\b/i, "reading"],
  [/\b(interactive\w*|exercise\w*|quiz\w*|challenge\w*|practice\w*|problem\w*)\b/i, "interactive"],
  [/\b(mix\w*|bit of everything|combination|varied|all of (?:them|the above))\b/i, "mixed"],
];

/** Match free text against skill names — used to seed "already knows". */
function detectSkills(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];

  for (const skill of SKILLS) {
    const name = skill.name.toLowerCase();
    // Match the full skill name, or the first word when it is distinctive.
    const head = name.split(/[\s&]+/)[0];
    const pattern = new RegExp(`\\b${escapeRegex(name)}\\b|\\b${escapeRegex(head)}\\b`, "i");
    if (head.length >= 3 && pattern.test(lower)) found.push(skill.id);
  }
  return Array.from(new Set(found));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Split a message into the part describing what they know vs what they want. */
function knownSkillsFrom(text: string): string[] {
  // Only credit skills mentioned in an "already know" clause or a stated
  // profession, to avoid crediting the thing they are asking to learn.
  const found: string[] = [];

  const knowsClause = text.match(
    /\b(i know|i've used|i have used|familiar with|comfortable with|experienced (?:in|with)|background in|i can|i already|proficient in|worked with|years of)\b([^.!?]*)/gi,
  );
  if (knowsClause) found.push(...detectSkills(knowsClause.join(" ")));

  for (const profession of professionMatches(text)) {
    found.push(...profession.skills);
  }

  return Array.from(new Set(found));
}

function detectHours(text: string): number | null {
  // "10 hours a week", "10 hrs/week", "about 5 hours per week", "15h/wk"
  const perWeek = text.match(
    /(\d{1,2})\s*(?:\+)?\s*(?:hours?|hrs?|h)\s*(?:a|per|each|\/)\s*(?:week|wk)/i,
  );
  if (perWeek) return clampHours(Number(perWeek[1]));

  // Per-day must be checked before the bare form, or "2 hours a day" would be
  // read as two hours a week.
  const perDay = text.match(
    /(\d{1,2})\s*(?:hours?|hrs?|h)\s*(?:a|per|each|\/)\s*day/i,
  );
  if (perDay) return clampHours(Number(perDay[1]) * 5);

  if (/\bfull.?time\b/i.test(text)) return 40;
  if (/\bpart.?time\b/i.test(text)) return 15;
  if (/\bweekends? only\b/i.test(text)) return 8;

  // Bare "4 hours". People answer "how many hours a week?" with just a number
  // and a unit; refusing that makes the assistant ask the same question twice.
  // Guarded against picking up durations that are clearly about something else.
  const bare = text.match(/(?:^|[\s,.:;])(\d{1,2})\s*(?:\+)?\s*(?:hours?|hrs?)\b/i);
  if (bare) {
    const context = text.slice(
      Math.max(0, (bare.index ?? 0) - 24),
      (bare.index ?? 0) + bare[0].length + 24,
    );
    // "…spent 3 hours on it", "3 hours of video" describe content, not capacity.
    if (!/\b(?:spent|took|watched|long|duration|of video|of content)\b/i.test(context)) {
      return clampHours(Number(bare[1]));
    }
  }

  // "a couple of hours", "a few hours a week"
  if (/\b(?:a\s+)?couple\s+of\s+hours?\b/i.test(text)) return 2;
  if (/\b(?:a\s+)?few\s+hours?\b/i.test(text)) return 4;
  return null;
}

function clampHours(value: number): number {
  return Math.min(60, Math.max(1, Math.round(value)));
}

/**
 * A deadline, not a duration of past experience.
 *
 * "in 6 months" is a target; "3 yrs of wordpress" is a CV line. Requiring
 * forward-looking context ("in", "within", "by", "next") keeps the two apart.
 */
function detectWeeks(text: string): number | null {
  const deadline =
    /\b(?:in|within|by|over|next|under|about|around)\s+(?:the\s+next\s+)?(\d{1,2})\s*(months?|weeks?|years?)\b/i;
  const match = text.match(deadline);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const weeks = unit.startsWith("month")
    ? amount * 4
    : unit.startsWith("year")
      ? amount * 52
      : amount;

  return Math.min(104, Math.max(1, weeks));
}

/** Phrases that separate where someone *is* from where they want to *go*. */
const TRANSITION_MARKERS =
  /\b(?:want(?:s)? to|wanna|hoping to|looking to|aiming to|planning to|move into|moving into|transition(?:ing)? (?:in)?to|switch(?:ing)? to|pivot(?:ing)? to|get into|getting into|become|becoming|break into|shift(?:ing)? to|interested in|goal is|so i can)\b/i;

/**
 * Build the query used for role matching.
 *
 * "I'm a backend developer moving into ML" names two roles. Matching the raw
 * text lets the *current* job win on keyword weight, which is exactly backwards.
 * Everything after a transition marker is the aspiration, so weight it heavily
 * and drop the stated profession from consideration.
 */
function aspirationQuery(text: string): string {
  const match = text.match(TRANSITION_MARKERS);
  if (!match || match.index === undefined) return text;

  // Short aspirations are common and meaningful ("…moving into ML"), so only
  // bail when there is genuinely nothing after the marker.
  const aspiration = text.slice(match.index + match[0].length).trim();
  if (aspiration.length === 0) return text;

  let past = text.slice(0, match.index);
  // Remove the current profession so it stops competing with the goal.
  for (const { phrase } of professionMatches(past)) {
    past = past.replace(new RegExp(escapeRegex(phrase), "gi"), " ");
  }

  // Repeat the aspiration so it dominates whatever context remains.
  return `${aspiration} ${aspiration} ${aspiration} ${past}`;
}

/** Extract everything we can from the whole conversation so far. */
export function extractIntentLocally(
  transcript: { role: "user" | "assistant"; content: string }[],
): ExtractedIntent {
  const userText = transcript
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n");

  const goal = transcript.find((m) => m.role === "user")?.content.trim() ?? "";
  const roleId = inferRole(aspirationQuery(userText));

  // `level` always carries a value because the profile needs one, but we track
  // separately whether the learner actually gave us evidence for it. Without
  // that distinction the default ("beginner") is indistinguishable from a real
  // answer, and the intake checklist ticks a question nobody was asked.
  let level: Level = "beginner";
  let levelKnown = false;

  for (const [pattern, value] of LEVEL_PATTERNS) {
    if (pattern.test(userText)) {
      level = value;
      levelKnown = true;
      break;
    }
  }

  // Stated years of experience are direct evidence of how far along they are.
  //
  // A stated profession deliberately is NOT. "I'm a backend developer moving
  // into ML" makes them an experienced backend developer and, most likely, a
  // beginner at ML — seniority in one domain is not progress toward another,
  // and level decides how hard the recommended material is. The profession
  // still earns them credit through knownSkills below, which is the precise
  // way to say "they are not starting from zero" without overstating it.
  if (!levelKnown) {
    const years = userText.match(/\b(\d{1,2})\s*(?:\+)?\s*(?:years?|yrs?)\b/i);
    const experienceYears = years ? Number(years[1]) : 0;

    if (experienceYears >= 5) {
      level = "advanced";
      levelKnown = true;
    } else if (experienceYears >= 2) {
      level = "intermediate";
      levelKnown = true;
    }
  }

  let style: LearningStyle | null = null;
  for (const [pattern, value] of STYLE_PATTERNS) {
    if (pattern.test(userText)) {
      style = value;
      break;
    }
  }

  const knownSkills = knownSkillsFrom(userText);
  const hoursPerWeek = detectHours(userText);
  const targetWeeks = detectWeeks(userText);

  // Interests: skills mentioned anywhere that aren't claimed as already known.
  const interests = detectSkills(userText).filter((s) => !knownSkills.includes(s));

  const missing: string[] = [];
  if (!roleId) missing.push("goal");
  if (!levelKnown) missing.push("level");
  if (hoursPerWeek === null) missing.push("hoursPerWeek");
  if (!style) missing.push("style");

  return {
    goal,
    roleId,
    interests: interests.slice(0, 8),
    level,
    knownSkills,
    hoursPerWeek,
    style,
    targetWeeks,
    missing,
    reply: buildLocalReply(roleId, level, hoursPerWeek, style, missing),
  };
}

function buildLocalReply(
  roleId: string | null,
  level: Level,
  hoursPerWeek: number | null,
  style: LearningStyle | null,
  missing: string[],
): string {
  const role = roleId ? ROLE_BY_ID[roleId] : null;

  if (!role) {
    return "I want to make sure I point you in the right direction. Which of these is closest to what you're aiming for — a data, machine learning, web development, cloud, security or product track? A sentence about what you'd like to be able to build is plenty.";
  }

  const article = /^[aeiou]/i.test(role.title) ? "an" : "a";
  const levelNote = missing.includes("level") ? "" : `, starting from ${level} level`;
  const opening = `Got it — that maps well onto ${article} ${role.title} track${levelNote}.`;

  // Ask for one thing at a time, in the order the checklist shows them. Asking
  // for two at once is how the previous version ended up repeating itself when
  // only half the answer was understood.
  if (missing.includes("level")) {
    return `${opening} Where would you say you're starting from — completely new to this, some experience already, or well into it?`;
  }
  if (missing.includes("hoursPerWeek")) {
    return `${opening} Roughly how many hours a week can you realistically put in? That's what decides whether this is a six-week plan or a six-month one.`;
  }
  if (missing.includes("style")) {
    return `${opening} Last thing — do you learn best from video courses, reading, or building projects hands-on?`;
  }

  const pace = hoursPerWeek ? ` at ${hoursPerWeek} hours a week` : "";
  const styleNote = style ? `, weighted toward ${style} material` : "";
  return `${opening} I've got what I need${pace}${styleNote}. Building your path now.`;
}
