"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

export interface ExemplarVideo {
  youtubeId: string;
  title: string;
  creator?: string;
  why?: string;
}

interface ExemplarContextValue {
  video: ExemplarVideo | null;
  openVideo: (v: ExemplarVideo) => void;
  closeVideo: () => void;
  isOpen: boolean;
}

const ExemplarContext = createContext<ExemplarContextValue | null>(null);

export function ExemplarProvider({ children }: { children: React.ReactNode }) {
  const [video, setVideo] = useState<ExemplarVideo | null>(null);
  const openVideo = useCallback((v: ExemplarVideo) => setVideo(v), []);
  const closeVideo = useCallback(() => setVideo(null), []);
  return (
    <ExemplarContext.Provider value={{ video, openVideo, closeVideo, isOpen: video !== null }}>
      {children}
    </ExemplarContext.Provider>
  );
}

export function useExemplar() {
  const ctx = useContext(ExemplarContext);
  if (!ctx) {
    throw new Error("useExemplar must be used within an ExemplarProvider");
  }
  return ctx;
}
