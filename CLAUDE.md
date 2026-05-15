# CLAUDE.md — Project Vuna / Mazra'at albaan

> **Claude: read this first.** It tells you what we are building, why, and how we work.
> If you have just opened in this directory, this is your briefing.

---

## 1. What this project is

A Solana-based agricultural marketplace for South African smallholder farmers, built for the **Solana 2026 Frontier Hackathon — Physical World Applications track**.

**Names:**
- **User-facing brand:** *Mazra'at albaan* (page titles, dashboard headings, marketing copy)
- **Internal codename / Solana program crate:** *Vuna* (matches the deployed program — do not rename)

**Authors:** Tumo Mogame & Pitsi Kgaume

**One-sentence pitch:** *A phone app that gives small farmers seeds, fertilizer and drought insurance on credit, repaid at harvest, with insurance auto-paid by on-chain weather data — without ever showing the farmer the word "blockchain".*

**Live deployments (devnet, free):**
- Frontend: https://solana-based-agricultural-marketpla.vercel.app/
- Solana program ID: `7LUkUHVazSw732334JKFP88VAFc4iYXXJZkgFnZV9kqA` (devnet)
- Demo Grow Pack: `AShtE5mNczJqoLYSQzASMHb5vLiAb3RSavPoLW4NyzAd` (status: `InsurancePaid`, R 1 400 paid)

---

## 2. Project layout

```
.
├── CLAUDE.md                ← this file
├── README.md                ← public-facing intro
├── .gitignore
│
├── package.json             ← workspace root (vitest for core/)
├── tsconfig.json
├── vitest.config.ts
│
├── core/                    ← shared TS business logic (canonical spec)
│   ├── credit-score.ts · grow-pack.ts · parametric.ts
│   ├── repayment.ts · currency.ts · validation.ts
│   └── types.ts · index.ts
│
├── tests/                   ← Vitest suite for core/ (99 passing)
│
├── docs/                    ← narrative + reference docs
│   ├── proposal.pdf · source-paper.pdf
│   ├── architecture.md · regulatory.md · glossary.md
│   ├── phase-4-fund-a-farmer.md   (peer-to-peer 0%-return roadmap, NOT implemented)
│   ├── outreach/               (insurer outreach pack — one-pager + product-brief PDFs)
│   └── presentation/           (Tumo's global pitch — script PDF + 10 slides, built by scripts/build_pitch.py)
│
├── design/                  ← UI design + mockups + brand
│   ├── palette.md              (original cream/green/gold brand palette)
│   ├── logo-mark.svg · logo-horizontal.svg
│   ├── logo-mark-{64,256,512,1024}.png · banner-{3x1,4x1}.png
│   ├── build_logo.py · build_banner.py · build_mockups.py
│   └── mockups/{mobile,web}.png
│
├── programs/vuna/           ← Anchor program — DEPLOYED to devnet
│   ├── Anchor.toml · Cargo.toml
│   ├── programs/vuna/src/
│   │   ├── lib.rs · constants.rs · error.rs · state.rs
│   │   └── instructions/{register_farmer,request_grow_pack,
│   │       approve_grow_pack,disburse_grow_pack,
│   │       trigger_insurance_payout,settle_repayment,
│   │       create_deal,confirm_and_release,
│   │       post_buyer_offer,cancel_buyer_offer}.rs
│   ├── programs/vuna/tests/lifecycle.rs   (litesvm integration test)
│   └── target/deploy/vuna.so              (built binary)
│
├── app/                     ← Next.js frontend — DEPLOYED to Vercel
│   ├── package.json · next.config.ts · vitest.config.ts · tsconfig.json
│   ├── public/brand/{logo-mark.svg,logo-horizontal.svg,logo-mark-{256,512}.png}
│   ├── public/fonts/Satoshi-*.woff2
│   ├── scripts/setup-devnet-demo.mjs       (one-shot demo data setup)
│   ├── supabase/migrations/                (3 SQL files: notifications, profiles, posts)
│   └── src/
│       ├── app/                            (Next.js App Router)
│       │   ├── icon.png                    (Next.js auto-favicon, brand mark 256px)
│       │   ├── page.tsx                    (Mazra'at albaan landing)
│       │   ├── layout.tsx
│       │   ├── login · signup · forgot-password · reset-password · auth/callback
│       │   ├── dashboard/                  (farmer surface — 3-column shell, 5 in-page tabs)
│       │   │   ├── page.tsx                (live on-chain reads, no mock data)
│       │   │   ├── apply-tab.tsx           (shared with /grow-pack/new)
│       │   │   ├── marketplace-tab.tsx
│       │   │   ├── dashboard.module.css
│       │   │   └── loading.tsx
│       │   ├── coop/                       (cooperative-staff admin surface — Phantom)
│       │   │   └── page.tsx                (approve / disburse / trigger drought payout)
│       │   ├── grow-pack/new/              (standalone wrapper around <ApplyTab/>)
│       │   ├── insurance/[packId]/         (standalone shareable URL)
│       │   └── api/tts/                    (server-side ElevenLabs proxy)
│       ├── components/ui/                  (shadcn primitives, vendored)
│       └── lib/
│           ├── supabase/                   (browser + server clients, demo-mode aware)
│           └── vuna/                       (Solana client + custodial wallet)
│               ├── program.ts              (PDA helpers, Borsh codecs, ix encoders)
│               ├── program.test.ts         (40 vitest tests)
│               ├── provider.tsx            (wallet-adapter + conditional <PrivyProvider>)
│               ├── farmer-wallet.tsx       (useFarmerWallet — bridges Privy ↔ wallet-adapter)
│               ├── privy-config.ts         (env-var-gated Privy config)
│               ├── wallet-button.tsx       (compact connect/disconnect, mode-aware)
│               ├── voice.ts                (ElevenLabs streaming helper)
│               ├── listen-button.tsx       (one-shot read-aloud)
│               └── dashboard-tour.tsx      (guided voice tour with per-step tab nav)
│
├── api/                     ← Node.js backend (scaffold — not started)
│
├── scripts/                 ← Python build scripts
│   ├── build_proposal_pdf.py
│   ├── build_one_pager.py
│   ├── build_product_brief.py
│   └── build_pitch.py          (Tumo's global-pitch pack: speaker script PDF + 16:9 slides)
│
└── spikes/                  ← throwaway research code
    └── oracle-check/        (Pyth + Switchboard probes; FINDINGS.md)
```

