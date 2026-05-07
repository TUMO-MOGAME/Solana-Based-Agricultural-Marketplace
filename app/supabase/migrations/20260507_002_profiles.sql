-- ============================================================================
-- Profiles — public-schema mirror of auth.users with creator-facing fields.
-- Run this AFTER the notifications migration.
-- ============================================================================
--
-- Why a separate table from auth.users?
--   • auth.users is in the `auth` schema and locked down; you can't add
--     application columns there.
--   • profiles holds the editable + queryable user metadata: full_name,
--     avatar_url, etc. Other tables FK into profiles by id.
--
-- Lifecycle
--   • Row is created automatically by `handle_new_user` trigger when a
--     user signs up — pulls email + full_name + avatar_url from the
--     auth.users row's raw_user_meta_data (set by Supabase Auth on
--     signup, including OAuth providers).
--   • updated_at is bumped automatically by `bump_profile_updated_at`
--     on every UPDATE.
--   • Deletion cascades from auth.users (so deleting an auth user wipes
--     their profile row).
-- ============================================================================

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles (email);

-- ─── Auto-create on signup ─────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Backfill any existing auth.users rows that pre-date this migration ────
insert into public.profiles (id, email, full_name, avatar_url)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
  u.raw_user_meta_data ->> 'avatar_url'
from auth.users u
on conflict (id) do nothing;

-- ─── Auto-bump updated_at ──────────────────────────────────────────────────
create or replace function public.bump_profile_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.bump_profile_updated_at();

-- ─── Row Level Security ────────────────────────────────────────────────────
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- INSERT is intentionally policy-less — only the SECURITY DEFINER trigger
-- and service_role create profile rows. End users can't fabricate a row
-- for a different uid.
