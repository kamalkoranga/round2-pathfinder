"use client";

import { useEffect, useMemo, useState } from "react";

import { buildAdaptation } from "@/lib/engine/adapt";
import { buildLearnerVector, computeGaps, computeReadiness } from "@/lib/engine/gap";
import { generatePath, pathProgress, pathSteps, nextStep } from "@/lib/engine/path";
import { nextActions, recommend } from "@/lib/engine/recommend";
import { useLearner } from "@/lib/store";

/**
 * True once zustand has rehydrated from localStorage.
 *
 * Everything derived from the profile must wait for this, otherwise the server
 * render (empty profile) and the first client render (restored profile) disagree.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

/**
 * All derived state in one place.
 *
 * Nothing here is persisted — the path, gaps and ranking are recomputed from the
 * profile whenever it changes, so they can never drift out of sync with it. The
 * whole pipeline is fast enough (a few ms over a ~70-item catalog) to run on
 * every render that matters.
 */
export function useDerived() {
  const profile = useLearner((s) => s.profile);
  const feedback = useLearner((s) => s.feedback);
  const revision = useLearner((s) => s.revision);
  const savedPath = useLearner((s) => s.savedPath);

  const adaptation = useMemo(() => buildAdaptation(feedback), [feedback]);

  // `revision` is included so completions and edits force a recompute.
  /* eslint-disable react-hooks/exhaustive-deps */
  const gaps = useMemo(() => computeGaps(profile), [profile, revision]);
  const mastery = useMemo(() => buildLearnerVector(profile), [profile, revision]);
  const readiness = useMemo(() => computeReadiness(profile), [profile, revision]);
  /**
   * A *preview* of what generating now would produce.
   *
   * This is not what the learner sees on their path page — that is the saved
   * snapshot below. It exists so the UI can tell them their plan is out of date
   * without silently replacing it.
   */
  const draftPath = useMemo(
    () => generatePath(profile, adaptation),
    [profile, adaptation, revision],
  );

  // The saved snapshot is authoritative once one exists.
  const path = savedPath ?? draftPath;
  const ranked = useMemo(
    () => recommend(profile, { adaptation }),
    [profile, adaptation, revision],
  );
  const actions = useMemo(
    () => nextActions(profile, adaptation, 3),
    [profile, adaptation, revision],
  );
  /* eslint-enable react-hooks/exhaustive-deps */

  const steps = useMemo(() => pathSteps(path), [path]);
  const progress = useMemo(
    () => pathProgress(path, profile.completed),
    [path, profile.completed],
  );
  const upNext = useMemo(
    () => nextStep(path, profile.completed),
    [path, profile.completed],
  );

  /**
   * True when the profile has moved on since the path was generated. Compares
   * the step lists rather than timestamps, so a no-op edit does not nag.
   */
  const pathStale = useMemo(() => {
    if (!savedPath) return false;
    const saved = pathSteps(savedPath).map((s) => s.resource.id).join(",");
    const draft = pathSteps(draftPath).map((s) => s.resource.id).join(",");
    return saved !== draft;
  }, [savedPath, draftPath]);

  return {
    profile,
    feedback,
    adaptation,
    gaps,
    mastery,
    readiness,
    path,
    hasSavedPath: savedPath !== null,
    pathStale,
    steps,
    ranked,
    actions,
    progress,
    upNext,
  };
}
