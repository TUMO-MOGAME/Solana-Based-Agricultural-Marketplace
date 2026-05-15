# app/ — CLAUDE context

Next.js frontend for **Mazra'at albaan** (codename: **Vuna**). Deployed to Vercel: https://solana-based-agricultural-marketpla.vercel.app/

## Status (2026-05-10)

Originally lifted on 2026-05-07 from a separate Next.js + Supabase project ("Social Assembly") for the auth + dashboard shell. Heavily refactored since:

- **Stripped** of the Social Assembly cruft (38+ files: coach-chat, CopilotKit, orchestrator, video-panel, journey/exemplar/pipeline panels, marketing/about/team pages, agent-only Supabase migrations, ~2.9 MB of unused images). `dashboard.module.css` trimmed from 5,293 → ~970 lines.
- **Rebranded** to Mazra'at albaan with the designed logo SVG/PNG mark in `public/brand/`. Visual theme: dark plum (`#1a0f0c`) base + coral-amber (`#ff7b6b → #ffb86b`) gradient accents.
- **Wired to Solana** — `lib/vuna/program.ts` has hand-rolled Borsh decoders + instruction encoders for the deployed program at `7LUkUHVazSw732334JKFP88VAFc4iYXXJZkgFnZV9kqA` on devnet. **40** Vitest tests cover PDA derivation + pricing math + ix byte layouts for 5 instructions.
- **Two wallet stacks, side-by-side:**
  - Privy (`@privy-io/react-auth`) for the farmer surface — email-OTP login + auto-created embedded Solana wallet, no seed phrase
  - `@solana/wallet-adapter-*` (Phantom + Solflare) for the co-op surface
  - `lib/vuna/farmer-wallet.tsx::useFarmerWallet()` is the bridge — exposes the wallet-adapter shape (`publicKey`, `sendTransaction`, `connecting`) regardless of which backend is active. Mode picked at module load by `NEXT_PUBLIC_PRIVY_APP_ID`.
- **No mock data on the dashboard.** ActiveTab, AlertsList, AboutTab, voice-tour narration all read from `FarmerAccount` + `GrowPack` PDAs at page-load time. Empty states shown when nothing is on chain yet.
- **ElevenLabs voice** wired via `/api/tts` server proxy (Flash v2.5). One-shot read-aloud (`<ListenButton />`) on Active and Insurance tabs; full guided dashboard tour (`<DashboardTour />`) drives tab nav as it speaks.
- **Co-op admin page at `/coop`** ships the MVP scope: approve, disburse, trigger drought payout. Scans every GrowPack on the program via `fetchAllGrowPacks(connection, status)`.

## Routes — shipped

| Route | Audience | What |
|-|-|-|
| `/` | Public | Mazra'at albaan landing — dark-plum hero, 3 feature cards, branded logo |
| `/login` · `/signup` · `/forgot-password` · `/reset-password` · `/auth/callback` | Public | Supabase auth, with demo-mode bypass when env vars are missing |
| `/dashboard` | Farmer | 3-column shell (left sidebar / profile + tabs / right rail). **Profile-header tabs:** Active, Apply, Insurance, History, About. **Sidebar items:** Home · Apply for Pack · Insurance · Wallet · Marketplace · Take a tour. Compact 168 px profile header, 64 px avatar with coral-amber gradient. Wallet sidebar item shows truncated pubkey when connected; right-rail wallet button stays compact (34×34 icon, glows when connected) so the layout doesn't overflow on email-shaped pubkeys. |
| `/coop` | Co-op staff / insurance admin | Three sections (Pending applications · Awaiting disbursement · Active packs — drought watch). Per-row Approve / Disburse / Trigger buttons. Phantom-only auth (technical users — no need to hide the chain). |
| `/grow-pack/new` | Farmer | Standalone wrapper around `<ApplyTab />` for shareable apply-direct links |
| `/insurance/[packId]` | Public | Server-rendered shareable URL — anyone can open it, the server fetches the pack from devnet at request time |
| `/api/tts` | Server | ElevenLabs proxy. Supports `?warmup=1` for cold-start mitigation in dev. |

**Rule of the dashboard:** no in-app click navigates away from `/dashboard`. Everything (Apply, Insurance, History, About, Marketplace, Wallet) is an in-page tab or an inline overlay. Standalone `/grow-pack/new`, `/insurance/[packId]`, and `/coop` exist purely for shareable / staff-only deep links.

## Key files

