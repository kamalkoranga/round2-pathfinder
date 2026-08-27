import { NextResponse } from "next/server";

import { activeProviderId, providerLabel } from "@/lib/ai/client";
import { DEFAULT_ANTHROPIC_MODEL } from "@/lib/ai/providers/anthropic";
import { DEFAULT_GEMINI_MODEL } from "@/lib/ai/providers/gemini";
import { CATALOG } from "@/lib/data/catalog";
import { ROLES } from "@/lib/data/roles";
import { SKILLS } from "@/lib/data/skills";

export const runtime = "nodejs";

/** Lets the UI show honestly which model layer, if any, is live. */
export async function GET() {
  const provider = activeProviderId();

  const model =
    provider === "gemini"
      ? process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL
      : provider === "anthropic"
        ? process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL
        : null;

  return NextResponse.json({
    aiEnabled: provider !== null,
    provider,
    providerLabel: providerLabel(provider),
    model,
    catalogSize: CATALOG.length,
    skillCount: SKILLS.length,
    roleCount: ROLES.length,
  });
}
