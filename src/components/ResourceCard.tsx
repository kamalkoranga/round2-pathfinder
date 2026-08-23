"use client";

import { useState } from "react";

import {
  IconBook,
  IconCheck,
  IconClipboard,
  IconClock,
  IconExternal,
  IconHammer,
  IconInfo,
  IconLock,
  IconSpark,
  IconThumbDown,
  IconThumbUp,
} from "@/components/icons";
import { Badge, Button, Progress } from "@/components/ui";
import { useProgressActions } from "@/lib/actions";
import { skillName } from "@/lib/data/skills";
import { DOWN_REASONS, useLearner } from "@/lib/store";
import type { ResourceKind, ScoredResource } from "@/lib/types";
import { cn } from "@/lib/utils";
import { WEIGHTS } from "@/lib/engine/recommend";

const KIND_META: Record<
  ResourceKind,
  { label: string; Icon: typeof IconBook; tone: "brand" | "mint" | "amber" | "neutral" }
> = {
  course: { label: "Course", Icon: IconBook, tone: "brand" },
  project: { label: "Project", Icon: IconHammer, tone: "mint" },
  assessment: { label: "Checkpoint", Icon: IconClipboard, tone: "amber" },
  reading: { label: "Reading", Icon: IconBook, tone: "neutral" },
};

const COMPONENT_LABELS: [keyof ScoredResource["components"], string, number][] = [
  ["relevance", "Goal relevance", WEIGHTS.relevance],
  ["gapCoverage", "Skill-gap coverage", WEIGHTS.gapCoverage],
  ["levelFit", "Level fit", WEIGHTS.levelFit],
  ["styleFit", "Style fit", WEIGHTS.styleFit],
  ["quality", "Quality prior", WEIGHTS.quality],
];

