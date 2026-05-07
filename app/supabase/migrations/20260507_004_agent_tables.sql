-- ============================================================================
-- Agent-output tables — backs every log_* / fetch_latest_* helper in
-- agents/shared/supabase_client.py.
--
-- Run this in Supabase SQL Editor (after notifications + profiles + posts).
-- The agents currently fail-silent when these tables are missing, so the
-- pipeline + panel + Learner have all been writing to /dev/null. This
-- migration brings every agent's persistence online.
-- ============================================================================
--
-- One row per agent run, per stage:
--   coaching_sessions    Coaching agent — every analysed image / video.
--   user_profiles        Profiler  (Agent 1) — behavioural informatics.
--   audience_profiles    Analyst   (Agent 2) — sentiment + audience quality.
--   strategy_briefs      Strategist(Agent 3) — pillars + windows + gaps.
--   trend_reports        Researcher(Agent 4) — trends + natural-fit score.
--   content_drafts       Creator   (Agent 5) — hook + script + tech specs.
--   panel_votes          Governance panel — 1 row per voter per iteration.
--   performance_logs     Learner   (Agent 6) — published-post metrics.
--
-- Naming choices:
--   • `uploader TEXT` (creator email) is the consistent identity column,
--     matching the rest of the schema. Tying every table back to
--     auth.uid() via profiles is a future migration once the broader
--     codebase is on UUIDs.
--   • Constrained columns get CHECK constraints (panel voter IDs,
--     iteration ≥ 0, etc.).
--   • Defaults err on the side of empty JSONB / arrays so writers can
--     omit unknown fields without violating NOT NULL.
--
-- RLS pattern (consistent across every table here):
--   • SELECT — authenticated users read their own rows
--     (or rows derivable from one of their own rows, e.g. panel_votes
--      for drafts they uploaded).
--   • INSERT / UPDATE / DELETE — no policy for authenticated users.
--     Agents write via SUPABASE_SERVICE_ROLE_KEY which bypasses RLS.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- coaching_sessions  (Coaching agent)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.coaching_sessions (
  id                uuid primary key default gen_random_uuid(),
  uploader          text not null,
  media_urls        text[]      not null default '{}',
  media_type        text                 check (media_type in ('image','video','mixed','text','none')),
  user_request      text,
  coaching_response text,
  created_at        timestamptz not null default now()
);

create index if not exists coaching_sessions_uploader_idx
  on public.coaching_sessions (uploader, created_at desc);

alter table public.coaching_sessions enable row level security;
drop policy if exists "coaching_sessions_select_own" on public.coaching_sessions;
create policy "coaching_sessions_select_own"
  on public.coaching_sessions for select
  to authenticated
  using (auth.email() = uploader);


