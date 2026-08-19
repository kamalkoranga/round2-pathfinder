import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { extractIntentLocally } from "../src/lib/ai/fallback";
import { intakeChecklist, isIntakeComplete } from "../src/lib/intake";
import type { ExtractedIntent } from "../src/lib/types";

/**
 * Regression tests for the rule-based intake extractor.
 *
 * This is the path the app falls back to whenever the model provider is
 * unavailable — no key, rate limit, outage — so it is *more* exposed than the
 * model path, not less. Every case below is one that shipped broken.
 */

const run = (...messages: string[]): ExtractedIntent =>
  extractIntentLocally(messages.map((content) => ({ role: "user" as const, content })));

describe("level", () => {
  it("is reported missing when the learner has said nothing about experience", () => {
    const intent = run("I want to be an ML engineer");
    assert.ok(
      intent.missing.includes("level"),
      "level defaults to 'beginner' for the profile, but that is a placeholder, " +
        "not an answer — it must still be reported as missing",
    );
  });

  it("does not claim a level in the reply it has not been told", () => {
    const intent = run("I want to be an ML engineer");
    assert.doesNotMatch(intent.reply, /from beginner level/i);
    assert.match(intent.reply, /starting from|new to this/i);
  });

  it("does not tick the checklist for an unanswered level", () => {
    const level = intakeChecklist(run("I want to be an ML engineer")).find(
      (f) => f.key === "level",
    );
    assert.equal(level?.value, null);
  });

  for (const [text, expected] of [
    ["complete beginner", "beginner"],
    ["I'm a senior engineer", "advanced"],
    ["I have 3 years experience", "intermediate"],
  ] as const) {
    it(`infers ${expected} from "${text}"`, () => {
      const intent = run("ML engineer", text);
      assert.equal(intent.level, expected);
      assert.ok(!intent.missing.includes("level"));
    });
  }

  it("does not read seniority in one domain as progress toward another", () => {
    // Reported: "I'm a backend developer and I want to move into machine
    // learning" ticked Experience level: Intermediate without being asked.
    // Backend seniority says nothing about ML readiness, and level decides how
    // hard the recommended material is.
    const intent = run("I'm a backend developer and I want to move into machine learning");

    assert.equal(intent.roleId, "ml-engineer");
    assert.ok(
      intent.missing.includes("level"),
      "a stated profession must not stand in for an answer about the goal",
    );

    const checklist = intakeChecklist(intent);
    assert.equal(checklist.find((f) => f.key === "level")?.value, null);
    assert.equal(
      checklist.filter((f) => f.value !== null).length,
      1,
      "only the goal should be ticked",
    );
  });

  it("still credits the profession as existing skills", () => {
    // The profession is not thrown away — it is recorded precisely, so the
    // planner does not start them at "Programming Foundations".
    const intent = run("I'm a backend developer and I want to move into machine learning");
    assert.ok(intent.knownSkills.includes("backend"), `got [${intent.knownSkills}]`);
  });
});

describe("hours per week", () => {
  for (const [text, expected] of [
    ["4 hours", 4],
    ["10 hours a week", 10],
    ["2 hours a day", 10],
    ["a couple of hours", 2],
    ["a few hours", 4],
    ["full time", 40],
  ] as const) {
    it(`reads "${text}" as ${expected}`, () => {
      assert.equal(run("ML engineer", "beginner", text).hoursPerWeek, expected);
    });
  }

  it("does not mistake a past duration for weekly capacity", () => {
    assert.equal(run("I spent 3 hours watching tutorials").hoursPerWeek, null);
  });
});

describe("learning style", () => {
  // Bare stems with a trailing \b silently fail on the commonest answers:
  // "reading" is not matched by /\bread\b/.
  for (const [text, expected] of [
    ["reading", "reading"],
    ["docs", "reading"],
    ["I like videos", "video"],
    ["watching lectures", "video"],
    ["building things", "hands-on"],
    ["a mix of everything", "mixed"],
  ] as const) {
    it(`reads "${text}" as ${expected}`, () => {
      assert.equal(run("ML engineer", "beginner", "5 hours a week", text).style, expected);
    });
  }
});

describe("the reported failure", () => {
  it('understands "4 Hours Reading" as both hours and style', () => {
    const intent = run("I want to be an ML engineer", "4 Hours Reading");
    assert.equal(intent.hoursPerWeek, 4);
    assert.equal(intent.style, "reading");
  });
});

describe("gibberish", () => {
  it("matches no role and asks again", () => {
    const intent = run("adfa");
    assert.equal(intent.roleId, null);
    assert.ok(intent.missing.includes("goal"));
    assert.ok(!isIntakeComplete(intent));
  });
});

describe("a complete conversation", () => {
  it("collects all four required answers", () => {
    const intent = run(
      "I'm a backend developer moving into machine learning",
      // The level has to be *stated*. The profession above credits backend
      // skills but says nothing about how far along they are in ML.
      "complete beginner when it comes to ML",
      "about 10 hours a week",
      "I learn best by building things",
    );
    assert.equal(intent.roleId, "ml-engineer");
    assert.equal(intent.level, "beginner");
    assert.equal(intent.hoursPerWeek, 10);
    assert.equal(intent.style, "hands-on");
    assert.deepEqual(intent.missing, []);
    assert.ok(isIntakeComplete(intent));

    // …and the backend experience is still on the record.
    assert.ok(intent.knownSkills.includes("backend"));
  });

  it("is not complete until the level is answered", () => {
    const intent = run(
      "I'm a backend developer moving into machine learning",
      "about 10 hours a week",
      "I learn best by building things",
    );
    assert.deepEqual(intent.missing, ["level"]);
    assert.ok(!isIntakeComplete(intent), "3 of 4 answers must not unlock generation");
  });
});
