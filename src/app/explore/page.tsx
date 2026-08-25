"use client";

import { useMemo, useState } from "react";

import { PageShell } from "@/components/PageShell";
import { ResourceCard } from "@/components/ResourceCard";
import { IconSearch } from "@/components/icons";
import { Button, Card } from "@/components/ui";
import { CATALOG_DOMAINS } from "@/lib/data/catalog";
import { recommend } from "@/lib/engine/recommend";
import { useDerived } from "@/lib/useDerived";
import type { ResourceKind } from "@/lib/types";
import { cn } from "@/lib/utils";

const KINDS: { value: ResourceKind | "all"; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "course", label: "Courses" },
  { value: "project", label: "Projects" },
  { value: "assessment", label: "Checkpoints" },
  { value: "reading", label: "Readings" },
];

const PAGE_SIZE = 12;

export default function ExplorePage() {
  const { profile, adaptation } = useDerived();

  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<ResourceKind | "all">("all");
  const [domain, setDomain] = useState<string>("all");
  const [reachableOnly, setReachableOnly] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);

  // Search re-runs the full ranking with the query blended into the relevance
  // term, so results stay personalised rather than becoming a plain text search.
  const results = useMemo(() => {
    const ranked = recommend(profile, {
      adaptation,
      reachableOnly,
      kind: kind === "all" ? undefined : kind,
      queryBoost: query,
    });
    const filtered =
      domain === "all" ? ranked : ranked.filter((s) => s.resource.domain === domain);

    if (!query.trim()) return filtered;

    // With an explicit query, drop results with no lexical signal at all.
    const needle = query.toLowerCase();
    return filtered.filter(
      (s) =>
        s.components.relevance > 0.02 ||
        s.resource.title.toLowerCase().includes(needle) ||
        s.resource.tags.some((t) => t.includes(needle)) ||
        s.resource.provider.toLowerCase().includes(needle),
    );
  }, [profile, adaptation, kind, domain, reachableOnly, query]);

  return (
    <PageShell
      title="Explore the catalog"
      description="Everything is still ranked against your goal and skill gaps — searching narrows the field, it doesn't switch off the personalisation."
      requireProfile={false}
    >
      <div className="space-y-5">
        {/* ---- Controls ---- */}
        <Card className="p-4">
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setLimit(PAGE_SIZE);
              }}
              placeholder="Search courses, skills, providers…"
              className="w-full rounded-lg border border-ink-200 bg-white py-2.5 pl-9 pr-3 text-sm text-ink-800 placeholder:text-ink-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {KINDS.map((option) => (
              <FilterChip
                key={option.value}
                active={kind === option.value}
                onClick={() => {
                  setKind(option.value);
                  setLimit(PAGE_SIZE);
                }}
              >
                {option.label}
              </FilterChip>
            ))}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <FilterChip active={domain === "all"} onClick={() => setDomain("all")}>
              All domains
            </FilterChip>
            {CATALOG_DOMAINS.map((option) => (
              <FilterChip
                key={option}
                active={domain === option}
                onClick={() => {
                  setDomain(option);
                  setLimit(PAGE_SIZE);
                }}
              >
                {option}
              </FilterChip>
            ))}
          </div>

          <label className="mt-3 flex w-fit cursor-pointer items-center gap-2 text-[13px] text-ink-600">
            <input
              type="checkbox"
              checked={reachableOnly}
              onChange={(event) => setReachableOnly(event.target.checked)}
              className="h-4 w-4 rounded border-ink-300 accent-brand-600"
            />
            Only show what I can start today
          </label>
        </Card>

        {/* ---- Results ---- */}
        <div className="flex items-baseline justify-between">
          <p className="text-[13px] text-ink-500">
            {results.length} result{results.length === 1 ? "" : "s"}
            {query ? ` for "${query}"` : ""}
          </p>
        </div>

        {results.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="text-[14px] font-medium text-ink-700">No matches</p>
            <p className="mx-auto mt-1 max-w-sm text-[13px] text-ink-500">
              Try a broader search term, or clear the filters.
            </p>
          </Card>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              {results.slice(0, limit).map((scored) => (
                <ResourceCard key={scored.resource.id} scored={scored} />
              ))}
            </div>

            {limit < results.length ? (
              <div className="flex justify-center pt-1">
                <Button
                  variant="secondary"
                  onClick={() => setLimit((value) => value + PAGE_SIZE)}
                >
                  Show more ({results.length - limit} remaining)
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </PageShell>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md px-2.5 py-1 text-[12.5px] font-medium transition-colors",
        active
          ? "bg-ink-900 text-white"
          : "border border-ink-200 bg-white text-ink-500 hover:border-ink-300 hover:text-ink-700",
      )}
    >
      {children}
    </button>
  );
}
