"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

/**
 * Tracks the currently-active pipeline run for the dashboard. When set,
 * the right rail swaps SessionsList → PipelinePanel (same takeover
 * pattern as VideoPanel + JourneyPanel) so the user can watch every
 * stage of the orchestrator complete in real time.
 *
 * Only one run is "active in the panel" at a time. Background runs
 * still execute and update their pipeline_runs rows; switching back
 * to one is just a setRunId call away.
 */

interface PipelineContextValue {
  activeRunId: string | null;
  openRun: (id: string) => void;
  closeRun: () => void;
  isOpen: boolean;
}

const PipelineContext = createContext<PipelineContextValue | null>(null);

export function PipelineProvider({ children }: { children: React.ReactNode }) {
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const openRun = useCallback((id: string) => setActiveRunId(id), []);
  const closeRun = useCallback(() => setActiveRunId(null), []);
  return (
    <PipelineContext.Provider
      value={{ activeRunId, openRun, closeRun, isOpen: activeRunId !== null }}
    >
      {children}
    </PipelineContext.Provider>
  );
}

export function usePipeline() {
  const ctx = useContext(PipelineContext);
  if (!ctx) throw new Error("usePipeline must be used within a PipelineProvider");
  return ctx;
}