`api/` is still an empty scaffold — backend service not started yet.

If a generated artifact (PDFs, mockups, vuna.so) is missing, regenerate from the matching build script in `scripts/` or `design/`, or run `cargo build-sbf` in `programs/vuna/programs/vuna/`.

---

## 3. The problems we are solving

1. Smallholders cannot get loans (no collateral, no credit history, no nearby branch).
2. Inputs are expensive, imported, and often counterfeit.
3. One bad season wipes a family out — insurance penetration is under 3%.
4. Middlemen capture 40–60% of crop value.
5. Good farmers have no portable credit history; every season starts from zero.

Smallholders grow ~70% of African food but get under 5% of bank lending. Closing even a slice of that gap is the bet.

---

## 4. Tech stack — what's actually shipped

| Layer | Tool | State |
|-|-|-|
| Blockchain | Solana (Anchor 1.0.2 / Rust 1.95 MSVC) | ✅ deployed devnet |
| Frontend | Next.js 15.5 + React 19 + Tailwind CSS 4 | ✅ deployed Vercel |
| Wallet (farmer / `/dashboard`) | `@privy-io/react-auth` — email-OTP custodial, embedded Solana wallet | ✅ wired (env-var gated) |
| Wallet (co-op / `/coop`) | `@solana/wallet-adapter-*` with Phantom + Solflare | ✅ wired |
| Wallet bridge | `lib/vuna/farmer-wallet.tsx` — `useFarmerWallet()` exposes the wallet-adapter-shaped API regardless of backend | ✅ wired |
| Auth (dashboard gate) | Supabase (`@supabase/ssr`) with demo-mode fallback | ✅ optional, applied |
| Voice (read-aloud + tour) | ElevenLabs Flash v2.5 via `/api/tts` server proxy | ✅ wired (env-var gated) |
| Backend | Node.js + Express | ❌ `api/` not started |
| Hosting | Vercel for frontend | ✅ live |
| Oracle (weather) | Underwriter-attestation (caller passes rainfall %, on-chain program computes payout). | ⚠️ caller is the co-op for now; will swap to a licensed-underwriter signing service when one is engaged. See `spikes/oracle-check/FINDINGS.md`. |
| Oracle (price) | Pyth Network | ⏳ planned (USD/ZAR FX, crop futures for fair-price reference) |
| Stablecoin | USDC (devnet, demo-only) | ⏳ no real value moved |
| Database | PostgreSQL via Supabase (3 migrations applied) | ✅ live |
| File storage | IPFS / Arweave | ❌ not started |

