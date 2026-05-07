# CLAUDE.md — Project Vuna

> **Claude: read this first.** It tells you what we are building, why, and how we work.
> If you have just opened in this directory, this is your briefing.

---

## 1. What this project is

**Project Vuna** is a Solana-based agricultural marketplace for South African smallholder farmers. We are building it for the **Solana 2026 Frontier Hackathon — Physical World Applications track**.

**Authors:** Tumo Mogame & Pitsi Kgaume

**One-sentence pitch:** *A phone app that gives small farmers seeds, fertilizer and drought insurance on credit, repaid at harvest, with insurance auto-paid by on-chain weather oracles — without ever showing the farmer the word "blockchain".*

---

## 2. Project layout

```
.
├── CLAUDE.md                ← this file
├── README.md                ← public-facing intro
├── .gitignore
│
├── package.json             ← workspace root (vitest test runner)
├── tsconfig.json
├── vitest.config.ts
│
├── core/                    ← shared TS business logic (canonical spec)
│   ├── CLAUDE.md
│   ├── credit-score.ts · grow-pack.ts · parametric.ts
│   ├── repayment.ts · currency.ts · validation.ts
│   ├── types.ts · index.ts
│
├── tests/                   ← Vitest suite (99 passing)
│   ├── CLAUDE.md
│   ├── README.md
│   ├── unit/                  one suite per core module
│   ├── integration/           cross-module composition tests
│   └── helpers/fixtures.ts
│
├── docs/                    ← narrative + reference docs
│   ├── CLAUDE.md
│   ├── proposal.pdf            (12-page formal proposal)
│   ├── source-paper.pdf        (research paper Vuna is built on)
│   ├── architecture.md         (system design)
│   ├── regulatory.md           (NCA / FAIS / FSCA / SARB / POPIA)
│   ├── glossary.md
│   └── outreach/               (insurer outreach pack — see its CLAUDE.md)
│       ├── 01_insurer-targets.md
│       ├── 02_one-pager.md
│       ├── 03_email-template.md
│       ├── 04_meeting-brief.md
│       ├── 05_followup-template.md
│       ├── 06_product-brief.md
│       ├── Vuna_one-pager.pdf       (built by scripts/build_one_pager.py)
│       └── Vuna_product-brief.pdf   (built by scripts/build_product_brief.py)
│
├── design/                  ← UI design + mockups
│   ├── CLAUDE.md
│   ├── palette.md              (color tokens; Tailwind-ready)
│   ├── build_mockups.py        (regenerate the PNGs)
│   └── mockups/
│       ├── mobile.png
│       └── web.png
│
├── programs/                ← Solana / Anchor on-chain code (scaffold)
│   ├── CLAUDE.md
│   └── README.md
│
├── app/                     ← Next.js frontend (farmer + co-op) (scaffold)
│   ├── CLAUDE.md
│   └── README.md
│
├── api/                     ← Node.js backend (scaffold)
│   ├── CLAUDE.md
│   └── README.md
│
└── scripts/                 ← utility / build scripts
    ├── build_proposal_pdf.py
    └── README.md
```

`programs/`, `app/`, `api/` are intentionally empty scaffolds. We initialise them with `anchor init`, `npx create-next-app`, and `npm init` respectively when we start coding — those tools want to own those directories.

If a generated artifact is missing, regenerate it from the build scripts in `scripts/` or `design/`.

---

## 3. The problems we are solving

1. Smallholders cannot get loans (no collateral, no credit history, no nearby branch).
2. Inputs are expensive, imported, and often counterfeit.
3. One bad season wipes a family out — insurance penetration is under 3%.
4. Middlemen capture 40–60% of crop value.
5. Good farmers have no portable credit history; every season starts from zero.

Smallholders grow ~70% of African food but get under 5% of bank lending. Closing even a slice of that gap is the bet.

---

## 4. Tech stack

| Layer | Tool | Why |
|-|-|-|
| Blockchain | Solana | sub-cent fees, sub-second finality, ecosystem |
| Smart contracts | Anchor (Rust) | standard Solana framework |
| Oracle | Pyth Network | native Solana weather feeds |
| Frontend (MVP) | Next.js + Tailwind CSS | fast to ship, good wallet adapters |
| Frontend (prod) | React Native PWA | rural mobile reach |
| Wallet (demo) | Phantom | acceptable for hackathon demo |
| Wallet (prod) | Magic.link / custodial | farmer NEVER sees a seed phrase |
| Stablecoin | USDC (demo); ZAR-pegged (prod) | most liquid; remove FX risk later |
| Backend | Node.js + Express | speed of development |
| Database | PostgreSQL via Supabase | auth + storage + realtime |
| File storage | IPFS / Arweave | docs and attestations |
| Hosting | Vercel + Railway | cheap, fast, low ops |

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

Scope discipline matters. If a new idea expands one of these boundaries, push back.

---

## 7. Design rules — non-negotiable

