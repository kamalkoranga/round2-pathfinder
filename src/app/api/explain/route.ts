import { NextResponse } from "next/server";
import { z } from "zod";

import { describeError, getProvider } from "@/lib/ai/client";
import { EXPLAIN_SYSTEM, describeOneResource } from "@/lib/ai/prompts";
import { buildAdaptation } from "@/lib/engine/adapt";
import { scoreOne } from "@/lib/engine/recommend";
import { FeedbackListSchema, ProfileSchema } from "@/lib/schema";
import type { LearnerProfile } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const RequestSchema = z.object({
  profile: ProfileSchema,
  resourceId: z.string().max(60),
  feedback: FeedbackListSchema,
});

export async function POST(request: Request) {
  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const profile = body.profile as LearnerProfile;
  const adaptation = buildAdaptation(body.feedback);
  const scored = scoreOne(profile, body.resourceId, adaptation);

  if (!scored) {
    return NextResponse.json({ error: "Unknown resource." }, { status: 404 });
  }

  // Without a key, the engine's own deterministic rationale is the explanation.
  const provider = await getProvider();
  if (!provider) {
    return NextResponse.json({ explanation: scored.reason, source: "engine" as const });
  }

  try {
    const text = await provider.complete({
      system: EXPLAIN_SYSTEM,
      prompt: `${describeOneResource(scored, profile)}

Explain to the learner why this was recommended.`,
      maxTokens: 2000,
    });

    return NextResponse.json({
      explanation: text || scored.reason,
      source: text ? provider.id : ("engine" as const),
    });
  } catch (error) {
    console.error("[explain]", error);
    return NextResponse.json({
      explanation: scored.reason,
      source: "engine" as const,
      warning: describeError(error),
    });
  }
}