---

## 5. Architecture sketch

### On-chain (Solana / Anchor programs)

- `FarmerAccount` PDA — farmer ID hash, region, history hash, current score
- `GrowPack` instruction — locks credit, registers insurance policy parameters, links suppliers
- `OracleCheck` crank — reads Pyth, fires payout if rainfall < threshold
- `Repayment` instruction — deducts at harvest sale, updates history
- `CreditScore` view — deterministic function over on-chain history

### Off-chain

- Mobile-first frontend (Next.js PWA in MVP, RN later)
- Custodial / abstracted wallet
- Backend service: registration, supplier inventory, marketplace listings, SARS / FSCA reporting
- USSD bridge for feature phones — **not in MVP**, on roadmap

---

## 6. What we are deliberately NOT building

- A supply chain → partner with existing seed and fertilizer suppliers
- Logistics → suppliers fulfill through their own channels
- An underwriting fund → connect to DeFi pools or partner with an MFI
- A general-purpose blockchain → use Solana
- A new payments rail → settle USDC, reconcile to ZAR via existing on/off-ramps and PayShap
- **A yield-bearing investment product.** Peer funding (Phase 4 — see [`docs/phase-4-fund-a-farmer.md`](docs/phase-4-fund-a-farmer.md)) is **strict 0% return, principal back only.** Adding any return — even 1% — reclassifies the product under NCA + FSCA and breaks the moral framing. Do not drift.

Scope discipline matters. If a new idea expands one of these boundaries, push back.

---

## 7. Design rules — non-negotiable

- **Mobile-first.** Farmer is on a low-end Android, often offline.
- **Hide the chain (from farmers).** No "wallet", "blockchain", "stablecoin", "USDC", "Solana" anywhere the farmer sees. Always show Rand. The wallet connect button visible in the demo dashboard is for *co-op staff / dev / hackathon judges* — the farmer-facing path will use a custodial provider (Magic.link / Privy) so they never see a seed phrase.
- **The drought-payout screen is the marketing screen.** Lead every demo with it.

### Palette — what's where

The shipped frontend uses the **dark-plum + coral-amber theme** inherited from the Social-Assembly shell we lifted on 2026-05-07. The `design/palette.md` file captures the *original* Mazra'at albaan brand palette (cream/forest-green/gold) used in `design/mockups/`. Both exist on purpose — mockups are the brand reference; the shipped UI optimised for visual coherence with the auth + dashboard chrome we kept.

| Where used | Tokens |
|-|-|
| Shipped frontend (`app/`) — root, dashboard, auth, /insurance, /grow-pack/new | bg `#1a0f0c` · accent gradient `#ff7b6b → #ffb86b` · cream text `rgba(255, 245, 230, 0.95)` · glass cards `rgba(255,255,255,0.04)` · dashed-threshold red `#C0392B` |
| Mockups (`design/mockups/`) | primary green `#0B3D2E` · cream `#F5F2EA` · gold `#E8B931` |

---

## 8. Regulatory constraints (non-negotiable)

| Law | What it requires |
|-|-|
| National Credit Act (NCA) | NCR registration to lend |
| FAIS Act | FSP licence to sell insurance |
| FSCA / CASP framework | CASP licence to handle crypto |
| SARB Exchange Control 2026 | Approval before any cross-border crypto flow. 5 years jail and compulsory surrender for non-compliance. |
| POPIA | Strict farmer-data handling. R10m fine on breach. |
| Insurance Act 2017 | Parametric insurance still needs a licensed underwriter |

We hold these licences ourselves OR partner with someone who does. No shortcuts. Skipping any one of these is how similar projects ended in headlines, not balance sheets.

---

## 9. Key vocabulary

