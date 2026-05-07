import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client that uses the SERVICE_ROLE key. Bypasses
 * RLS — never import this in a client component, route this to the
 * browser, or expose it to a request that isn't fully server-trusted.
 *
 * Use cases: writing notifications from a Next.js API route on behalf
 * of an agent, server-side admin tasks, anything that needs to touch
 * data across users.
 */
let _admin: ReturnType<typeof createClient> | null = null;

export function createSupabaseAdminClient() {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  _admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _admin;
}
