"use client";

// useFarmerWallet — same shape as @solana/wallet-adapter-react useWallet(),
// but routes through Privy's embedded Solana wallet when configured.
//
// The dashboard, marketplace, and apply tabs already use useWallet() in
// 5 places. By matching its return shape we let those call sites just
// swap the import — surrounding logic stays.
//
// Mode is decided ONCE at module load by the env var, so the hook
// identity is stable across renders (React Rules of Hooks compliant —
// the hook itself never branches between Privy and wallet-adapter
// internals on different renders).

import { useCallback, useMemo } from "react";
import { PublicKey, type Transaction, type Connection } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import bs58 from "bs58";
import { isPrivyConfigured, PRIVY_SOLANA_CHAIN } from "./privy-config";

export type FarmerWalletMode = "privy" | "wallet-adapter";

export type FarmerWallet = {
  /** Stable identity of the wallet. Null while not connected / created. */
  publicKey: PublicKey | null;
  /** True while the wallet system is bootstrapping. */
  connecting: boolean;
  /** True once we know the connect/disconnect state with confidence. */
  ready: boolean;
  /** Sign + send. Returns the base58 signature, just like wallet-adapter. */
  sendTransaction: (
    tx: Transaction,
    connection: Connection,
  ) => Promise<string>;
  /** Trigger the wallet UI (Privy login modal or wallet-adapter modal). */
  connect: () => Promise<void>;
  /** Disconnect / sign out. */
  disconnect: () => Promise<void>;
  /** Which backend is in play. Useful for UI branching (button labels). */
  mode: FarmerWalletMode;
  /** Privy-only: the logged-in email. Undefined for wallet-adapter. */
  email?: string;
};

// ─── Privy implementation ────────────────────────────────────────────

function useFarmerWalletPrivy(): FarmerWallet {
  const { ready: privyReady, authenticated, user, login, logout } = usePrivy();
  const { ready: walletsReady, wallets } = useWallets();

  // Privy lists every Solana wallet the user has connected. For an
  // auto-created embedded wallet there'll be exactly one entry.
  const wallet = wallets[0] ?? null;

  const publicKey = useMemo(() => {
    if (!wallet?.address) return null;
    try {
      return new PublicKey(wallet.address);
    } catch {
      return null;
    }
  }, [wallet]);

  const sendTransaction = useCallback(
    async (tx: Transaction, connection: Connection): Promise<string> => {
      if (!wallet) throw new Error("Wallet not ready — sign in first.");
      if (!publicKey) throw new Error("Wallet has no address yet.");
      if (!tx.feePayer) tx.feePayer = publicKey;
      if (!tx.recentBlockhash) {
        const { blockhash } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
      }
      // Privy's Standard Wallet feature wants serialized bytes, not a
      // Transaction object. We don't require all signatures yet —
      // Privy fills in the signer's.
      const serialized = tx.serialize({ requireAllSignatures: false });
      const out = await wallet.signAndSendTransaction({
        transaction: new Uint8Array(serialized),
        chain: PRIVY_SOLANA_CHAIN,
      });
      // Privy returns raw signature bytes. wallet-adapter consumers
      // expect a base58 string (TransactionSignature).
      return bs58.encode(out.signature);
    },
    [wallet, publicKey],
  );

  const connect = useCallback(async () => {
    if (!authenticated) login();
  }, [authenticated, login]);

  const email =
    typeof user?.email?.address === "string" ? user.email.address : undefined;

  return {
    publicKey,
    connecting: !privyReady,
    ready: privyReady && walletsReady,
    sendTransaction,
    connect,
    disconnect: logout,
    mode: "privy",
    email,
  };
}

// ─── wallet-adapter implementation (unchanged behaviour) ─────────────

function useFarmerWalletAdapter(): FarmerWallet {
  const wa = useWallet();
  const { setVisible } = useWalletModal();

  const sendTransaction = useCallback(
    async (tx: Transaction, connection: Connection): Promise<string> => {
      if (!wa.sendTransaction) {
        throw new Error("Wallet doesn't support sending transactions.");
      }
      return wa.sendTransaction(tx, connection);
    },
    [wa],
  );

  const connect = useCallback(async () => {
    setVisible(true);
  }, [setVisible]);

  const disconnect = useCallback(async () => {
    if (wa.connected) await wa.disconnect();
  }, [wa]);

  return {
    publicKey: wa.publicKey,
    connecting: wa.connecting,
    ready: !wa.connecting,
    sendTransaction,
    connect,
    disconnect,
    mode: "wallet-adapter",
  };
}

// Pick the implementation at module load — env var is baked into the
// build, so the hook identity is stable for the lifetime of the app.
export const useFarmerWallet: () => FarmerWallet = isPrivyConfigured()
  ? useFarmerWalletPrivy
  : useFarmerWalletAdapter;
