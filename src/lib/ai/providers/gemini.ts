import { GoogleGenAI, ThinkingLevel, type Content } from "@google/genai";

import type { AIProvider, ChatTurn } from "@/lib/ai/provider";

/**
 * Gemini implementation, via the current unified `@google/genai` SDK.
 *
 * Note the vocabulary differences from the Anthropic path: the assistant role is
 * called `model`, the system prompt lives in `config.systemInstruction` rather
 * than the message list, and structured output is requested with
 * `responseMimeType` + `responseJsonSchema` instead of a schema helper.
 */

/**
 * Stable default. `gemini-3.7-flash` is the newer flagship but returns 503
 * "high demand" often enough to be a poor default for a demo; 3.6 is the model
 * Google's own retirement notices point at. Override with GEMINI_MODEL.
 */
export const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

/** Map our transcript onto Gemini's `Content[]`. */
function toContents(turns: ChatTurn[]): Content[] {
  return turns.map((turn) => ({
    role: turn.role === "assistant" ? "model" : "user",
    parts: [{ text: turn.content }],
  }));
}

export function createGeminiProvider(apiKey: string): AIProvider {
  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;

  return {
    id: "gemini",
    model,

    async extract({ system, messages, jsonSchema }) {
      const response = await ai.models.generateContent({
        model,
        contents: toContents(messages),
        config: {
          systemInstruction: system,
          maxOutputTokens: 4000,
          responseMimeType: "application/json",
          responseJsonSchema: jsonSchema,
        },
      });

      const text = response.text;
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch {
        // Constrained decoding makes this unlikely, but never trust it blindly —
        // the caller falls back to the local extractor when we return null.
        return null;
      }
    },

    async complete({ system, prompt, maxTokens = 2000 }) {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction: system,
          maxOutputTokens: maxTokens,
          // Rewriting a score breakdown into prose needs little reasoning.
          // The Claude path uses effort:"low" here for the same reason.
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
      return response.text?.trim() ?? "";
    },

    async *stream({ system, history, question, maxTokens = 4000 }) {
      const stream = await ai.models.generateContentStream({
        model,
        contents: toContents([...history, { role: "user", content: question }]),
        config: { systemInstruction: system, maxOutputTokens: maxTokens },
      });

      for await (const chunk of stream) {
        const text = chunk.text;
        if (text) yield text;
      }
    },
  };
}
