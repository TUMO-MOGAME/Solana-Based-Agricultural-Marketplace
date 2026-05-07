"use client";

import {
  ChangeEvent,
  KeyboardEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Send,
  Sparkles,
  Plus,
  ArrowLeft,
  AlertCircle,
  Paperclip,
  X,
  Image as ImageIcon,
  Video,
} from "lucide-react";
import { PendingAttachment, useSessions } from "./sessions-context";
import { computeStage } from "./events-journey";
import { useExemplar } from "./exemplar-context";
import styles from "./dashboard.module.css";

/*  Gemini-style full-surface chat. Mounts in the middle of the dashboard
    whenever `sessions.isChatOpen` is true. Sends messages through
    /api/coach-chat, which bridges to the Python A2A coaching agent.

    File attachments upload to /api/upload (stored under tmp/uploads/), are
    passed to the agent via URL so Gemini vision can analyse them, and are
    then deleted server-side as soon as the agent replies. Only the file
    metadata sticks to the session thread.

    When closed (header ← button), the dashboard returns to its normal
    profile + timeline layout. Session state lives in SessionsProvider so
    nothing is lost on close / reopen. */

const SUGGESTIONS = [
  "Score the hook on my latest TikTok",
  "Rework this caption for more saves",
  "What's a strong first-three-seconds for a tutorial?",
  "How should I theme this week's posts?",
];

const FALLBACK_AVATAR = "https://i.pravatar.cc/300?img=26";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

// Draft attachment state in the composer — like PendingAttachment but some
// fields only exist once /api/upload resolves.
type DraftAttachment = {
  id: string;
  name: string;
  mime: string;
  kind: "image" | "video";
  size: number;
  previewUrl?: string;
  url?: string;
  storedName?: string;
  error?: string;
};

