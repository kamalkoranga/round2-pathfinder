"use client";

import { useEffect, useRef } from "react";

import { useLearner, type PathSummary } from "@/lib/store";
import { useSession } from "@/lib/useSession";
import type { ChatMessage, Feedback, LearnerProfile, LearningPath } from "@/lib/types";

/**
 * Keeps the local store and the server in step.
 *
 * Two modes:
 *   signed out — localStorage only, and this does nothing.
 *   signed in  — Postgres is authoritative; local state is the working copy and
 *                an offline cache.
 *
 * The interesting case is the transition. Someone can use the whole app
 * anonymously, build a profile and a path, and only then sign in. Throwing that
 * away would be indefensible, so the first sync *adopts* the local record when
 * the account is empty. Once the account has data, the server wins and the
 * local copy is replaced — an account that silently reverted to a stale browser
 * copy would be worse than either.
 */

interface ServerProfile {
  profile: LearnerProfile;
  feedback: Feedback[];
  intakeComplete: boolean;
  transcript: ChatMessage[];
}

/** Has the learner actually put anything into this browser's copy? */
function hasLocalWork(profile: LearnerProfile, onboarded: boolean): boolean {
  return (
    onboarded ||
    profile.goalText.trim().length > 0 ||
    profile.roleId !== null ||
    profile.completed.length > 0 ||
    Object.keys(profile.skills).length > 0
  );
}

/** Is the account still empty? */
function isServerEmpty(server: ServerProfile): boolean {
  return (
    !server.intakeComplete &&
    server.profile.goalText.trim().length === 0 &&
    server.profile.roleId === null &&
    server.profile.completed.length === 0 &&
    Object.keys(server.profile.skills).length === 0
  );
}

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSession();

  const hydrateFromServer = useLearner((s) => s.hydrateFromServer);
  const setSyncStatus = useLearner((s) => s.setSyncStatus);

  /** The user id we have already run the initial sync for. */
  const syncedFor = useRef<string | null>(null);
  /** Revision at the time of the last successful save, to avoid redundant PUTs. */
  const lastSaved = useRef<number>(-1);

  // ---- Initial sync / adoption -------------------------------------------
  useEffect(() => {
    if (loading) return;

    if (!user) {
      syncedFor.current = null;
      lastSaved.current = -1;
      setSyncStatus("local");
      return;
    }

    if (syncedFor.current === user.id) return;
    syncedFor.current = user.id;

    let cancelled = false;

    (async () => {
      setSyncStatus("syncing");
      try {
        const [profileRes, pathRes] = await Promise.all([
          fetch("/api/profile"),
          fetch("/api/path"),
        ]);
        if (!profileRes.ok) throw new Error("Could not load your account.");

        const server = (await profileRes.json()) as ServerProfile;
        const pathData = pathRes.ok
          ? ((await pathRes.json()) as { path: LearningPath | null; history: PathSummary[] })
          : { path: null, history: [] };

        if (cancelled) return;

        const local = useLearner.getState();
        const adopt = isServerEmpty(server) && hasLocalWork(local.profile, local.onboarded);

        if (adopt) {
          // First sign-in with anonymous work in hand: push it up, keep it.
          const saved = await fetch("/api/profile", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              profile: local.profile,
              intakeComplete: local.onboarded,
              transcript: local.chat.slice(-40),
            }),
          });
          if (!saved.ok) throw new Error("Could not save your existing profile.");

          // Ratings and completions are stored separately, so replay them.
          await Promise.all([
            ...local.profile.completed.map((resourceId) =>
              fetch("/api/progress", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ kind: "completion", resourceId, done: true }),
              }),
            ),
            ...local.feedback.map((f) =>
              fetch("/api/progress", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  kind: "rating",
                  resourceId: f.resourceId,
                  signal: f.signal,
                  reason: f.reason,
                }),
              }),
            ),
          ]);

          if (cancelled) return;
          lastSaved.current = local.revision;
          setSyncStatus("synced");
          return;
        }

        // Account already has data — it wins.
        hydrateFromServer({
          profile: server.profile,
          feedback: server.feedback,
          onboarded: server.intakeComplete,
          chat: server.transcript ?? [],
          savedPath: pathData.path,
          pathHistory: pathData.history ?? [],
        });
        lastSaved.current = useLearner.getState().revision;
      } catch (error) {
        if (cancelled) return;
        console.error("[sync]", error);
        setSyncStatus(
          "error",
          error instanceof Error ? error.message : "Sync failed.",
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, loading, hydrateFromServer, setSyncStatus]);

  // ---- Debounced profile saves -------------------------------------------
  useEffect(() => {
    if (!user) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const unsubscribe = useLearner.subscribe((state, previous) => {
      if (state.revision === previous.revision) return;
      if (state.revision === lastSaved.current) return;

      if (timer) clearTimeout(timer);
      // Profile edits arrive in bursts (typing, slider drags). Coalesce them.
      timer = setTimeout(async () => {
        const current = useLearner.getState();
        const revisionAtSend = current.revision;
        try {
          const response = await fetch("/api/profile", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              profile: current.profile,
              intakeComplete: current.onboarded,
              transcript: current.chat.slice(-40),
            }),
          });
          if (!response.ok) throw new Error("Save failed.");
          lastSaved.current = revisionAtSend;
          // Only clear the error if nothing changed while we were in flight.
          if (useLearner.getState().revision === revisionAtSend) {
            setSyncStatus("synced");
          }
        } catch (error) {
          console.error("[sync:save]", error);
          setSyncStatus("error", "Changes are saved in this browser but not to your account.");
        }
      }, 900);
    });

    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [user, setSyncStatus]);

  return <>{children}</>;
}

/**
 * Fire-and-forget progress writes.
 *
 * Completions and ratings are their own endpoints so a single checkbox does not
 * round-trip the entire profile. Failures are logged, not surfaced: the local
 * store already has the change, and the next profile save reconciles.
 */
export function pushCompletion(resourceId: string, done: boolean) {
  void fetch("/api/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "completion", resourceId, done }),
  }).catch((error) => console.error("[sync:completion]", error));
}

export function pushRating(
  resourceId: string,
  signal: "up" | "down" | null,
  reason?: string,
) {
  void fetch("/api/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "rating", resourceId, signal, reason }),
  }).catch((error) => console.error("[sync:rating]", error));
}
