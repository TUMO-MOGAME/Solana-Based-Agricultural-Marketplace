import { createBrowserClient } from "@supabase/ssr";

/**
 * Returns true when both Supabase env vars are present at build time.
 * When false, the auth pages and dashboard fall back to a "demo mode"
 * that lets the rest of the app be browsed without a backend — useful
 * for hackathon demos before a Supabase project is set up.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function createSupabaseBrowserClient() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY in app/.env.local — see app/.env.example.",
    );
  }
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
