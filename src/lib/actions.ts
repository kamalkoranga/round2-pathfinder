"use client";

import { useCallback, useState } from "react";

import { buildAdaptation } from "@/lib/engine/adapt";
import { generatePath } from "@/lib/engine/path";
import { useLearner, type PathSummary } from "@/lib/store";
import { pushCompletion, pushRating } from "@/lib/sync";
import { useSession } from "@/lib/useSession";
import type { LearningPath } from "@/lib/types";

/**
 * Generate and store a learning path.
 *
 * Signed in, generation happens on the server from the *persisted* profile and
 * is saved as a snapshot, so the stored plan always matches data we actually
 * hold. Signed out, the same engine runs in the browser and the result is kept
 * in localStorage — identical output, different home.
 */
export function useGeneratePath() {
  const { user } = useSession();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (): Promise<LearningPath | null> => {
    setGenerating(true);
    setError(null);
    try {
      const state = useLearner.getState();

      if (!user) {
        const path = generatePath(state.profile, buildAdaptation(state.feedback));
        state.setSavedPath(path);
        state.completeOnboarding();
        return path;
      }

      // Flush the profile first: the server generates from what it has stored,
      // so an unsaved edit would silently not be reflected in the plan.
      const saved = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: state.profile,
          intakeComplete: true,
          transcript: state.chat.slice(-40),
        }),
      });
      if (!saved.ok) throw new Error("Could not save your profile.");

      const response = await fetch("/api/path", { method: "POST" });
      if (!response.ok) throw new Error("Could not generate your path.");

      const { path } = (await response.json()) as { path: LearningPath };
      state.setSavedPath(path);
      state.completeOnboarding();

      // Refresh history so the newly archived path shows up.
      void fetch("/api/path")
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { history: PathSummary[] } | null) => {
          if (data?.history) useLearner.getState().setPathHistory(data.history);
        })
        .catch(() => {});

      return path;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not generate your path.";
      setError(message);
      return null;
    } finally {
      setGenerating(false);
    }
  }, [user]);

  return { generate, generating, error };
}

/**
 * Progress mutations that also persist when signed in.
 *
 * The local store is always updated first so the UI stays instant; the write is
 * fire-and-forget behind it.
 */
export function useProgressActions() {
  const { user } = useSession();
  const toggleComplete = useLearner((s) => s.toggleComplete);
  const rate = useLearner((s) => s.rate);
  const clearRating = useLearner((s) => s.clearRating);

  const toggle = useCallback(
    (resourceId: string) => {
      const wasComplete = useLearner
        .getState()
        .profile.completed.includes(resourceId);
      toggleComplete(resourceId);
      if (user) pushCompletion(resourceId, !wasComplete);
    },
    [toggleComplete, user],
  );

  const setRating = useCallback(
    (resourceId: string, signal: "up" | "down", reason?: string) => {
      rate(resourceId, signal, reason);
      if (user) pushRating(resourceId, signal, reason);
    },
    [rate, user],
  );

  const removeRating = useCallback(
    (resourceId: string) => {
      clearRating(resourceId);
      if (user) pushRating(resourceId, null);
    },
    [clearRating, user],
  );

  return { toggle, setRating, removeRating };
}
