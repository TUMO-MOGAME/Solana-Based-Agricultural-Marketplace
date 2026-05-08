"use client";

// Solana wallet + connection providers for the app.
//
// Mount once at the root layout. `useConnection` and `useWallet` from
// @solana/wallet-adapter-react are then available in any client component.
//
// Wallet selection modal styling is overridden in globals.css so it picks
// up the dark plum / coral-amber theme instead of the default light skin.
//
// Per app/CLAUDE.md rule 4, this is the *demo / co-op-staff* wallet path
// (Phantom). The farmer-facing custodial path (Magic.link or Privy) is
// a separate, non-blocking workstream.

import { useMemo, type ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";

// Default wallet-adapter UI styles — we restyle them in globals.css.
import "@solana/wallet-adapter-react-ui/styles.css";

const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.devnet.solana.com";

export function VunaWalletProvider({ children }: { children: ReactNode }) {
  // useMemo — wallet adapters create internal listeners on construction;
  // we only want one set per mount, not one per re-render.
  //
  // Phantom is intentionally NOT listed here. Modern Phantom (and Brave
  // Wallet, Backpack) self-register via the Wallet Standard, and adding
  // a manual PhantomWalletAdapter on top causes the runtime warning
  // "The Wallet Adapter for Phantom can be removed from your app." We
  // still ship Solflare as a manual adapter because not every Solflare
  // install registers itself yet, depending on version.
  const wallets = useMemo(() => [new SolflareWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={RPC_URL}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
