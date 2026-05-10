// Single source of truth for whether Privy is configured.
//
// When NEXT_PUBLIC_PRIVY_APP_ID is set in .env.local, the dashboard
// uses Privy's email-login + auto-created embedded Solana wallet for
// the farmer-facing surface (satisfies the "hide the chain" rule from
// CLAUDE.md — no seed phrase, no Phantom popup, no chain words).
//
// When the env var is missing, the dashboard falls back to the
// existing wallet-adapter + Phantom flow. Useful for local dev
// before you have an app ID, and as the co-op-staff path on
// /coop/* (when that surface exists).
//
// Solana cluster the farmer wallet operates on. Defaults to devnet
// — matches NEXT_PUBLIC_SOLANA_RPC default in provider.tsx. Override
// via NEXT_PUBLIC_SOLANA_CLUSTER in .env.local if you ever point at
// mainnet.

export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "";

export type SolanaCluster = "mainnet" | "devnet" | "testnet";

export const SOLANA_CLUSTER: SolanaCluster =
  (process.env.NEXT_PUBLIC_SOLANA_CLUSTER as SolanaCluster | undefined) ??
  "devnet";

/** Privy chain identifier matching {@link SOLANA_CLUSTER}. */
export const PRIVY_SOLANA_CHAIN: `solana:${SolanaCluster}` = `solana:${SOLANA_CLUSTER}`;

export function isPrivyConfigured(): boolean {
  return PRIVY_APP_ID.length > 0;
}
