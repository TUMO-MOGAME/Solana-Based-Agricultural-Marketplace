# `api/` Node.js backend — scoping doc

> **Status: not built yet.** `api/` is an empty scaffold. This doc defines
> the architecture, the endpoint priority, and the compliance constraints
> *before* code starts — same pattern as the Phase 4 roadmap.
>
> Build target: **Pilot v1 (2027 H1)**. Not blocking for the hackathon demo.

---

## Why we need it

The frontend currently writes directly to Supabase from the browser. That's
fine for the hackathon and the demo. For a real pilot it isn't, for four
reasons:

1. **No on-chain validation.** The browser asks Supabase "save crop=Maize for pack PDA=X" and Supabase trusts it. There's nothing checking that the PDA actually exists on-chain, or that the caller owns it. A malicious user could spam fake pack_meta rows.
2. **No audit log.** POPIA requires us to log every access to personal information. RLS prevents *reading* the wrong rows; it does not log *who read what when*.
3. **No idempotency.** Rural connections drop. Every write endpoint must be safely retryable. Browser-direct writes don't have this discipline by default.
4. **No regulatory reporting.** SARS / FSCA / SARB need periodic reports. Those queries belong server-side, not in a farmer's phone.

The backend is the place where these four concerns live.

---

## Hard rules

Carry over from `api/CLAUDE.md`, restated here so they're load-bearing:

1. **POPIA from day one.** Encrypt PII at rest. Restrict access by role. Log every PII read.
2. **No PII to chain.** Hash before passing to Solana.
3. **Chain is truth for money. DB is truth for everything else.** Never duplicate on-chain state into Postgres — read it from the chain when you need it.
4. **Idempotent endpoints.** Every write accepts an idempotency key from the client. Repeat calls with the same key return the same result.
5. **No secrets in repo.** All credentials come from env vars.

---

## Architecture

```
   Browser (app/)                                  Co-op staff (/coop)
        │                                                  │
        │  Bearer <Supabase JWT>                           │  Bearer <Supabase JWT>
        ▼                                                  ▼
   ┌──────────────────────────────────────────────────────────────┐
   │                    api/ — Express + TS                       │
   │                                                              │
   │   /v1/packs/:pda/meta   (POST)  ─┐                           │
   │   /v1/packs/:pda        (GET)    │  validators + idem keys   │
   │   /v1/farmers           (POST)   │  POPIA audit logger       │
   │   /v1/kyc/submit        (POST)   │  role-based access        │
   │   /v1/coop/queue        (GET)    │                           │
   │   /v1/reports/sars      (GET)   ─┘                           │
   │                                                              │
   └──────────┬──────────────────────────────────────┬────────────┘
              │                                      │
              ▼                                      ▼
   ┌──────────────────┐                   ┌────────────────────┐
   │  Postgres        │                   │  Solana devnet/    │
   │  (Supabase)      │                   │  mainnet           │
   │                  │                   │                    │
   │  pack_meta       │                   │  FarmerAccount     │
   │  audit_log       │                   │  GrowPack          │
   │  kyc_documents   │                   │  Deal, BuyerOffer  │
   │  supplier_inv    │                   │                    │
   └──────────────────┘                   └────────────────────┘
```

- **Auth:** Supabase JWT. Same session as the frontend. Server verifies with the Supabase JWKS.
- **Authorisation:** Role-based via Postgres `profiles.role` (`farmer` / `coop_staff` / `admin`). Default `farmer`.
- **Solana access:** Read-only `@solana/web3.js` client. Backend NEVER signs on-chain transactions — those stay client-side, signed by the farmer's wallet (Privy) or the co-op's wallet (Phantom). The backend is a read-only chain consumer for compliance reports and validation.
- **Logging:** `pino` with PII-redaction rules. Every endpoint logs `{request_id, user_id, action, resource, outcome}`. PII fields are redacted at the logger level so a careless `logger.info(user)` can't leak.

---

## Endpoint priority

In order of impact on getting to Pilot v1. Each row is one milestone.

| # | Endpoint | Purpose | Blocks | Effort |
|-|-|-|-|-|
| 1 | `POST /v1/packs/:pda/meta` | Move pack_meta writes server-side; validate PDA exists on-chain + caller owns it | nothing | S |
| 2 | `GET /v1/packs/:pda` | Aggregated pack view: on-chain GrowPack + off-chain meta + supplier info | nothing | S |
| 3 | `POST /v1/farmers` | Server-mediated farmer registration; co-op-side onboarding form | replaces parts of `/coop` direct chain writes | M |
| 4 | `POST /v1/kyc/submit` | Document upload (encrypted at rest), passes through to manual co-op review queue | needs storage provider chosen | M |
| 5 | `GET /v1/coop/queue` | Server-side aggregated pending/approved/active queue with rich filters and search | nothing | M |
| 6 | `GET /v1/audit/pii-access` | POPIA audit log query (Information Officer use) | needs `audit_log` schema | S |
| 7 | `POST /v1/repayment/reconcile` | Off-ramp reconciliation: matches USDC arrival to expected harvest sale, fires settle_repayment | NCR + CASP licences | L |
| 8 | `GET /v1/reports/sars` | Periodic tax-style reports of all credit flows | requires real money first | L |
| 9 | `GET /v1/reports/sarb` | Cross-border crypto flow reports per Circular 3-2026 | only post Phase 4c | L |

