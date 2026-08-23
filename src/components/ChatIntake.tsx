"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { IconArrowRight, IconSend, IconSpark } from "@/components/icons";
import { Button } from "@/components/ui";
import { useGeneratePath } from "@/lib/actions";
import {
  intakeChecklist,
  intakeExtras,
  intentToProfile,
  isIntakeComplete,
} from "@/lib/intake";
import { useLearner } from "@/lib/store";
import type { ChatMessage, ExtractedIntent } from "@/lib/types";
import { cn, uid } from "@/lib/utils";

const OPENING =
  "Tell me what you want to be able to do. A sentence is plenty — where you're starting from and where you'd like to get to.";

const SUGGESTIONS = [
  "I'm a backend developer and I want to move into machine learning",
  "Complete beginner — I want to become a data analyst in 6 months",
  "I know React and want to build AI products with LLMs",
  "Help me prepare for software engineering interviews",
];

/**
 * The conversational profiling flow.
 *
 * Each turn posts the whole transcript to /api/intake, which returns both a
 * visible reply and the structured profile extracted so far. When the extractor
 * reports nothing essential is missing, we commit the profile and move on.
 */
export function ChatIntake() {
  const router = useRouter();
  const { setProfile, setChat } = useLearner();
  const { generate, generating, error: genError } = useGeneratePath();

  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: uid(), role: "assistant", content: OPENING, at: new Date().toISOString() },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [intent, setIntent] = useState<ExtractedIntent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy]);

  const checklist = intakeChecklist(intent);
  const answered = checklist.filter((f) => f.value !== null).length;
  const ready = isIntakeComplete(intent);
  const extras = intakeExtras(intent);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    setError(null);
    const userMessage: ChatMessage = {
      id: uid(),
      role: "user",
      content: trimmed,
      at: new Date().toISOString(),
    };
    const next = [...messages, userMessage];
    setMessages(next);
    setInput("");
    setBusy(true);

    try {
      const response = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) throw new Error("intake failed");
      const data = (await response.json()) as { intent: ExtractedIntent };

      setIntent(data.intent);
      setMessages((current) => [
        ...current,
        {
          id: uid(),
          role: "assistant",
          content: data.intent.reply,
          at: new Date().toISOString(),
        },
      ]);
    } catch {
      setError("Could not reach the assistant. Check your connection and try again.");
      setMessages((current) => current.slice(0, -1));
      setInput(trimmed);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  /** Commit the intake, generate the path, then open it. */
  async function buildPath() {
    if (!intent || !ready || generating) return;

    setProfile(
      intentToProfile(
        intent,
        messages.find((m) => m.role === "user")?.content ?? "",
      ),
    );
    setChat(messages);

    const path = await generate();
    if (path) router.push("/path");
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-1 pb-4">
        {messages.map((message) => (
          <Bubble key={message.id} message={message} />
        ))}

        {busy ? (
          <div className="flex items-center gap-2.5">
            <Avatar />
            <div className="flex gap-1 rounded-2xl rounded-tl-sm bg-white px-4 py-3.5 ring-1 ring-ink-200">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-ink-300 animate-pulse-soft"
                  style={{ animationDelay: `${i * 0.16}s` }}
                />
              ))}
            </div>
          </div>
        ) : null}

        {intent && !busy ? (
          <div className="animate-fade-up pl-10">
            <div
              className={cn(
                "rounded-xl border p-4 transition-colors",
                ready ? "border-brand-200 bg-brand-50" : "border-ink-200 bg-white",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div
                  className={cn(
                    "flex items-center gap-2 text-[13px] font-semibold",
                    ready ? "text-brand-800" : "text-ink-700",
                  )}
                >
                  <IconSpark className="h-4 w-4" />
                  {ready ? "Ready to build your path" : "Building your profile"}
                </div>
                <span className="text-[12px] tabular-nums text-ink-500">
                  {answered}/{checklist.length}
                </span>
              </div>

              <ul className="mt-3 space-y-1.5">
                {checklist.map((field) => (
                  <li key={field.key} className="flex items-start gap-2 text-[13px]">
                    <span
                      className={cn(
                        "mt-[3px] flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold leading-none",
                        field.value
                          ? "bg-brand-600 text-white"
                          : "border border-dashed border-ink-300",
                      )}
                      aria-hidden
                    >
                      {/* Only render the tick when earned — an always-present
                          glyph hidden with text-transparent still reaches the
                          accessibility tree and reads as "answered". */}
                      {field.value ? "✓" : null}
                    </span>
                    <span
                      className={
                        field.value ? "text-ink-700" : "text-ink-400"
                      }
                    >
                      <span className="text-ink-500">{field.label}:</span>{" "}
                      {field.value ?? (
                        <span className="italic">still to answer</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>

              {extras.length > 0 ? (
                <p className="mt-2.5 text-[12px] leading-relaxed text-ink-500">
                  Also noted: {extras.join(" · ")}
                </p>
              ) : null}

              {genError ? (
                <p className="mt-3 rounded-lg bg-rose-100 px-3 py-2 text-[12.5px] text-rose-700">
                  {genError}
                </p>
              ) : null}

              <Button
                className="mt-3.5 w-full sm:w-auto"
                onClick={buildPath}
                disabled={!ready || generating}
                title={
                  ready
                    ? undefined
                    : "Answer the remaining questions first"
                }
              >
                {generating ? "Generating…" : "Generate my learning path"}
                {generating ? null : <IconArrowRight className="h-4 w-4" />}
              </Button>

              {!ready ? (
                <p className="mt-2 text-[12px] leading-relaxed text-ink-500">
                  A plan built on guesses is worse than none — answer the rest and
                  this unlocks.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {messages.length === 1 && !busy ? (
          <div className="animate-fade-up space-y-2 pl-10 pt-1">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => send(suggestion)}
                className="block w-full rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-left text-[13px] text-ink-600 transition-all hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="mb-2 rounded-lg bg-rose-100 px-3 py-2 text-[12.5px] text-rose-700">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
        className="flex items-end gap-2 rounded-2xl border border-ink-200 bg-white p-2 transition-colors focus-within:border-brand-300"
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder="Describe your goal…"
          disabled={busy}
          className="max-h-32 min-h-[38px] flex-1 resize-none bg-transparent px-2.5 py-2 text-sm text-ink-800 placeholder:text-ink-400 focus:outline-none disabled:opacity-60"
        />
        <Button
          type="submit"
          size="sm"
          disabled={busy || input.trim().length === 0}
          className="h-9 w-9 shrink-0 p-0"
          aria-label="Send message"
        >
          <IconSend className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

function Avatar() {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center self-start rounded-lg bg-ink-900 text-white">
      <IconSpark className="h-3.5 w-3.5" />
    </span>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div
      className={cn(
        "flex animate-fade-up items-start gap-2.5",
        isUser && "justify-end",
      )}
    >
      {!isUser ? <Avatar /> : null}
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[14px] leading-relaxed",
          isUser
            ? "rounded-br-sm bg-ink-900 text-white"
            : "rounded-tl-sm bg-white text-ink-700 ring-1 ring-ink-200",
        )}
      >
        {message.content}
      </div>
    </div>
  );
}
