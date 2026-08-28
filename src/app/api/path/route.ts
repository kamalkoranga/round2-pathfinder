import { NextResponse } from "next/server";

import { generateAndSavePath, listPaths, loadActivePath } from "@/lib/repo";
import { requireUserId } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

/** The learner's active saved path, plus their path history. */
export async function GET() {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  try {
    const [path, history] = await Promise.all([
      loadActivePath(auth.userId),
      listPaths(auth.userId),
    ]);
    return NextResponse.json({ path, history });
  } catch (error) {
    console.error("[path:get]", error);
    return NextResponse.json({ error: "Could not load your path." }, { status: 500 });
  }
}

/**
 * Generate a new path from the stored profile and save it as a snapshot,
 * archiving whatever came before.
 *
 * Generation runs server-side from the *persisted* profile rather than from a
 * client-supplied one, so a saved path always corresponds to data we actually
 * hold — the snapshot and the profile can never disagree about what was asked.
 */
export async function POST() {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  try {
    const path = await generateAndSavePath(auth.userId);
    return NextResponse.json({ path });
  } catch (error) {
    console.error("[path:post]", error);
    return NextResponse.json({ error: "Could not generate your path." }, { status: 500 });
  }
}
