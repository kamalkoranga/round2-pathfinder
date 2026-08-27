import { NextResponse } from "next/server";
import { z } from "zod";

import { setCompletion, setFeedback } from "@/lib/repo";
import { ProgressSchema, RatingSchema } from "@/lib/schema";
import { requireUserId } from "@/lib/supabase/server";

export const runtime = "nodejs";

const BodySchema = z.union([
  z.object({ kind: z.literal("completion") }).and(ProgressSchema),
  z.object({ kind: z.literal("rating") }).and(RatingSchema),
]);

/**
 * Incremental progress updates.
 *
 * Completions and ratings are written individually rather than as part of a
 * whole-profile save: they fire on every click, and round-tripping the entire
 * profile for a single checkbox would make it easy to clobber a concurrent edit
 * from another tab.
 */
export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  try {
    if (body.kind === "completion") {
      await setCompletion(auth.userId, body.resourceId, body.done);
    } else {
      await setFeedback(auth.userId, body.resourceId, body.signal, body.reason);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[progress]", error);
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
}