- **Mazra'at albaan** — the user-facing brand. Used in page titles, dashboard headings, marketing copy.
- **Vuna** — internal codename. The Solana program crate, the program ID, the technical project shorthand. Means "harvest" in isiZulu/isiXhosa. Do *not* rename — the program is already deployed.
- **Grow Pack** — bundled credit + seeds + fertilizer + insurance. Our flagship product.
- **Cooperative / co-op** — partner farmer organisation that handles registration & KYC. In the demo, the connected wallet plays this role.
- **Parametric insurance** — payout triggered by measurable data (rainfall < 50% of norm), not by claims investigation.
- **CASP** — Crypto Asset Service Provider, the FSCA licence required to handle crypto.
- **NCR** — National Credit Regulator (lending licence).
- **FSCA** — Financial Sector Conduct Authority (insurance + crypto licensing).
- **SARB** — South African Reserve Bank (exchange-control regulation).
- **PDA** — Program Derived Address. Both `FarmerAccount` and `GrowPack` are PDAs (deterministic addresses derived from the program ID + seeds).

---

## 10. Ground rules for Claude

1. **Be realistic.** No false dreams. If a number is uncertain, say "uncertain." If a step is hard, say so.
2. **Mobile UX trumps blockchain elegance.** If a clever contract pattern complicates the farmer's life, simplify the contract.
3. **Hide the chain.** Anything user-facing must never name Solana, USDC, wallets, or stablecoins.
4. **The hard problems are off-chain.** Trust, fraud, default recovery, ground-truth verification. Do not pretend a smart contract solves them.
5. **Cut scope before shipping broken.** When in doubt, ship a smaller working thing.
6. **Slow, careful, honest work.** This is development infrastructure, not a Series A pitch.
7. **Default to short.** Match response length to the task. The user has explicitly asked for short, simple answers more than once.

---

## 11. Realistic expectations

| Phase | Window | Goal |
|-|-|-|
| Hackathon | 6 weeks | Working devnet demo. End-to-end flow. 5–10 simulated farmers. |
| Pilot v1 | H1 2027 | 50–200 real farmers, one province, one crop. **60–80% repayment, not 95%.** |
| Pilot v2 | H2 2027 | Second province, second crop. Reinsurance arrangement begins. |
| Regional | 2028 | Zambia / Kenya via Superteam. Multi-currency settlement. |
| **Phase 4 — Fund a Farmer** | 2028+ | Peer-funded Grow Packs, devnet → SA-domestic → SADC → global. **Strict 0% return.** Roadmap in [`docs/phase-4-fund-a-farmer.md`](docs/phase-4-fund-a-farmer.md). |

---

## 12. Failure modes we plan against

1. No cooperative partner ever signs on → outreach starts week 1.
2. Repayment crashes below 50% → conservative loan size, group lending.
3. Climate wipes out the pool → reinsurance partner before pool > $50k.
4. Regulatory action pre-licence → no retail solicitation pre-licence.
5. Smart contract exploit → audit before mainnet, bounty program.
6. Acquisition by Apollo / Pula → best of the bad cases.

---

## 13. Current build status

### Live deployments
- **Frontend:** `https://solana-based-agricultural-marketpla.vercel.app/` (Vercel, auto-deploys from `main`)
- **Solana program:** `7LUkUHVazSw732334JKFP88VAFc4iYXXJZkgFnZV9kqA` on devnet (BPF Loader Upgradeable, authority = `9ndRtL...veYeKyQ`)
- **Demo Grow Pack:** `AShtE5mNczJqoLYSQzASMHb5vLiAb3RSavPoLW4NyzAd` (status: `InsurancePaid`, R 1 400 paid out at 40% rainfall)

### Done — on-chain
- [x] Research paper analysed; proposal PDF and mockups generated
- [x] Project structure (docs / design / programs / app / api / scripts / tests / spikes / core)
- [x] Oracle spikes — Pyth has no weather feeds; Switchboard is build-your-own. Decision: route through licensed-underwriter attestation. See `spikes/oracle-check/FINDINGS.md`.
- [x] Insurer outreach pack drafted — `docs/outreach/` (one-pager + product-brief PDFs, targets LBIC / Santam / Hollard / OMI)
- [x] **`core/` library** — 6 pure-TS modules (credit-score, grow-pack, parametric, repayment, currency, validation) + 99 Vitest tests
- [x] **Anchor program at `programs/vuna/`** — 5 source modules (lib, constants, error, state, instructions/), 6 instructions, 41 host-side cargo tests, 3 litesvm integration tests
- [x] Program built (`target/deploy/vuna.so`, 204 KB) and deployed to devnet
- [x] Demo data setup script (`app/scripts/setup-devnet-demo.mjs`) — registers a farmer, requests + approves + disburses a Grow Pack, fires a 40% rainfall trigger

