import Anthropic from "@anthropic-ai/sdk";

export {
  activeProviderId,
  getProvider,
  isAIEnabled,
  providerLabel,
  type AIProvider,
  type ChatTurn,
  type ProviderId,
} from "@/lib/ai/provider";

/**
 * Map a provider error onto a safe, user-facing message.
 *
 * Anthropic errors are typed, so we branch on the SDK's classes. Gemini surfaces
 * HTTP failures as plain errors, so those are matched on status text — kept
 * narrow and falling through to a generic message rather than guessing.
 */
export function describeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) {
    return "The configured Anthropic API key was rejected.";
  }
  if (error instanceof Anthropic.RateLimitError) {
    return "The assistant is rate limited right now — try again in a moment.";
  }
  if (error instanceof Anthropic.BadRequestError) {
    return "The assistant could not process that request.";
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return "Could not reach the model provider. Check your network connection.";
  }
  if (error instanceof Anthropic.APIError) {
    return `Assistant error (${error.status}).`;
  }

  const message = error instanceof Error ? error.message : String(error);

  if (/API key not valid|API_KEY_INVALID|PERMISSION_DENIED|\b401\b|\b403\b/i.test(message)) {
    return "The configured Gemini API key was rejected.";
  }
  // Gemini's free tier caps requests *per day per model*, so distinguish
  // "wait a moment" from "you are done for today" — the fixes are different.
  if (/PerDay|requests per day|free_tier_requests/i.test(message)) {
    return "Daily free-tier quota for this model is used up — set GEMINI_MODEL to another model, or enable billing. Showing the engine's own answer meanwhile.";
  }
  if (/RESOURCE_EXHAUSTED|quota|\b429\b/i.test(message)) {
    return "The assistant is rate limited right now — try again in a moment.";
  }
  if (/UNAVAILABLE|high demand|overloaded|\b503\b/i.test(message)) {
    return "The model is busy right now — showing the engine's own answer instead.";
  }
  if (/NOT_FOUND|no longer available|\b404\b/i.test(message)) {
    return "The configured model was not found or is retired — check GEMINI_MODEL.";
  }
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|network/i.test(message)) {
    return "Could not reach the model provider. Check your network connection.";
  }

  return "Something went wrong talking to the assistant.";
}
