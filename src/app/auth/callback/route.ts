import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * OAuth callback.
 *
 * GitHub redirects to Supabase, Supabase redirects here with a one-time code,
 * and we exchange it for a session cookie.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error_description") ?? searchParams.get("error");

  // Only allow relative redirects — an absolute `next` would make this an open
  // redirect that could bounce a freshly-authenticated user to another site.
  const requested = searchParams.get("next") ?? "/dashboard";
  const next = requested.startsWith("/") && !requested.startsWith("//")
    ? requested
    : "/dashboard";

  if (error) {
    return NextResponse.redirect(
      `${origin}/signin?error=${encodeURIComponent(error)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/signin?error=missing_code`);
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(
      `${origin}/signin?error=${encodeURIComponent(exchangeError.message)}`,
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
