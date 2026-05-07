"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

/**
 * Controls whether the right rail shows the JourneyPanel (swapping in for
 * SessionsList). Mirrors the ExemplarContext pattern used for the video
 * player — keep it small and focused so it can coexist with the other
 * right-rail takeovers without stepping on them.
 */

interface JourneyContextValue {
  /** Session id of the journey currently shown in the right-rail panel. */
  journeySessionId: string | null;
  openJourney: (sessionId: string) => void;
  closeJourney: () => void;
  isOpen: boolean;
}

const JourneyContext = createContext<JourneyContextValue | null>(null);

export function JourneyProvider({ children }: { children: React.ReactNode }) {
  const [journeySessionId, setJourneySessionId] = useState<string | null>(null);
  const openJourney = useCallback((id: string) => setJourneySessionId(id), []);
  const closeJourney = useCallback(() => setJourneySessionId(null), []);
  return (
    <JourneyContext.Provider
      value={{
        journeySessionId,
        openJourney,
        closeJourney,
        isOpen: journeySessionId !== null,
      }}
    >
      {children}
    </JourneyContext.Provider>
  );
}

export function useJourney() {
  const ctx = useContext(JourneyContext);
  if (!ctx) {
    throw new Error("useJourney must be used within a JourneyProvider");
  }
  return ctx;
}
