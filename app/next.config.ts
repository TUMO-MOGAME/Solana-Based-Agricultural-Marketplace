import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this app/ directory. The Vuna repo root has
  // its own package-lock.json (for the core/ vitest workspace), which
  // would otherwise win the workspace-root inference and break file tracing.
  outputFileTracingRoot: path.resolve(__dirname),

  // Keep ESLint as a separate pipeline (run via `pnpm lint`) instead of
  // gating production builds. Pre-existing lint debt in vendored shadcn
  // primitives (input/sidebar/skeleton) and `a2a-chat.tsx` still surfaces
  // when `pnpm lint` is run, so it isn't hidden — it just doesn't block
  // `next build` from producing a deployable bundle.
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Privy + WalletConnect bring along a few optional peer deps that we
  // don't use (Farcaster login, pino-pretty for log prettifying). Their
  // import paths exist for users who DO use those features; the rest of
  // us get spammed with "Module not found" warnings. Aliasing them to
  // `false` tells webpack "treat this as resolved-but-empty" — silences
  // the warnings without affecting anything we actually run.
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@farcaster/mini-app-solana": false,
      "pino-pretty": false,
    };
    return config;
  },
};

export default nextConfig;
