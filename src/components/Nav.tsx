"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import {
  IconCompass,
  IconGrid,
  IconRoute,
  IconSearch,
  IconSpark,
  IconUser,
} from "@/components/icons";
import { useLearner } from "@/lib/store";
import { signOut, useSession } from "@/lib/useSession";
import { cn, initials } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", Icon: IconGrid },
  { href: "/path", label: "My Path", Icon: IconRoute },
  { href: "/explore", label: "Explore", Icon: IconSearch },
  { href: "/assistant", label: "Assistant", Icon: IconSpark },
  { href: "/profile", label: "Profile", Icon: IconUser },
];

export function Nav() {
  const pathname = usePathname();
  const profile = useLearner((s) => s.profile);
  const onboarded = useLearner((s) => s.onboarded);
  const { user, authAvailable } = useSession();

  const displayName = user?.name || profile.name || "Learner";
  const [status, setStatus] = useState<{ enabled: boolean; label: string } | null>(
    null,
  );

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((d) =>
        setStatus({
          enabled: Boolean(d.aiEnabled),
          label: String(d.providerLabel ?? "Offline engine"),
        }),
      )
      .catch(() => setStatus({ enabled: false, label: "Offline engine" }));
  }, []);

  // The intake screen is deliberately chrome-free.
  if (pathname === "/" || pathname === "/onboarding") return null;

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-ink-200 bg-white lg:flex">
        <Link href="/dashboard" className="flex items-center gap-2.5 px-5 py-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-900 text-white">
            <IconCompass className="h-[18px] w-[18px]" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-ink-900">
            PathFinder
          </span>
        </Link>

        <nav className="flex-1 space-y-0.5 px-3">
          {LINKS.map(({ href, label, Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors",
                  active
                    ? "bg-ink-100 text-ink-900"
                    : "text-ink-500 hover:bg-ink-50 hover:text-ink-800",
                )}
              >
                <Icon className={cn("h-[18px] w-[18px]", active && "text-brand-600")} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-ink-200 p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
            {user?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt=""
                className="h-8 w-8 shrink-0 rounded-full bg-ink-100 object-cover"
              />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[12px] font-semibold text-brand-700">
                {initials(displayName)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-ink-800">
                {displayName}
              </div>
              <div className="truncate text-[11.5px] text-ink-400">
                {onboarded ? `${profile.hoursPerWeek}h / week` : "Not set up"}
              </div>
            </div>
          </div>

          <SyncBadge />

          {authAvailable ? (
            user ? (
              <button
                onClick={() => void signOut()}
                className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-[11.5px] text-ink-400 transition-colors hover:bg-ink-50 hover:text-ink-700"
              >
                Sign out
              </button>
            ) : (
              <Link
                href="/signin"
                className="mt-1 block rounded-lg px-2 py-1.5 text-[11.5px] font-medium text-brand-700 transition-colors hover:bg-brand-50"
              >
                Sign in to save your path →
              </Link>
            )
          ) : null}

          <div className="mt-1 flex items-center gap-1.5 px-2 pb-1 text-[11px] text-ink-400">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                status === null
                  ? "bg-ink-300 animate-pulse-soft"
                  : status.enabled
                    ? "bg-mint-500"
                    : "bg-amber-500",
              )}
            />
            {status === null
              ? "Checking assistant…"
              : status.enabled
                ? `${status.label} assistant live`
                : "Offline engine mode"}
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/85 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink-900 text-white">
              <IconCompass className="h-4 w-4" />
            </span>
            <span className="text-[14px] font-semibold tracking-tight">PathFinder</span>
          </Link>
          {user?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt=""
              className="h-7 w-7 rounded-full bg-ink-100 object-cover"
            />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-[11px] font-semibold text-brand-700">
              {initials(displayName)}
            </span>
          )}
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          {LINKS.map(({ href, label, Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition-colors",
                  active ? "bg-ink-100 text-ink-900" : "text-ink-500",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </header>
    </>
  );
}

/**
 * Where the learner's data currently lives.
 *
 * Worth showing plainly: signed out, everything is in this browser and will not
 * follow them anywhere. Silently losing a plan is the kind of thing people only
 * discover when it is too late to matter.
 */
function SyncBadge() {
  const status = useLearner((s) => s.syncStatus);
  const error = useLearner((s) => s.syncError);

  const map = {
    local: { dot: "bg-ink-300", text: "Saved in this browser" },
    syncing: { dot: "bg-amber-500 animate-pulse-soft", text: "Syncing…" },
    synced: { dot: "bg-mint-500", text: "Synced to your account" },
    error: { dot: "bg-rose-500", text: error ?? "Sync failed" },
  }[status];

  return (
    <div
      className="flex items-start gap-1.5 px-2 py-1 text-[11px] text-ink-400"
      title={status === "error" ? (error ?? undefined) : undefined}
    >
      <span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", map.dot)} />
      <span className="leading-snug">{map.text}</span>
    </div>
  );
}