-- ─────────────────────────────────────────────────────────────────────────────
-- user_profiles  (Profiler — Agent 1)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.user_profiles (
  id                  uuid primary key default gen_random_uuid(),
  uploader            text not null,
  platforms           text[]      not null default '{}',
  baseline_authority  jsonb       not null default '{}'::jsonb,
  posting_cadence     jsonb       not null default '{}'::jsonb,
  response_integrity  numeric,
  content_archetypes  jsonb       not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

create index if not exists user_profiles_uploader_idx
  on public.user_profiles (uploader, created_at desc);

alter table public.user_profiles enable row level security;
drop policy if exists "user_profiles_select_own" on public.user_profiles;
create policy "user_profiles_select_own"
  on public.user_profiles for select
  to authenticated
  using (auth.email() = uploader);


-- ─────────────────────────────────────────────────────────────────────────────
-- audience_profiles  (Analyst — Agent 2)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.audience_profiles (
  id                    uuid primary key default gen_random_uuid(),
  uploader              text not null,
  authenticity_score    numeric                                 check (authenticity_score is null or (authenticity_score >= 0 and authenticity_score <= 100)),
  sentiment_breakdown   jsonb       not null default '{}'::jsonb,
  top_viewers           jsonb       not null default '[]'::jsonb,
  engagement_frequency  jsonb       not null default '{}'::jsonb,
  appreciation_density  numeric,
  active_windows        jsonb       not null default '{}'::jsonb,
  created_at            timestamptz not null default now()
);

create index if not exists audience_profiles_uploader_idx
  on public.audience_profiles (uploader, created_at desc);

alter table public.audience_profiles enable row level security;
drop policy if exists "audience_profiles_select_own" on public.audience_profiles;
create policy "audience_profiles_select_own"
  on public.audience_profiles for select
  to authenticated
  using (auth.email() = uploader);


-- ─────────────────────────────────────────────────────────────────────────────
-- strategy_briefs  (Strategist — Agent 3)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.strategy_briefs (
  id                   uuid primary key default gen_random_uuid(),
  uploader             text not null,
  content_pillars      jsonb       not null default '[]'::jsonb,
  engagement_gaps      jsonb       not null default '[]'::jsonb,
  performance_windows  jsonb       not null default '{}'::jsonb,
  conflicts_resolved   jsonb       not null default '[]'::jsonb,
  iteration            integer     not null default 0 check (iteration >= 0),
  created_at           timestamptz not null default now()
);

create index if not exists strategy_briefs_uploader_idx
  on public.strategy_briefs (uploader, created_at desc);

alter table public.strategy_briefs enable row level security;
drop policy if exists "strategy_briefs_select_own" on public.strategy_briefs;
create policy "strategy_briefs_select_own"
  on public.strategy_briefs for select
  to authenticated
  using (auth.email() = uploader);


-- ─────────────────────────────────────────────────────────────────────────────
-- trend_reports  (Researcher — Agent 4)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.trend_reports (
  id                  uuid primary key default gen_random_uuid(),
  uploader            text not null,
  niche               text,
  trends              jsonb       not null default '[]'::jsonb,
  keywords            jsonb       not null default '[]'::jsonb,
  natural_fit_score   numeric                                 check (natural_fit_score is null or (natural_fit_score >= 0 and natural_fit_score <= 100)),
  content_gap_report  jsonb       not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

create index if not exists trend_reports_uploader_idx
  on public.trend_reports (uploader, created_at desc);
create index if not exists trend_reports_niche_idx
  on public.trend_reports (niche);

alter table public.trend_reports enable row level security;
drop policy if exists "trend_reports_select_own" on public.trend_reports;
create policy "trend_reports_select_own"
  on public.trend_reports for select
  to authenticated
  using (auth.email() = uploader);


-- ─────────────────────────────────────────────────────────────────────────────
-- content_drafts  (Creator — Agent 5)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.content_drafts (
  id                   uuid primary key default gen_random_uuid(),
  uploader             text not null,
  strategy_brief_id    uuid references public.strategy_briefs(id) on delete set null,
  platform             text,
  format               text         check (format is null or format in ('video','image','carousel','thread','text','live','other')),
  hook_framework       text         check (hook_framework is null or hook_framework in ('curiosity','pain_point','contrarian','step_by_step','listicle','question','other')),
  hook_text            text,
  script               text,
  production_notes     jsonb       not null default '{}'::jsonb,
  technical_specs      jsonb       not null default '{}'::jsonb,
  iteration            integer     not null default 0 check (iteration >= 0),
  created_at           timestamptz not null default now()
);

create index if not exists content_drafts_uploader_idx
  on public.content_drafts (uploader, created_at desc);
create index if not exists content_drafts_strategy_idx
  on public.content_drafts (strategy_brief_id);

alter table public.content_drafts enable row level security;
drop policy if exists "content_drafts_select_own" on public.content_drafts;
create policy "content_drafts_select_own"
  on public.content_drafts for select
  to authenticated
  using (auth.email() = uploader);


-- ─────────────────────────────────────────────────────────────────────────────
-- panel_votes  (Governance panel — 5 voters × N iterations per draft)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.panel_votes (
  id                  uuid primary key default gen_random_uuid(),
  content_draft_id    uuid not null references public.content_drafts(id) on delete cascade,
  voter               text not null check (voter in ('strategic','quality','safety','brand','platform')),
  score               numeric                                 check (score is null or (score >= 0 and score <= 100)),
  approved            boolean,
  dissent_reasons     jsonb       not null default '[]'::jsonb,
  iteration           integer     not null default 0 check (iteration >= 0),
  created_at          timestamptz not null default now()
);

create index if not exists panel_votes_draft_idx
  on public.panel_votes (content_draft_id, iteration, voter);

alter table public.panel_votes enable row level security;
-- Read panel votes only for drafts you own (vote rows don't carry uploader
-- directly — we resolve through the content_drafts FK).
drop policy if exists "panel_votes_select_via_own_draft" on public.panel_votes;
create policy "panel_votes_select_via_own_draft"
  on public.panel_votes for select
  to authenticated
  using (
    exists (
      select 1 from public.content_drafts d
      where d.id = panel_votes.content_draft_id
        and d.uploader = auth.email()
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- performance_logs  (Learner — Agent 6)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.performance_logs (
  id                    uuid primary key default gen_random_uuid(),
  uploader              text not null,
  content_draft_id      uuid references public.content_drafts(id) on delete set null,
  published_post_url    text,
  impressions           bigint,
  engagement_rate       numeric,
  share_rate            numeric,
  retention_curve       jsonb       not null default '{}'::jsonb,
  outperformed_forecast boolean,
  notes                 text,
  created_at            timestamptz not null default now()
);

create index if not exists performance_logs_uploader_idx
  on public.performance_logs (uploader, created_at desc);
create index if not exists performance_logs_draft_idx
  on public.performance_logs (content_draft_id);

alter table public.performance_logs enable row level security;
drop policy if exists "performance_logs_select_own" on public.performance_logs;
create policy "performance_logs_select_own"
  on public.performance_logs for select
  to authenticated
  using (auth.email() = uploader);


-- ─────────────────────────────────────────────────────────────────────────────
-- (Optional) Re-link posts to these tables now that they exist.
-- Skipped by default — the FKs would fail if any existing posts row has
-- a coaching_session_id / content_draft_id / performance_log_id pointing
-- at a UUID that doesn't yet have a matching row. Run these manually
-- once you've decided you're happy with the integrity rules:
-- ─────────────────────────────────────────────────────────────────────────────
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
