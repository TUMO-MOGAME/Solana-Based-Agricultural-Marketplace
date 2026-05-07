"use client";

// Compact wallet connect button.
// - Disconnected: shows a wallet icon; click opens the wallet-modal.
// - Connected:    shows the truncated address; click disconnects.
//
// Styled to match the dashboard's `.accountBtn` shape (34×34 rounded square)
// when disconnected, and a wider pill when connected.

import { Wallet, LogOut } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

function shortAddress(addr: string): string {
  if (addr.length <= 8) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export function WalletButton({ className }: { className?: string }) {
  const { publicKey, disconnect, connecting } = useWallet();
  const { setVisible } = useWalletModal();

  if (publicKey) {
    return (
      <button
        type="button"
        onClick={() => disconnect()}
        title="Disconnect wallet"
        aria-label={`Disconnect wallet ${publicKey.toBase58()}`}
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
          }}
        >
          <Wallet style={{ width: 12, height: 12, color: "#1a0f0c" }} />
        </span>
        {shortAddress(publicKey.toBase58())}
        <LogOut style={{ width: 12, height: 12, opacity: 0.6 }} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setVisible(true)}
      disabled={connecting}
      title={connecting ? "Connecting…" : "Connect wallet"}
      aria-label="Connect wallet"
      className={className}
    >
      <Wallet />
    </button>
  );
}
