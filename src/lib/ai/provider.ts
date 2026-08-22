/**
 * Model-provider abstraction.
 *
 * PathFinder's recommendation engine is entirely local; the model is only ever
 * the language layer on top of it. That makes the provider genuinely swappable,
 * so rather than hard-wiring one vendor we define the three things the app
 * actually needs and let either Claude or Gemini supply them.
 *
 * Selection is by whichever API key is configured. If both are set,
 * AI_PROVIDER decides; otherwise the first key found wins.
 */

import type { ZodType } from "zod";

export type ProviderId = "anthropic" | "gemini";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AIProvider {
  id: ProviderId;
  model: string;

  /**
   * Extract structured data.
   *
   * The schema is supplied in two forms because the two SDKs want different
   * things: Anthropic has a Zod helper (`zodOutputFormat`), while Gemini takes
   * plain JSON Schema. Passing both keeps each provider on its documented happy
   * path instead of hand-rolling a conversion. The caller re-validates the
   * result regardless, so an implementation may return anything.
   */
  extract(args: {
    system: string;
    messages: ChatTurn[];
    schema: ZodType;
    jsonSchema: Record<string, unknown>;
    schemaName: string;
  }): Promise<unknown | null>;

  /** One-shot text completion. */
  complete(args: {
    system: string;
    prompt: string;
    maxTokens?: number;
  }): Promise<string>;

  /** Streaming completion, yielding text deltas. */
  stream(args: {
    system: string;
    history: ChatTurn[];
    question: string;
    maxTokens?: number;
  }): AsyncIterable<string>;
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

function anthropicKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY?.trim() || undefined;
}

function geminiKey(): string | undefined {
  // GOOGLE_API_KEY is the variable the Google SDK itself falls back to.
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    undefined
  );
}

/** Which provider will be used, or null when no key is configured. */
export function activeProviderId(): ProviderId | null {
  const preferred = process.env.AI_PROVIDER?.trim().toLowerCase();

  if (preferred === "anthropic") return anthropicKey() ? "anthropic" : null;
  if (preferred === "gemini") return geminiKey() ? "gemini" : null;

  if (geminiKey()) return "gemini";
  if (anthropicKey()) return "anthropic";
  return null;
}

export function isAIEnabled(): boolean {
  return activeProviderId() !== null;
}

/**
 * Build the active provider.
 *
 * Implementations are imported lazily so the unused vendor SDK is never loaded
 * — and so a missing optional dependency can't break the other path.
 */
export async function getProvider(): Promise<AIProvider | null> {
  const id = activeProviderId();
  if (id === "gemini") {
    const { createGeminiProvider } = await import("@/lib/ai/providers/gemini");
    return createGeminiProvider(geminiKey()!);
  }
  if (id === "anthropic") {
    const { createAnthropicProvider } = await import(
      "@/lib/ai/providers/anthropic"
    );
    return createAnthropicProvider();
  }
  return null;
}

/** Human-readable label for the status endpoint and the sidebar. */
export function providerLabel(id: ProviderId | null): string {
  if (id === "anthropic") return "Claude";
  if (id === "gemini") return "Gemini";
  return "Offline engine";
}
