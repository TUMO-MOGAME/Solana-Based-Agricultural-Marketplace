-- ============================================================================
-- Posts — one row per piece of creator content, from analysis to performance.
-- Run AFTER the profiles + notifications migrations.
-- ============================================================================
--
-- What this stores
--   1. METADATA about the media (filename, mime, size, duration…) —
--      NEVER the file itself. Pictures and videos are processed
--      transiently by the Coaching agent and deleted; only the metadata
--      lives here.
--   2. The AGENT ANALYSES — the coach's markdown response, the Creator
--      agent's draft (hook, script, production notes), accumulated
--      panel votes, etc.
--   3. PERFORMANCE — how the post did after the user published it
--      (impressions, engagement rate, retention curve…), populated by
--      the Learner agent.
--
-- What this does NOT store
--   • Raw image/video bytes — those live in tmp/uploads/ during analysis
--     and are deleted as soon as the coach has its reply.
--   • Per-turn chat history — that's in coaching_memory.db (SQLite,
--     local) and won't be lifted into Supabase until later.
--
-- Lifecycle
--   • Row is INSERTed when a post is first analysed (Coaching or Creator
--     pipeline run). status starts at 'analysed'.
--   • UPDATEd when the user schedules / publishes (status, scheduled_for,
--     published_at, published_url).
--   • UPDATEd by Learner once performance metrics are pulled.
-- ============================================================================

create table if not exists public.posts (
  id                  uuid primary key default gen_random_uuid(),
  uploader            text not null,                       -- creator email

  -- ── Media metadata (NEVER the file itself) ─────────────────────────
  media_kind          text not null check (
    media_kind in ('image', 'video', 'mixed', 'text', 'none')
  ),
  media_metadata      jsonb not null default '{}'::jsonb,
  -- typical keys: filename, mime, size_bytes, width, height, duration_sec,
  -- thumbnail_url (external host only), source_platform

  -- ── User intent ────────────────────────────────────────────────────
  title               text,                                -- short label
  caption             text,                                -- post caption / copy
  hook_text           text,                                -- first-line hook
  platform_target     text,                                -- tiktok / reels / shorts / youtube / instagram / x / multi
  user_request        text,                                -- the prompt the creator sent the coach

  -- ── Agent analyses ─────────────────────────────────────────────────
  coaching_response   text,                                -- coach's full markdown reply
  content_draft       jsonb,                               -- Creator agent output (hook framework, script, production_notes, technical_specs)
  panel_votes         jsonb,                               -- accumulated votes across iterations
  panel_approved      boolean,                             -- final consensus

  -- ── References back to the per-stage tables ───────────────────────
  -- These are plain UUID columns rather than FOREIGN KEY constraints
  -- because the per-stage tables (coaching_sessions, content_drafts,
  -- performance_logs) aren't migrated yet — they're documented in
  -- agents/shared/supabase_client.py as a target shape but the agents
  -- currently fail-silent on writes to them. When you create those
  -- tables in a later migration, ALTER TABLE … ADD CONSTRAINT … to
  -- enforce the FK (sample at the bottom of this file, commented out).
  coaching_session_id uuid,
  content_draft_id    uuid,
  performance_log_id  uuid,

  -- ── Publish state ──────────────────────────────────────────────────
  status              text not null default 'analysed' check (
    status in ('analysed', 'scheduled', 'published', 'archived')
  ),
  scheduled_for       timestamptz,
  published_at        timestamptz,
  published_url       text,

  -- ── Performance (Learner-populated) ────────────────────────────────
  performance         jsonb not null default '{}'::jsonb,
  -- typical keys: impressions, engagement_rate, share_rate, retention_curve,
  -- outperformed_forecast, notes, last_synced_at

  -- ── Lifecycle ──────────────────────────────────────────────────────
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Indexes — query patterns we expect:
--   • "all my posts, newest first"
--   • "all my published posts"
--   • "all my TikTok posts"
create index if not exists posts_uploader_created_idx
  on public.posts (uploader, created_at desc);

create index if not exists posts_uploader_status_idx
  on public.posts (uploader, status, created_at desc);

create index if not exists posts_uploader_platform_idx
  on public.posts (uploader, platform_target, created_at desc)
  where platform_target is not null;

-- ─── Auto-bump updated_at ──────────────────────────────────────────────────
create or replace function public.bump_post_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists posts_updated_at on public.posts;
create trigger posts_updated_at
  before update on public.posts
  for each row execute procedure public.bump_post_updated_at();

-- ─── Row Level Security ────────────────────────────────────────────────────
alter table public.posts enable row level security;

-- Read own.
drop policy if exists "posts_select_own" on public.posts;
create policy "posts_select_own"
  on public.posts for select
  to authenticated
  using (auth.email() = uploader);

-- Update own (status changes, performance backfills, edits).
drop policy if exists "posts_update_own" on public.posts;
create policy "posts_update_own"
  on public.posts for update
  to authenticated
  using (auth.email() = uploader)
  with check (auth.email() = uploader);

-- Insert own — agents typically write via service_role (bypasses RLS),
-- but a creator manually adding a post via the UI is also valid.
drop policy if exists "posts_insert_own" on public.posts;
create policy "posts_insert_own"
  on public.posts for insert
  to authenticated
  with check (auth.email() = uploader);

-- Delete own — soft-archive is preferred (set status='archived'), but
-- allowing hard-delete keeps the data-export-and-purge story clean.
drop policy if exists "posts_delete_own" on public.posts;
create policy "posts_delete_own"
  on public.posts for delete
  to authenticated
  using (auth.email() = uploader);

-- ─── Future: enforce FK constraints once the per-stage tables exist ───────
-- Once you migrate coaching_sessions / content_drafts / performance_logs
-- (the tables documented in agents/shared/supabase_client.py), uncomment
-- and run these to enforce referential integrity:
--
-- alter table public.posts
--   add constraint posts_coaching_session_fk
--   foreign key (coaching_session_id)
--   references public.coaching_sessions(id) on delete set null;
--
-- alter table public.posts
--   add constraint posts_content_draft_fk
--   foreign key (content_draft_id)
--   references public.content_drafts(id) on delete set null;
--
-- alter table public.posts
--   add constraint posts_performance_log_fk
--   foreign key (performance_log_id)
--   references public.performance_logs(id) on delete set null;