| File | What |
|-|-|
| `src/app/page.tsx` | Root landing |
| `src/app/layout.tsx` | Root layout — mounts `<VunaWalletProvider />`, sets metadata |
| `src/app/icon.png` | Next.js auto-favicon (the brand mark, 256px PNG) |
| `src/app/dashboard/page.tsx` | Farmer dashboard with all 5 in-page tabs. Reads on-chain `FarmerAccount` + `GrowPack` once at page level, threads to `ActiveTab` + `AlertsList` + `AboutTab` via props. No `ACTIVE_PACK` / `ALERTS` mock — gone. |
| `src/app/dashboard/apply-tab.tsx` | The Grow Pack application form (used by both dashboard tab AND `/grow-pack/new`) |
| `src/app/dashboard/marketplace-tab.tsx` | Phase-3 marketplace: scans `BuyerOffer` PDAs, posts / cancels / matches them, escrow `Deal` flow, real on-chain everywhere |
| `src/app/dashboard/dashboard.module.css` | Dashboard CSS — ~970 lines after the Social Assembly trim |
| `src/app/dashboard/loading.tsx` | Minimal Mazra'at albaan loading pill |
| `src/app/coop/page.tsx` | Co-op admin page (Phantom). Three on-chain queues + actions. |
| `src/app/insurance/[packId]/page.tsx` | Server-rendered shareable insurance view |
| `src/app/grow-pack/new/page.tsx` | Thin wrapper around `<ApplyTab />` |
| `src/app/api/tts/route.ts` | ElevenLabs server proxy — Flash v2.5 model, server-side key only, supports `?warmup=1` |
| `src/lib/vuna/program.ts` | Solana client — `PROGRAM_ID`, PDA helpers, Borsh decoders, instruction encoders for **all 10 instructions** (register_farmer, request_grow_pack, approve_grow_pack, disburse_grow_pack, trigger_insurance_payout, create_deal, confirm_and_release, post_buyer_offer, cancel_buyer_offer; settle_repayment still inlined in setup-devnet-demo.mjs). Account scanners: `fetchAllGrowPacks`, `fetchDealsByWallet`, `fetchAllBuyerOffers`. |
| `src/lib/vuna/program.test.ts` | 40 Vitest tests for the client |
| `src/lib/vuna/provider.tsx` | `<VunaWalletProvider />` — Connection + WalletProvider + WalletModalProvider, wraps with `<PrivyProvider>` (with Solana wallet connectors + RPC config) when env-var is set |
| `src/lib/vuna/farmer-wallet.tsx` | `useFarmerWallet()` — bridges Privy ↔ wallet-adapter behind one wallet-adapter-shaped API |
| `src/lib/vuna/privy-config.ts` | `isPrivyConfigured()`, `PRIVY_SOLANA_CHAIN`, `SOLANA_CLUSTER` — single source for env-var-derived constants |
| `src/lib/vuna/wallet-button.tsx` | Compact connect/disconnect button. Two layouts: 34×34 icon (compact, used in dashboard right rail) and a wider email/address pill (no className, used on `/coop`). |
| `src/lib/vuna/voice.ts` | Browser-side ElevenLabs streaming helper (`speak`, `stopSpeaking`, `warmupTts`). 20s play-start timeout; warmup endpoint compiles `/api/tts` route in dev. |
| `src/lib/vuna/listen-button.tsx` | Speaker icon button — idle / loading / playing / error states |
| `src/lib/vuna/dashboard-tour.tsx` | `useDashboardTour()` hook + `<TourMenuItem />` + `<TourOverlay />`. 7-step narration, drives tab navigation as each step speaks, pulses the Wallet sidebar item during the wallet step. |
| `src/lib/supabase/client.ts` | Browser Supabase client + `isSupabaseConfigured()` for demo-mode |
| `scripts/setup-devnet-demo.mjs` | One-shot devnet setup — registers a farmer, creates + approves + disburses a Grow Pack, fires drought trigger |
| `public/brand/{logo-mark,logo-horizontal}.svg` | Branded mark + horizontal lockup |
| `public/brand/logo-mark-{256,512}.png` | Raster fallbacks |

## Two surfaces, one codebase

| Surface | Audience | Wallet | Auth |
|-|-|-|-|
| `/dashboard` | Farmer (mobile-first, dark plum theme) | Privy email-OTP custodial (env-var gated) → falls back to Phantom | Supabase email + password |
| `/coop` | Cooperative officer / insurance admin | Phantom + Solflare via wallet-adapter | Same Supabase auth (gated by Supabase session) — staff use the same login as everyone else; the wallet is what tells the on-chain program who's acting |

## Rules — non-negotiable (carried over from project root)

1. **Hide the chain (from farmers).** No "wallet", "blockchain", "stablecoin", "USDC", "Solana" anywhere a farmer sees on `/dashboard`. Always show Rand. The Wallet sidebar label is the one allowed exception — it's vague enough to read as "your account" to a non-technical user. The address itself is shown only when connected via wallet-adapter (co-op fallback path); in Privy mode the connected pill shows the email instead.
2. **Mobile-first.** Tailwind v4, mobile breakpoints first.
3. **Dark plum + coral-amber theme** is the shipped look. The cream/forest-green/gold logo (in `public/brand/`) is the branded mark — designed separately and dropped into the dark-plum chrome.
4. **Currency is Rand.** All amounts shown to the farmer are in ZAR.
5. **POPIA.** Never log PII to console or analytics.
6. **No in-app route hops from inside `/dashboard`.** Everything is a tab.
7. **`/coop` is technical.** The chain shows openly there — addresses, status enums, transaction signatures. Co-op staff need that visibility to operate.