- **Mobile-first.** Farmer is on a low-end Android, often offline.
- **Hide the chain.** No "wallet", "blockchain", "stablecoin", "USDC", "Solana" anywhere a farmer sees. Always show Rand.
- **Earthy palette, not crypto-flashy.**
  - Primary green `#0B3D2E`
  - Mid green `#1F6B49`
  - Cream background `#F5F2EA`
  - Gold accent `#E8B931`
  - Success `#2E7D32`, Warn `#E67E22`, Danger `#C0392B`
- **The drought-payout screen is the marketing screen.** Lead every demo with it.

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

- **Grow Pack** — bundled credit + seeds + fertilizer + insurance. Our flagship product.
- **Vuna** — "harvest" in isiZulu and isiXhosa.
- **Cooperative / co-op** — partner farmer organisation that handles registration & KYC.
- **Parametric insurance** — payout triggered by measurable data (rainfall < 50mm), not by claims investigation.
- **CASP** — Crypto Asset Service Provider, the FSCA licence.
- **NCR** — National Credit Regulator.
- **FSCA** — Financial Sector Conduct Authority.
- **SARB** — South African Reserve Bank.

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

- [x] Research paper analysed
- [x] Formal proposal PDF generated
- [x] Mobile mockup PNG generated
- [x] Web mockup PNG generated
- [x] CLAUDE.md briefing (this file)
- [x] Project structure scaffold (docs/ design/ programs/ app/ api/ scripts/)
- [x] Oracle spike — **Pyth has no weather data. See `spikes/oracle-check/FINDINGS.md`.**
- [x] Switchboard spike — Switchboard is build-your-own infrastructure, not a source. Confirmed.
- [x] Insurer outreach pack drafted — `docs/outreach/`. Targets: LBIC, Santam Agriculture, Hollard, Old Mutual Insure.
- [x] Product brief drafted — `docs/outreach/Vuna_product-brief.pdf` for follow-up after first call
- [x] **`core/` library scaffolded with 6 modules + 99 passing tests.** Run with `npm test`.
- [x] Rust 1.95 (MSVC) + Solana CLI 3.1.14 + avm 1.0.2 + anchor-cli 1.0.2 installed
- [x] Windows Developer Mode enabled (required for Solana symlinks)
- [x] **Anchor program scaffolded at `programs/vuna/` and built successfully** (`target/deploy/vuna.so`)
- [x] **Step 1 of porting: account types + 6 instruction skeletons.** `FarmerAccount`, `GrowPack`, `GrowPackStatus`, and `register_farmer` / `request_grow_pack` / `approve_grow_pack` / `disburse_grow_pack` / `trigger_insurance_payout` / `settle_repayment` all defined and compiling.
- [x] **Step 2: credit-score logic ported.** `CreditEvent` enum + `FarmerAccount::apply_event` mirror `core/credit-score.ts`. All 11 TS test cases mirrored as Rust `#[test]`s and passing. Counter updates moved to settlement (TS semantics). Insurance-first rule: drought year never damages score.
- [x] **Step 3: grow-pack pricing logic ported.** `GrowPackPricing` + `GrowPackQuote` + `GrowPack::quote()` mirror `core/grow-pack.ts`. 9 of the 11 TS test cases mirrored.
- [x] **Step 4: parametric trigger logic ported.** `ParametricPolicy` + `PayoutTier` + `PayoutResult` + `ParametricPolicy::evaluate_payout` mirror `core/parametric.ts`. All 10 happy-path tier tests + 2 validation tests mirrored as Rust `#[test]`s. **`trigger_insurance_payout` now computes payout amount on-chain from rainfall** — caller can't inflate.
- [x] **Step 5: harvest-settlement logic ported.** `RepaymentResult` + `GrowPack::settle_at_harvest` mirror `core/repayment.ts`. 7 happy-path tests + the 6-case invariant test all passing. Settlement handler now delegates the math. **41 Rust tests passing across 4 modules — every numeric rule in `core/` has a parallel Rust port.**
- [ ] First insurer cold email sent — recommended first contact: LBIC
- [ ] Step 6: end-to-end `litesvm` integration test exercising the full Grow Pack lifecycle on a simulated Solana runtime
- [ ] Step 3: port `core/grow-pack.ts` validation + tests
- [ ] Step 4: port `core/parametric.ts` tier evaluation into `trigger_insurance_payout` + tests
- [ ] Step 5: tighten `settle_repayment` math + the 6-case invariant test
- [ ] Step 6: end-to-end `litesvm` integration test for the full Grow Pack lifecycle
- [ ] Cooperative outreach — not started
- [ ] Hackathon registration confirmed
- [ ] Anchor program scaffold — not started
- [ ] Frontend repo — not started

⚠️ **Note for future-Claude:** The proposal PDF (§4 and §5) still names Pyth as the weather oracle. That is now wrong. Do NOT regenerate the proposal until the alternative is decided — otherwise we'll have to regenerate twice.

When you change status, edit this section.

---

## 14. When in doubt

Re-read **§7 (Disadvantages)** and **§8 (Challenges)** of `docs/proposal.pdf`. Those set the realism bar. If a new idea cannot survive that bar, cut it.

---

*Last updated: 2026-05-06 by Tumo & Pitsi (with Claude).*
