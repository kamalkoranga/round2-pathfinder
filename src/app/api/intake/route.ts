import { NextResponse } from "next/server";
import { z } from "zod";

import { describeError, getProvider } from "@/lib/ai/client";
import { INTAKE_SYSTEM } from "@/lib/ai/prompts";
import { extractIntentLocally } from "@/lib/ai/fallback";
import { ROLE_BY_ID } from "@/lib/data/roles";
import { SKILL_BY_ID } from "@/lib/data/skills";
import type { ExtractedIntent } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const RequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      }),
    )
    .min(1)
    .max(40),
});

/** What we ask the model to return. Mirrors ExtractedIntent. */
const IntentSchema = z.object({
  goal: z.string().describe("The learner's goal, in their own words, one sentence"),
  roleId: z
    .string()
    .nullable()
    .describe("Closest role archetype id from the catalogue, or null"),
  interests: z.array(z.string()).describe("Skill ids the learner wants to develop"),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  knownSkills: z
    .array(z.string())
    .describe("Skill ids the learner already has grounding in"),
  hoursPerWeek: z.number().nullable(),
  style: z.enum(["video", "hands-on", "reading", "interactive", "mixed"]).nullable(),
  targetWeeks: z.number().nullable(),
  missing: z.array(z.string()).describe("Fields still unknown and worth asking about"),
  reply: z.string().describe("The visible message to the learner"),
});

/**
 * Hand-written JSON Schema for providers that take raw JSON Schema (Gemini).
 *
 * Deliberately not derived from the Zod schema: Gemini supports only a subset of
 * JSON Schema, and in particular expresses "nullable" as `anyOf` rather than the
 * `type: [..., "null"]` union that `z.toJSONSchema` emits. Keeping this explicit
 * makes exactly what the model sees reviewable.
 */
const nullable = (type: string) => ({ anyOf: [{ type }, { type: "null" }] });

const INTENT_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    goal: { type: "string", description: "The learner's goal, one sentence" },
    roleId: {
      ...nullable("string"),
      description: "Closest role archetype id from the catalogue, or null",
    },
    interests: {
      type: "array",
      items: { type: "string" },
      description: "Skill ids the learner wants to develop",
    },
    level: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
    knownSkills: {
      type: "array",
      items: { type: "string" },
      description: "Skill ids the learner already has grounding in",
    },
    hoursPerWeek: nullable("number"),
    style: {
      anyOf: [
        { type: "string", enum: ["video", "hands-on", "reading", "interactive", "mixed"] },
        { type: "null" },
      ],
    },
    targetWeeks: nullable("number"),
    missing: {
      type: "array",
      items: { type: "string" },
      description: "Fields still unknown and worth asking about",
    },
    reply: { type: "string", description: "The visible message to the learner" },
  },
  required: [
    "goal",
    "roleId",
    "interests",
    "level",
    "knownSkills",
    "hoursPerWeek",
    "style",
    "targetWeeks",
    "missing",
    "reply",
  ],
  propertyOrdering: [
    "goal",
    "roleId",
    "interests",
    "level",
    "knownSkills",
    "hoursPerWeek",
    "style",
    "targetWeeks",
    "missing",
    "reply",
  ],
};

/** Drop any ids the model produced that are not in our taxonomy. */
function sanitize(intent: ExtractedIntent): ExtractedIntent {
  return {
    ...intent,
    roleId: intent.roleId && ROLE_BY_ID[intent.roleId] ? intent.roleId : null,
    interests: intent.interests.filter((id) => SKILL_BY_ID[id]).slice(0, 10),
    knownSkills: intent.knownSkills.filter((id) => SKILL_BY_ID[id]).slice(0, 20),
    hoursPerWeek:
      intent.hoursPerWeek === null
        ? null
        : Math.min(60, Math.max(1, Math.round(intent.hoursPerWeek))),
    targetWeeks:
      intent.targetWeeks === null
        ? null
        : Math.min(104, Math.max(1, Math.round(intent.targetWeeks))),
  };
}

export async function POST(request: Request) {
  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const provider = await getProvider();

  // No key configured — use the local extractor so the flow still works.
  if (!provider) {
    return NextResponse.json({
      intent: extractIntentLocally(body.messages),
      source: "local" as const,
    });
  }

  try {
    const raw = await provider.extract({
      system: INTAKE_SYSTEM,
      messages: body.messages,
      schema: IntentSchema,
      jsonSchema: INTENT_JSON_SCHEMA,
      schemaName: "learner_intent",
    });

    // Validate whatever came back — never trust the model's shape.
    const parsed = IntentSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({
        intent: extractIntentLocally(body.messages),
        source: "local" as const,
      });
    }

    return NextResponse.json({
      intent: sanitize(parsed.data as ExtractedIntent),
      source: provider.id,
    });
  } catch (error) {
    console.error("[intake]", error);
    // Never hard-fail the intake flow — fall back rather than block the learner.
    return NextResponse.json({
      intent: extractIntentLocally(body.messages),
      source: "local" as const,
      warning: describeError(error),
    });
  }
}
