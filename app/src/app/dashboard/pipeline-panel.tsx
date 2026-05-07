"use client";

import { useEffect, useState } from "react";
import {
  X,
  Activity,
  Check,
  Loader2,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  Compass,
  Lightbulb,
  PenLine,
  Vote,
  LineChart,
} from "lucide-react";
import { usePipeline } from "./pipeline-context";
import styles from "./dashboard.module.css";

/* PipelinePanel — replaces SessionsList on the right rail when an
   orchestrator run is being watched. Polls /api/orchestrate/[id] every
   2 s and renders one row per pipeline stage with its current status. */

interface Stage {
  node: string;
  status: "running" | "ok" | "error";
  duration_ms?: number;
  error?: string | null;
}

interface PipelineRun {
  id: string;
  uploader: string;
  intent: string | null;
  status: "pending" | "running" | "approved" | "rejected" | "errored";
  stages: Stage[];
  panel_iteration: number;
  panel_approved: boolean | null;
  content_draft_id: string | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  user_input: string | null;
  created_at: string;
  updated_at: string;
}

const ORDERED_STAGES: { key: string; label: string; icon: React.ReactNode }[] = [
  { key: "profiler",   label: "Profiler",   icon: <Sparkles /> },
  { key: "analyst",    label: "Analyst",    icon: <Compass /> },
  { key: "strategist", label: "Strategist", icon: <Lightbulb /> },
  { key: "researcher", label: "Researcher", icon: <TrendingUp /> },
  { key: "creator",    label: "Creator",    icon: <PenLine /> },
  { key: "panel",      label: "Panel × 5",  icon: <Vote /> },
  { key: "learner",    label: "Learner",    icon: <LineChart /> },
];

const PANEL_VOTERS = new Set([
  "panel_strategic",
  "panel_quality",
  "panel_safety",
  "panel_brand",
  "panel_platform",
]);

function stageStatusFor(stages: Stage[], key: string): Stage["status"] | "pending" {
  // For panel, aggregate all panel_* + panel rows
  if (key === "panel") {
    const panelLogs = stages.filter(
      (s) => s.node === "panel" || PANEL_VOTERS.has(s.node) ||
        (typeof s.node === "string" && s.node.startsWith("panel_")),
    );
    if (panelLogs.length === 0) return "pending";
    if (panelLogs.some((s) => s.status === "running")) return "running";
    if (panelLogs.every((s) => s.status === "ok")) return "ok";
    return panelLogs[panelLogs.length - 1].status;
  }
  // Find the LAST log entry for this node — handles the running→ok transition
  // since we append a 'running' row before the work and an 'ok' after.
  const matches = stages.filter((s) => s.node === key);
  if (matches.length === 0) return "pending";
  return matches[matches.length - 1].status;
}

