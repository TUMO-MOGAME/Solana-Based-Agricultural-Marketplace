"use client";

// Compact wallet connect button.
//
// Two layout modes, picked by whether the caller passes `className`:
//
//   - **Compact** (`className` provided) — 34×34 icon-only button in
//     every state. Used inside the dashboard's right rail where the
//     full email pill would overflow the 260px-wide container. The
//     connected state glows accent-colored; tooltip carries the
//     email or address.
//
//   - **Wide** (no `className`) — shows a pill with the email (Privy
//     mode) or truncated address (wallet-adapter mode) once connected.
//     Used on /coop and any other surface with room to spare.
//
// Auth backend (Privy email-login vs. Phantom popup) comes from
// useFarmerWallet(), which picks at module load based on env var.

import { Wallet, LogOut } from "lucide-react";
import { useFarmerWallet } from "./farmer-wallet";

function shortAddress(addr: string): string {
  if (addr.length <= 8) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

function shortEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length <= 12) return email;
  return `${local.slice(0, 10)}…@${domain}`;
}

export function WalletButton({ className }: { className?: string }) {
  const fw = useFarmerWallet();
  const connected = fw.publicKey !== null;
  // className is only set by callers in tight layouts (the dashboard
  // right-rail). In those contexts we stay compact in every state.
  const compact = !!className;

  // ─── Connected, wide layout (e.g. /coop header) ───────────────
  if (connected && !compact) {
    const label =
      fw.mode === "privy"
        ? fw.email
          ? shortEmail(fw.email)
          : "Wallet ready"
        : shortAddress(fw.publicKey!.toBase58());
    const title =
      fw.mode === "privy"
        ? `Signed in as ${fw.email ?? "your wallet"}. Click to sign out.`
        : `Connected ${fw.publicKey!.toBase58()}. Click to disconnect.`;

    return (
      <button
        type="button"
        onClick={() => {
          void fw.disconnect();
        }}
        title={title}
        aria-label={title}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          height: 34,
          padding: "0 10px 0 4px",
          borderRadius: 999,
          background: "rgba(255, 184, 107, 0.10)",
          border: "1px solid rgba(255, 184, 107, 0.4)",
          color: "rgba(255, 245, 230, 0.95)",
          fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.04em",
          cursor: "pointer",
          transition: "all 0.15s",
          maxWidth: 220,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #ff7b6b, #ffb86b)",
            display: "grid",
            placeItems: "center",
            boxShadow: "0 4px 10px rgba(255, 123, 107, 0.35)",
            flexShrink: 0,
          }}
        >
          <Wallet style={{ width: 12, height: 12, color: "#1a0f0c" }} />
        </span>
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
          }}
        >
          {label}
        </span>
        <LogOut style={{ width: 12, height: 12, opacity: 0.6, flexShrink: 0 }} />
      </button>
    );
  }

  // ─── Connected, compact layout (dashboard right rail) ─────────
  if (connected && compact) {
    const tipBase =
      fw.mode === "privy"
        ? fw.email ?? "wallet ready"
        : fw.publicKey!.toBase58();
    const title = `Connected as ${tipBase}. Click to sign out.`;
    return (
      <button
        type="button"
        onClick={() => {
          void fw.disconnect();
        }}
        title={title}
        aria-label={title}
        className={className}
        // Override .accountBtn defaults so the connected state stands
        // out — accent gradient instead of the muted default surface.
        style={{
          background: "linear-gradient(135deg, #ff7b6b, #ffb86b)",
          color: "#1a0f0c",
          border: "1px solid rgba(255, 184, 107, 0.55)",
          boxShadow: "0 4px 12px rgba(255, 123, 107, 0.30)",
        }}
      >
        <Wallet />
      </button>
    );
  }

  // ─── Disconnected (both layouts use the same compact icon) ────
  const aria =
    fw.mode === "privy" ? "Sign in to your wallet" : "Connect wallet";
  const title = fw.connecting
    ? "Loading…"
    : fw.mode === "privy"
      ? "Sign in with email"
      : "Connect wallet";

  return (
    <button
      type="button"
      onClick={() => {
        void fw.connect();
      }}
      disabled={fw.connecting}
      title={title}
      aria-label={aria}
      className={className}
    >
      <Wallet />
    </button>
  );
}