**Phase boundary:** items 1–6 are pre-pilot-v1 work. 7–9 light up only once real money flows.

---

## Data model — new tables

Beyond the existing `profiles`, `notifications`, `posts`, and `pack_meta`:

### `audit_log`
```sql
create table public.audit_log (
  id          bigserial primary key,
  ts          timestamptz not null default now(),
  request_id  uuid not null,
  actor_id    uuid references auth.users(id),     -- null for system actions
  action      text not null,                       -- "pack_meta.read", "kyc.upload", etc.
  resource    text not null,                       -- "pack:<pda>", "farmer:<id>", etc.
  outcome     text not null,                       -- "ok" | "denied" | "error"
  detail      jsonb                                -- redacted; never PII
);
create index audit_log_actor_idx on public.audit_log (actor_id, ts desc);
create index audit_log_resource_idx on public.audit_log (resource);
```

### `kyc_documents`
```sql
create table public.kyc_documents (
  id          uuid primary key default gen_random_uuid(),
  farmer_id   uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('id_card', 'proof_of_address', 'co_op_letter')),
  storage_url text not null,                       -- Supabase Storage with private bucket
  uploaded_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),     -- co-op staff who approved
  reviewed_at timestamptz,
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reject_reason text
);
```
RLS: farmer can insert + read own; co-op staff can read all + update review fields.

### `idempotency_keys`
```sql
create table public.idempotency_keys (
  key         uuid primary key,
  actor_id    uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null,
  request_hash text not null,                      -- sha256 of body
  response    jsonb not null,
  created_at  timestamptz not null default now()
);
-- TTL: rows older than 24h are deleted by a scheduled job.
```

### `roles` extension on `profiles`
```sql
alter table public.profiles
  add column if not exists role text not null default 'farmer'
    check (role in ('farmer', 'coop_staff', 'admin'));
```

---

## What `api/` is NOT

- ❌ Not a place to mirror on-chain state into the database. We read from the chain on demand.
- ❌ Not a wallet. The backend never signs Solana transactions. Wallets stay client-side.
- ❌ Not a custody service. We do not hold farmer funds. CASP licence covers the *embedded wallet* relationship, not API-mediated custody.
- ❌ Not a chat / messaging service. Notifications go through Supabase Realtime if we need them; no WebSocket bespoke.
- ❌ Not a marketing surface. Public-facing copy lives in `app/`. The API talks JSON.

---

## Deployment shape

| Env | Where | When |
|-|-|-|
| **dev** | Localhost via `npm run dev` | Always |
| **staging** | Render / Railway / Fly.io free tier, devnet-only, fake KYC docs | First time we hit endpoint #3 |
| **prod-pilot** | Render paid tier (single region: `eu-west`/`af-south`), devnet for first 4 weeks then mainnet | Pilot v1 launch (2027 H1) |

Why not Vercel functions: cold-starts are ugly on rural connections; long-running tasks (reconciliation jobs, audit aggregation) don't fit serverless well. A small always-on container is friendlier.

Why not bigger infra: 50–200 farmers don't need k8s. Render + a single Postgres (Supabase) is plenty until we cross 5k farmers, at which point we revisit.

---

## Open questions

1. **Storage for KYC documents.** Supabase Storage (simplest, integrates with auth) vs a dedicated provider (Cloudinary, S3 with KMS). Supabase Storage is the default until we have a reason to leave.
2. **Idempotency key strategy.** 24h TTL is the standard but might be too short for a farmer on a flaky connection. Worth piloting with 48h.
3. **POPIA audit log retention.** Law requires "for a reasonable period". Probably 7 years matching the financial records retention rule. Cost is negligible at our scale.
4. **Coop staff invitation flow.** No self-signup for `coop_staff`. Admin manually upgrades a `profiles.role`. Needs a "claim invite" UI surface later — not urgent.

---

## When to start

The first endpoint (`POST /v1/packs/:pda/meta`) becomes worth building when:

1. We have a co-op partner signed (the registration flow gets fast feedback)
2. **OR** we want to add audit logging for POPIA compliance demonstration
3. **OR** the Supabase RLS-only approach causes a real bug

None of those are true today. The backend stays an empty scaffold for the
hackathon. We build it the same week we send the first farmer pack request
that involves real money.

---

*Drafted: 2026-05-15 by Tumo (with Claude). Status: scoping only — no
implementation. Update as endpoint priorities shift.*
