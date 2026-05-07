-- ============================================================================
-- Pipeline runs — one row per orchestrator invocation, with live stage state.
--
-- Run this in Supabase SQL Editor.
-- ============================================================================
--
-- Why this table exists
--   The orchestrator pipeline is a 5–15 minute, 11-agent workflow. We can't
--   block the user's HTTP request that long, so /api/orchestrate kicks off
--   a Python subprocess and returns immediately with a run_id. The
--   subprocess updates this row after every LangGraph node completes; the
--   dashboard polls and renders progress live.
--
-- Lifecycle
--   • POST /api/orchestrate INSERTs a row with status='pending', spawns
--     the Python subprocess, returns the row id.
--   • The subprocess UPDATEs the row to 'running' and begins. After each
--     LangGraph node it appends to stages JSONB and bumps updated_at.
--   • Final status is 'approved' (panel reached 80% consensus + Learner
--     ran), 'rejected' (panel exhausted retries), or 'errored'.
--   • content_draft_id is filled in from the Creator's output when the
--     run reaches the Learner stage.
-- ============================================================================

create table if not exists public.pipeline_runs (
  id                  uuid primary key default gen_random_uuid(),
  uploader            text not null,
  intent              text                 check (intent is null or intent in (
                        'event_journey',  -- triggered by joining an event
                        'trend_plan',     -- triggered from a trend notification
                        'manual',         -- explicit user action ("plan a post")
                        'onboarding',     -- one-time signup pipeline
                        'stage_refresh'   -- event journey stage transition
                      )),
  seed_input          jsonb       not null default '{}'::jsonb,   -- whatever triggered it
  user_input          text,                                       -- the prompt seed
  status              text        not null default 'pending'      check (status in (
                        'pending', 'running', 'approved', 'rejected', 'errored'
                      )),
  stages              jsonb       not null default '[]'::jsonb,
  -- typical stages entry: { node, status: 'running'|'ok'|'error',
  --                         started_at, finished_at, duration_ms,
  --                         summary?: string, error?: string }
  panel_iteration     integer     not null default 0,
  panel_approved      boolean,
  content_draft_id    uuid,                                       -- FK target lives in content_drafts
  error               text,
  started_at          timestamptz,
  completed_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists pipeline_runs_uploader_idx
  on public.pipeline_runs (uploader, created_at desc);

create index if not exists pipeline_runs_status_idx
  on public.pipeline_runs (status, started_at)
  where status in ('pending', 'running');

-- ─── Auto-bump updated_at ──────────────────────────────────────────────────
create or replace function public.bump_pipeline_run_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists pipeline_runs_updated_at on public.pipeline_runs;
create trigger pipeline_runs_updated_at
  before update on public.pipeline_runs
  for each row execute procedure public.bump_pipeline_run_updated_at();

-- ─── Row Level Security ────────────────────────────────────────────────────
alter table public.pipeline_runs enable row level security;

-- Read own.
drop policy if exists "pipeline_runs_select_own" on public.pipeline_runs;
create policy "pipeline_runs_select_own"
  on public.pipeline_runs for select
  to authenticated
  using (auth.email() = uploader);

-- INSERT/UPDATE/DELETE — service role only (the /api/orchestrate route
-- creates rows; the subprocess updates them; both use SUPABASE_SERVICE_ROLE_KEY).