function formatDuration(ms: number | undefined): string {
  if (!ms) return "";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export default function PipelinePanel() {
  const { activeRunId, closeRun } = usePipeline();
  const [run, setRun] = useState<PipelineRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Poll the run every 2 s. Stops once the run reaches a terminal status.
  useEffect(() => {
    if (!activeRunId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/orchestrate/${activeRunId}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`run lookup returned ${res.status}`);
        }
        const json = (await res.json()) as { run?: PipelineRun };
        if (cancelled) return;
        if (json.run) {
          setRun(json.run);
          setError(null);
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      }
    };
    void poll();
    const id = window.setInterval(() => {
      // Stop polling once terminal — the row won't change again.
      if (run && ["approved", "rejected", "errored"].includes(run.status)) {
        return;
      }
      void poll();
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [activeRunId, run]);

  if (!activeRunId) return null;

  const stages = run?.stages ?? [];
  const overallStatus = run?.status ?? "pending";
  const isTerminal = ["approved", "rejected", "errored"].includes(overallStatus);

  // Latest "running" stage for the headline
  const headlineStage =
    stages.length > 0 ? stages[stages.length - 1] : null;

  return (
    <div className={styles.pipelinePanel}>
      <header className={styles.pipelinePanelHeader}>
        <div className={styles.pipelinePanelHeaderLeft}>
          <div
            className={`${styles.pipelinePanelIcon} ${styles[`pipelineIcon_${overallStatus}`] ?? ""}`}
          >
            {overallStatus === "approved" ? (
              <Check />
            ) : overallStatus === "rejected" || overallStatus === "errored" ? (
              <AlertTriangle />
            ) : (
              <Activity />
            )}
          </div>
          <div className={styles.pipelinePanelTitleWrap}>
            <span className={styles.pipelinePanelEyebrow}>
              Orchestrator pipeline
            </span>
            <h3 className={styles.pipelinePanelTitle}>
              {overallStatus === "pending" && "Starting…"}
              {overallStatus === "running" && headlineStage
                ? `Running: ${headlineStage.node}`
                : null}
              {overallStatus === "running" && !headlineStage && "Running…"}
              {overallStatus === "approved" && "Approved by panel"}
              {overallStatus === "rejected" && "Panel rejected"}
              {overallStatus === "errored" && "Pipeline errored"}
            </h3>
          </div>
        </div>
        <button
          type="button"
          className={styles.pipelinePanelClose}
          onClick={closeRun}
          aria-label="Close panel"
          title="Close panel"
        >
          <X />
        </button>
      </header>

      {/* Brief input echo — what triggered this run */}
      {run?.user_input ? (
        <div className={styles.pipelinePanelInput}>
          <span className={styles.pipelinePanelInputLabel}>Brief</span>
          <p className={styles.pipelinePanelInputBody}>{run.user_input}</p>
        </div>
      ) : null}

      {/* The 7-stage progress list */}
      <ul className={styles.pipelineStageList}>
        {ORDERED_STAGES.map(({ key, label, icon }) => {
          const status = stageStatusFor(stages, key);
          const matches = stages.filter(
            (s) =>
              s.node === key ||
              (key === "panel" &&
                (s.node === "panel" ||
                  PANEL_VOTERS.has(s.node) ||
                  s.node.startsWith("panel_"))),
          );
          const last = matches[matches.length - 1];
          const totalMs = matches
            .filter((s) => s.status === "ok" || s.status === "error")
            .reduce((sum, s) => sum + (s.duration_ms || 0), 0);
          return (
            <li
              key={key}
              className={`${styles.pipelineStageItem} ${styles[`pipelineStage_${status}`] ?? ""}`}
            >
              <span className={styles.pipelineStageMarker}>
                {status === "running" ? (
                  <Loader2 className={styles.pipelineSpin} />
                ) : status === "ok" ? (
                  <Check />
                ) : status === "error" ? (
                  <AlertTriangle />
                ) : (
                  <span className={styles.pipelineStagePending}>○</span>
                )}
              </span>
              <span className={styles.pipelineStageIcon}>{icon}</span>
              <div className={styles.pipelineStageBody}>
                <span className={styles.pipelineStageLabel}>{label}</span>
                {totalMs > 0 ? (
                  <span className={styles.pipelineStageDuration}>
                    {formatDuration(totalMs)}
                  </span>
                ) : null}
                {last?.error ? (
                  <span className={styles.pipelineStageError}>{last.error}</span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Iteration indicator if the panel forced a retry */}
      {run && run.panel_iteration > 0 ? (
        <div className={styles.pipelineIterationBanner}>
          Panel rejected — Creator on iteration {run.panel_iteration} of 4.
        </div>
      ) : null}

      {/* Final outcome card */}
      {isTerminal && run ? (
        <div className={styles.pipelineOutcome}>
          {overallStatus === "approved" ? (
            <>
              <strong>✓ Pipeline approved</strong>
              <p>
                A new content draft has been written to your{" "}
                <code>posts</code> table. Open Supabase → Table Editor → posts
                to see it, or wire in a "View draft" link next.
              </p>
              {run.content_draft_id ? (
                <p className={styles.pipelineOutcomeMono}>
                  content_draft_id: {run.content_draft_id}
                </p>
              ) : null}
            </>
          ) : overallStatus === "rejected" ? (
            <>
              <strong>✗ Panel never reached consensus</strong>
              <p>
                The panel rejected through all {run.panel_iteration + 1}{" "}
                iterations. Try again with a different brief, or look at the
                dissent reasons in <code>panel_votes</code>.
              </p>
            </>
          ) : (
            <>
              <strong>✗ Pipeline errored</strong>
              <p className={styles.pipelineOutcomeMono}>
                {run.error || "Unknown error"}
              </p>
            </>
          )}
        </div>
      ) : null}

      {error ? (
        <div className={styles.pipelinePanelPollError}>
          Polling error — {error}. Will keep retrying.
        </div>
      ) : null}
    </div>
  );
}
