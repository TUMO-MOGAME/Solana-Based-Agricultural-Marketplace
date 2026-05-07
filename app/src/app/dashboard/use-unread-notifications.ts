"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Tiny hook that drives the bell-icon dot.
 *
 * Polls /api/notifications/unread-count every `intervalMs` ms (default
 * 60 s). Exposes `count` (the current unread integer) and `refresh()`
 * for callers to trigger an immediate re-fetch after they mutate a
 * notification (mark read, dismiss, etc.).
 *
 * Returns 0 when unauthenticated or the route 5xx's — the bell stays
 * silent rather than showing a false positive.
 */
export function useUnreadNotifications(intervalMs: number = 60_000) {
  const [count, setCount] = useState<number>(0);
  const cancelled = useRef(false);

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/unread-count", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = (await res.json()) as { count?: number };
      if (cancelled.current) return;
      setCount(typeof json.count === "number" ? json.count : 0);
    } catch {
      /* offline / aborted — leave the previous count alone */
    }
  }, []);

  useEffect(() => {
    cancelled.current = false;
    void fetchCount();
    const id = window.setInterval(() => void fetchCount(), intervalMs);
    return () => {
      cancelled.current = true;
      window.clearInterval(id);
    };
  }, [fetchCount, intervalMs]);

  return { count, refresh: fetchCount };
}
