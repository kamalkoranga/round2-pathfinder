import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { isAuthConfigured, requireSupabaseConfig } from "@/lib/supabase/env";

/**
 * Server-side Supabase client, bound to the request's cookies.
 *
 * Used in route handlers and server components to establish who the caller is.
 */
export async function createClient() {
  const { url, key } = requireSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. That is fine: the middleware
          // refreshes the session on every request, so the tokens are already
          // current by the time we get here.
        }
      },
    },
  });
}

/**
 * The authenticated user's id, or null.
 *
 * Uses `getClaims()`, which verifies the JWT, rather than `getSession()`, which
 * reads it straight from the cookie without validation and must never be
 * trusted for authorisation.
 */
export async function currentUserId(): Promise<string | null> {
  if (!isAuthConfigured()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return null;

  const sub = data.claims?.sub;
  return typeof sub === "string" ? sub : null;
}

/** Convenience for route handlers: the user id, or a 401 response. */
export async function requireUserId(): Promise<
  { userId: string } | { response: Response }
> {
  const userId = await currentUserId();
  if (!userId) {
    return {
      response: Response.json(
        { error: "Not signed in." },
        { status: 401 },
      ),
    };
  }
  return { userId };
}
