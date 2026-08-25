"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { PageShell } from "@/components/PageShell";
import { IconCheck, IconRefresh } from "@/components/icons";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  SectionTitle,
  inputClass,
} from "@/components/ui";
import { useProgressActions } from "@/lib/actions";
import { RESOURCE_BY_ID } from "@/lib/data/catalog";
import { ROLES } from "@/lib/data/roles";
import { SKILLS, SKILL_DOMAINS } from "@/lib/data/skills";
import { LEVELS, STYLES, useLearner } from "@/lib/store";
import { useDerived } from "@/lib/useDerived";
import type { LearningStyle, Level } from "@/lib/types";
import { cn } from "@/lib/utils";

const MASTERY_STEPS = [
  { value: 0, label: "None" },
  { value: 0.35, label: "Basic" },
  { value: 0.65, label: "Solid" },
  { value: 0.9, label: "Strong" },
];

export default function ProfilePage() {
  const router = useRouter();
  const { profile } = useDerived();
  const { setProfile, setSkill, reset } = useLearner();
  const { toggle } = useProgressActions();

  const [skillFilter, setSkillFilter] = useState<string>(SKILL_DOMAINS[0]);
  const [confirmReset, setConfirmReset] = useState(false);

  const visibleSkills = useMemo(
    () => SKILLS.filter((s) => s.domain === skillFilter),
    [skillFilter],
  );

  const completedResources = profile.completed
    .map((id) => RESOURCE_BY_ID[id])
    .filter(Boolean);

  return (
    <PageShell
      title="Your profile"
      description="Everything the recommender knows about you. Edit anything here and your path regenerates immediately."
      requireProfile={false}
    >
      <div className="space-y-5">
        {/* ---- Goal ---- */}
        <Card>
          <CardHeader
            title="Goal"
            description="What you're working toward. This drives the target skill vector."
          />
          <div className="space-y-4 p-5 pt-4">
            <Field label="Your name" hint="optional">
              <input
                className={inputClass}
                value={profile.name}
                onChange={(event) => setProfile({ name: event.target.value })}
                placeholder="How should we address you?"
              />
            </Field>

            <Field label="Goal, in your own words">
              <textarea
                className={cn(inputClass, "min-h-[76px] resize-y")}
                value={profile.goalText}
                onChange={(event) => setProfile({ goalText: event.target.value })}
                placeholder="e.g. I want to move from backend engineering into machine learning"
              />
            </Field>

            <Field label="Target role" hint="sets the skill profile you're measured against">
              <div className="flex flex-wrap gap-1.5">
                {ROLES.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => setProfile({ roleId: role.id })}
                    className={cn(
                      "rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition-colors",
                      profile.roleId === role.id
                        ? "bg-ink-900 text-white"
                        : "border border-ink-200 bg-white text-ink-600 hover:border-ink-300",
                    )}
                  >
                    {role.title}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </Card>

        {/* ---- Logistics ---- */}
        <Card>
          <CardHeader
            title="How you learn"
            description="Used for level fit, style fit and pacing the milestones."
          />
          <div className="grid gap-5 p-5 pt-4 sm:grid-cols-2">
            <Field label="Current level">
              <div className="flex gap-1.5">
                {LEVELS.map((level) => (
                  <button
                    key={level}
                    onClick={() => setProfile({ level: level as Level })}
                    className={cn(
                      "flex-1 rounded-lg px-2 py-2 text-[12.5px] font-medium capitalize transition-colors",
                      profile.level === level
                        ? "bg-ink-900 text-white"
                        : "border border-ink-200 bg-white text-ink-600 hover:border-ink-300",
                    )}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </Field>

            <Field
              label="Hours per week"
              hint={`~${Math.round(profile.hoursPerWeek / 5)}h per weekday`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={40}
                  value={profile.hoursPerWeek}
                  onChange={(event) =>
                    setProfile({ hoursPerWeek: Number(event.target.value) })
                  }
                  className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-ink-200 accent-brand-600"
                />
                <span className="w-12 shrink-0 text-right text-[13px] font-semibold tabular-nums text-ink-800">
                  {profile.hoursPerWeek}h
                </span>
              </div>
            </Field>

            <Field label="Preferred format">
              <div className="flex flex-wrap gap-1.5">
                {STYLES.map((style) => (
                  <button
                    key={style.value}
                    onClick={() => setProfile({ style: style.value as LearningStyle })}
                    title={style.hint}
                    className={cn(
                      "rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition-colors",
                      profile.style === style.value
                        ? "bg-ink-900 text-white"
                        : "border border-ink-200 bg-white text-ink-600 hover:border-ink-300",
                    )}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Deadline" hint="optional">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={104}
                  value={profile.targetWeeks ?? ""}
                  onChange={(event) =>
                    setProfile({
                      targetWeeks: event.target.value ? Number(event.target.value) : null,
                    })
                  }
                  placeholder="—"
                  className={cn(inputClass, "w-24")}
                />
                <span className="text-[13px] text-ink-500">weeks</span>
              </div>
            </Field>
          </div>
        </Card>

        {/* ---- Skills ---- */}
        <Card>
          <CardHeader
            title="Skill self-assessment"
            description="Be honest — under-reporting adds redundant steps, over-reporting skips foundations you actually need."
          />
          <div className="p-5 pt-4">
            <div className="mb-4 flex flex-wrap gap-1.5">
              {SKILL_DOMAINS.map((domain) => (
                <button
                  key={domain}
                  onClick={() => setSkillFilter(domain)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors",
                    skillFilter === domain
                      ? "bg-brand-600 text-white"
                      : "border border-ink-200 bg-white text-ink-500 hover:border-ink-300",
                  )}
                >
                  {domain}
                </button>
              ))}
            </div>

            <div className="space-y-1">
              {visibleSkills.map((skill) => {
                const value = profile.skills[skill.id] ?? 0;
                return (
                  <div
                    key={skill.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-ink-50"
                  >
                    <span className="text-[13px] text-ink-700">{skill.name}</span>
                    <div className="flex gap-1">
                      {MASTERY_STEPS.map((step) => {
                        const active = Math.abs(value - step.value) < 0.13;
                        return (
                          <button
                            key={step.value}
                            onClick={() => setSkill(skill.id, step.value)}
                            className={cn(
                              "rounded-md px-2 py-1 text-[11.5px] font-medium transition-colors",
                              active
                                ? "bg-brand-600 text-white"
                                : "bg-ink-100 text-ink-500 hover:bg-ink-200",
                            )}
                          >
                            {step.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* ---- Learning history ---- */}
        <Card>
          <CardHeader
            title="Learning history"
            description="Completed items count toward your mastery vector and are never recommended again."
            action={
              <Badge tone="neutral">{completedResources.length} completed</Badge>
            }
          />
          <div className="p-5 pt-4">
            {completedResources.length === 0 ? (
              <p className="py-4 text-center text-[13px] text-ink-400">
                Nothing marked complete yet. Tick items off as you finish them and your
                path will re-plan around them.
              </p>
            ) : (
              <div className="space-y-1.5">
                {completedResources.map((resource) => (
                  <div
                    key={resource.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-ink-100 bg-ink-50/60 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium text-ink-700">
                        {resource.title}
                      </div>
                      <div className="text-[11.5px] text-ink-400">
                        {resource.provider} · {resource.hours}h
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggle(resource.id)}
                    >
                      Undo
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* ---- Danger zone ---- */}
        <div>
          <SectionTitle>Reset</SectionTitle>
          <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <p className="text-[13.5px] font-medium text-ink-700">
                Start over from scratch
              </p>
              <p className="mt-0.5 text-[12.5px] text-ink-500">
                Clears your profile, feedback and history from this browser.
              </p>
            </div>
            {confirmReset ? (
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setConfirmReset(false)}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    reset();
                    router.push("/");
                  }}
                >
                  <IconCheck className="h-3.5 w-3.5" />
                  Confirm reset
                </Button>
              </div>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setConfirmReset(true)}>
                <IconRefresh className="h-3.5 w-3.5" />
                Reset everything
              </Button>
            )}
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
