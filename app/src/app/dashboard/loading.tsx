// Streamed by Next.js while /dashboard is compiling (dev) or its data
// resolves (prod). Mirrors the Mazra'at albaan dashboard's dark plum +
// coral-amber theme so the user never sees a bright white flash.
//
// Deliberately minimal — just the dark base + a soft "loading" pill.
// We don't render the full skeleton because the dashboard is currently
// hardcoded data and resolves instantly; an over-decorated skeleton
// flashes longer than the real page.

export default function DashboardLoading() {
  return (
    <div
      className="relative flex h-[100svh] w-full items-center justify-center overflow-hidden"
      style={{
        backgroundColor: "#1a0f0c",
        fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 18% 28%, #ff7b6b, transparent 32%), radial-gradient(circle at 78% 68%, #ffb86b, transparent 36%)",
          filter: "blur(140px)",
          opacity: 0.12,
        }}
      />
      <div
        className="relative flex items-center gap-3 rounded-full px-4 py-2.5"
        style={{
          background: "rgba(26, 15, 12, 0.78)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 184, 107, 0.2)",
          boxShadow: "0 14px 32px rgba(0, 0, 0, 0.5)",
        }}
      >
        <span className="relative flex h-2 w-2">
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full"
            style={{ backgroundColor: "#ff7b6b", opacity: 0.6 }}
          />
          <span
            className="relative inline-flex h-2 w-2 rounded-full"
            style={{ backgroundColor: "#ffb86b" }}
          />
        </span>
        <span
          className="text-[11px] font-semibold uppercase tracking-[3px]"
          style={{ color: "rgba(255, 230, 210, 0.9)" }}
        >
          Loading…
        </span>
      </div>
    </div>
  );
}
