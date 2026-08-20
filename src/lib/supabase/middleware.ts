import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isAuthConfigured, supabaseKey, supabaseUrl } from "@/lib/supabase/env";

/**
 * Refresh the Supabase session on every request.
 *
 * Server Components cannot write cookies, so rotated access tokens have to be
 * persisted here. The dance below is the awkward but necessary part: when
 * Supabase hands us new cookies we must write them onto BOTH the request (so
 * Server Components rendering in this same pass see the fresh token) and the
 * response (so the browser stores it).
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  // Without config there is no session to refresh — pass the request through
  // untouched so the app still runs in its signed-out mode.
  if (!isAuthConfigured()) return response;

  const supabase = createServerClient(supabaseUrl()!, supabaseKey()!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Supabase passes cache-control headers that must travel with the
        // response: a cached page carrying auth cookies would serve one user's
        // session to another.
        if (headers) {
          for (const [key, value] of Object.entries(headers)) {
            response.headers.set(key, value);
          }
        }
      },
    },
  });

  // Verifies and, if needed, rotates the token. Must be awaited before the
  // response is returned or the refreshed cookies are never written.
  await supabase.auth.getClaims();

  return response;
}
