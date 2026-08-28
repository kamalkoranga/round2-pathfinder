import { NextResponse } from "next/server";
import { z } from "zod";

import { describeError, getProvider } from "@/lib/ai/client";
import {
  TUTOR_SYSTEM,
  describeGaps,
  describePath,
  describeProfile,
  describeScored,
} from "@/lib/ai/prompts";
import { buildAdaptation } from "@/lib/engine/adapt";
import { computeGaps } from "@/lib/engine/gap";
import { checkDeadline, generatePath } from "@/lib/engine/path";
import { recommend } from "@/lib/engine/recommend";
import { FeedbackListSchema, ProfileSchema } from "@/lib/schema";
import type { LearnerProfile } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const RequestSchema = z.object({
  profile: ProfileSchema,
  feedback: FeedbackListSchema,
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      }),
    )
    .max(30)
    .default([]),
  question: z.string().min(1).max(2000),
});

/** Answer offline by summarising what the engine already knows. */
function localAnswer(profile: LearnerProfile, question: string): string {
  const gaps = computeGaps(profile);
  const path = generatePath(profile);
  const top = gaps.slice(0, 3).map((g) => g.name);

  const lower = question.toLowerCase();

  if (/\bhow long|\bweeks?\b|\btime\b|\bwhen will\b|\bdeadline\b/.test(lower)) {
    const deadline = checkDeadline(path, profile);
    const base = `At ${profile.hoursPerWeek} hours a week, your current path is about ${path.totalHours} hours of work — roughly ${path.totalWeeks} weeks across ${path.milestones.length} milestones.`;
    if (deadline.hasDeadline && !deadline.feasible) {
      return `${base} That overshoots your ${deadline.targetWeeks}-week target: you would need about ${deadline.requiredHoursPerWeek} hours a week to finish on time, or a narrower goal.`;
    }
    if (deadline.hasDeadline) {
      return `${base} That fits inside your ${deadline.targetWeeks}-week target.`;
    }
    return `${base} Raising your weekly hours in the profile recalculates this immediately.`;
  }
  if (/\bwhy\b|\breason\b/.test(lower)) {
    return `Your path is ordered by skill gap priority. Right now the largest gaps are ${top.join(
      ", ",
    )}. Every step is placed after whatever teaches its prerequisites, which is why foundations appear before the applied work.`;
  }
  if (/\bgap|\bweak|\bmissing|\bskill/.test(lower)) {
    return top.length
      ? `Your highest-priority gaps are ${top.join(", ")}. The first milestone, "${
          path.milestones[0]?.title ?? "your opening milestone"
        }", is built specifically to close them.`
      : `You already meet the target profile for this goal — there are no significant gaps left to close.`;
  }
  if (/\bnext\b|\bstart\b|\bfirst\b/.test(lower)) {
    const first = path.milestones[0]?.steps[0];
    return first
      ? `Start with "${first.resource.title}" (${first.resource.provider}, ${first.resource.hours}h). ${first.reason}`
      : `There is nothing queued yet — set a goal on the onboarding screen to generate your path.`;
  }

  return `Here is where you stand: your target is ${path.roleTitle}, your top gaps are ${
    top.join(", ") || "none"
  }, and your path is ${path.totalHours} hours over about ${path.totalWeeks} weeks. Configure an ANTHROPIC_API_KEY to ask open-ended questions and get a full conversational answer.`;
}

export async function POST(request: Request) {
  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const profile = body.profile as LearnerProfile;

  const provider = await getProvider();
  if (!provider) {
    return NextResponse.json({
      answer: localAnswer(profile, body.question),
      source: "engine" as const,
    });
  }

  const adaptation = buildAdaptation(body.feedback);
  const gaps = computeGaps(profile);
  const path = generatePath(profile, adaptation);
  const top = recommend(profile, { adaptation, limit: 8 });

  const context = [
    describeProfile(profile),
    describeGaps(gaps),
    describePath(path),
    describeScored(top),
    adaptation.notes.length
      ? `FEEDBACK ADAPTATIONS IN EFFECT\n${adaptation.notes.map((n) => `- ${n}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    // The system prompt is split so the static instructions stay cacheable on
    // providers that support it; the per-learner context follows.
    const deltas = provider.stream({
      system: `${TUTOR_SYSTEM}\n\n${context}`,
      history: body.history,
      question: body.question,
      maxTokens: 2000,
    });

    // Stream plain text back so the UI can render tokens as they arrive.
    const encoder = new TextEncoder();
    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        let emitted = false;
        try {
          for await (const delta of deltas) {
            emitted = true;
            controller.enqueue(encoder.encode(delta));
          }
        } catch (error) {
          // Provider calls fail once iteration begins, so this — not the outer
          // catch — is where auth/rate-limit errors land. If nothing was
          // streamed yet we can still fall back to a useful local answer.
          console.error("[ask:stream]", error);
          controller.enqueue(
            encoder.encode(
              emitted
                ? `\n\n(${describeError(error)})`
                : `${localAnswer(profile, body.question)}\n\n(${describeError(error)})`,
            ),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Answer-Source": provider.id,
      },
    });
  } catch (error) {
    console.error("[ask]", error);
    return NextResponse.json({
      answer: localAnswer(profile, body.question),
      source: "engine" as const,
      warning: describeError(error),
    });
  }
}
