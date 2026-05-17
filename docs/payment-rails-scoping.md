# Payment rails scoping doc — ZAR ↔ on-chain bridge

> **Status: not built. No code yet.** This doc defines the partners, the
> architecture, the compliance path, and the phased delivery — *before*
> a line of production-money code gets written.
>
> Build target: **Pilot v1 (2027 H1)** for the production tier. Sandbox
> tier (real APIs, no real money) is the next engineering investment
> after this doc is approved.
>
> Same scoping-first pattern as `api-backend-scoping.md` and
> `phase-4-fund-a-farmer.md`.

---

## TL;DR

Three tiers, three different worlds. Don't confuse them.

| Tier | What | Who can ship it | Money moving | Regulator interest |
|-|-|-|-|-|
| **1. Mocked UI** | Fake "Pay with Capitec" buttons → simulated EFT confirmation → fund a devnet pack | Solo dev, 1 week | None | None |
| **2. Sandbox-real** | Stitch / Ozow sandbox + VALR / Yellow Card sandbox → real API calls → Solana devnet | Solo dev, 4-6 weeks | None | None |
| **3. Production** | Real ZAR leaves a farmer's bank → real USDC lands on Solana mainnet → escrow fires → real ZAR back at harvest | **Not legal without licensed partners.** Needs lawyer, signed contracts, KYC vendor, audit. 6-9 months. | Real | High |

Build tier 1 and 2. Don't touch tier 3 until the partnership contracts and the licences exist.

---

## Why we need it

The current demo is end-to-end against Solana devnet. It is honest about
this — the dashboard never claims real ZAR moved. But for the product
to actually do its job in the real world, two pipes have to be plumbed:

1. **ZAR-in pipe.** Co-op or buyer sends real Rand → it has to land as
   on-chain value in a Grow Pack escrow PDA.
2. **ZAR-out pipe.** On confirm-and-release or insurance payout →
   on-chain value has to land as real Rand in the farmer's bank account.

Today both pipes are missing. The on-chain code already works. The
bridge to Capitec / ABSA / Standard Bank / Nedbank is the missing piece.
This doc scopes that bridge.

---

## Hard rules — non-negotiable

Carry over from `CLAUDE.md` §8 and `docs/regulatory.md`. Re-stated here
so they're load-bearing for this design.

1. **We never touch real money ourselves.** Every regulated step —
   KYC, custody, ZAR↔USDC conversion, settlement — is performed by a
   partner that holds the relevant licence. Mazra'at albaan is an
   orchestrator. It is never the regulated entity.
2. **Farmer never sees crypto words.** The UI shows only Rand, bank
   names, and EFT/PayShap. Never "USDC", "wallet", "Solana", "SOL",
   "stablecoin", "blockchain". Carries over from `CLAUDE.md` §7.
3. **Idempotent.** Rural connections drop mid-flow. Every step
   (initiate, confirm, settle) accepts an idempotency key. Repeat
   calls return the same result, never double-charge.
4. **Audit trail.** Every ZAR movement, FX rate, fee, and on-chain
   transaction is logged with `{timestamp, counterparty, reference,
   amount_zar, amount_usdc, rate, fee_zar}`. SARS / FSCA / SARB
   filings draw from this log.
5. **No cross-border without SARB exchange-control approval.** All
   counterparties resident in SA. No flows to non-SA wallets until
   approval is in place. Penalty for getting this wrong: up to 5 years
   and compulsory surrender (`CLAUDE.md` §8).
6. **POPIA from day one.** KYC documents live at the partner. Our
   side stores a hash + reference only. PII never enters Solana.

---

## Architecture (production tier)

