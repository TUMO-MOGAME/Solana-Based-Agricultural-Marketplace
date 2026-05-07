-- ============================================================================
-- Notifications — backs the dashboard bell + scrollable feed.
-- Run this in Supabase SQL Editor (or `supabase db push` if you wire the CLI).
-- ============================================================================
--
-- Table contract
--   • One row per notification surfaced to a creator.
--   • Categories are constrained — adding a new one is a one-line SQL change.
--   • Read / Bookmarked / Dismissed are *_at timestamps. NULL = the action
--     hasn't happened. The bell badge counts rows where read_at IS NULL AND
--     dismissed_at IS NULL.
--   • `meta` is JSONB so writers can attach category-specific extras
--     (trend score, platform, region, source agent, etc.) without altering
--     the schema.
--
-- Producers
--   • Service-role inserts only. The agents (Researcher, Strategist, Learner,
--     and the Next.js trend-alerts route) write here using
--     SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.
--
-- Consumers
--   • The dashboard reads through the user's cookie session — RLS scopes
--     each user to their own rows by matching uploader against auth.email().
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists public.notifications (
  id              uuid primary key default gen_random_uuid(),
  uploader        text not null,
  category        text not null check (
    category in ('opportunity', 'trend', 'reminder', 'platform_update')
  ),
  title           text not null,
  body            text not null,
  chat_prompt     text,            -- seed prompt when user clicks "Open in chat"
  meta            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  read_at         timestamptz,     -- NULL = unread
  bookmarked_at   timestamptz,     -- NULL = not saved
  dismissed_at    timestamptz      -- NULL = not dismissed; non-null hides it
);

-- Indexes
-- Main feed query: list non-dismissed notifications for one user, newest first.
create index if not exists notifications_feed_idx
  on public.notifications (uploader, created_at desc)
  where dismissed_at is null;

-- Unread count — partial index makes the badge query trivial.
create index if not exists notifications_unread_idx
  on public.notifications (uploader)
  where read_at is null and dismissed_at is null;

-- Category filter (e.g. "show me only Trends").
create index if not exists notifications_category_idx
  on public.notifications (uploader, category, created_at desc)
  where dismissed_at is null;

-- ─── Row Level Security ────────────────────────────────────────────────────
alter table public.notifications enable row level security;

-- Read: each authenticated user sees only their own.
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (auth.email() = uploader);

-- Update: each authenticated user can only mutate their own (mark read,
-- bookmark, dismiss). Read_at / bookmarked_at / dismissed_at are the only
-- fields the frontend ever changes.
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications for update
  to authenticated
  using (auth.email() = uploader)
  with check (auth.email() = uploader);

-- No INSERT or DELETE policy is intentional — only service_role writes
-- (agents emit via SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS) and we
-- never hard-delete notifications, only soft-dismiss them.
