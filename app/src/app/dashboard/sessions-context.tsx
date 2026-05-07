"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

/*  Sessions persistence + A2A coach chat state.

    Owns the list of saved coaching sessions, the currently-active session
    id, and the live messages of that session. Messages are sent through
    `/api/coach-chat`, which forwards them to the Python A2A Content
    Coaching Agent (agents/coaching/agent.py) and deletes any attached
    files from `tmp/uploads/` once the agent has finished analysing them.

    Per product requirement, only *metadata* for uploaded files is kept
    after a turn completes — filename, mime, size, kind, timestamp. The
    URL that served the file to the agent dies with the file, so it's
    never persisted to localStorage or shown in the saved thread. Supabase
    is the eventual source of truth; the agent's save_coaching_session
    tool writes to it directly (no-ops when the DB isn't configured).

    Phase 3 should swap localStorage for Supabase-backed session storage
    once real auth is in. */

import type { CreatorEvent } from "./events-data";
import {
  buildJourneyHint,
  buildJourneyPrompt,
  EventTicket,
  ticketFromEvent,
} from "./events-journey";

export type SessionRole = "user" | "model";

// Attachments the user is still preparing in the composer — carry the URL
// + storedName so /api/coach-chat can hand them to the agent and then
// delete the file. Never persisted.
export interface PendingAttachment {
  id: string;
  storedName: string;
  url: string;
  kind: "image" | "video";
  filename: string;
  mime: string;
  size: number;
}

// Metadata-only record kept in the session thread after the turn
// completes. No `url` here — the file is gone.
export interface AttachmentMeta {
  filename: string;
  mime: string;
  size: number;
  kind: "image" | "video";
  sharedAt: string;
}

export interface SessionMessage {
  id: string;
  role: SessionRole;
  content: string;
  createdAt: string;
  attachments?: AttachmentMeta[];
}

export interface Session {
  id: string;
  title: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
  messages: SessionMessage[];
  /** Present only on "event journey" sessions. Coach receives a
      derived journey hint on every turn (see buildJourneyHint). */
  eventTicket?: EventTicket;
}

interface SessionsContextValue {
  sessions: Session[];
  activeId: string | null;
  activeMessages: SessionMessage[];
  isLoading: boolean;
  error: string | null;
  isChatOpen: boolean;
  openChat: () => void;
  closeChat: () => void;
  newSession: () => void;
  loadSession: (id: string) => void;
  deleteSession: (id: string) => void;
  sendMessage: (
    content: string,
    attachments?: PendingAttachment[],
    options?: { forceNew?: boolean },
  ) => Promise<void>;
  startSessionFromNotification: (prompt: string) => Promise<void>;
  startEventJourney: (event: CreatorEvent) => Promise<void>;
  closeEventJourney: (sessionId: string) => void;
  clearError: () => void;
}

const SessionsContext = createContext<SessionsContextValue | null>(null);

export function useSessions() {
  const ctx = useContext(SessionsContext);
  if (!ctx) throw new Error("useSessions must be used inside <SessionsProvider>");
  return ctx;
}

const MAX_SESSIONS = 50;

