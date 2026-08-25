"use client";

import Link from "next/link";
import { useState } from "react";

import { PageShell } from "@/components/PageShell";
import { ResourceCard } from "@/components/ResourceCard";
import { IconCheck, IconClock, IconRefresh, IconTarget } from "@/components/icons";
import { Badge, Button, Card, Progress, SectionTitle } from "@/components/ui";
import { skillName } from "@/lib/data/skills";
import { checkDeadline, isStepUnlocked } from "@/lib/engine/path";
import { useLearner } from "@/lib/store";
import { useDerived } from "@/lib/useDerived";
import type { Milestone } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function PathPage() {
  const { path, progress, profile, adaptation } = useDerived();
  const revision = useLearner((s) => s.revision);
  const setProfile = useLearner((s) => s.setProfile);
  const deadline = checkDeadline(path, profile);

  return (
    <PageShell
      title="My learning path"
      description={
        path.milestones.length > 0
          ? `${path.roleTitle} · ${path.totalHours} hours across ${path.milestones.length} milestones, sequenced so nothing assumes something you haven't learned yet.`
          : undefined
      }
      action={
        <Badge tone="brand" className="px-2.5 py-1 text-[12px]">
          <IconRefresh className="h-3.5 w-3.5" />
          Rev {revision}
        </Badge>
      }
    >
      {path.milestones.length === 0 ? (
        <Card className="p-8 text-center">
          <h2 className="text-[15px] font-semibold text-ink-800">
            Nothing left to schedule
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-ink-500">
            Based on your current profile you already meet the target for{" "}
            {path.roleTitle}. Raise your goal on the profile page, or explore the
            catalog for something new.
          </p>
        </Card>
      ) : (
        <div className="space-y-7">
          {/* ---- Summary strip ---- */}
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-400">
                  Overall progress
                </div>
                <div className="mt-1 text-[28px] font-semibold leading-none tracking-tight text-ink-900">
                  {Math.round(progress * 100)}%
                </div>
              </div>
              <div className="flex flex-wrap gap-5 text-[13px] text-ink-500">
                <SummaryItem
                  icon={<IconClock className="h-4 w-4" />}
                  label="Estimated"
                  value={`~${path.totalWeeks} weeks`}
                  sub={`at ${profile.hoursPerWeek}h/week`}
                />
                <SummaryItem
                  icon={<IconCheck className="h-4 w-4" />}
                  label="Completed"
                  value={`${
                    path.milestones
                      .flatMap((m) => m.steps)
                      .filter((s) => profile.completed.includes(s.resource.id)).length
                  } / ${path.milestones.flatMap((m) => m.steps).length}`}
                  sub="steps"
                />
                <SummaryItem
                  icon={<IconTarget className="h-4 w-4" />}
                  label="Open gaps"
                  value={String(path.gaps.length)}
                  sub="skills"
                />
              </div>
            </div>
            <Progress value={progress} className="mt-4" tone="mint" />
          </Card>

          {/* ---- Deadline feasibility ---- */}
          {deadline.hasDeadline && !deadline.feasible ? (
            <div className="rounded-[--radius-card] border border-amber-500/30 bg-amber-100/60 p-4">
              <p className="text-[13px] font-semibold text-amber-700">
                This plan runs past your {deadline.targetWeeks}-week deadline
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-amber-700/85">
                At {profile.hoursPerWeek}h/week it takes about{" "}
                {deadline.projectedWeeks} weeks. To finish on time you would need
                roughly <strong>{deadline.requiredHoursPerWeek}h/week</strong> — or
                narrow the goal so there is less to cover.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => setProfile({ hoursPerWeek: Math.min(40, deadline.requiredHoursPerWeek) })}
                >
                  Set {Math.min(40, deadline.requiredHoursPerWeek)}h/week
                </Button>
                <Link href="/profile">
                  <Button size="sm" variant="secondary">
                    Adjust my goal
                  </Button>
                </Link>
              </div>
            </div>
          ) : null}

          {deadline.hasDeadline && deadline.feasible ? (
            <div className="rounded-[--radius-card] border border-mint-100 bg-mint-100/40 p-4">
              <p className="text-[13px] leading-relaxed text-mint-700">
                <strong className="font-semibold">On track.</strong> This plan
                finishes in about {deadline.projectedWeeks} weeks, inside your{" "}
                {deadline.targetWeeks}-week target.
              </p>
            </div>
          ) : null}

          {/* ---- Adaptation notice ---- */}
          {adaptation.notes.length > 0 ? (
            <div className="rounded-[--radius-card] border border-brand-200 bg-brand-50 p-4">
              <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-brand-700">
                Adapted from your feedback
              </p>
              <ul className="mt-2 space-y-1">
                {adaptation.notes.map((note) => (
                  <li key={note} className="text-[13px] leading-relaxed text-brand-800/85">
                    · {note}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* ---- Milestones ---- */}
          <div>
            <SectionTitle hint={`${path.milestones.length} milestones`}>
              Roadmap
            </SectionTitle>
            <div className="space-y-4">
              {path.milestones.map((milestone, index) => (
                <MilestoneBlock
                  key={milestone.id}
                  milestone={milestone}
                  index={index}
                  isLast={index === path.milestones.length - 1}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

function SummaryItem({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-ink-400">{icon}</span>
      <div>
        <div className="text-[11px] uppercase tracking-[0.05em] text-ink-400">{label}</div>
        <div className="text-[15px] font-semibold text-ink-800">{value}</div>
        <div className="text-[11.5px] text-ink-400">{sub}</div>
      </div>
    </div>
  );
}

function MilestoneBlock({
  milestone,
  index,
  isLast,
}: {
  milestone: Milestone;
  index: number;
  isLast: boolean;
}) {
  const { profile, path, ranked } = useDerived();
  const [open, setOpen] = useState(index < 2);

  // The path stores only the step summary; pull the full score breakdown from
  // the ranking so "Why this?" shows real numbers.
  const scoredById = new Map(ranked.map((s) => [s.resource.id, s]));

  const completedCount = milestone.steps.filter((s) =>
    profile.completed.includes(s.resource.id),
  ).length;
  const done = completedCount === milestone.steps.length;
  const ratio = milestone.steps.length ? completedCount / milestone.steps.length : 0;

  return (
    <div className="relative">
      {/* Connector line to the next milestone */}
      {!isLast ? (
        <span
          className="absolute left-[19px] top-14 bottom-[-16px] w-px bg-ink-200"
          aria-hidden
        />
      ) : null}

      <Card className={cn("overflow-hidden", done && "border-mint-100")}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-start gap-3.5 p-4 text-left transition-colors hover:bg-ink-50"
          aria-expanded={open}
        >
          <span
            className={cn(
              "relative z-10 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ring-4 ring-white",
              done ? "bg-mint-500 text-white" : "bg-ink-900 text-white",
            )}
          >
            {done ? <IconCheck className="h-4 w-4" /> : index + 1}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[15px] font-semibold tracking-tight text-ink-900">
                {milestone.title}
              </h3>
              <Badge tone={done ? "mint" : "outline"}>
                {completedCount}/{milestone.steps.length}
              </Badge>
              <Badge tone="neutral">by week {milestone.weekEnd}</Badge>
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-500">
              {milestone.summary}
            </p>

            {milestone.skills.length > 0 ? (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {milestone.skills.slice(0, 5).map((skillId) => (
                  <Badge key={skillId} tone="brand">
                    {skillName(skillId)}
                  </Badge>
                ))}
                {milestone.skills.length > 5 ? (
                  <Badge tone="outline">+{milestone.skills.length - 5}</Badge>
                ) : null}
              </div>
            ) : null}

            <Progress
              value={ratio}
              className="mt-3"
              tone={done ? "mint" : "brand"}
            />
          </div>

          <span className="mt-1 shrink-0 text-[12px] text-ink-400">
            {milestone.hours}h
          </span>
        </button>

        {open ? (
          <div className="space-y-2.5 border-t border-ink-100 bg-ink-50/50 p-4">
            {milestone.steps.map((step) => {
              const scored = scoredById.get(step.resource.id);
              return (
                <ResourceCard
                  key={step.resource.id}
                  order={step.order}
                  locked={!isStepUnlocked(path, step, profile.completed)}
                  scored={
                    scored
                      ? // Prerequisites are satisfied by the path's ordering, so
                        // suppress the "missing prereq" warning inside the path.
                        { ...scored, reason: step.reason, missingPrereqs: [] }
                      : {
                          resource: step.resource,
                          score: step.score,
                          components: {
                            relevance: 0,
                            gapCoverage: 0,
                            levelFit: 0,
                            styleFit: 0,
                            quality: 0,
                            feedbackAdj: 0,
                          },
                          closesGaps: step.closesGaps,
                          missingPrereqs: [],
                          reason: step.reason,
                        }
                  }
                />
              );
            })}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