const cx = (...parts: Array<string | false | undefined | null>) =>
  parts.filter(Boolean).join(" ");

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SessionChat({
  userName,
  userAvatar,
}: {
  userName: string;
  userAvatar: string;
}) {
  const {
    activeMessages,
    isLoading,
    error,
    clearError,
    sendMessage,
    newSession,
    closeChat,
    sessions,
    activeId,
  } = useSessions();

  // Journey state — ticket sessions go read-only once the stage rolls to
  // "closed" (derived live from the event date). The right-rail
  // JourneyPanel owns the banner/progress UI; here we only need the
  // closed flag to gate the composer.
  const activeSession = activeId
    ? sessions.find((s) => s.id === activeId)
    : undefined;
  const journeyClosed = activeSession?.eventTicket
    ? computeStage(activeSession.eventTicket) === "closed"
    : false;

  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const timelineRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentTitle = useMemo(() => {
    if (!activeId) return "New session";
    return sessions.find((s) => s.id === activeId)?.title ?? "New session";
  }, [sessions, activeId]);

  const firstName = userName.split(" ")[0] ?? userName;

  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [activeMessages.length, isLoading]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [activeId]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  // Revoke any outstanding blob preview URLs on unmount
  useEffect(() => {
    return () => {
      for (const a of attachments) {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uploading = attachments.some((a) => !a.url && !a.error);
  const readyAttachments = attachments.filter((a) => a.url && a.storedName);
  const canSend =
    !isLoading &&
    !uploading &&
    !journeyClosed &&
    (text.trim().length > 0 || readyAttachments.length > 0);

  const handleFileSelect = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (e.target) e.target.value = "";
    if (files.length === 0) return;
    setUploadError(null);

    const drafts: DraftAttachment[] = files.map((f) => {
      const isImage = f.type.startsWith("image/");
      const isVideo = f.type.startsWith("video/");
      const kind: "image" | "video" = isVideo ? "video" : "image";
      const limit = kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
      const badType = !isImage && !isVideo;
      const badSize = f.size > limit;
      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: f.name,
        mime: f.type,
        kind,
        size: f.size,
        previewUrl: isImage ? URL.createObjectURL(f) : undefined,
        error: badType
          ? "Unsupported file type"
          : badSize
          ? `Over ${(limit / 1024 / 1024) | 0} MB limit`
          : undefined,
      };
    });

    setAttachments((prev) => [...prev, ...drafts]);

    for (let i = 0; i < drafts.length; i++) {
      const d = drafts[i];
      if (d.error) continue;
      const file = files[i];
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error ?? `Upload failed (${res.status})`);
        setAttachments((prev) =>
          prev.map((x) =>
            x.id === d.id ? { ...x, url: body.url, storedName: body.storedName } : x
          )
        );
      } catch (err) {
        setAttachments((prev) =>
          prev.map((x) =>
            x.id === d.id
              ? {
                  ...x,
                  error: err instanceof Error ? err.message : "Upload failed",
                }
              : x
          )
        );
      }
    }
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const removed = prev.find((a) => a.id === id);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  const handleSend = async () => {
    if (!canSend) return;

    // Convert ready drafts into PendingAttachments for the context. Revoke
    // the blob previews now — the bubble re-derives visuals from metadata.
    const pending: PendingAttachment[] = readyAttachments.map((a) => ({
      id: a.id,
      storedName: a.storedName!,
      url: a.url!,
      kind: a.kind,
      filename: a.name,
      mime: a.mime,
      size: a.size,
    }));

    for (const a of attachments) {
      if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
    }

    const toSend = text;
    setText("");
    setAttachments([]);
    setUploadError(null);
    await sendMessage(toSend, pending);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (s: string) => {
    setText(s);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const isEmpty = activeMessages.length === 0;

  return (
    <section className={styles.chatSurface} aria-label="Coach session">
      <header className={styles.chatSurfaceHeader}>
        <button
          type="button"
          className={styles.chatHeaderBack}
          onClick={closeChat}
          aria-label="Close session"
        >
          <ArrowLeft />
          <span>Back to dashboard</span>
        </button>

        <div className={styles.chatHeaderTitleWrap}>
          <span className={styles.chatHeaderEyebrow}>
            Content Coach · A2A agent
          </span>
          <h1 className={styles.chatHeaderTitleText}>{currentTitle}</h1>
        </div>

        <button
          type="button"
          className={styles.chatHeaderNew}
          onClick={newSession}
          disabled={isEmpty && !activeId}
        >
          <Plus />
          <span>New chat</span>
        </button>
      </header>

      <div className={styles.chatSurfaceBody} ref={timelineRef}>
        {isEmpty ? (
          <div className={styles.chatWelcome}>
            <div className={styles.chatWelcomeGlyph}>
              <Sparkles />
            </div>
            <h2 className={styles.chatWelcomeHello}>
              Hello, <span>{firstName}</span>
            </h2>
            <p className={styles.chatWelcomeSubtitle}>
              Drop a post, paste a link, or attach a rough cut. The coach
              reviews your media, then only the analysis is kept — your file
              is wiped from the server once the reply lands.
            </p>
            <div className={styles.chatSuggestions}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={styles.chatSuggestion}
                  onClick={() => handleSuggestion(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className={styles.chatThread}>
            {activeMessages.map((m) => (
              <ChatBubble
                key={m.id}
                role={m.role}
                content={m.content}
                attachments={m.attachments}
                userName={userName}
                userAvatar={userAvatar}
              />
            ))}
            {isLoading ? <ThinkingBubble /> : null}
          </div>
        )}
      </div>

      {error ? (
        <div className={styles.chatErrorBanner} role="alert">
          <AlertCircle />
          <span>{error}</span>
          <button
            type="button"
            className={styles.chatErrorDismiss}
            onClick={clearError}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className={styles.chatComposer}>
        {(attachments.length > 0 || uploadError) && (
          <div className={styles.chatAttachments}>
            {attachments.map((a) => (
              <div
                key={a.id}
                className={cx(
                  styles.chatAttachment,
                  !a.url && !a.error && styles.chatAttachmentUploading,
                  a.error && styles.chatAttachmentError
                )}
              >
                {a.kind === "image" && a.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className={styles.chatAttachmentThumb}
                    src={a.previewUrl}
                    alt={a.name}
                  />
                ) : (
                  <div className={styles.chatAttachmentIcon}>
                    {a.kind === "image" ? <ImageIcon /> : <Video />}
                  </div>
                )}
                <div className={styles.chatAttachmentBody}>
                  <span className={styles.chatAttachmentName}>{a.name}</span>
                  <span className={styles.chatAttachmentMeta}>
                    {a.error ?? (a.url ? `${formatBytes(a.size)} · ready` : "Uploading…")}
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.chatAttachmentRemove}
                  onClick={() => removeAttachment(a.id)}
                  aria-label={`Remove ${a.name}`}
                >
                  <X />
                </button>
              </div>
            ))}
            {uploadError ? (
              <div className={styles.chatAttachmentBanner}>{uploadError}</div>
            ) : null}
          </div>
        )}

        <div className={styles.chatComposerInner}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            hidden
            onChange={handleFileSelect}
          />
          <button
            type="button"
            className={styles.chatAttachBtn}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach image or video"
            title="Attach image or video"
            disabled={journeyClosed}
          >
            <Paperclip />
          </button>
          <textarea
            ref={textareaRef}
            className={styles.chatComposerTextarea}
            placeholder={
              journeyClosed
                ? "This journey has closed."
                : `Message your coach, ${firstName}…`
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
            rows={1}
            disabled={journeyClosed}
          />
          <button
            type="button"
            className={styles.chatComposerSend}
            onClick={handleSend}
            disabled={!canSend}
            aria-label="Send"
          >
            <Send />
          </button>
        </div>
        <p className={styles.chatComposerHint}>
          {journeyClosed
            ? "Journey closed — this thread is read-only."
            : isLoading
            ? "Coach is drafting a reply…"
            : uploading
            ? "Uploading attachments…"
            : "Images ≤10MB · videos ≤50MB · files are deleted after coaching"}
        </p>
      </div>
    </section>
  );
}

/* ═════════════════════════════════════════════════════════════════
   Chat bubble — one turn in the timeline
   ═════════════════════════════════════════════════════════════════ */

function ChatBubble({
  role,
  content,
  attachments,
  userName,
  userAvatar,
}: {
  role: "user" | "model";
  content: string;
  attachments?: Array<{
    filename: string;
    mime: string;
    size: number;
    kind: "image" | "video";
    sharedAt: string;
  }>;
  userName: string;
  userAvatar: string;
}) {
  const isUser = role === "user";
  return (
    <article
      className={`${styles.chatBubble} ${
        isUser ? styles.chatBubbleUser : styles.chatBubbleCoach
      }`}
    >
      <div className={styles.chatBubbleAvatar}>
        {isUser ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={userAvatar || FALLBACK_AVATAR} alt={userName} />
        ) : (
          <span>SA</span>
        )}
      </div>
      <div className={styles.chatBubbleBody}>
        <div className={styles.chatBubbleName}>
          {isUser ? userName : "Content Coach"}
        </div>
        <div className={styles.chatBubbleText}>
          <MarkdownLite text={content} />
        </div>
        {attachments && attachments.length > 0 ? (
          <div className={styles.chatBubbleAttachments}>
            {attachments.map((a, i) => (
              <div key={i} className={styles.chatBubbleAttachment}>
                <div className={styles.chatBubbleAttachmentIcon}>
                  {a.kind === "image" ? <ImageIcon /> : <Video />}
                </div>
                <div className={styles.chatBubbleAttachmentBody}>
                  <span className={styles.chatBubbleAttachmentName}>
                    {a.filename}
                  </span>
                  <span className={styles.chatBubbleAttachmentMeta}>
                    {a.kind} · {formatBytes(a.size)} · analysed &amp; removed
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function ThinkingBubble() {
  return (
    <article className={`${styles.chatBubble} ${styles.chatBubbleCoach}`}>
      <div className={styles.chatBubbleAvatar}>
        <span>SA</span>
      </div>
      <div className={styles.chatBubbleBody}>
        <div className={styles.chatBubbleName}>Content Coach</div>
        <div className={styles.chatThinkingDots} aria-label="Coach is thinking">
          <span />
          <span />
          <span />
        </div>
      </div>
    </article>
  );
}

/* ═════════════════════════════════════════════════════════════════
   MarkdownLite — **bold**, *em*, `inline code`, ### headings,
   - bullets, 1. numbered, and plain http links. Enough for the
   coach's typical output without pulling in a markdown dep.
   ═════════════════════════════════════════════════════════════════ */

function MarkdownLite({ text }: { text: string }) {
  // Force an exemplar fence onto its own block by padding blank lines
  // around it — covers cases where the coach appends the fence directly
  // to the prose above without the usual double-newline separator.
  const normalized = text.replace(
    /(```exemplar\s*\n[\s\S]*?\n?```)/g,
    "\n\n$1\n\n"
  );
  const blocks = normalized.split(/\n{2,}/);
  return (
    <>
      {blocks.map((block, i) => (
        <Block key={i} text={block} />
      ))}
    </>
  );
}

function Block({ text }: { text: string }) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // ─── Exemplar video suggestion (coaching agent fenced block) ───
  // The coaching agent emits:
  //   ```exemplar
  //   {"youtube_id":"...","title":"...","creator":"...","why":"..."}
  //   ```
  // Render it as a clickable card that opens the video panel on the right.
  if (trimmed.startsWith("```exemplar")) {
    const match = trimmed.match(/^```exemplar\s*\n([\s\S]*?)\n?```/);
    if (match) {
      try {
        const parsed = JSON.parse(match[1].trim());
        if (parsed.youtube_id && parsed.title) {
          return (
            <ExemplarCard
              youtubeId={String(parsed.youtube_id)}
              title={String(parsed.title)}
              creator={parsed.creator ? String(parsed.creator) : undefined}
              why={parsed.why ? String(parsed.why) : undefined}
            />
          );
        }
      } catch {
        // fall through to normal rendering if JSON is malformed
      }
    }
  }

  const hMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
  if (hMatch) {
    const level = hMatch[1].length;
    const body = hMatch[2];
    if (level === 1) return <h3 className={styles.chatHeading1}><Inline text={body} /></h3>;
    if (level === 2) return <h4 className={styles.chatHeading2}><Inline text={body} /></h4>;
    return <h5 className={styles.chatHeading3}><Inline text={body} /></h5>;
  }

  const lines = trimmed.split(/\n/);
  const allBullets = lines.every((l) => /^[-*]\s+/.test(l));
  if (allBullets) {
    return (
      <ul className={styles.chatList}>
        {lines.map((l, i) => (
          <li key={i}>
            <Inline text={l.replace(/^[-*]\s+/, "")} />
          </li>
        ))}
      </ul>
    );
  }

  const allOrdered = lines.every((l) => /^\d+\.\s+/.test(l));
  if (allOrdered) {
    return (
      <ol className={styles.chatListOrdered}>
        {lines.map((l, i) => (
          <li key={i}>
            <Inline text={l.replace(/^\d+\.\s+/, "")} />
          </li>
        ))}
      </ol>
    );
  }

  return (
    <p className={styles.chatParagraph}>
      {lines.map((l, i) => (
        <span key={i}>
          <Inline text={l} />
          {i < lines.length - 1 ? <br /> : null}
        </span>
      ))}
    </p>
  );
}

/* ═════════════════════════════════════════════════════════════════
   ExemplarCard — clickable card rendered in place of the coaching
   agent's ```exemplar fenced block. Click opens the right-rail
   VideoPanel (which swaps in for SessionsList).
   ═════════════════════════════════════════════════════════════════ */

function ExemplarCard({
  youtubeId,
  title,
  creator,
  why,
}: {
  youtubeId: string;
  title: string;
  creator?: string;
  why?: string;
}) {
  const { openVideo } = useExemplar();
  return (
    <button
      type="button"
      className={styles.exemplarCard}
      onClick={() =>
        openVideo({
          youtubeId,
          title,
          creator,
          why,
        })
      }
    >
      <div className={styles.exemplarCardIcon}>
        <Video />
      </div>
      <div className={styles.exemplarCardBody}>
        <span className={styles.exemplarCardEyebrow}>Want to see how top creators handle this?</span>
        <span className={styles.exemplarCardTitle}>{title}</span>
        {creator ? <span className={styles.exemplarCardCreator}>{creator}</span> : null}
        {why ? <span className={styles.exemplarCardWhy}>{why}</span> : null}
      </div>
      <div className={styles.exemplarCardAction}>Watch example</div>
    </button>
  );
}

function Inline({ text }: { text: string }) {
  const parts: Array<string | ReactNode> = [];
  const combined = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|https?:\/\/\S+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = combined.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      parts.push(<em key={key++}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("`")) {
      parts.push(<code key={key++}>{token.slice(1, -1)}</code>);
    } else {
      parts.push(
        <a key={key++} href={token} target="_blank" rel="noopener noreferrer">
          {token.length > 48 ? `${token.slice(0, 48)}…` : token}
        </a>
      );
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <>{parts}</>;
}
