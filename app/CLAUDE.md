# app/ — CLAUDE context

Next.js frontend for Project Vuna — both the **farmer mobile app** and the **co-op web dashboard**.

## Status (2026-05-07)

**This is not a fresh scaffold.** It is a **faithful copy of a separate Next.js + Supabase project** (the "Social Assembly" frontend, lifted on 2026-05-07 from
`c:\Social_____Assembly___Emma___` on branch `FrontEndSample_2`).

We copied it because its auth + dashboard shell is already working end-to-end and gives Vuna a head start. The Python agent backend it talks to was deliberately left behind; routes that depend on it will return clean 503s.

### What works without the agent backend
- Login / signup / forgot-password / reset-password (Supabase email auth)
- Welcome / about / team marketing pages
- Dashboard shell — sidebars, profile, timeline tabs
- Events page (uses static `FALLBACK_EVENTS`)
- Notifications panel UI (renders empty until something writes to `public.notifications`)
- Sessions sidebar (localStorage-backed)
- Posts table reads
- Profile auto-create trigger (Supabase only)

### What WON'T work until the agent backend exists (or until we replace it)
- Coaching chat — `/api/coach-chat` returns 503
- Trend-alerts auto-population
- Orchestrator pipeline button — likewise 503
- Video / image analysis

All those surfaces render, fail with a clear error, and stop. None crash the page.

## What still needs to happen for Vuna

The copy is **not yet rebranded**. The about page, team page, dashboard copy, and several routes (`coach-chat`, `trend-alerts`, `orchestrate`) are Social-Assembly-shaped. Treat them as scaffolding — pattern + plumbing reused, content + domain replaced.

**Vuna-shaped work to do (rough order):**
1. Rebrand marketing pages (`/`, `/welcome`, `/about`, `/team`) for Vuna.
2. Decide which dashboard panels survive into Vuna (probably: notifications, sessions, profile) and which become farmer/co-op-specific (Grow Pack list, drought-payout history, repayment schedule).
3. Stand up the Vuna-specific routes from the Vuna `app/CLAUDE.md` plan: `/grow-pack/new`, `/insurance`, `/coop/dashboard`, plus the **drought-payout screen** (the marketing screen — build this *first*).
4. Wire the palette tokens from `../design/palette.md` into the Tailwind 4 `@theme` block in `src/app/globals.css`.
5. Strip or replace the agent-backend API routes — Vuna does not need a Python coaching pipeline.
6. Add Solana wallet adapters (Phantom for the demo / co-op staff; Magic.link or Privy for farmers — they must never see a seed phrase).

## Two surfaces, one codebase (Vuna intent)

| Surface | Audience | Mockup |
|-|-|-|
| `/app/...` | Farmer (phone PWA) | `../design/mockups/mobile.png` |
| `/coop/...` | Cooperative officer (desktop) | `../design/mockups/web.png` |

We split routes by audience but share components where it makes sense.

## Rules — non-negotiable (carried over from the project root)

1. **Hide the chain.** Anywhere a farmer sees, never use the words "wallet", "blockchain", "stablecoin", "USDC", "Solana". Always show Rand.
2. **Mobile-first.** Tailwind, mobile breakpoints first.
3. **Use the palette.** Tokens come from `../design/palette.md`.
4. **Custodial wallet only for the farmer.** Magic.link or similar. Farmer never sees a seed phrase. Phantom is acceptable for the *demo* and for *co-op staff*, not for farmers.
5. **Currency is Rand.** All amounts shown to the farmer are in ZAR.
6. **isiZulu and isiXhosa support** is on the roadmap; English-only is acceptable for the hackathon MVP.
7. **POPIA.** Never log PII to console or analytics.

## Stack (as currently copied)

- **Framework:** Next.js 15.5.15 (App Router), React 19
- **Styling:** Tailwind CSS 4 (via `@tailwindcss/postcss` + `@theme` blocks in `src/app/globals.css`)
- **Auth + DB:** Supabase (`@supabase/ssr` + `@supabase/supabase-js`)
- **UI primitives:** shadcn/ui (vendored under `src/components/ui/`), Radix Tabs, lucide-react icons
- **Animation:** GSAP
- **Optional AI chat:** CopilotKit + `@a2a-js/sdk` + OpenAI (only `a2a-chat.tsx`)
- **Package manager:** pnpm (the source uses pnpm; lockfile not copied — run `pnpm install` to regenerate)

**Stack still to add for Vuna:**
- `@solana/web3.js`, `@solana/wallet-adapter-react`, Anchor TS bindings (when `programs/` exists)
- `react-hook-form` + `zod` for forms
- `@tanstack/react-query` for server state
- `next-intl` (when isiZulu / isiXhosa lands)

## Setup

```bash
cd app
pnpm install
cp .env.example .env.local      # fill in Supabase keys
pnpm dev                         # http://localhost:3000
pnpm exec tsc --noEmit           # typecheck
pnpm build                       # production build
```

### Supabase migrations

Migrations live in `supabase/migrations/`. Run them in numerical order in your Supabase project's SQL Editor:
- `20260507_001_notifications.sql`
- `20260507_002_profiles.sql`
- `20260507_003_posts.sql`
- `20260507_004_agent_tables.sql` *(agent-backend only — safe to run, harmless if unused)*
- `20260507_005_chat_messages.sql` *(agent-backend only)*
- `20260507_006_pipeline_runs.sql` *(agent-backend only)*

In Auth → Providers, enable email/password (and Google + Apple if `social-auth.tsx` should work).

## Critical path

Build the **drought-payout screen** first. It's the marketing screen and the hardest visual. If it works, everything else is pattern repetition.
