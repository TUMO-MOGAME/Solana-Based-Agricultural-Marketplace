"use client";

import { useEffect, useState } from "react";

/* Streamed instantly by Next.js while /dashboard compiles (dev) or its
   data resolves (prod). Mirrors the new shell silhouette: left rail + main
   (search · profile · timeline) + right rail — in the auth-page palette
   so it doesn't flash a bright white skeleton against the dark dashboard.

   Reads the avatar from sessionStorage (set by /login · /signup) so the
   profile circle shows the logged-in user's image during the loading
   state instead of a generic placeholder. */

const skel = "animate-pulse rounded-md";

export default function DashboardLoading() {
  const [avatar, setAvatar] = useState("/content_creator.webp");

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("sa.user");
      if (!raw) return;
      const parsed = JSON.parse(raw) as { avatar?: string };
      if (parsed.avatar) setAvatar(parsed.avatar);
    } catch {
      /* keep default */
    }
  }, []);
  return (
    <div
      className="relative flex h-[100svh] w-full overflow-hidden"
      style={{
        maxWidth: 1600,
        margin: "0 auto",
        backgroundColor: "#1a0f0c",
        fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
      }}
    >
      {/* Ambient blobs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-[30%]"
        style={{
          background:
            "radial-gradient(circle at 18% 28%, #ff7b6b, transparent 32%), radial-gradient(circle at 78% 68%, #ffb86b, transparent 36%)",
          filter: "blur(140px)",
          opacity: 0.12,
          zIndex: 0,
        }}
      />

      {/* ─── Left rail ─── */}
      <aside
        className="relative z-[2] hidden md:flex flex-col w-[260px] shrink-0 overflow-y-auto"
        style={{
          backgroundColor: "#160b08",
          borderRight: "1px solid rgba(255, 230, 210, 0.08)",
        }}
      >
        <div className="flex items-center gap-3 h-[72px] px-6">
          <div
            className={`${skel} h-[34px] w-[34px] rounded-[10px]`}
            style={{
              background: "linear-gradient(135deg, #ff7b6b, #ffb86b)",
              opacity: 0.4,
            }}
          />
          <div className="flex flex-col gap-1.5">
            <div className={`${skel} h-3 w-32 bg-white/10`} />
            <div className={`${skel} h-2 w-20 bg-white/5`} />
          </div>
        </div>

        <div className="px-4 pt-2 pb-5 flex flex-col gap-1.5">
          <div className={`${skel} h-2.5 w-12 mx-3 mb-3 bg-white/5`} />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 h-10 rounded-[10px] px-3"
            >
              <div className={`${skel} h-4 w-4 bg-white/10`} />
              <div className={`${skel} h-3 w-24 bg-white/10`} />
            </div>
          ))}
        </div>

      </aside>

      {/* ─── Main column ─── */}
      <main className="relative z-[1] flex-grow min-w-0 flex flex-col">
        {/* Search bar */}
        <div
          className="h-16 px-6 flex items-center gap-3 shrink-0"
          style={{
            backgroundColor: "#160b08",
            borderBottom: "1px solid rgba(255, 230, 210, 0.08)",
          }}
        >
          <div
            className={`${skel} h-[42px] max-w-[480px] w-full rounded-xl`}
            style={{ backgroundColor: "rgba(0, 0, 0, 0.3)" }}
          />
        </div>

        {/* Body */}
        <div className="flex-grow overflow-hidden p-5">
          {/* Profile header */}
          <div
            className="relative h-[280px] rounded-[20px] overflow-hidden"
            style={{
              background:
                "radial-gradient(circle at 20% 30%, rgba(255, 123, 107, 0.6), transparent 45%), radial-gradient(circle at 80% 70%, rgba(255, 184, 107, 0.5), transparent 50%), linear-gradient(135deg, #2a1712 0%, #5a2a1d 100%)",
            }}
          >
            {/* Bottom gradient */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to bottom, transparent 30%, rgba(26, 15, 12, 0.5) 70%, rgba(26, 15, 12, 0.95) 100%)",
              }}
            />
            <div className="absolute bottom-[76px] left-7 flex items-end gap-5 z-[3]">
              <img
                src={avatar}
                alt=""
                className="h-[108px] w-[108px] rounded-full object-cover"
                style={{
                  border: "3px solid #1a0f0c",
                  boxShadow: "0 0 0 1px rgba(255, 184, 107, 0.4)",
                }}
              />
              <div className="pb-2 flex flex-col gap-2">
                <div className={`${skel} h-6 w-40 bg-white/10`} />
                <div className={`${skel} h-2.5 w-28 bg-white/5`} />
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 pl-[168px] flex gap-1 z-[3]">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`${skel} h-3 w-16 mx-3 my-[18px] bg-white/10`}
                />
              ))}
            </div>
          </div>

          {/* Timeline columns */}
          <div className="flex gap-5 pt-5">
            {/* Left */}
            <div className="w-[320px] shrink-0 flex flex-col gap-5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="rounded-[16px] p-5"
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.04)",
                    border: "1px solid rgba(255, 230, 210, 0.08)",
                  }}
                >
                  <div className={`${skel} h-3 w-28 mb-4 bg-white/10`} />
                  <div className={`${skel} h-2.5 w-5/6 mb-2 bg-white/10`} />
                  <div className={`${skel} h-2.5 w-3/4 mb-2 bg-white/10`} />
                  <div className={`${skel} h-2.5 w-2/3 bg-white/5`} />
                </div>
              ))}
            </div>

            {/* Right — chat skeleton */}
            <div className="flex-grow min-w-0">
              <div
                className="rounded-[16px] overflow-hidden flex flex-col"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid rgba(255, 230, 210, 0.08)",
                  minHeight: "68vh",
                }}
              >
                <div
                  className="flex items-center gap-4 p-5"
                  style={{ borderBottom: "1px solid rgba(255, 230, 210, 0.08)" }}
                >
                  <div
                    className={`${skel} h-10 w-10 rounded-xl`}
                    style={{
                      background: "linear-gradient(135deg, #ff7b6b, #ffb86b)",
                      opacity: 0.4,
                    }}
                  />
                  <div className="flex-grow flex flex-col gap-2">
                    <div className={`${skel} h-3 w-48 bg-white/10`} />
                    <div className={`${skel} h-2 w-32 bg-white/5`} />
                  </div>
                </div>
                <div className="flex-grow p-5 flex flex-col gap-5">
                  <div className="flex gap-3">
                    <div
                      className={`${skel} h-8 w-8 rounded-full shrink-0 bg-white/10`}
                    />
                    <div className="flex-grow flex flex-col gap-2 max-w-[80%]">
                      <div className={`${skel} h-3 w-3/4 bg-white/10`} />
                      <div className={`${skel} h-3 w-5/6 bg-white/10`} />
                      <div className={`${skel} h-3 w-2/3 bg-white/5`} />
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <div className="flex flex-col items-end gap-2 max-w-[70%]">
                      <div className={`${skel} h-3 w-48 bg-white/10`} />
                      <div className={`${skel} h-3 w-32 bg-white/5`} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Centred status pill */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className="flex items-center gap-3 rounded-full px-4 py-2.5"
            style={{
              background: "rgba(26, 15, 12, 0.78)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255, 184, 107, 0.2)",
              boxShadow: "0 14px 32px rgba(0, 0, 0, 0.5)",
            }}
          >
            <span className="relative flex h-2 w-2">
              <span
                className="absolute inline-flex h-full w-full rounded-full animate-ping"
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
              Loading Creator Studio…
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
