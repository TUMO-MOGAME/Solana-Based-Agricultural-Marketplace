# app/

Next.js frontend for **Mazra'at albaan** — farmer mobile PWA + (planned) cooperative-officer dashboard. Internal codename: **vuna**.

## Live deployment

| | |
|-|-|
| Frontend | https://solana-based-agricultural-marketpla.vercel.app/ |
| Drought-payout demo (real on-chain data) | https://solana-based-agricultural-marketpla.vercel.app/insurance/AShtE5mNczJqoLYSQzASMHb5vLiAb3RSavPoLW4NyzAd |
| Solana program | `7LUkUHVazSw732334JKFP88VAFc4iYXXJZkgFnZV9kqA` (devnet) |

## Status

Originally lifted from a separate Next.js + Supabase project on 2026-05-07, then heavily restructured for Vuna. As of 2026-05-08 it's:

- Fully rebranded to Mazra'at albaan
- Stripped of all Social-Assembly-specific code
- Wired to the deployed Solana program via hand-rolled Borsh decoders
- Wallet adapter (Phantom) connected
- Deployed to Vercel with auto-deploy on push to `main`

See [`CLAUDE.md`](CLAUDE.md) for full context.

## Quick start

```bash
cd app
pnpm install
cp .env.example .env.local      # optional — Supabase auth
pnpm dev                         # http://localhost:3000
```

```bash
pnpm test                        # 25 Vitest tests (PDA, pricing, ix encoders)
pnpm exec tsc --noEmit           # typecheck
pnpm build                       # production build (matches Vercel)
pnpm lint                        # next lint
```

No Supabase project? You don't need one — the app falls back to a demo-mode stub user when env vars are absent.

## Routes

| Route | What |
|-|-|
| `/` | Mazra'at albaan landing |
| `/login` · `/signup` · `/forgot-password` · `/reset-password` | Supabase auth, demo-mode bypass |
| `/dashboard` | The main app — left sidebar / profile + 5 tabs (Active · Apply · Insurance · History · About) / right rail with alerts |
| `/grow-pack/new` | Standalone Apply form (shareable URL) |
| `/insurance/[packId]` | Standalone shareable on-chain pack view |

## Devnet demo setup

To create a registered farmer + active Grow Pack with a fired drought trigger on devnet:

```bash
node scripts/setup-devnet-demo.mjs
```

Uses your default Solana CLI keypair as the cooperative. Idempotent.

## Env vars

See [`.env.example`](.env.example). All optional.

| Var | Use |
|-|-|
| `NEXT_PUBLIC_SUPABASE_URL` | Real Supabase auth |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Real Supabase auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin |
| `NEXT_PUBLIC_SOLANA_RPC` | Override default `https://api.devnet.solana.com` |

## Supabase setup (optional)

Run the SQL files in `supabase/migrations/` in numerical order in your Supabase project's SQL Editor. Three migrations remain (Social-Assembly agent migrations were removed):

- `20260507_001_notifications.sql`
- `20260507_002_profiles.sql`
- `20260507_003_posts.sql`

Enable email/password in Auth → Providers (and Google + Apple if you want `social-auth.tsx` to work).

## Vercel deployment

Critical settings:

- **Root Directory:** `app/`
- **Framework Preset:** Next.js (auto-detected after setting Root Directory)
- All other settings can stay default

## Mockup references

- Farmer mobile: [`../design/mockups/mobile.png`](../design/mockups/mobile.png)
- Co-op web: [`../design/mockups/web.png`](../design/mockups/web.png)