```
       ┌──────────────────────────────────────────────────────────┐
       │  FARMER / BUYER on Capitec / ABSA / Standard / Nedbank    │
       └──────────────────────────────┬───────────────────────────┘
                                      │  PayShap / EFT push
                                      ▼
       ┌──────────────────────────────────────────────────────────┐
       │  EFT aggregator API     (Stitch or Ozow)                  │
       │  - parses bank login, initiates push                      │
       │  - confirms settlement back to our backend                │
       └──────────────────────────────┬───────────────────────────┘
                                      │  ZAR settled to partner-held trust account
                                      ▼
       ┌──────────────────────────────────────────────────────────┐
       │  CASP exchange API      (VALR or Yellow Card)             │
       │  - holds the ZAR (custody = partner)                      │
       │  - converts ZAR → USDC at market                          │
       │  - sends USDC to our designated Solana address            │
       │  KYC done HERE by the partner, not by us.                 │
       └──────────────────────────────┬───────────────────────────┘
                                      │  USDC on Solana mainnet
                                      ▼
       ┌──────────────────────────────────────────────────────────┐
       │  api/ backend orchestrator    (Node.js, see api-backend-  │
       │                                scoping.md)                │
       │  - records the ZAR → USDC leg in audit_log                │
       │  - signs the on-chain instruction to fund the pack        │
       │    OR triggers the relevant existing user-signed flow     │
       └──────────────────────────────┬───────────────────────────┘
                                      ▼
       ┌──────────────────────────────────────────────────────────┐
       │  Vuna Solana program   (already deployed, unchanged)      │
       │  - GrowPack escrow PDA receives USDC                      │
       │  - disburse_grow_pack / confirm_and_release fire as today │
       └──────────────────────────────────────────────────────────┘
```

Harvest direction is the same diagram, reversed: on-chain USDC → CASP
exchange → ZAR settled → EFT push to farmer's bank.

**Crucially: the on-chain code does not change.** Everything above the
existing program (`programs/vuna/`) is new. The bridge sits between
the bank and the program — it never modifies how the program works.

---

## Partner landscape (as of 2026, public info only)

### EFT / PayShap aggregators

These move ZAR between SA bank accounts. They do not touch crypto.

| Partner | What | API maturity | Sandbox? | Indicative fees |
|-|-|-|-|-|
| **Stitch** | Pay-by-bank with PayShap + EFT. Modern OAuth-style flow. | High — REST + webhooks, well documented. | Yes, self-serve. | ~R 1-3 per transaction + monthly minimum. **Confirm directly.** |
| **Ozow** | Instant EFT, big retail footprint (Takealot, Shoprite). | High — but older flow, less "fintech native". | Yes. | Similar range. **Confirm directly.** |
| **Peach Payments** | Card + EFT + PayShap, multi-channel. | High, more "merchant" oriented. | Yes. | Variable per channel. **Confirm directly.** |
| **Yoco** | POS first, EFT secondary. | Medium — POS API is the strong product. | Yes. | Card-first pricing. **Confirm directly.** |

**Recommendation for our flow: Stitch.** It is built for the modern
pay-by-bank use case (push from the user's banking app, immediate
confirmation), which matches the farmer / buyer UX we need.

### CASP-licensed crypto exchanges (ZAR ↔ USDC)

These hold the CASP licence. We must use one of them; we cannot
substitute.

| Partner | ZAR pair to USDC? | API for partners? | KYC handled by | SA presence | Indicative spread |
|-|-|-|-|-|-|
| **VALR** | Yes, direct ZAR-USDC pair. | Yes — partner programme exists, REST + WebSocket. | VALR (their licence, their burden). | SA-domiciled, FSCA-registered CASP. | 0.1-0.5% trading fee + small spread. **Confirm via partner agreement.** |
| **Luno** | Yes, ZAR-USDC supported. | Partial — partner programme exists but smaller surface. | Luno. | SA-headquartered, FSCA CASP. | 0.5-2% retail-side; partner pricing differs. **Confirm directly.** |
| **Yellow Card** | Yes, focus on African ZAR / NGN / KES ↔ USDC. | Yes, REST API documented. | Yellow Card. | Pan-African; SA presence newer. | ~1.5-3% spread. **Confirm directly.** |
| **VALR Pay / Easy Equities crypto** | Indirect routes — likely worse pricing. | Not designed for partner API. | n/a | n/a | Skip. |

**Recommendation: VALR first conversation, Yellow Card as backup.**
VALR has the deepest ZAR liquidity and the most mature partner
programme. Yellow Card matters more once we cross SADC borders
(Phase 4 territory). Avoid hand-rolling against multiple exchanges
in the first pilot — pick one, prove the rails, then diversify.

---

## Phased delivery

