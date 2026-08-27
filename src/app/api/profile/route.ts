import { NextResponse } from "next/server";

import { LearnerProfileSchema, ChatMessagesSchema } from "@/lib/schema";
import { loadProfile, saveProfile } from "@/lib/repo";
import { requireUserId } from "@/lib/supabase/server";
import { z } from "zod";

export const runtime = "nodejs";

/** The signed-in learner's stored profile, feedback and intake state. */
export async function GET() {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  try {
    const stored = await loadProfile(auth.userId);
    return NextResponse.json(stored);
  } catch (error) {
    console.error("[profile:get]", error);
    return NextResponse.json({ error: "Could not load profile." }, { status: 500 });
  }
}

const PutSchema = z.object({
  profile: LearnerProfileSchema,
  intakeComplete: z.boolean().optional(),
  transcript: ChatMessagesSchema.optional(),
});

/** Replace the signed-in learner's profile. */
export async function PUT(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  let body: z.infer<typeof PutSchema>;
  try {
    body = PutSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid profile payload." }, { status: 400 });
  }

  try {
    await saveProfile(auth.userId, body.profile, {
      intakeComplete: body.intakeComplete,
      transcript: body.transcript,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[profile:put]", error);
    return NextResponse.json({ error: "Could not save profile." }, { status: 500 });
  }
}