## Stack

- **Framework:** Next.js 15.5 (App Router), React 19
- **Styling:** Tailwind CSS 4 (via `@tailwindcss/postcss` + `@theme` blocks in `src/app/globals.css`)
- **Auth + DB:** Supabase (`@supabase/ssr` + `@supabase/supabase-js`) — *optional*, demo mode kicks in when env vars are missing
- **Wallet (farmer):** `@privy-io/react-auth` (+ `/solana` sub-export). Privy provider wires `toSolanaWalletConnectors()` and devnet RPC via `@solana/kit` (`createSolanaRpc`, `createSolanaRpcSubscriptions`).
- **Wallet (co-op):** `@solana/web3.js` + `@solana/wallet-adapter-react` + `@solana/wallet-adapter-react-ui` + Phantom + Solflare adapters
- **Voice:** `@elevenlabs/elevenlabs-js` server-side via `/api/tts` proxy (Flash v2.5)
- **State:** local React state (no global store yet)
- **Tests:** Vitest 2.1 (40 tests)
- **UI primitives:** shadcn/ui (vendored under `src/components/ui/`)
- **Icons:** lucide-react
- **Animation:** GSAP (used by auth-card)
- **Package manager:** pnpm (deterministic via `pnpm-lock.yaml`)

## Environment variables

All optional. See `.env.example`. When Supabase keys are missing, the auth pages and dashboard fall back to a demo-mode stub user. When `NEXT_PUBLIC_PRIVY_APP_ID` is missing, `useFarmerWallet()` falls back to wallet-adapter / Phantom. When `ELEVENLABS_API_KEY` is missing, voice buttons return 503.

| Var | Use |
|-|-|
| `NEXT_PUBLIC_SUPABASE_URL` | Real Supabase auth |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Real Supabase auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin |
| `NEXT_PUBLIC_SOLANA_RPC` | Override the default `https://api.devnet.solana.com` |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Custodial farmer wallet (Privy) |
| `NEXT_PUBLIC_SOLANA_CLUSTER` | `mainnet` / `devnet` / `testnet` (default `devnet`) |
| `ELEVENLABS_API_KEY` | Server-side TTS |
| `ELEVENLABS_VOICE_ID` | Override default Sarah voice |

## Setup

```bash
cd app
pnpm install
cp .env.example .env.local      # optional — fill in only what you want enabled
pnpm dev                         # http://localhost:3000
pnpm test                        # 40 unit tests
pnpm exec tsc --noEmit           # typecheck
pnpm build                       # production build (mirrors Vercel)
```

## Devnet demo data

To create a fresh GrowPack on devnet (registers a farmer, creates a pack, approves, disburses, fires drought trigger at 40% rainfall):

```bash
node scripts/setup-devnet-demo.mjs
```

Uses your default Solana CLI keypair (`~/.config/solana/id.json`) as the cooperative. Idempotent — skips steps for accounts that already exist.

To get a fresh row to click through on `/coop`, change `SEASON_ID` inside the script and re-run.

## Vercel deployment

- **Root Directory:** `app/` (critical — without this, every route 404s)
- **Framework Preset:** Next.js (auto-detected once Root Directory is set)
- **Build / Install / Output:** all defaults
- **Env vars:** add the Supabase / Privy / ElevenLabs vars you want enabled. Without any of them, demo mode + wallet-adapter still works.

## Critical path remaining

In rough order of impact:

1. **Insurer outreach** — `docs/outreach/` is drafted; first cold email to LBIC unsent. Not a coding task.
2. **Oracle architecture decision** — `trigger_insurance_payout` currently accepts the rainfall % from the cooperative; replace with a licensed-underwriter signing service when one is engaged. See `spikes/oracle-check/FINDINGS.md`.
3. **`api/` Node.js backend** — empty scaffold. Needed for KYC, supplier inventory, off-ramp reconciliation, POPIA-compliant logging. Biggest remaining scope; needs its own scoping doc before code starts.
4. **`/coop` extras** — audit log, multi-wallet farmer/buyer impersonation for demo. (settle_repayment UI + farmer-registration UI ✅ shipped 2026-05-15.)
5. **isiZulu / isiXhosa localisation.**
6. **USSD / feature-phone bridge.**
7. **Audit the Anchor program** before any mainnet deploy.

### Recently shipped (2026-05-15)
- ✅ Pack metadata persistence — `pack_meta` Supabase table + lib + dashboard display
- ✅ `settle_repayment` encoder lifted into `lib/vuna/program.ts`
- ✅ Settle-repayment UI on `/coop` ("Harvest close" section)
- ✅ Farmer-registration UI on `/coop` (`<RegisterFarmerPanel>`)
- ✅ Phase 4 Fund-a-Farmer roadmap doc + 0% principle locked
