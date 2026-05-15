-- ============================================================================
-- pack_meta — off-chain metadata for a GrowPack PDA.
-- ============================================================================
--
-- The on-chain GrowPack account is the canonical record of money: bundle
-- cost, repayment, status, insurance threshold. It does NOT store the crop
-- name or the hectares planted, because those are descriptive metadata that
-- (a) don't drive any on-chain logic and (b) add bytes + cost to every
-- account on devnet / mainnet.
--
-- Today the Apply form collects crop + hectares from the farmer, then
-- discards them on submit. This table keeps them.
--
-- POPIA: crop + hectares are not PII on their own, but the farmer_id FK
-- links them to auth.users (which has email). RLS below restricts row
-- visibility to the farmer who owns the row.
-- ============================================================================

create table if not exists public.pack_meta (
  pack_pda    text        primary key,
  farmer_id   uuid        not null references auth.users(id) on delete cascade,
  crop        text        not null check (crop in ('Maize', 'Wheat', 'Soybean', 'Sorghum', 'Beans')),
  hectares    numeric(6, 2) not null check (hectares > 0 and hectares <= 1000),
  season_id   integer     not null check (season_id >= 2024 and season_id <= 2100),
  created_at  timestamptz not null default now()
);

create index if not exists pack_meta_farmer_idx on public.pack_meta (farmer_id);
create index if not exists pack_meta_season_idx on public.pack_meta (season_id);

-- ─── Row Level Security ────────────────────────────────────────────────────
alter table public.pack_meta enable row level security;

drop policy if exists "pack_meta_select_own" on public.pack_meta;
create policy "pack_meta_select_own"
  on public.pack_meta for select
  to authenticated
  using (auth.uid() = farmer_id);

drop policy if exists "pack_meta_insert_own" on public.pack_meta;
create policy "pack_meta_insert_own"
  on public.pack_meta for insert
  to authenticated
  with check (auth.uid() = farmer_id);

-- UPDATE / DELETE intentionally have no policy — once a pack is on-chain,
-- the metadata is locked. If a correction is needed, the service role can
-- do it manually. End users cannot rewrite history.
