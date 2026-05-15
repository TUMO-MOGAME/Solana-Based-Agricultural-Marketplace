"use client";

// <BackgroundVideo /> — fixed full-viewport background video for every page.
//
// Mounted once in app/layout.tsx. Sits behind all content (z-index: -10).
// Native <video> poster attribute paints the first frame instantly while the
// video file streams in, so users never see an empty / black screen on cold
// load. Muted + playsInline + autoPlay so it works on mobile (iOS Safari
// only autoplays muted+inline). No audio track exists in the source files.
//
// A dark plum overlay sits on top of the video so the existing dashboard /
// auth / coop content reads cleanly without restyling every page.

export function BackgroundVideo() {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -10,
        overflow: "hidden",
        pointerEvents: "none",
        background: "#1a0f0c",
      }}
    >
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster="/media/farmer-bg-poster.webp"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
        }}
      >
        <source src="/media/farmer-bg.webm" type="video/webm" />
        <source src="/media/farmer-bg.mp4" type="video/mp4" />
      </video>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(26, 15, 12, 0.78) 0%, rgba(26, 15, 12, 0.72) 50%, rgba(26, 15, 12, 0.82) 100%)",
        }}
      />
    </div>
  );
}