function storageKey(userEmail: string) {
  return `sa.coach-sessions.${userEmail || "anon"}`;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function deriveTitle(userContent: string): string {
  const firstLine = userContent.trim().split(/\n/)[0].trim();
  if (!firstLine) return "New session";
  const firstSentence = firstLine.split(/(?<=[.!?])\s+/)[0];
  const pick = firstSentence.length > 8 ? firstSentence : firstLine;
  return pick.length > 60 ? `${pick.slice(0, 60).trimEnd()}…` : pick;
}

function deriveSummary(modelContent: string): string {
  const cleaned = modelContent.replace(/[*`_#>]/g, "").trim();
  if (!cleaned) return "";
  const line = cleaned.split(/\n/).find((l) => l.trim().length > 0)?.trim() ?? "";
  return line.length > 110 ? `${line.slice(0, 110).trimEnd()}…` : line;
}

function moveToTop(list: Session[], sid: string): Session[] {
  const idx = list.findIndex((s) => s.id === sid);
  if (idx <= 0) return list;
  return [list[idx], ...list.slice(0, idx), ...list.slice(idx + 1)];
}

function toMeta(a: PendingAttachment, sharedAt: string): AttachmentMeta {
  return {
    filename: a.filename,
    mime: a.mime,
    size: a.size,
    kind: a.kind,
    sharedAt,
  };
}

export function SessionsProvider({
  userEmail,
  children,
}: {
  userEmail: string;
  children: ReactNode;
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<SessionMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isChatOpen, setChatOpen] = useState(false);

  const hydrated = useRef(false);
  const activeIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // Mirror of sessions so sendMessage can look up the active session's
  // eventTicket (for journey context) without depending on `sessions` in
  // the useCallback dep list, which would churn on every turn.
  const sessionsRef = useRef<Session[]>([]);
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  // ── Hydrate ────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(userEmail));
      if (raw) {
        const parsed = JSON.parse(raw) as {
          sessions: Session[];
          activeId: string | null;
        };
        const list = Array.isArray(parsed.sessions) ? parsed.sessions : [];
        setSessions(list);
        const aid = parsed.activeId ?? null;
        setActiveId(aid);
        if (aid) {
          const match = list.find((s) => s.id === aid);
          if (match) setActiveMessages(match.messages);
        }
      }
    } catch {
      /* malformed storage — fall through */
    }
    hydrated.current = true;
  }, [userEmail]);

  // ── Persist ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(
        storageKey(userEmail),
        JSON.stringify({ sessions, activeId })
      );
    } catch {
      /* quota / private mode — ignore */
    }
  }, [sessions, activeId, userEmail]);

  const newSession = useCallback(() => {
    setActiveId(null);
    setActiveMessages([]);
    setError(null);
  }, []);

  const openChat = useCallback(() => setChatOpen(true), []);
  const closeChat = useCallback(() => setChatOpen(false), []);

  const loadSession = useCallback((id: string) => {
    setSessions((prev) => {
      const session = prev.find((s) => s.id === id);
      if (session) {
        setActiveId(id);
        setActiveMessages(session.messages);
        setError(null);
      }
      return prev;
    });
  }, []);

  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeIdRef.current === id) {
      setActiveId(null);
      setActiveMessages([]);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const sendMessage = useCallback(
    async (
      content: string,
      attachments: PendingAttachment[] = [],
      options: { forceNew?: boolean; newTicket?: EventTicket } = {},
    ) => {
      const trimmed = content.trim();
      if (isLoading) return;
      if (!trimmed && attachments.length === 0) return;

      const now = new Date().toISOString();
      const attachmentMeta = attachments.map((a) => toMeta(a, now));

      const userMsg: SessionMessage = {
        id: newId("m"),
        role: "user",
        content: trimmed,
        createdAt: now,
        attachments: attachmentMeta.length ? attachmentMeta : undefined,
      };

      // `forceNew` lets callers (notification CTAs, deep-links) start a
      // brand-new session without racing against React's async state
      // updates — the ref and the "previous messages" snapshot are
      // reset synchronously here so the payload below always reflects
      // a clean thread.
      if (options.forceNew) {
        activeIdRef.current = null;
        setActiveId(null);
      }

      const prevMessages = options.forceNew ? [] : activeMessages;
      const nextMessages = [...prevMessages, userMsg];
      setActiveMessages(nextMessages);
      setError(null);

      // Decide BEFORE calling setSessions whether this is a brand-new
      // session, and pre-generate the id. React 18 StrictMode double-
      // invokes state updater functions in dev to catch impurity — doing
      // the id generation + activeId mutation inside the reducer would
      // silently drop the new session on the second invocation. Keeping
      // the reducer pure (and idempotent via the `prev.some(...)` guard)
      // makes this safe under StrictMode.
      const creatingNew = !activeIdRef.current;
      const sessionId = activeIdRef.current ?? newId("s");
      if (creatingNew) {
        activeIdRef.current = sessionId;
        setActiveId(sessionId);
      }

      setSessions((prev) => {
        if (creatingNew) {
          // StrictMode-safe: if a prior invocation already added this
          // session, don't duplicate it.
          if (prev.some((s) => s.id === sessionId)) return prev;
          const session: Session = {
            id: sessionId,
            title: options.newTicket
              ? `Journey · ${options.newTicket.eventTitle}`
              : trimmed
              ? deriveTitle(trimmed)
              : attachmentMeta[0]?.filename ?? "New session",
            summary: "",
            createdAt: now,
            updatedAt: now,
            messages: nextMessages,
            eventTicket: options.newTicket,
          };
          return [session, ...prev].slice(0, MAX_SESSIONS);
        }
        const idx = prev.findIndex((s) => s.id === sessionId);
        if (idx === -1) return prev;
        const existing = prev[idx];
        const updated: Session = {
          ...existing,
          messages: nextMessages,
          updatedAt: now,
          title:
            existing.title && existing.title !== "New session"
              ? existing.title
              : trimmed
              ? deriveTitle(trimmed)
              : existing.title,
        };
        const copy = [...prev];
        copy[idx] = updated;
        return moveToTop(copy, sessionId);
      });

      // Pull the journey ticket either from the caller (new journey via
      // `newTicket`) or from the current session — so the coach gets a
      // fresh journey hint on every turn, including subsequent days.
      const existingSession = sessionsRef.current.find(
        (s) => s.id === sessionId,
      );
      const ticketForHint: EventTicket | undefined =
        options.newTicket ?? existingSession?.eventTicket;
      const systemHint = ticketForHint
        ? buildJourneyHint(ticketForHint)
        : undefined;

      // Title we send alongside chat_messages writes. Mirrors the title
      // logic in setSessions above so the persisted server-side rows
      // match the in-memory thread label.
      const sessionTitle = options.newTicket
        ? `Journey · ${options.newTicket.eventTitle}`
        : existingSession?.title && existingSession.title !== "New session"
        ? existingSession.title
        : trimmed
        ? deriveTitle(trimmed)
        : existingSession?.title ?? null;

      setIsLoading(true);
      try {
        const res = await fetch("/api/coach-chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            uploader: userEmail,
            sessionId,
            sessionTitle,
            systemHint,
            messages: nextMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            attachments: attachments.map((a) => ({
              storedName: a.storedName,
              url: a.url,
              kind: a.kind,
              filename: a.filename,
              mime: a.mime,
              size: a.size,
            })),
          }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            (payload as { error?: string })?.error ??
              `Coach responded with ${res.status}`
          );
        }
        const reply: string = (payload as { content?: string }).content ?? "";
        if (!reply.trim()) throw new Error("Empty reply from coach");

        const replyMsg: SessionMessage = {
          id: newId("m"),
          role: "model",
          content: reply,
          createdAt: new Date().toISOString(),
        };
        const withReply = [...nextMessages, replyMsg];
        setActiveMessages(withReply);

        setSessions((prev) => {
          const idx = prev.findIndex((s) => s.id === sessionId);
          if (idx === -1) return prev;
          const existing = prev[idx];
          const updated: Session = {
            ...existing,
            messages: withReply,
            updatedAt: new Date().toISOString(),
            summary: existing.summary || deriveSummary(reply),
          };
          const copy = [...prev];
          copy[idx] = updated;
          return moveToTop(copy, sessionId);
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Couldn’t reach the coach"
        );
      } finally {
        setIsLoading(false);
      }
    },
    [activeMessages, isLoading, userEmail]
  );

  const startSessionFromNotification = useCallback(
    async (prompt: string) => {
      setChatOpen(true);
      await sendMessage(prompt, [], { forceNew: true });
    },
    [sendMessage],
  );

  // Starts a dedicated "event journey" session — tagged with an
  // eventTicket so the chat banner + sessions-list badge can render
  // journey-specific UI, and the coach receives a journey hint on
  // every subsequent turn.
  const startEventJourney = useCallback(
    async (event: CreatorEvent) => {
      const ticket = ticketFromEvent(event);
      setChatOpen(true);
      await sendMessage(buildJourneyPrompt(event), [], {
        forceNew: true,
        newTicket: ticket,
      });
    },
    [sendMessage],
  );

  // Flags the session as closed. Stage derivation in events-journey.ts
  // honours `closedAt` and returns "closed" regardless of the event date.
  const closeEventJourney = useCallback((sessionId: string) => {
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === sessionId);
      if (idx === -1) return prev;
      const s = prev[idx];
      if (!s.eventTicket || s.eventTicket.closedAt) return prev;
      const updated: Session = {
        ...s,
        eventTicket: {
          ...s.eventTicket,
          closedAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      };
      const copy = [...prev];
      copy[idx] = updated;
      return copy;
    });
  }, []);

  return (
    <SessionsContext.Provider
      value={{
        sessions,
        activeId,
        activeMessages,
        isLoading,
        error,
        isChatOpen,
        openChat,
        closeChat,
        newSession,
        loadSession,
        deleteSession,
        sendMessage,
        startSessionFromNotification,
        startEventJourney,
        closeEventJourney,
        clearError,
      }}
    >
      {children}
    </SessionsContext.Provider>
  );
}
