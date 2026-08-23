"use client";

import { useMemo } from "react";

import { SKILL_BY_ID } from "@/lib/data/skills";
import type { SkillGap } from "@/lib/types";

/** Domain names are too long to sit around a small radar — abbreviate. */
const SHORT_DOMAIN: Record<string, string> = {
  "Machine Learning": "ML",
  "Web Development": "Web Dev",
  "Cloud & DevOps": "DevOps",
  "Product & Career": "Product",
  Mathematics: "Maths",
};

/**
 * Radar chart comparing current mastery, the target profile, and where the
 * generated path is projected to take the learner.
 *
 * Axes are the domains of the learner's top gaps rather than raw skills — six
 * readable labels instead of thirty unreadable ones.
 */
export function SkillRadar({
  mastery,
  projected,
  gaps,
  size = 260,
}: {
  mastery: Record<string, number>;
  projected: Record<string, number>;
  gaps: SkillGap[];
  size?: number;
}) {
  const axes = useMemo(() => {
    // Aggregate to domain level, weighted by each skill's target.
    const domains = new Map<
      string,
      { current: number; target: number; projected: number; weight: number }
    >();

    for (const gap of gaps) {
      const entry = domains.get(gap.domain) ?? {
        current: 0,
        target: 0,
        projected: 0,
        weight: 0,
      };
      entry.current += gap.current * gap.target;
      entry.target += gap.target * gap.target;
      entry.projected += Math.min(projected[gap.skillId] ?? 0, gap.target) * gap.target;
      entry.weight += gap.target;
      domains.set(gap.domain, entry);
    }

    // Include domains the learner has already satisfied, so progress is visible.
    for (const [skillId, value] of Object.entries(mastery)) {
      const domain = SKILL_BY_ID[skillId]?.domain;
      if (!domain || domains.has(domain) || value < 0.3) continue;
      domains.set(domain, {
        current: value * 0.6,
        target: 0.6 * 0.6,
        projected: value * 0.6,
        weight: 0.6,
      });
    }

    return Array.from(domains.entries())
      .map(([domain, v]) => ({
        domain,
        current: v.weight > 0 ? v.current / v.weight : 0,
        target: v.weight > 0 ? v.target / v.weight : 0,
        projected: v.weight > 0 ? v.projected / v.weight : 0,
        weight: v.weight,
      }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 6);
  }, [gaps, mastery, projected]);

  if (axes.length < 3) {
    return (
      <div className="flex h-48 items-center justify-center text-center text-[13px] text-ink-400">
        Not enough skill dimensions yet — set a goal to see your profile.
      </div>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 54;
  const count = axes.length;

  const point = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    const r = radius * Math.max(0.04, Math.min(1, value));
    return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r] as const;
  };

  const polygon = (key: "current" | "target" | "projected") =>
    axes.map((axis, i) => point(i, axis[key]).join(",")).join(" ");

  return (
    <div className="flex flex-col items-center px-6">
      <svg
        width={size}
        height={size}
        role="img"
        aria-label="Skill profile radar chart"
        style={{ overflow: "visible" }}
      >
        {/* Grid rings */}
        {[0.25, 0.5, 0.75, 1].map((ring) => (
          <polygon
            key={ring}
            points={axes.map((_, i) => point(i, ring).join(",")).join(" ")}
            fill="none"
            stroke="var(--color-ink-200)"
            strokeWidth={1}
          />
        ))}

        {/* Spokes */}
        {axes.map((_, i) => {
          const [x, y] = point(i, 1);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="var(--color-ink-200)"
              strokeWidth={1}
            />
          );
        })}

        {/* Target — dashed outline */}
        <polygon
          points={polygon("target")}
          fill="none"
          stroke="var(--color-ink-400)"
          strokeWidth={1.4}
          strokeDasharray="4 3"
        />

        {/* Projected after path — light fill */}
        <polygon
          points={polygon("projected")}
          fill="var(--color-brand-500)"
          fillOpacity={0.12}
          stroke="var(--color-brand-400)"
          strokeWidth={1.4}
        />

        {/* Current — solid */}
        <polygon
          points={polygon("current")}
          fill="var(--color-brand-600)"
          fillOpacity={0.3}
          stroke="var(--color-brand-600)"
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* Labels */}
        {axes.map((axis, i) => {
          const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
          const lx = cx + Math.cos(angle) * (radius + 18);
          const ly = cy + Math.sin(angle) * (radius + 18);
          const anchor =
            Math.abs(Math.cos(angle)) < 0.25 ? "middle" : Math.cos(angle) > 0 ? "start" : "end";
          return (
            <text
              key={axis.domain}
              x={lx}
              y={ly}
              textAnchor={anchor}
              dominantBaseline="middle"
              className="fill-ink-500"
              style={{ fontSize: 10 }}
            >
              {SHORT_DOMAIN[axis.domain] ?? axis.domain}
            </text>
          );
        })}
      </svg>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11.5px] text-ink-500">
        <Legend color="var(--color-brand-600)" label="Now" />
        <Legend color="var(--color-brand-300)" label="After your path" />
        <Legend color="var(--color-ink-400)" label="Target" dashed />
      </div>
    </div>
  );
}

function Legend({
  color,
  label,
  dashed,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="h-0 w-4 border-t-2"
        style={{
          borderColor: color,
          borderStyle: dashed ? "dashed" : "solid",
        }}
      />
      {label}
    </span>
  );
}

/** Horizontal gap bars — the precise read that the radar only gestures at. */
export function GapBars({ gaps, limit = 8 }: { gaps: SkillGap[]; limit?: number }) {
  if (gaps.length === 0) {
    return (
      <p className="py-6 text-center text-[13px] text-ink-400">
        No open gaps — you already meet this target profile.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {gaps.slice(0, limit).map((gap) => (
        <div key={gap.skillId}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="truncate text-[13px] font-medium text-ink-700">
              {gap.name}
            </span>
            <span className="shrink-0 text-[11.5px] tabular-nums text-ink-400">
              {Math.round(gap.current * 100)}% → {Math.round(gap.target * 100)}%
            </span>
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-ink-100">
            {/* Target extent */}
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-brand-100"
              style={{ width: `${gap.target * 100}%` }}
            />
            {/* Current mastery */}
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-brand-600 transition-[width] duration-500"
              style={{ width: `${gap.current * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
