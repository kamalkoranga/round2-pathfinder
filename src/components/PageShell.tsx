"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Button, EmptyState } from "@/components/ui";
import { useLearner } from "@/lib/store";
import { useHydrated } from "@/lib/useDerived";

export function PageShell({
  title,
  description,
  action,
  children,
  /** When true, shows a prompt instead of children until onboarding is done. */
  requireProfile = true,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  requireProfile?: boolean;
}) {
  const hydrated = useHydrated();
  const onboarded = useLearner((s) => s.onboarded);

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-7 sm:px-8 lg:py-10">
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.015em] text-ink-900">
            {title}
          </h1>
          {description ? (
            <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-ink-500">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>

      {!hydrated ? (
        <LoadingSkeleton />
      ) : requireProfile && !onboarded ? (
        <EmptyState
          title="No learning path yet"
          description="Tell PathFinder what you want to achieve and it will build your personalised roadmap in a few seconds."
          action={
            <Link href="/">
              <Button>Set up my profile</Button>
            </Link>
          }
        />
      ) : (
        children
      )}
    </main>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-24 animate-pulse-soft rounded-[--radius-card] border border-ink-200 bg-white"
          style={{ animationDelay: `${i * 0.1}s` }}
        />
      ))}
    </div>
  );
}
