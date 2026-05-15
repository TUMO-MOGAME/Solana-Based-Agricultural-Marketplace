"use client";

// /grow-pack/new — standalone Apply-for-Grow-Pack page.
//
// Now a thin wrapper around <ApplyTab /> so the dashboard's embedded
// Apply tab and this standalone route share the exact same form code.
// Standalone route is useful for shareable URLs (e.g. emailing a co-op
// officer a direct apply link).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ApplyTab } from "../../dashboard/apply-tab";

export default function NewGrowPackPage() {
  const router = useRouter();

  return (
    <main
      className="min-h-screen p-4 md:p-8"
      style={{
        background: "transparent",
        color: "rgba(255, 245, 230, 0.95)",
        fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
      }}
    >
      <div className="max-w-3xl mx-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-xs"
          style={{ color: "rgba(255, 230, 210, 0.55)" }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Dashboard
        </Link>

        <div style={{ marginTop: 18 }}>
          <ApplyTab
            onSuccess={({ packAddress }) => {
              router.push(`/insurance/${packAddress}`);
            }}
          />
        </div>
      </div>
    </main>
  );
}
