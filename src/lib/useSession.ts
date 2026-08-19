"use client";

import { useEffect, useState } from "react";

import { isAuthConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/client";

export interface SessionUser {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

export interface SessionState {
  user: SessionUser | null;
  /** Still determining who the caller is. */
  loading: boolean;
  /** Supabase is not configured at all — the app runs in local-only mode. */
  authAvailable: boolean;
}

/**
 * The current Supabase session, kept in sync with auth state changes.
 *
 * When Supabase is not configured this reports `authAvailable: false` and the
 * app falls back to browser-local storage, so the whole thing still runs with
 * no backend at all.
 */
export function useSession(): SessionState {
  const authAvailable = isAuthConfigured();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(authAvailable);

  useEffect(() => {
    if (!authAvailable) return;

    const supabase = createClient();
    let active = true;

    const toUser = (raw: {
      id: string;
      email?: string;
      user_metadata?: Record<string, unknown>;
    } | null): SessionUser | null => {
      if (!raw) return null;
      const meta = raw.user_metadata ?? {};
      return {
        id: raw.id,
        email: raw.email ?? null,
        name:
          (typeof meta.full_name === "string" && meta.full_name) ||
          (typeof meta.user_name === "string" && meta.user_name) ||
          (typeof meta.name === "string" && meta.name) ||
          null,
        avatarUrl:
          typeof meta.avatar_url === "string" ? meta.avatar_url : null,
      };
    };

    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(toUser(data.user));
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(toUser(session?.user ?? null));
      setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [authAvailable]);

  return { user, loading, authAvailable };
}

/** Kick off the GitHub OAuth redirect. */
export async function signInWithGitHub(next = "/dashboard") {
  const supabase = createClient();
  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo },
  });
  if (error) throw error;
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  window.location.href = "/";
}
