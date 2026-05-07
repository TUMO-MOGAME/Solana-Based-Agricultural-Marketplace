# app/

Next.js frontend for **Mazra'at albaan** — farmer mobile PWA + cooperative-officer dashboard. (Internal codename: **vuna**.)

## Status

The frontend was lifted from a separate Next.js + Supabase project on 2026-05-07 for the auth + dashboard shell. As of 2026-05-08 it has been:

- **Stripped** of the Social Assembly cruft (coach-chat, CopilotKit, orchestrator, video-panel, journey/exemplar/pipeline panels, marketing/about/team pages, agent-only Supabase migrations).
- **Rebranded** to Mazra'at albaan (page metadata, auth pages, root landing).
- **Repurposed**: dashboard is now a minimal placeholder; the real Grow Pack panels land in the next iteration.

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

Run the SQL files in `supabase/migrations/` in numerical order in your Supabase project's SQL Editor. Three migrations remain:

- `20260507_001_notifications.sql`
- `20260507_002_profiles.sql`
- `20260507_003_posts.sql`

Enable email/password in Auth → Providers (and Google + Apple if you want `social-auth.tsx` to work).

## Mockup references

- Farmer mobile: [`../design/mockups/mobile.png`](../design/mockups/mobile.png)
- Co-op web: [`../design/mockups/web.png`](../design/mockups/web.png)

See [`CLAUDE.md`](CLAUDE.md) for design rules and stack choices.
