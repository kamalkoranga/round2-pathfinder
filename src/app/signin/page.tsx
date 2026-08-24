"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { IconArrowRight, IconCompass } from "@/components/icons";
import { Button, Card } from "@/components/ui";
import { signInWithGitHub, useSession } from "@/lib/useSession";

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

function SignInContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading, authAvailable } = useSession();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(params.get("error"));

  const next = params.get("next") ?? "/dashboard";

  // Already signed in — no reason to show a sign-in screen.
  useEffect(() => {
    if (user) router.replace(next);
  }, [user, next, router]);

  async function handleSignIn() {
    setBusy(true);
    setError(null);
    try {
      await signInWithGitHub(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start sign-in.");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-900 text-white">
            <IconCompass className="h-5 w-5" />
          </span>
          <span className="text-[16px] font-semibold tracking-tight text-ink-900">
            PathFinder
          </span>
        </Link>

        <Card className="p-7">
          <h1 className="text-[19px] font-semibold tracking-tight text-ink-900">
            Sign in to save your path
          </h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-500">
            Your profile, progress and generated roadmaps are stored to your
            account, so they follow you across devices.
          </p>

          {!authAvailable ? (
            <div className="mt-5 rounded-lg bg-amber-100/70 px-3.5 py-3 text-[13px] leading-relaxed text-amber-700">
              Sign-in is not configured on this deployment. PathFinder still works
              — your data is saved in this browser only.
              <Link href="/" className="mt-2 block font-medium underline">
                Continue without an account
              </Link>
            </div>
          ) : (
            <>
              {error ? (
                <p className="mt-5 rounded-lg bg-rose-100 px-3.5 py-2.5 text-[13px] leading-relaxed text-rose-700">
                  {error}
                </p>
              ) : null}

              <Button
                className="mt-5 w-full"
                onClick={handleSignIn}
                disabled={busy || loading}
              >
                <GitHubMark className="h-4 w-4" />
                {busy ? "Redirecting…" : "Continue with GitHub"}
              </Button>

              <Link
                href="/"
                className="mt-4 flex items-center justify-center gap-1.5 text-[13px] text-ink-500 transition-colors hover:text-ink-800"
              >
                Try it without an account
                <IconArrowRight className="h-3.5 w-3.5" />
              </Link>
            </>
          )}
        </Card>

        <p className="mt-5 text-center text-[12px] leading-relaxed text-ink-400">
          We only read your GitHub profile and email — nothing is written to your
          account and no repositories are accessed.
        </p>
      </div>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInContent />
    </Suspense>
  );
}