### Done — frontend
- [x] Lifted Next.js + Supabase shell from "Social Assembly" project on 2026-05-07
- [x] Stripped 38+ files of agent-backend cruft, trimmed dashboard CSS 5293 → 945 lines, removed ~2.9 MB of unused assets
- [x] Rebranded to **Mazra'at albaan** (page titles, auth pages, root landing, dashboard chrome, favicon, branded logo SVG/PNG mark in `app/public/brand/`)
- [x] Made Supabase optional with demo-mode fallback (no env vars → stub user) — and wired to a real Supabase project (`ewsqeqlffromnxogtubj`) with all 3 migrations applied
- [x] **Custodial farmer wallet via Privy** — `lib/vuna/farmer-wallet.tsx` exposes `useFarmerWallet()` matching the wallet-adapter shape; under the hood it routes to Privy email-OTP + auto-created embedded Solana wallet when `NEXT_PUBLIC_PRIVY_APP_ID` is set, else falls back to wallet-adapter / Phantom. All 5 `useWallet()` call sites migrated. Privy provider config wires `toSolanaWalletConnectors()` + `solana.rpcs[devnet]` (built with `@solana/kit`).
- [x] **Wallet-adapter (Phantom + Solflare)** kept for the co-op surface — same `<VunaWalletProvider>` mounts both stacks; the surfaces just read different hooks.
- [x] **Co-op admin page at `/coop`** — three sections (Pending applications / Awaiting disbursement / Active packs · drought watch), each row driven by real on-chain `getProgramAccounts` scan via `fetchAllGrowPacks(connection, status)`. Action buttons wire to the new `makeApprove/Disburse/TriggerInsurancePayoutIx` encoders. Phantom-only auth (technical users — no need to hide the chain).
- [x] **`lib/vuna/program.ts` extended** — added `makeApproveGrowPackIx`, `makeDisburseGrowPackIx`, `makeTriggerInsurancePayoutIx`, `fetchAllGrowPacks`, `GROW_PACK_ACCOUNT_DISC` (lifted out of `setup-devnet-demo.mjs`). Hand-rolled Borsh decoders unchanged — discriminators hardcoded because Anchor's IDL builder is still broken on Windows.
- [x] **ElevenLabs voice surface** — `/api/tts` server proxy (Flash v2.5), `<ListenButton />` for one-shot read-aloud (used on Active + Insurance), `<DashboardTour />` guided narration that drives tab navigation as it speaks. All gated by `ELEVENLABS_API_KEY`.
- [x] **Marketplace tab** — Phase 3, fully on-chain: scans `BuyerOffer` PDAs, supports post / cancel / match (creating an escrow `Deal` PDA via `create_deal`), seller releases via `confirm_and_release`. Released deals persisted in localStorage so released history survives PDA closure.
- [x] **History tab** — real on-chain reads of past Grow Packs (3-season lookback) + marketplace-deal history scanned via `fetchDealsByWallet`.
- [x] **No mock data on the dashboard.** ActiveTab, AlertsList, AboutTab, voice tour all read from `FarmerAccount` + `GrowPack` PDAs at page-load time. `ACTIVE_PACK` and `ALERTS` constants removed; empty states shown when nothing is on chain yet.
- [x] **Routes — all working end-to-end against the deployed program:**
  - `/` — dark-plum Mazra'at albaan landing with branded SVG mark
  - `/login` · `/signup` · `/forgot-password` · `/reset-password` · `/auth/callback` — Supabase, with demo-mode bypass
  - `/dashboard` — farmer surface, 3-column shell, **6 in-page nav targets**: Home, Apply for Pack, Insurance, Wallet (sidebar item only), Marketplace, plus the "Take a tour" voice trigger. The compact profile-header tabs are Active, Apply, Insurance, History, About.
  - `/coop` — co-op admin (new)
  - `/grow-pack/new` — standalone wrapper around `<ApplyTab />`
  - `/insurance/[packId]` — server-rendered shareable URL, dark-plum themed
  - `/api/tts` — server-side ElevenLabs proxy