export function ResourceCard({
  scored,
  order,
  locked = false,
  compact = false,
}: {
  scored: ScoredResource;
  /** Step number, when shown inside a path. */
  order?: number;
  locked?: boolean;
  compact?: boolean;
}) {
  const { resource, reason, closesGaps, missingPrereqs, components, score } = scored;
  const { profile, feedback } = useLearner();
  const { toggle, setRating, removeRating } = useProgressActions();

  const [showWhy, setShowWhy] = useState(false);
  const [showReasons, setShowReasons] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explaining, setExplaining] = useState(false);

  const done = profile.completed.includes(resource.id);
  const rating = feedback.find((f) => f.resourceId === resource.id);
  const meta = KIND_META[resource.kind];

  async function explain() {
    if (explanation || explaining) {
      setShowWhy((v) => !v);
      return;
    }
    setShowWhy(true);
    setExplaining(true);
    try {
      const response = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, resourceId: resource.id, feedback }),
      });
      const data = await response.json();
      setExplanation(data.explanation ?? reason);
    } catch {
      setExplanation(reason);
    } finally {
      setExplaining(false);
    }
  }

  return (
    <article
      className={cn(
        "group relative rounded-[--radius-card] border bg-white transition-all",
        done ? "border-mint-100 bg-mint-100/25" : "border-ink-200 hover:border-ink-300",
        locked && "opacity-65",
      )}
    >
      <div className={cn("p-4", compact && "p-3.5")}>
        <div className="flex items-start gap-3">
          {order !== undefined ? (
            <span
              className={cn(
                "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11.5px] font-semibold",
                done
                  ? "bg-mint-500 text-white"
                  : locked
                    ? "bg-ink-100 text-ink-400"
                    : "bg-ink-900 text-white",
              )}
            >
              {done ? <IconCheck className="h-3.5 w-3.5" /> : order}
            </span>
          ) : null}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={meta.tone}>
                <meta.Icon className="h-3 w-3" />
                {meta.label}
              </Badge>
              {locked ? (
                <Badge tone="amber">
                  <IconLock className="h-3 w-3" />
                  Locked
                </Badge>
              ) : null}
              <Badge tone="outline">{resource.level}</Badge>
              <span className="flex items-center gap-1 text-[11.5px] text-ink-400">
                <IconClock className="h-3 w-3" />
                {resource.hours}h
              </span>
              <span className="text-[11.5px] text-ink-400">★ {resource.rating}</span>
            </div>

            <h3
              className={cn(
                "mt-2 text-[14.5px] font-semibold leading-snug tracking-tight text-ink-900",
                done && "line-through decoration-mint-700/40",
              )}
            >
              {resource.title}
            </h3>
            <p className="mt-0.5 text-[12.5px] text-ink-400">{resource.provider}</p>

            {!compact ? (
              <p className="mt-2.5 text-[13px] leading-relaxed text-ink-500">{reason}</p>
            ) : null}

            {!compact ? (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {closesGaps.slice(0, 4).map((skillId) => (
                  <Badge key={skillId} tone="mint">
                    {skillName(skillId)}
                  </Badge>
                ))}
                <FindOnlineLink resource={resource} />
              </div>
            ) : null}

            {missingPrereqs.length > 0 ? (
              <p className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-amber-100/70 px-2.5 py-1.5 text-[12px] leading-relaxed text-amber-700">
                <IconInfo className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Assumes {missingPrereqs.map(skillName).join(", ")} — cover that first, or
                  let your path sequence it for you.
                </span>
              </p>
            ) : null}
          </div>
        </div>

        {/* ---- Actions ---- */}
        <div className="mt-3.5 flex flex-wrap items-center gap-1.5 border-t border-ink-100 pt-3">
          <Button
            size="sm"
            variant={done ? "secondary" : "primary"}
            onClick={() => toggle(resource.id)}
          >
            <IconCheck className="h-3.5 w-3.5" />
            {done ? "Completed" : "Mark done"}
          </Button>

          <Button size="sm" variant="ghost" onClick={explain}>
            <IconSpark className="h-3.5 w-3.5" />
            Why this?
          </Button>

          <div className="ml-auto flex items-center gap-0.5">
            <button
              onClick={() =>
                rating?.signal === "up" ? removeRating(resource.id) : setRating(resource.id, "up")
              }
              aria-label="More like this"
              title="More like this"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                rating?.signal === "up"
                  ? "bg-mint-100 text-mint-700"
                  : "text-ink-400 hover:bg-ink-100 hover:text-ink-600",
              )}
            >
              <IconThumbUp className="h-[15px] w-[15px]" />
            </button>
            <button
              onClick={() => {
                if (rating?.signal === "down") {
                  removeRating(resource.id);
                  setShowReasons(false);
                } else {
                  setShowReasons((v) => !v);
                }
              }}
              aria-label="Less like this"
              title="Less like this"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                rating?.signal === "down"
                  ? "bg-rose-100 text-rose-700"
                  : "text-ink-400 hover:bg-ink-100 hover:text-ink-600",
              )}
            >
              <IconThumbDown className="h-[15px] w-[15px]" />
            </button>
          </div>
        </div>

        {/* ---- Thumbs-down reason picker ---- */}
        {showReasons ? (
          <div className="mt-2.5 animate-fade-up rounded-lg bg-ink-50 p-2.5">
            <p className="mb-2 text-[12px] font-medium text-ink-600">
              What&apos;s wrong with it? This retunes your whole path.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {DOWN_REASONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setRating(resource.id, "down", option.value);
                    setShowReasons(false);
                  }}
                  className="rounded-md border border-ink-200 bg-white px-2.5 py-1 text-[12px] text-ink-600 transition-colors hover:border-rose-500/40 hover:bg-rose-100 hover:text-rose-700"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* ---- Explanation + score breakdown ---- */}
        {showWhy ? (
          <div className="mt-2.5 animate-fade-up space-y-3 rounded-lg bg-ink-50 p-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-400">
                Why this was recommended
              </p>
              {explaining ? (
                <div className="mt-2 space-y-1.5">
                  <div className="h-2.5 w-full animate-pulse-soft rounded bg-ink-200" />
                  <div className="h-2.5 w-4/5 animate-pulse-soft rounded bg-ink-200" />
                </div>
              ) : (
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-600">
                  {explanation ?? reason}
                </p>
              )}
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-400">
                Score breakdown · {score.toFixed(3)}
              </p>
              <div className="space-y-1.5">
                {COMPONENT_LABELS.map(([key, label, weight]) => (
                  <div key={key} className="flex items-center gap-2.5">
                    <span className="w-32 shrink-0 text-[11.5px] text-ink-500">{label}</span>
                    <Progress value={components[key]} className="h-1" tone="ink" />
                    <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-ink-400">
                      {components[key].toFixed(2)} ×{weight}
                    </span>
                  </div>
                ))}
                {components.feedbackAdj !== 0 ? (
                  <div className="flex items-center gap-2.5">
                    <span className="w-32 shrink-0 text-[11.5px] text-ink-500">
                      Your feedback
                    </span>
                    <span
                      className={cn(
                        "text-[11.5px] font-medium",
                        components.feedbackAdj > 0 ? "text-mint-700" : "text-rose-700",
                      )}
                    >
                      {components.feedbackAdj > 0 ? "+" : ""}
                      {components.feedbackAdj.toFixed(2)}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}

/**
 * "Find online" — opens a web search for this resource.
 *
 * The catalog is a curated dataset modelled on real platforms, so it stores no
 * URLs: inventing direct links would mean shipping dead ones, and a link that
 * 404s is worse than no link. A search scoped to the exact title and provider
 * always resolves, and lands the learner on the real thing when it exists.
 */
function FindOnlineLink({ resource }: { resource: ScoredResource["resource"] }) {
  // A project or assessment is PathFinder's own exercise, not something to go
  // and enrol in — searching for it would send people somewhere unhelpful.
  if (resource.kind === "project" || resource.kind === "assessment") return null;

  const query = `${resource.title} ${resource.provider}`;
  const href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
      title={`Search the web for "${resource.title}"`}
      className="inline-flex items-center gap-1 rounded-full border border-ink-200 px-2 py-0.5 text-[11.5px] font-medium text-ink-500 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
    >
      <IconExternal className="h-3 w-3" />
      Find online
    </a>
  );
}