| Phase | Scope | Duration | Cost to us | Money moving |
|-|-|-|-|-|
| **1: Mocked UI** | "Pay with Capitec / ABSA / Standard / Nedbank / PayShap" buttons → fake EFT screen → existing devnet flow continues as today. Pure frontend. | 1 week | R 0 | None |
| **2: Sandbox-real** | Stand up `api/`. Wire Stitch sandbox. Wire VALR sandbox (or YC sandbox). Real API calls flowing end-to-end against Solana devnet. No production credentials anywhere. | 4-6 weeks **after `api/` exists** | R 0 (sandboxes are free) | None |
| **3: Production** | Signed contracts with one EFT partner + one CASP. KYC vendor wired (or bundled with CASP). Audit. Limited pilot launch with one co-op. | 6-9 months including legal | R 50-150k legal + partner integration fees | Real |

Each phase strictly gates the next. **No phase 3 work begins before
phase 2 ships AND the partnership contracts are signed.**

### Phase 1 — Mocked UI (what we'd ship next)

Concrete deliverables:

- New `<PayWithBankModal />` component on the dashboard, fired from the
  Apply tab's "Fund this pack" CTA and from the Marketplace tab's
  Match flow.
- Four bank-logo buttons (ABSA, Capitec, Standard Bank, Nedbank) +
  PayShap. **Use logos with permission only.** Use generic icons until
  we have brand approval — do not ship a card with logos we don't
  have written permission for.
- A fake confirmation screen: "Sending R X from your Capitec account…"
  → 2s spinner → "Done. Your Grow Pack is funded."
- The existing devnet on-chain flow runs underneath, exactly as today.
- A small "DEMO — no real money moves" badge on the modal so the
  honesty rule (CLAUDE.md §10) is preserved at the UI level.

What it buys us: a story that lands with co-op partners and DFIs.
"This is what the farmer will see." Beats any slide.

What it does NOT buy us: any indication that the production architecture
works. That is what phase 2 is for.

### Phase 2 — Sandbox-real (the real engineering investment)

Concrete deliverables:

- `api/` backend exists (see `api-backend-scoping.md`) — minimum the
  4-5 endpoints below need to be live.
- 5 new endpoints in `api/`:
  - `POST /v1/payments/initiate` — accepts `{pack_pda, amount_zar, bank}`,
    creates a Stitch payment request, returns a redirect URL
  - `POST /v1/payments/webhook/stitch` — Stitch settlement callback
  - `POST /v1/payments/convert` — internal call: ZAR settled → call
    VALR sandbox to "buy" USDC → return tx ref
  - `POST /v1/payments/disburse` — orchestrator: convert + on-chain
    fund + log
  - `GET /v1/payments/:id` — status polling for the UI
- Stitch sandbox onboarding (self-serve, ~1 day).
- VALR sandbox onboarding (apply for partner sandbox access, may take
  1-2 weeks for them to provision).
- End-to-end integration test: simulate "buyer pays R 5,000 via Stitch
  sandbox" → "ZAR settles to test trust account" → "VALR sandbox
  returns 270 USDC on devnet" → "Vuna program credits the Grow Pack" →
  "farmer dashboard reflects funded status" → all logged.
- Dashboard: same UI as phase 1, but the modal now wires to the real
  sandbox APIs. The "DEMO" badge stays — sandbox is still demo data.

What it buys us: when we walk into a real VALR or Yellow Card
partnership conversation, we have a working integration to show. The
conversation goes from "we'd like to" to "we've already built it on
your sandbox, here's the credentials." This is the difference between
6 months and 6 weeks of partner onboarding.

### Phase 3 — Production (Pilot v1 territory)

Not scoped in detail here — that scoping happens *after* phase 2 is
live and we have a signed partner. The reason: every partner contract
changes the architecture (custody flow, KYC handoff, settlement
guarantees, fee schedule). Pre-scoping is premature.

What we already know we'll need:

- Legal review of partner contracts. Budget R 30-100k.
- A POPIA-compliant KYC document store, or full KYC delegation to
  the CASP partner.
- A reconciliation job that runs daily against partner statements and
  on-chain state, flags discrepancies.
- A pre-go-live audit of the orchestrator code by a third party.
- A regulatory affairs adviser (part-time, retainer model is fine for
  a small pilot).

---

## Indicative cost per transaction (production tier)

These are RANGES from public info. Real numbers come from signed
partner agreements. Treat as order-of-magnitude only.

For a hypothetical R 5,000 Grow Pack funding round:

