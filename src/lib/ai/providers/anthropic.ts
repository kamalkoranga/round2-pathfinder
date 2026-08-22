import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import type { AIProvider, ChatTurn } from "@/lib/ai/provider";

/**
 * Claude implementation.
 *
 * The static taxonomy blocks the callers put at the front of `system` sit behind
 * a `cache_control` breakpoint, so only the per-learner tail is re-billed.
 */

export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5";

let cached: Anthropic | null = null;

function client(): Anthropic {
  if (!cached) cached = new Anthropic();
  return cached;
}

function toMessages(turns: ChatTurn[]): Anthropic.MessageParam[] {
  return turns.map((turn) => ({ role: turn.role, content: turn.content }));
}

export function createAnthropicProvider(): AIProvider {
  const model = process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL;

  return {
    id: "anthropic",
    model,

    async extract({ system, messages, schema }) {
      const response = await client().messages.parse({
        model,
        max_tokens: 4000,
        system: [
          { type: "text", text: system, cache_control: { type: "ephemeral" } },
        ],
        messages: toMessages(messages),
        output_config: { format: zodOutputFormat(schema) },
      });

      // parsed_output is null when the model's output failed validation.
      return response.parsed_output ?? null;
    },

    async complete({ system, prompt, maxTokens = 1000 }) {
      const stream = client().messages.stream({
        model,
        max_tokens: maxTokens,
        system: [
          { type: "text", text: system, cache_control: { type: "ephemeral" } },
        ],
        messages: [{ role: "user", content: prompt }],
        output_config: { effort: "low" },
      });

      const message = await stream.finalMessage();
      return message.content
        .filter((block) => block.type === "text")
        .map((block) => (block.type === "text" ? block.text : ""))
        .join("")
        .trim();
    },

    async *stream({ system, history, question, maxTokens = 2000 }) {
      const stream = client().messages.stream({
        model,
        max_tokens: maxTokens,
        system: [
          { type: "text", text: system, cache_control: { type: "ephemeral" } },
        ],
        messages: toMessages([...history, { role: "user", content: question }]),
        output_config: { effort: "low" },
      });

      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          yield event.delta.text;
        }
      }
    },
  };
}
