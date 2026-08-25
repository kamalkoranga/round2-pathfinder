"use client";

import Link from "next/link";

import { PageShell } from "@/components/PageShell";
import { ResourceCard } from "@/components/ResourceCard";
import { GapBars, SkillRadar } from "@/components/SkillRadar";
import { IconArrowRight, IconSpark } from "@/components/icons";
import { Badge, Button, Card, CardHeader, Progress, SectionTitle, Stat } from "@/components/ui";
import { ROLE_BY_ID } from "@/lib/data/roles";
import { useDerived } from "@/lib/useDerived";

export default function DashboardPage() {
  const { profile, path, gaps, mastery, readiness, progress, actions, upNext, adaptation } =
    useDerived();

  const role = profile.roleId ? ROLE_BY_ID[profile.roleId] : null;
  const totalSteps = path.milestones.flatMap((m) => m.steps).length;
  const doneSteps = path.milestones
    .flatMap((m) => m.steps)
    .filter((s) => profile.completed.includes(s.resource.id)).length;

  return (
    <PageShell
      title={profile.name ? `Welcome back, ${profile.name}` : "Your dashboard"}
      description={
        role
          ? `Tracking toward ${role.title}. ${role.blurb}`
          : "Your progress, skill development and next recommended actions."
      }
      action={
        <Link href="/path">
          <Button variant="secondary" size="sm">
            View full path
            <IconArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      }
    >
      <div className="space-y-7">
        {/* ---- Headline stats ---- */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label="Goal readiness"
            value={`${Math.round(readiness * 100)}%`}
            sub="of your target profile"
          />
          <Stat
            label="Path progress"
            value={`${Math.round(progress * 100)}%`}
            sub={`${doneSteps} of ${totalSteps} steps`}
          />
          <Stat
            label="Open skill gaps"
            value={String(gaps.length)}
            sub={gaps[0] ? `top: ${gaps[0].name}` : "none remaining"}
          />
          <Stat
            label="Time remaining"
            value={`~${Math.max(
              0,
              Math.ceil(
                (path.totalHours * (1 - progress)) / Math.max(1, profile.hoursPerWeek),
              ),
            )}w`}
            sub={`at ${profile.hoursPerWeek}h/week`}
          />
        </div>

        {/* ---- Up next ---- */}
        {upNext ? (
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 bg-brand-50/60 px-5 py-3">
              <div className="flex items-center gap-2">
                <IconSpark className="h-4 w-4 text-brand-600" />
                <span className="text-[13px] font-semibold text-brand-800">
                  Up next in your path
                </span>
              </div>
              <Badge tone="brand">Step {upNext.order}</Badge>
            </div>
            <div className="p-5">
              <h3 className="text-[16px] font-semibold tracking-tight text-ink-900">
                {upNext.resource.title}
              </h3>
              <p className="mt-1 text-[12.5px] text-ink-400">
                {upNext.resource.provider} · {upNext.resource.hours} hours ·{" "}
                {upNext.resource.level}
              </p>
              <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-600">
                {upNext.reason}
              </p>
              <Link href="/path" className="mt-4 inline-block">
                <Button size="sm">
                  Go to this step
                  <IconArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </Card>
        ) : null}

        {/* ---- Skill development ---- */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Skill profile"
              description="Where you are now, where your path takes you, and the target."
            />
            <div className="p-5 pt-3">
              <SkillRadar
                mastery={mastery}
                projected={path.projected}
                gaps={gaps}
                size={276}
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Priority skill gaps"
              description="Ranked by gap size, importance to your goal, and how much else depends on them."
            />
            <div className="p-5 pt-4">
              <GapBars gaps={gaps} limit={7} />
            </div>
          </Card>
        </div>

        {/* ---- Milestone progress ---- */}
        {path.milestones.length > 0 ? (
          <div>
            <SectionTitle hint={`${path.milestones.length} stages`}>
              Milestones
            </SectionTitle>
            <Card className="divide-y divide-ink-100">
              {path.milestones.map((milestone, index) => {
                const completed = milestone.steps.filter((s) =>
                  profile.completed.includes(s.resource.id),
                ).length;
                const ratio = completed / milestone.steps.length;
                return (
                  <div key={milestone.id} className="flex items-center gap-4 p-4">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${
                        ratio === 1 ? "bg-mint-500 text-white" : "bg-ink-100 text-ink-500"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-[13.5px] font-medium text-ink-800">
                          {milestone.title}
                        </span>
                        <span className="shrink-0 text-[11.5px] tabular-nums text-ink-400">
                          {completed}/{milestone.steps.length} · wk {milestone.weekEnd}
                        </span>
                      </div>
                      <Progress
                        value={ratio}
                        className="mt-1.5"
                        tone={ratio === 1 ? "mint" : "brand"}
                      />
                    </div>
                  </div>
                );
              })}
            </Card>
          </div>
        ) : null}

        {/* ---- Next recommended actions ---- */}
        <div>
          <SectionTitle hint="ranked for you right now">
            Next recommended actions
          </SectionTitle>
          {actions.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {actions.map((scored) => (
                <ResourceCard key={scored.resource.id} scored={scored} />
              ))}
            </div>
          ) : (
            <Card className="p-6 text-center text-[13px] text-ink-400">
              Nothing new to recommend — you have covered the catalog for this goal.
            </Card>
          )}
        </div>

        {/* ---- Adaptation log ---- */}
        {adaptation.notes.length > 0 ? (
          <div>
            <SectionTitle>How your feedback changed things</SectionTitle>
            <Card className="p-5">
              <ul className="space-y-2">
                {adaptation.notes.map((note) => (
                  <li
                    key={note}
                    className="flex gap-2.5 text-[13px] leading-relaxed text-ink-600"
                  >
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand-500" />
                    {note}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}
