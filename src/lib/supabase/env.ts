/**
 * Supabase connection details.
 *
 * Supabase renamed the client-side key from "anon" to "publishable"; projects
 * created at different times expose different variable names, so accept either
 * rather than making the app's behaviour depend on when the project was made.
 */

export function supabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || undefined;
}

export function supabaseKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    undefined
  );
}

/** True when Supabase Auth is configured. Auth UI hides itself when false. */
export function isAuthConfigured(): boolean {
  return Boolean(supabaseUrl() && supabaseKey());
}

/** Throwing accessors for code paths that cannot proceed without config. */
export function requireSupabaseConfig(): { url: string; key: string } {
  const url = supabaseUrl();
  const key = supabaseKey();
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
    );
  }
  return { url, key };
}
