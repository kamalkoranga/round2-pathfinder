"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type {
  ChatMessage,
  Feedback,
  LearnerProfile,
  LearningPath,
  LearningStyle,
  Level,
} from "@/lib/types";

/**
 * Client-side state, mirrored to localStorage.
 *
 * This is the working copy in both modes. Signed out, localStorage is the only
 * home the learner's record has, so the app still works with no account and no
 * database. Signed in, src/lib/sync.tsx keeps this in step with Postgres, and
 * the local copy doubles as an offline cache — a failed save degrades to
 * "your work is still here" rather than losing it.
 *
 * Gaps and rankings stay derived (see useDerived) so they cannot go stale. The
 * generated path is the deliberate exception: it is a stored snapshot.
 */

export const DEFAULT_PROFILE: LearnerProfile = {
  name: "",
  goalText: "",
  roleId: null,
  interests: [],
  level: "beginner",
  skills: {},
  completed: [],
  hoursPerWeek: 8,
  style: "mixed",
  pace: "steady",
  targetWeeks: null,
  createdAt: new Date().toISOString(),
};

/**
 * Where the learner's record currently lives.
 *
 * `local`   — signed out; everything stays in this browser.
 * `syncing` — talking to the server.
 * `synced`  — signed in and persisted to Postgres.
 * `error`   — a save failed; local state is still authoritative and usable.
 */
export type SyncStatus = "local" | "syncing" | "synced" | "error";

interface LearnerState {
  profile: LearnerProfile;
  feedback: Feedback[];
  chat: ChatMessage[];
  /** True once the learner has completed intake. */
  onboarded: boolean;
  /** Bumped whenever the path should be regenerated. */
  revision: number;

  /**
   * The generated path, as a stored snapshot.
   *
   * Null until the learner explicitly generates one. Keeping it here rather than
   * deriving it on every render is the point: a plan someone is part-way through
   * should not silently rewrite itself when the catalog or their profile shifts.
   */
  savedPath: LearningPath | null;
  pathHistory: PathSummary[];

  syncStatus: SyncStatus;
  syncError: string | null;

  setProfile: (patch: Partial<LearnerProfile>) => void;
  setSkill: (skillId: string, value: number) => void;
  toggleComplete: (resourceId: string) => void;
  rate: (resourceId: string, signal: "up" | "down", reason?: string) => void;
  clearRating: (resourceId: string) => void;
  addChat: (message: ChatMessage) => void;
  setChat: (messages: ChatMessage[]) => void;
  completeOnboarding: () => void;
  setSavedPath: (path: LearningPath | null) => void;
  setPathHistory: (history: PathSummary[]) => void;
  setSyncStatus: (status: SyncStatus, error?: string | null) => void;
  /** Replace local state with what the server holds, without re-triggering a save. */
  hydrateFromServer: (state: {
    profile: LearnerProfile;
    feedback: Feedback[];
    onboarded: boolean;
    chat: ChatMessage[];
    savedPath: LearningPath | null;
    pathHistory: PathSummary[];
  }) => void;
  reset: () => void;
}

export interface PathSummary {
  id: string;
  roleTitle: string;
  goal: string;
  totalHours: number;
  totalWeeks: number;
  isActive: boolean;
  createdAt: string;
}

export const useLearner = create<LearnerState>()(
  persist(
    (set) => ({
      profile: DEFAULT_PROFILE,
      feedback: [],
      chat: [],
      onboarded: false,
      revision: 0,
      savedPath: null,
      pathHistory: [],
      syncStatus: "local",
      syncError: null,

      setProfile: (patch) =>
        set((state) => ({
          profile: { ...state.profile, ...patch },
          revision: state.revision + 1,
        })),

      setSkill: (skillId, value) =>
        set((state) => ({
          profile: {
            ...state.profile,
            skills: { ...state.profile.skills, [skillId]: value },
          },
          revision: state.revision + 1,
        })),

      toggleComplete: (resourceId) =>
        set((state) => {
          const has = state.profile.completed.includes(resourceId);
          return {
            profile: {
              ...state.profile,
              completed: has
                ? state.profile.completed.filter((id) => id !== resourceId)
                : [...state.profile.completed, resourceId],
            },
            revision: state.revision + 1,
          };
        }),

      rate: (resourceId, signal, reason) =>
        set((state) => ({
          feedback: [
            ...state.feedback.filter((f) => f.resourceId !== resourceId),
            { resourceId, signal, reason, at: new Date().toISOString() },
          ],
          revision: state.revision + 1,
        })),

      clearRating: (resourceId) =>
        set((state) => ({
          feedback: state.feedback.filter((f) => f.resourceId !== resourceId),
          revision: state.revision + 1,
        })),

      addChat: (message) => set((state) => ({ chat: [...state.chat, message] })),
      setChat: (messages) => set({ chat: messages }),

      completeOnboarding: () =>
        set((state) => ({ onboarded: true, revision: state.revision + 1 })),

      setSavedPath: (savedPath) => set({ savedPath }),
      setPathHistory: (pathHistory) => set({ pathHistory }),
      setSyncStatus: (syncStatus, syncError = null) => set({ syncStatus, syncError }),

      hydrateFromServer: (state) =>
        set({
          profile: state.profile,
          feedback: state.feedback,
          onboarded: state.onboarded,
          chat: state.chat,
          savedPath: state.savedPath,
          pathHistory: state.pathHistory,
          syncStatus: "synced",
          syncError: null,
          // Deliberately does NOT bump `revision`: this is the server telling us
          // what it already has, not a local edit that needs saving back.
        }),

      reset: () =>
        set({
          profile: { ...DEFAULT_PROFILE, createdAt: new Date().toISOString() },
          feedback: [],
          chat: [],
          onboarded: false,
          revision: 0,
          savedPath: null,
          pathHistory: [],
        }),
    }),
    {
      name: "pathfinder-learner-v1",
      version: 2,
      // Sync status is per-session, never restored from disk.
      partialize: (state) => {
        const { syncStatus: _s, syncError: _e, ...rest } = state;
        void _s;
        void _e;
        return rest;
      },
      migrate: (persisted, version) => {
        // v1 predates saved paths; give the new fields their defaults.
        if (version < 2 && persisted && typeof persisted === "object") {
          return {
            ...(persisted as object),
            savedPath: null,
            pathHistory: [],
          } as unknown as LearnerState;
        }
        return persisted as LearnerState;
      },
    },
  ),
);

// ---------------------------------------------------------------------------
// Convenience selectors
// ---------------------------------------------------------------------------

export const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];

export const STYLES: { value: LearningStyle; label: string; hint: string }[] = [
  { value: "video", label: "Video", hint: "Lectures and walkthroughs" },
  { value: "hands-on", label: "Hands-on", hint: "Build things to learn them" },
  { value: "reading", label: "Reading", hint: "Books, docs and articles" },
  { value: "interactive", label: "Interactive", hint: "Exercises and challenges" },
  { value: "mixed", label: "Mixed", hint: "A bit of everything" },
];

/** Rating reasons offered on thumbs-down — these drive difficulty adaptation. */
export const DOWN_REASONS = [
  { value: "too-hard", label: "Too hard" },
  { value: "too-easy", label: "Too easy" },
  { value: "not-relevant", label: "Not relevant" },
  { value: "wrong-format", label: "Wrong format" },
] as const;
