# app/ — CLAUDE context

Next.js frontend for **Mazra'at albaan** (codename: **Vuna**). Deployed to Vercel: https://solana-based-agricultural-marketpla.vercel.app/

## Status (2026-05-08)

Originally lifted on 2026-05-07 from a separate Next.js + Supabase project ("Social Assembly") for the auth + dashboard shell. As of 2026-05-08 it has been:

- **Stripped** of the Social Assembly cruft (38+ files: coach-chat, CopilotKit, orchestrator, video-panel, journey/exemplar/pipeline panels, marketing/about/team pages, agent-only Supabase migrations, ~2.9 MB of unused images). `dashboard.module.css` trimmed from 5,293 → 945 lines.
- **Rebranded** to Mazra'at albaan (page metadata, auth pages, root landing, dashboard chrome). Visual theme: dark plum (`#1a0f0c`) base + coral-amber (`#ff7b6b → #ffb86b`) gradient accents.
- **Wired to Solana** — `lib/vuna/program.ts` has hand-rolled Borsh decoders + instruction encoders for the deployed program at `7LUkUHVazSw732334JKFP88VAFc4iYXXJZkgFnZV9kqA` on devnet. 25 Vitest tests cover PDA derivation + pricing math + ix byte layouts.
- **Wallet adapter (Phantom) wired** via `<VunaWalletProvider />` in the root layout.

## Routes — shipped

| Route | What |
|-|-|
| `/` | Mazra'at albaan landing — dark-plum hero, 3 feature cards |
| `/login` · `/signup` · `/forgot-password` · `/reset-password` · `/auth/callback` | Supabase auth, with demo-mode bypass when env vars are missing |
| `/dashboard` | 3-column shell (left sidebar / profile + tabs / right rail). **5 in-page tabs:** Active, Apply, Insurance, History, About. Compact 168 px profile header, 64 px avatar with coral-amber gradient. Wallet item in left sidebar shows truncated pubkey when connected. |
| `/grow-pack/new` | Standalone wrapper around `<ApplyTab />` for shareable apply-direct links |
| `/insurance/[packId]` | Server-rendered shareable URL — anyone can open it, the server fetches the pack from devnet at request time |

**Rule of the dashboard:** no in-app click navigates away from `/dashboard`. Everything (Apply, Insurance, etc.) is an in-page tab. Standalone `/grow-pack/new` and `/insurance/[packId]` exist purely for shareable deep-link URLs.

## Key files

| File | What |
|-|-|
| `src/app/page.tsx` | Root landing |
| `src/app/layout.tsx` | Root layout — mounts `<VunaWalletProvider />`, sets metadata |
| `src/app/dashboard/page.tsx` | The dashboard with all 5 tabs |
| `src/app/dashboard/apply-tab.tsx` | The Grow Pack application form (used by both dashboard tab AND `/grow-pack/new`) |
| `src/app/dashboard/dashboard.module.css` | Dashboard CSS — 945 lines after the Social Assembly trim |
| `src/app/dashboard/loading.tsx` | Minimal Mazra'at albaan loading pill (replaced the old "Loading Creator Studio…" skeleton) |
| `src/app/insurance/[packId]/page.tsx` | Server-rendered shareable insurance view |
| `src/app/grow-pack/new/page.tsx` | Thin wrapper around `<ApplyTab />` |
| `src/lib/vuna/program.ts` | Solana client — `PROGRAM_ID`, PDA helpers, Borsh decoders, instruction encoders |
| `src/lib/vuna/program.test.ts` | 25 Vitest tests for the client |
| `src/lib/vuna/provider.tsx` | `<VunaWalletProvider />` — Connection + WalletProvider + WalletModalProvider |
| `src/lib/vuna/wallet-button.tsx` | Compact connect/disconnect button |
| `src/lib/supabase/client.ts` | Browser Supabase client + `isSupabaseConfigured()` for demo-mode |
| `scripts/setup-devnet-demo.mjs` | One-shot devnet setup — registers a farmer, creates + approves + disburses a Grow Pack, fires drought trigger |
| `public/wallet-view.tsx` ← (orphan, untouched) | Tier/pool/claims component the user added; not yet integrated |

