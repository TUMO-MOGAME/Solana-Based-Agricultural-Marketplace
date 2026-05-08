// Tiny localStorage cache for demo-mode user info.
//
// Background: when Supabase env vars are missing, the auth pages bypass
// real authentication and just route to /dashboard. The dashboard then
// rendered a hardcoded "Demo Farmer" stub regardless of what the user
// actually typed in the signup form. These helpers persist the typed
// {name, email} so the dashboard can show real values in demo mode too.
//
// When Supabase IS configured, this file is unused — real auth flows
// take over and the dashboard reads the user from `supabase.auth.getUser()`
// instead.

const STORAGE_KEY = "vuna.demoUser";

export type DemoUser = { name?: string; email?: string };

export function readDemoUser(): DemoUser {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const obj = parsed as Record<string, unknown>;
    return {
      name: typeof obj.name === "string" ? obj.name : undefined,
      email: typeof obj.email === "string" ? obj.email : undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Merge a patch into the stored demo user. We merge (rather than
 * replace) so that a login flow which only knows the email doesn't
 * blow away the name captured at signup time.
 */
export function mergeDemoUser(patch: DemoUser): void {
  if (typeof window === "undefined") return;
  try {
    const current = readDemoUser();
    const next: DemoUser = { ...current, ...patch };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private mode / quota / SSR — silently ignore */
  }
}

export function clearDemoUser(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
