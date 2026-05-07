"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import type { Artifact } from "./artifact-panel";

interface ArtifactContextValue {
  artifact: Artifact | null;
  openArtifact: (artifact: Artifact) => void;
  closeArtifact: () => void;
  isOpen: boolean;
}

const ArtifactContext = createContext<ArtifactContextValue | null>(null);

export function ArtifactProvider({ children }: { children: React.ReactNode }) {
  const [artifact, setArtifact] = useState<Artifact | null>(null);

  const openArtifact = useCallback((a: Artifact) => {
    setArtifact(a);
  }, []);

  const closeArtifact = useCallback(() => {
    setArtifact(null);
  }, []);

  return (
    <ArtifactContext.Provider
      value={{ artifact, openArtifact, closeArtifact, isOpen: artifact !== null }}
    >
      {children}
    </ArtifactContext.Provider>
  );
}

export function useArtifact() {
  const ctx = useContext(ArtifactContext);
  if (!ctx) {
    throw new Error("useArtifact must be used within an ArtifactProvider");
  }
  return ctx;
}
