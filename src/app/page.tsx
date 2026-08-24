"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ChatIntake } from "@/components/ChatIntake";
import { IconCompass, IconRoute, IconSpark, IconTarget } from "@/components/icons";
import { useLearner } from "@/lib/store";

const PILLARS = [
  {
    Icon: IconTarget,
    title: "Skill-gap analysis",
    body: "Your profile and your goal become vectors over a skill taxonomy. The difference is what you actually need to learn.",
  },
  {
    Icon: IconRoute,
    title: "Sequenced, not listed",
    body: "A topological sort over prerequisites means step 7 never assumes something step 9 teaches.",
  },
  {
    Icon: IconSpark,
    title: "Every pick explained",
    body: "Six scored components per recommendation, and an assistant that answers why in plain language.",
  },
];

export default function Home() {
  const onboarded = useLearner((s) => s.onboarded);
  const [mounted, setMounted] = useState(false);

  // Zustand hydrates from localStorage after mount; render nothing goal-specific
  // until then to avoid a hydration mismatch.
  useEffect(() => setMounted(true), []);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-8 sm:px-8 lg:py-14">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-14">
        {/* ---- Left: pitch ---- */}
        <div className="lg:pt-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-900 text-white">
              <IconCompass className="h-5 w-5" />
            </span>
            <span className="text-[16px] font-semibold tracking-tight text-ink-900">
              PathFinder
            </span>
          </div>

          <h1 className="mt-8 text-[34px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink-900 sm:text-[44px]">
            Stop collecting courses.
            <br />
            <span className="text-ink-400">Start following a path.</span>
          </h1>

          <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-ink-500">
            Describe your goal in your own words. PathFinder works out the skills
            you are missing, then builds a sequenced roadmap of courses, projects
            and checkpoints — with the prerequisites in the right order and a
            reason attached to every step.
          </p>

          {mounted && onboarded ? (
            <Link
              href="/dashboard"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-ink-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-ink-800"
            >
              Back to my dashboard
            </Link>
          ) : null}

          <dl className="mt-11 space-y-6">
            {PILLARS.map(({ Icon, title, body }) => (
              <div key={title} className="flex gap-3.5">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600 ring-1 ring-ink-200">
                  <Icon className="h-[17px] w-[17px]" />
                </span>
                <div>
                  <dt className="text-[14px] font-semibold text-ink-800">{title}</dt>
                  <dd className="mt-1 max-w-md text-[13.5px] leading-relaxed text-ink-500">
                    {body}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        </div>

        {/* ---- Right: intake ---- */}
        <div className="flex h-[min(78vh,42rem)] flex-col rounded-2xl border border-ink-200 bg-ink-100/60 p-4 lg:h-[min(82vh,44rem)]">
          <div className="mb-3 flex items-center justify-between px-1">
            <span className="text-[12px] font-semibold uppercase tracking-[0.07em] text-ink-400">
              Let&apos;s begin
            </span>
          </div>
          <div className="min-h-0 flex-1">
            <ChatIntake />
          </div>
        </div>
      </div>
    </main>
  );
}
