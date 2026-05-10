"use client";

// Solana wallet + connection providers for the app.
//
// Mount once at the root layout. `useConnection` and `useFarmerWallet`
// (or `useWallet`) are then available in any client component.
//
// Two layers, both always mounted:
//   1. <ConnectionProvider> + <WalletProvider> + <WalletModalProvider> —
//      the existing wallet-adapter stack. Powers the co-op-staff path
//      (Phantom popup) on /coop/* (when that surface ships).
//   2. <PrivyProvider> — only mounted when NEXT_PUBLIC_PRIVY_APP_ID is
//      set. Powers the farmer-facing custodial path: email login →
//      auto-created embedded Solana wallet → no seed phrase, no
//      "blockchain" words anywhere the farmer sees.
//
// useFarmerWallet() in lib/vuna/farmer-wallet.tsx picks which backend
// to read from at module load, based on the same env var.

import { useMemo, type ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import {
  createSolanaRpc,
  createSolanaRpcSubscriptions,
} from "@solana/kit";
import {
  isPrivyConfigured,
  PRIVY_APP_ID,
  PRIVY_SOLANA_CHAIN,
} from "./privy-config";

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

  const inner = (
    <ConnectionProvider endpoint={RPC_URL}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );

  if (!isPrivyConfigured()) return inner;

  // Privy config:
  //  - embeddedWallets.solana.createOnLogin: 'users-without-wallets' →
  //    auto-create a custodial Solana wallet for any farmer who logs
  //    in without one. The farmer never sees a seed phrase.
  //  - loginMethods: ['email'] keeps the auth surface as simple as
  //    possible for low-literacy users. Add 'sms' later for users
  //    whose phone is their primary identity.
  //  - appearance.theme matches our dark plum + coral-amber palette
  //    so the Privy modal feels like part of the app.
  // Privy's transaction-confirm modal (StandardSignAndSendTransactionScreen)
  // looks up `config.solana.rpcs[chain]` to broadcast a signed tx. Privy
  // ships defaults only for mainnet, so for devnet we MUST provide one
  // here or the modal throws "No RPC configuration found for chain
  // solana:devnet" the moment a user tries to sign.
  //
  // The Rpc objects are @solana/kit clients (separate package from
  // @solana/web3.js). They're heavy but Privy's API requires them.
  const wsUrl = RPC_URL.replace(/^http(s?):/, (_m, s) => `ws${s}:`);

  // Registering Solana wallet connectors is what makes `useWallets()`
  // from @privy-io/react-auth/solana actually work. Without this, the
  // hook throws "useWallets was called outside the PrivyProvider" at
  // dashboard render time — even though we ARE inside the provider —
  // because Privy looks up Solana connectors in a separate context
  // that's only populated when this is set.
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["email"],
        embeddedWallets: {
          solana: { createOnLogin: "users-without-wallets" },
        },
        externalWallets: {
          solana: {
            connectors: toSolanaWalletConnectors(),
          },
        },
        solana: {
          rpcs: {
            [PRIVY_SOLANA_CHAIN]: {
              rpc: createSolanaRpc(RPC_URL),
              rpcSubscriptions: createSolanaRpcSubscriptions(wsUrl),
            },
          },
        },
        appearance: {
          theme: "dark",
          accentColor: "#ff7b6b",
          walletChainType: "solana-only",
        },
      }}
    >
      {inner}
    </PrivyProvider>
  );
}
