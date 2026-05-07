-- ============================================================================
-- Chat messages — one row per turn (user OR model OR system) across all
-- coaching sessions. Backs the "every message of every session in
-- Supabase" feature.
--
-- Run this in Supabase SQL Editor.
-- ============================================================================
--
-- Why this table exists alongside coaching_sessions / posts
--   • coaching_sessions stores ONE row per analysis (the user's request +
--     the coach's full markdown reply, denormalised). Good for "show me
--     all the times Emma asked the coach to analyse a video".
--   • posts stores ONE row per piece of content with metadata + analyses
--     + performance.
--   • chat_messages stores EVERY individual message in EVERY session,
--     ordered by `created_at`. Good for "replay the full thread for
--     session s-abc123" or "what did the coach say in their last reply
--     last Tuesday".
--
-- Lifecycle
--   • The Next.js route /api/coach-chat inserts two rows per turn — one
--     for the user's message, one for the coach's reply — using the
--     service-role admin client. Frontend sessions-context provides the
--     session_id so the rows are grouped.
--   • The frontend's existing localStorage-backed Sessions sidebar still
--     works as-is; chat_messages is an additional, server-side record
--     that survives device changes and powers analytics later.
-- ============================================================================

create table if not exists public.chat_messages (
  id             uuid primary key default gen_random_uuid(),
  uploader       text not null,                                   -- creator email
  session_id     text not null,                                   -- frontend-issued (e.g. "s-abc123")
  session_title  text,                                            -- denormalised for easier listing
  role           text not null check (role in ('user', 'model', 'system')),
  content        text not null,
  attachments    jsonb not null default '[]'::jsonb,              -- metadata only — no bytes
  meta           jsonb not null default '{}'::jsonb,              -- model name, token counts, errors, …
  created_at     timestamptz not null default now()
);

-- ─── Indexes — query patterns we expect ────────────────────────────────────
-- 1) "Replay this thread, oldest-to-newest"
create index if not exists chat_messages_thread_idx
  on public.chat_messages (uploader, session_id, created_at);

-- 2) "All my recent messages across sessions" / "what did Emma write today"
create index if not exists chat_messages_recent_idx
  on public.chat_messages (uploader, created_at desc);

-- ─── Row Level Security ────────────────────────────────────────────────────
alter table public.chat_messages enable row level security;

-- Read own.
drop policy if exists "chat_messages_select_own" on public.chat_messages;
create policy "chat_messages_select_own"
  on public.chat_messages for select
  to authenticated
  using (auth.email() = uploader);

-- Insert own — frontend-driven manual writes are valid (e.g. seeding a
-- session from import). Service-role bypasses RLS, which is what the
-- /api/coach-chat route uses for its automated writes.
drop policy if exists "chat_messages_insert_own" on public.chat_messages;
create policy "chat_messages_insert_own"
  on public.chat_messages for insert
  to authenticated
  with check (auth.email() = uploader);

-- Delete own — for "delete this thread" actions in the UI.
drop policy if exists "chat_messages_delete_own" on public.chat_messages;
create policy "chat_messages_delete_own"
  on public.chat_messages for delete
  to authenticated
  using (auth.email() = uploader);

-- No UPDATE policy on purpose — messages are immutable. If we ever need
-- to edit (e.g. redact PII), do it through service_role.