- [x] **No route hops from inside the dashboard.** Apply, Insurance, History, About, Marketplace, Wallet all transform the middle column in place. (`/coop` is a separate surface for staff.)
- [x] Deployed to Vercel (Root Directory = `app/`, Framework = Next.js)

### Tests, all passing
- 99 Vitest tests in root `tests/` — `core/` rules
- 41 cargo unit tests + 3 litesvm integration tests in `programs/vuna/programs/vuna/` — Rust port + on-chain lifecycle
- 47 Vitest tests in `app/src/lib/vuna/program.test.ts` — PDA derivation, pricing math, instruction-encoder byte layouts for **6 instructions** (register_farmer, request_grow_pack, approve_grow_pack, disburse_grow_pack, trigger_insurance_payout, settle_repayment)
- **Total: 190 tests across 3 languages**

### Done since last update (2026-05-15)
- [x] Pack metadata persistence — crop + hectares now stored in `pack_meta` Supabase table (RLS-locked to farmer-owner), written on Apply success, displayed on Active intro card + Insurance Pack details + voice greeting
- [x] Settle-repayment encoder lifted into `app/src/lib/vuna/program.ts` (+ 7 byte-layout tests)
- [x] Settle-repayment UI on `/coop` — new "Harvest close" section with sale-proceeds input
- [x] Farmer-registration UI on `/coop` — `<RegisterFarmerPanel>` at the top of the page replaces having to run `setup-devnet-demo.mjs` for new farmers
- [x] Phase 4 Fund-a-Farmer roadmap doc (`docs/phase-4-fund-a-farmer.md`) + 0% principle locked in §6

### Not yet done
- [ ] First insurer cold email sent — recommended first contact: LBIC
- [ ] `api/` Node.js backend service (KYC, supplier inventory, off-ramp reconciliation, POPIA logging) — biggest remaining scope, post-hackathon
- [ ] USSD / feature-phone bridge
- [ ] Audit the Anchor program before any mainnet deploy
- [ ] Replace caller-as-attester in `trigger_insurance_payout` with a licensed-underwriter signing service once one is engaged
- [ ] Native-speaker review of the 11-language i18n strings — see "Translation review" below

### ⚠️ Known stale docs
- `docs/proposal.pdf` (§4 + §5) still names **Pyth** as the weather oracle. This is wrong — Pyth has no weather feeds. Do NOT regenerate the proposal PDF until we've finalised the underwriter-attestation architecture; otherwise we'll regenerate twice.

### Translation review (i18n)

All 11 South African official languages are wired in `app/src/lib/i18n/` —
keys are stable, the `t()` helper falls back to English on any miss, and a
language picker sits in the dashboard sidebar.

**Confidence levels:**
- **HIGH** — `en`, `af`. Safe to ship.
- **MEDIUM** — `zu`, `xh`, `st`, `tn`. Usable for demo. Should be reviewed before a real pilot.
- **LOW** — `nso`, `ss`, `nr`, `ve`, `ts`. Best-effort. **Must** be reviewed before any farmer-facing pilot — wrong words for "insurance" or "harvest" in a farmer's home language is worse than English. Marked with a trailing `*` in the language picker.

Bringing a co-op partner on board? Ask them to nominate native speakers for
each language they operate in. Two-hour review per language is usually
enough to lift the LOW set to MEDIUM. Update the `reviewed` flag in
`app/src/lib/i18n/locales.ts` once confirmed.

Voice (ElevenLabs) currently plays English only. Localised voice is a
separate workstream — the Flash v2.5 model claims multilingual support but
quality varies across the LOW-confidence set.

When you change status, edit this section.

---

## 14. When in doubt

Re-read **§7 (Disadvantages)** and **§8 (Challenges)** of `docs/proposal.pdf`. Those set the realism bar. If a new idea cannot survive that bar, cut it.

---

*Last updated: 2026-05-10 by Tumo & Pitsi (with Claude).*
