"use client";

import { createBrowserClient } from "@supabase/ssr";

import { requireSupabaseConfig } from "@/lib/supabase/env";

/** Browser-side Supabase client, used for sign-in and sign-out. */
export function createClient() {
  const { url, key } = requireSupabaseConfig();
  return createBrowserClient(url, key);
}
