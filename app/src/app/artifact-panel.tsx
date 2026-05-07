"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Maximize2,
  Minimize2,
  Globe,
  FileText,
  Code,
  ExternalLink,
  Copy,
  Check,
  ChevronLeft,
} from "lucide-react";

/* ─── Types ─── */
export type ArtifactType = "markdown" | "code" | "iframe" | "html";

export interface Artifact {
  id: string;
  title: string;
  type: ArtifactType;
  content: string; // markdown text, code string, or URL for iframe
  language?: string; // for code artifacts
}

interface ArtifactPanelProps {
  artifact: Artifact | null;
  onClose: () => void;
}

/* ─── Simple Markdown Renderer ─── */
function renderMarkdown(md: string): string {
  let html = md
    // code blocks
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (_m, lang, code) => {
      return `<pre class="artifact-code-block"><code class="language-${lang || ""}">${escapeHtml(code.trim())}</code></pre>`;
    })
    // inline code
    .replace(/`([^`]+)`/g, '<code class="artifact-inline-code">$1</code>')
    // headings
    .replace(/^### (.+)$/gm, '<h3 class="artifact-h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="artifact-h2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="artifact-h1">$1</h1>')
    // bold & italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // horizontal rule
    .replace(/^---$/gm, '<hr class="artifact-hr" />')
    // unordered list items
    .replace(/^[-*] (.+)$/gm, '<li class="artifact-li">$1</li>')
    // ordered list items
    .replace(/^\d+\. (.+)$/gm, '<li class="artifact-li-ordered">$1</li>')
    // blockquote
    .replace(/^> (.+)$/gm, '<blockquote class="artifact-blockquote">$1</blockquote>')
    // paragraphs (double newline)
    .replace(/\n\n/g, '</p><p class="artifact-p">')
    // single newline → <br>
    .replace(/\n/g, "<br />");

  // wrap consecutive <li> in <ul>
  html = html.replace(
    /(<li class="artifact-li">[\s\S]*?<\/li>)(?:\s*<br \/>)*/g,
    "$1"
  );

  return `<p class="artifact-p">${html}</p>`;
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ─── Icon for artifact type ─── */
function ArtifactIcon({ type }: { type: ArtifactType }) {
  switch (type) {
    case "iframe":
      return <Globe className="h-4 w-4" />;
    case "code":
      return <Code className="h-4 w-4" />;
    case "html":
      return <Code className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
}

/* ─── Main Panel ─── */
export default function ArtifactPanel({ artifact, onClose }: ArtifactPanelProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  // Reset iframe loading on artifact change
  useEffect(() => {
    if (artifact?.type === "iframe") {
      setIframeLoading(true);
    }
  }, [artifact?.content, artifact?.type]);

  // Escape key to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isFullscreen) setIsFullscreen(false);
        else onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, isFullscreen]);

  if (!artifact) return null;

  const handleCopy = async () => {
    if (artifact.type !== "iframe") {
      await navigator.clipboard.writeText(artifact.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      ref={panelRef}
      className={`flex flex-col bg-white border-l border-neutral-200 transition-all duration-300 ease-in-out ${
        isFullscreen
          ? "fixed inset-0 z-50 border-l-0"
          : "relative h-full"
      }`}
    >
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between min-h-14 px-3 sm:px-4 pt-[max(env(safe-area-inset-top),0.25rem)] pb-1 border-b border-neutral-100 shrink-0 bg-white">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="flex items-center gap-1 text-neutral-400 hover:text-neutral-700 transition-colors text-[12px] font-medium shrink-0"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Close</span>
          </button>

          <div className="h-5 w-px bg-neutral-200" />

          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-lg bg-red-50 grid place-items-center shrink-0">
              <ArtifactIcon type={artifact.type} />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-neutral-900 truncate">
                {artifact.title}
              </p>
              <p className="text-[10px] text-neutral-400 uppercase tracking-wider font-medium">
                {artifact.type === "iframe" ? "Browser" : artifact.type}
                {artifact.language ? ` · ${artifact.language}` : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Copy button (not for iframe) */}
          {artifact.type !== "iframe" && (
            <button
              onClick={handleCopy}
              className="h-8 w-8 rounded-lg grid place-items-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
              title="Copy content"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          )}

          {/* Open in new tab (iframe only) */}
          {artifact.type === "iframe" && (
            <a
              href={artifact.content}
              target="_blank"
              rel="noopener noreferrer"
              className="h-8 w-8 rounded-lg grid place-items-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}

          {/* Fullscreen toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="h-8 w-8 rounded-lg grid place-items-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg grid place-items-center text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ─── Content ─── */}
      <div className="flex-1 overflow-hidden relative">
        {/* Iframe */}
        {artifact.type === "iframe" && (
          <>
            {iframeLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 rounded-full border-2 border-red-200 border-t-red-500 animate-spin" />
                  <p className="text-[12px] text-neutral-400 font-medium">Loading browser view…</p>
                </div>
              </div>
            )}
            <iframe
              src={artifact.content}
              className="w-full h-full border-0"
              onLoad={() => setIframeLoading(false)}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              title={artifact.title}
            />
          </>
        )}

        {/* Markdown */}
        {artifact.type === "markdown" && (
          <div className="h-full overflow-y-auto p-4 sm:p-6 safe-bottom">
            <div
              className="artifact-markdown max-w-none"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(artifact.content) }}
            />
          </div>
        )}

        {/* Code */}
        {artifact.type === "code" && (
          <div className="h-full overflow-y-auto p-0">
            <pre className="h-full overflow-auto bg-neutral-950 text-neutral-100 p-4 sm:p-6 text-[13px] leading-relaxed font-mono">
              <code>{artifact.content}</code>
            </pre>
          </div>
        )}

        {/* HTML */}
        {artifact.type === "html" && (
          <div className="h-full overflow-hidden">
            <iframe
              srcDoc={artifact.content}
              className="w-full h-full border-0"
              sandbox="allow-scripts"
              title={artifact.title}
            />
          </div>
        )}
      </div>
    </div>
  );
}
