/* Shared types + display helpers for the unified notifications feed.
   Imported by:
     - notifications-panel.tsx           (reader — renders the bell panel)
     - dashboard/page.tsx                (bell-badge logic)
     - any future agent-emitted writer

   The DATA shape mirrors the public.notifications table verbatim.
   /api/notifications returns rows in this exact form. */

export type NotificationCategory =
  | "opportunity"
  | "trend"
  | "reminder"
  | "platform_update";

export interface Notification {
  id: string;
  uploader: string;
  category: NotificationCategory;
  title: string;
  body: string;
  chat_prompt: string | null;
  meta: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
  bookmarked_at: string | null;
  dismissed_at: string | null;
}

/* Display labels used in the UI. Keep these in sync with the SQL CHECK
   constraint — adding a new category requires (a) a one-line DDL change
   and (b) a new entry here. */
export const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  opportunity:     "Opportunity",
  trend:           "Trend",
  reminder:        "Reminder",
  platform_update: "Platform update",
};

/* Friendly relative-time formatter — reuses the same format the trend
   panel already used. Defaults to "just now" / "Nm" / "Nh" / "Yesterday"
   / "Nd" / absolute date. */
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = (Date.now() - then) / 1000;
  if (diff < 45) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800) return "Yesterday";
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/* Best-effort PATCH wrapper. The route accepts any subset of
   { read?, bookmarked?, dismissed? } and toggles the matching *_at
   column. Returns the updated row, or null on auth/network/RLS error. */
export async function patchNotification(
  id: string,
  body: Partial<Pick<{ read: boolean; bookmarked: boolean; dismissed: boolean }, "read" | "bookmarked" | "dismissed">>,
): Promise<Notification | null> {
  try {
    const res = await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { notification?: Notification };
    return json.notification ?? null;
  } catch {
    return null;
  }
}
