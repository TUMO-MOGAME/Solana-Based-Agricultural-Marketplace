# api/ — CLAUDE context

Node.js backend for Project Vuna.

## Status

Empty scaffold. Initialise with `npm init -y` and an Express + TypeScript setup when we start.

## Responsibilities

The backend handles everything that does NOT belong on-chain:

- Farmer registration & light-touch KYC pipeline
- Co-op approval workflow (the 48-hour human review)
- Supplier inventory & marketplace listings
- Off-chain attestations (delivery confirmation, harvest verification)
- Reading on-chain state and exposing aggregated views to the frontend
- Reporting bridge to SARS / FSCA / SARB for compliance
- POPIA-compliant PII storage

## What stays on-chain vs off-chain

Always default to off-chain unless there's a real reason. See `docs/architecture.md` for the full split.

## Rules

1. **POPIA from day one.** Encrypt PII at rest. Restrict by role. Audit logs on every PII access.
2. **No PII to chain.** When passing data to a Solana instruction, hash it first.
3. **Trust the chain for money flows; trust off-chain for everything else.** Don't try to verify on-chain truths in the database — read them from the chain.
4. **Idempotent endpoints.** Network failures will happen on rural connections. Every write endpoint must be safely retryable.
5. **No secrets in the repo.** All credentials come from environment variables (Supabase keys, RPC URLs, Pyth keys).

## Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Express (or Fastify if we want stricter schemas)
- **Auth:** Supabase Auth
- **Database:** PostgreSQL via Supabase
- **Validation:** Zod
- **Solana client:** `@solana/web3.js` + Anchor TS bindings
- **RPC:** Helius (free tier for hackathon, paid for pilot)
- **Logging:** pino + redaction rules for PII

## When you start

```bash
cd api
npm init -y
npm install express typescript @types/node @types/express \
            @solana/web3.js @coral-xyz/anchor \
            @supabase/supabase-js zod pino dotenv
npx tsc --init
```

Set up `src/index.ts`, `src/routes/`, `src/services/`, `.env.example`. Never commit `.env`.
