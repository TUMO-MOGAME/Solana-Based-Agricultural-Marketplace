# api/

Node.js backend for Project Vuna.

## Status

Scaffold. Not yet initialised.

## Setup

```bash
cd api
npm init -y
npm install express typescript @types/node @types/express \
            @solana/web3.js @coral-xyz/anchor \
            @supabase/supabase-js zod pino dotenv
npx tsc --init
```

## Run (after setup)

```bash
npm run dev
npm run build
npm test
```

## Notes

- Never commit `.env`. Use `.env.example` for the contract.
- POPIA compliance is a baseline, not a feature. See `docs/regulatory.md`.

See `CLAUDE.md` here for responsibilities and rules.