## Two surfaces, one codebase (Vuna intent — current vs. planned)

| Surface | Audience | Status |
|-|-|-|
| `/dashboard` | Farmer (mobile-first, dark plum theme) | ✅ Shipped with 5 in-page tabs |
| `/coop/...` | Cooperative officer (desktop) | ❌ Not started |

## Rules — non-negotiable (carried over from project root)

1. **Hide the chain (from farmers).** No "wallet", "blockchain", "stablecoin", "USDC", "Solana" anywhere a farmer sees. Always show Rand. The wallet connect button currently in the dashboard is for *co-op staff / dev / hackathon judges* — the farmer-facing path will use a custodial wallet (Magic.link / Privy) when that's wired.
2. **Mobile-first.** Tailwind v4, mobile breakpoints first.
3. **Dark plum + coral-amber theme** is the shipped look. The cream/green/gold palette in `../design/palette.md` is the original brand mockup palette — see root `CLAUDE.md` §7 for the split.
4. **Currency is Rand.** All amounts shown to the farmer are in ZAR.
5. **POPIA.** Never log PII to console or analytics.
6. **No in-app route hops from inside `/dashboard`.** Everything is a tab.

## Stack

- **Framework:** Next.js 15.5 (App Router), React 19
- **Styling:** Tailwind CSS 4 (via `@tailwindcss/postcss` + `@theme` blocks in `src/app/globals.css`)
- **Auth + DB:** Supabase (`@supabase/ssr` + `@supabase/supabase-js`) — *optional*, demo mode kicks in when env vars are missing
- **Solana:** `@solana/web3.js` + `@solana/wallet-adapter-react` + `@solana/wallet-adapter-react-ui` + Phantom adapter
- **State:** local React state (no global store yet)
- **Tests:** Vitest 2.1
- **UI primitives:** shadcn/ui (vendored under `src/components/ui/`)
- **Icons:** lucide-react
- **Animation:** GSAP (used by auth-card)
- **Package manager:** pnpm (deterministic via `pnpm-lock.yaml`)

## Environment variables

All optional. See `.env.example`. When Supabase keys are missing, the auth pages and dashboard fall back to a demo-mode stub user; real auth resumes once they're populated.

| Var | Use |
|-|-|
| `NEXT_PUBLIC_SUPABASE_URL` | Optional — enables real Supabase auth |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional, server-side admin |
| `NEXT_PUBLIC_SOLANA_RPC` | Optional, defaults to `https://api.devnet.solana.com` |

## Setup

```bash
cd app
pnpm install
cp .env.example .env.local      # optional — fill in only if you want real auth
pnpm dev                         # http://localhost:3000
pnpm test                        # 25 unit tests
pnpm exec tsc --noEmit           # typecheck
pnpm build                       # production build (mirrors Vercel)
```

## Devnet demo data

To create a fresh GrowPack on devnet (registers a farmer, creates a pack, approves, disburses, fires drought trigger at 40% rainfall):

```bash
node scripts/setup-devnet-demo.mjs
```

Uses your default Solana CLI keypair (`~/.config/solana/id.json`) as the cooperative. Idempotent — skips steps for accounts that already exist.

## Vercel deployment

- **Root Directory:** `app/` (critical — without this, every route 404s)
- **Framework Preset:** Next.js (auto-detected once Root Directory is set)
- **Build / Install / Output:** all defaults
- **Env vars:** none required, optionally `NEXT_PUBLIC_SOLANA_RPC` for a custom RPC

## Critical path remaining

In rough order of impact:

1. **Co-op web dashboard** (`/coop/*`) — entirely unbuilt; that's half the product story per the mockups
2. **Custodial wallet** (Magic.link / Privy) for the farmer-facing surface
3. **Marketplace** — placeholder; backend depends on `api/` which hasn't started
4. **History tab** — currently a "coming soon" stub; should show past Grow Packs from the connected farmer's on-chain history
5. **Real Supabase project + migrations applied** — currently only demo mode tested
6. **Encoders for `approve_grow_pack` / `disburse_grow_pack` / `trigger_insurance_payout` / `settle_repayment`** in `lib/vuna/program.ts` — currently inlined in `setup-devnet-demo.mjs`. Needed once the co-op dashboard exists.
