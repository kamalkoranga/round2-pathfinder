"use client";

import { useEffect, useRef, useState } from "react";

import { PageShell } from "@/components/PageShell";
import { IconSend, IconSpark } from "@/components/icons";
import { Button, Card } from "@/components/ui";
import { useDerived } from "@/lib/useDerived";
import type { ChatMessage } from "@/lib/types";
import { cn, uid } from "@/lib/utils";

const STARTERS = [
  "Why is this course first in my path?",
  "What's my biggest weakness right now?",
  "Can I finish this faster if I do 15 hours a week?",
  "What should I build for my portfolio?",
];

/**
 * The learner-facing tutor.
 *
 * Every request carries the learner's profile, gaps and generated path as
 * context, so answers are grounded in their actual plan rather than generic
 * advice. Responses stream token by token.
 */
export default function AssistantPage() {
  const { profile, feedback, path, gaps } = useDerived();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || streaming) return;

    const userMessage: ChatMessage = {
      id: uid(),
      role: "user",
      content: trimmed,
      at: new Date().toISOString(),
    };
    const assistantId = uid();

    setMessages((current) => [
      ...current,
      userMessage,
      { id: assistantId, role: "assistant", content: "", at: new Date().toISOString() },
    ]);
    setInput("");
    setStreaming(true);

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile,
          feedback,
          question: trimmed,
          history: messages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      // Offline/engine mode returns JSON rather than a stream.
      const contentType = response.headers.get("Content-Type") ?? "";
      if (contentType.includes("application/json")) {
        const data = await response.json();
        setMessages((current) =>
          current.map((m) =>
            m.id === assistantId
              ? { ...m, content: data.answer ?? data.error ?? "No answer available." }
              : m,
          ),
        );
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("no stream");
      const decoder = new TextDecoder();

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((current) =>
          current.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + chunk } : m,
          ),
        );
      }
    } catch {
      setMessages((current) =>
        current.map((m) =>
          m.id === assistantId
            ? { ...m, content: "Sorry — I couldn't reach the assistant. Try again." }
            : m,
        ),
      );
    } finally {
      setStreaming(false);
    }
  }

  return (
    <PageShell
      title="Ask the assistant"
      description="It has your profile, your skill gaps and your full path in context — ask about any of it."
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_15rem]">
        {/* ---- Conversation ---- */}
        <Card className="flex h-[min(70vh,40rem)] flex-col overflow-hidden">
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-ink-900 text-white">
                  <IconSpark className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-[15px] font-semibold text-ink-800">
                  What would you like to know?
                </h3>
                <p className="mt-1.5 max-w-xs text-[13px] leading-relaxed text-ink-500">
                  Ask why something was recommended, how to go faster, or what to
                  focus on next.
                </p>
                <div className="mt-5 w-full max-w-sm space-y-2">
                  {STARTERS.map((starter) => (
                    <button
                      key={starter}
                      onClick={() => ask(starter)}
                      className="block w-full rounded-lg border border-ink-200 bg-white px-3.5 py-2 text-left text-[13px] text-ink-600 transition-all hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex animate-fade-up items-start gap-2.5",
                    message.role === "user" && "justify-end",
                  )}
                >
                  {message.role === "assistant" ? (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ink-900 text-white">
                      <IconSpark className="h-3.5 w-3.5" />
                    </span>
                  ) : null}
                  <div
                    className={cn(
                      "max-w-[82%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed",
                      message.role === "user"
                        ? "rounded-br-sm bg-ink-900 text-white"
                        : "rounded-tl-sm bg-ink-100 text-ink-700",
                    )}
                  >
                    {message.content ||
                      (streaming ? (
                        <span className="inline-flex gap-1 py-1">
                          {[0, 1, 2].map((i) => (
                            <span
                              key={i}
                              className="h-1.5 w-1.5 rounded-full bg-ink-400 animate-pulse-soft"
                              style={{ animationDelay: `${i * 0.16}s` }}
                            />
                          ))}
                        </span>
                      ) : null)}
                  </div>
                </div>
              ))
            )}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              ask(input);
            }}
            className="flex items-center gap-2 border-t border-ink-100 p-3"
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about your path…"
              disabled={streaming}
              className="flex-1 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 placeholder:text-ink-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:opacity-60"
            />
            <Button
              type="submit"
              disabled={streaming || input.trim().length === 0}
              className="h-10 w-10 shrink-0 p-0"
              aria-label="Send"
            >
              <IconSend className="h-4 w-4" />
            </Button>
          </form>
        </Card>

        {/* ---- Context panel ---- */}
        <div className="space-y-3">
          <Card className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-400">
              What it can see
            </p>
            <dl className="mt-3 space-y-2.5 text-[12.5px]">
              <ContextRow label="Goal" value={path.roleTitle} />
              <ContextRow label="Level" value={profile.level} />
              <ContextRow label="Weekly time" value={`${profile.hoursPerWeek} hours`} />
              <ContextRow label="Open gaps" value={String(gaps.length)} />
              <ContextRow
                label="Path"
                value={`${path.milestones.length} milestones · ${path.totalHours}h`}
              />
              <ContextRow label="Completed" value={`${profile.completed.length} items`} />
            </dl>
          </Card>

          {gaps.length > 0 ? (
            <Card className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-400">
                Top gaps
              </p>
              <ul className="mt-2.5 space-y-1.5">
                {gaps.slice(0, 5).map((gap) => (
                  <li key={gap.skillId} className="text-[12.5px] text-ink-600">
                    {gap.name}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </PageShell>
  );
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="shrink-0 text-ink-400">{label}</dt>
      <dd className="truncate text-right font-medium text-ink-700">{value}</dd>
    </div>
  );
}