| Cost item | Range | Notes |
|-|-|-|
| EFT push (Stitch / Ozow) | R 1-3 flat | Negotiated at volume. |
| ZAR ↔ USDC conversion (VALR) | R 5-50 | 0.1-1% all-in. Spread varies in stress markets. |
| Solana fee for the on-chain instruction | <R 1 | Currently ~$0.0005 equivalent. |
| **Total rails cost** | **~R 10-55 per R 5,000 round** | 0.2-1.1% all-in. |

This is competitive with traditional MFI disbursement (often 2-4% in
admin fees alone). The thinness of the margin matters: a Grow Pack at
R 5,000 with 1% rails cost = R 50; at 3% = R 150. That's the
difference between "viable" and "we're losing on the disbursement."

**Cost discipline matters from day one of phase 3.**

---

## Risks — be honest

| Risk | Likelihood | Mitigation |
|-|-|-|
| VALR / YC won't onboard us until we have NCR licence or pilot traction | High | Phase 2 sandbox first — gives proof of integration to make the conversation easier. Have a co-op partner introduction letter ready. |
| Stablecoin de-peg (USDC has hit $0.85 in the past) | Low-Medium | Hold USDC for as short a time as possible. Convert ZAR → USDC just before on-chain action; convert USDC → ZAR immediately on release. Never hold treasury reserves in USDC. |
| Bank latency varies (PayShap = seconds, legacy EFT = up to 2 days) | High | PayShap-first design. Fall back to EFT only when explicit. Show realistic estimates in the UI. |
| KYC partner data ownership unclear under POPIA | Medium | Confirm in writing during contract: who is data controller, who is processor. We probably want to be controller for portability. |
| FSCA tightens CASP rules mid-pilot | Medium | Build with the strictest reading. Monitor FSCA Joint Standards updates. |
| Co-op partner pulls out before we sign rails contracts | Medium | Don't sign exclusive partnership terms. Multi-co-op pilot if possible. |
| Solana mainnet outage during a settlement window | Low | Retry logic + manual reconciliation runbook. Partner sees ZAR holding stuck; we explain and process when chain returns. Has happened to every L1 — not a project-killer. |

---

## Decision criteria — when to start phase 2

All three should be true before phase 2 starts:

1. **`api/` backend has shipped (or starts shipping in parallel).** Phase
   2 needs an HTTP surface that doesn't exist yet. See
   `api-backend-scoping.md`.
2. **At least one co-op partner has agreed in principle** to be the
   Pilot v1 counter-party. Even a non-binding letter is enough at this
   stage.
3. **We've had at least one intro call with VALR or Yellow Card** to
   confirm a partner programme exists at the scale we operate
   (otherwise phase 2 is building against a sandbox we can never
   productionise).

If any of these is missing, phase 2 is a sandbox engineering exercise
with no path forward. Save the effort.

---

## What this doc does NOT cover

- **Card payments.** Cards are not the right rail for SA farmer payments
  (low penetration outside cities, high fees). Out of scope.
- **Mobile money** (M-Pesa, MoMo, etc.). Big in Kenya / Uganda, small in
  SA. Re-visit only if we expand into SADC.
- **Self-custodial wallet flows for the farmer.** The product hides the
  chain — the farmer never holds a wallet. Co-op staff and buyers can
  use Phantom / Solflare on the `/coop` surface, but that's their own
  flow, not a payment rail.
- **Tokenised ZAR stablecoins** (ZARP, etc.). Interesting but immature;
  USDC is the boring choice that already works.

---

## Open questions before approving phase 2

1. Are we comfortable that phase 1 alone (mocked UI) is the right
   hackathon-post deliverable, with phase 2 gated on the criteria
   above? Or do we want to start sandbox work in parallel?
2. Has anyone made a warm-intro to a VALR partner manager? Yellow
   Card?
3. Does the rough cost-per-transaction (0.2-1.1% all-in) work
   inside the Grow Pack pricing model in `core/grow-pack.ts`?
   Worth a quick spike to confirm.
4. Bank logos: are we OK shipping phase 1 with generic icons until
   we have written brand permission from ABSA / Capitec / Standard /
   Nedbank? (My recommendation: yes, generic icons.)

---

*Drafted 2026-05-16. Not yet approved. No code starts until this doc
is signed off.*
