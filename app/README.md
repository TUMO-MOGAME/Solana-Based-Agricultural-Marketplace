# app/

Next.js frontend for Project Vuna — farmer mobile PWA + cooperative-officer dashboard.

## Status

Frontend lifted on 2026-05-07 from a separate Next.js + Supabase project (auth + dashboard shell). Not yet rebranded for Vuna. See [`CLAUDE.md`](CLAUDE.md) for what works, what doesn't, and what's left to do.

## Quick start

```bash
cd app
pnpm install
cp .env.example .env.local      # fill in Supabase keys
pnpm dev                         # http://localhost:3000
```

```bash
pnpm exec tsc --noEmit           # typecheck
pnpm build                       # production build
pnpm lint                        # next lint
```

## Env vars

See [`.env.example`](.env.example). At minimum you need the three `*_SUPABASE_*` vars to get past login.

## Supabase setup

Run the SQL files in `supabase/migrations/` in numerical order in your Supabase project's SQL Editor. Enable email/password in Auth → Providers (and Google + Apple if you want `social-auth.tsx` to work).

## Mockup references

- Farmer mobile: [`../design/mockups/mobile.png`](../design/mockups/mobile.png)
- Co-op web: [`../design/mockups/web.png`](../design/mockups/web.png)
