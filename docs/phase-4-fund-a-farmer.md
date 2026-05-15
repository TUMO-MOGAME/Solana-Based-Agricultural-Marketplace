# Phase 4 — Fund a Farmer

> Roadmap doc. **NOT yet implemented in code. NOT in the 2026 Hackathon scope.**
> Documented now so the design is locked in *before* someone (us, a future
> contributor, an acquirer) is tempted to drift from the principles below.

---

## The idea in one paragraph

Today a Grow Pack is funded by the co-op (or, post-pilot, a licensed insurer
+ DeFi pool). Phase 4 adds a second funding rail: any verified person,
anywhere, can contribute to a specific Grow Pack and get their principal back
at harvest. **No interest, ever.** This is solidarity capital — a Kiva-style
peer microloan rail on Solana, not an investment product.

---

## The 0% principle — non-negotiable

**Funders receive their principal back. Nothing more. Ever.**

This is the rule that:

- Keeps the product out of NCA (National Credit Act) territory — no compensation, no credit-provider classification.
- Keeps the product out of FSCA / Financial Markets Act territory — no return, no security.
- Keeps the moral framing honest — solidarity, not extraction. A return-bearing P2P platform where global funders earn interest from African smallholders has uncomfortable echoes of extractive capital. That is not the story this project tells.

If we ever change this, we are building a different product. That different
product needs an NCR licence, an FSP licence, a full securities review, and
a different name.

**Do not add even a 1% bonus to funders. Do not add token-based rewards. Do
not add yield.** If you find yourself debating *"but what if we offer just
a small return"* — stop. Re-read this paragraph.

---

## How Phase 4 differs from the insurer route

Two funding rails into the same Grow Pack PDA. Both can coexist on a single
pack (e.g. R 2 000 from the insurer pool + R 800 from 16 peer funders).

| | Insurer route (Phases 1–3) | Phase 4 — P2P route |
|-|-|-|
| Capital source | Licensed underwriter + DeFi pool | Pool of individual funders, R 50 – R 5 000 each |
| Funder return | Premium income (regulated) | **Principal back only (0%)** |
| Default loss falls on | Underwriter / pool | Individual funders (pro-rata) |
| Primary regulation | NCA, FAIS, FSCA, Insurance Act | POPIA, FICA-light, **no NCR (because 0%)** |
| Trust mechanism | Underwriter does diligence | Co-op curates the farmer; chain proves the flow |
| Geography | Domestic first | Domestic first; global only after SARB approval |
| Scale | Big packs, big farms | Long tail of small smallholders |

---

## User flows

### Funder flow (new surface — `/fund` route, NOT inside the farmer dashboard)

1. Funder lands on `/fund`. Browses open Grow Pack requests.
2. Each card shows: farmer first name only (no PII), region, crop, hectares, amount needed, amount funded so far, expected harvest date, and *what happens if drought hits*.
3. Funder picks an amount (≥ R 50), reads + accepts the disclaimer:
   > *"Defaults happen. Your principal is at risk. No interest is promised. You may lose all or part of your contribution."*
4. Funder signs the on-chain `contribute_to_pack` instruction.
5. Principal is locked in a `FunderContribution` PDA.
6. When combined contributions hit the pack's bundle cost, the pack auto-disburses — no second co-op approval needed.

### Farmer flow — unchanged

The farmer sees no difference. They request a pack, the co-op approves, the
seeds arrive. They don't know if it was funded by the insurer or by 23
peers. Per the project's **hide the chain** rule (root `CLAUDE.md` §7), this
detail stays off the farmer dashboard.

### Harvest / repayment flow

1. Farmer sells the harvest via the existing marketplace (`Deal` PDA).
2. `settle_repayment` deducts principal + service fee from sale proceeds.
3. New instruction `release_funder_contributions` distributes the principal pro-rata to every `FunderContribution` PDA pointing at this pack.
4. Each funder sees their contribution as `Repaid`; they withdraw to their wallet via `withdraw_funder_contribution`.

### Drought / partial-default flow

1. `trigger_insurance_payout` fires as it does today.
2. **Behavioural change** — insurance payout flows to the pack escrow first, not directly to the farmer.
3. Funders get a pro-rata share of the insurance payout in lieu of full repayment. The farmer keeps the remainder for replanting.
4. Any shortfall vs principal is a permanent loss to funders. Disclosed upfront.

### Total-default flow

If no harvest sale happens AND insurance doesn't trigger (within the maturity
window), funders absorb the loss pro-rata. The disclaimer at contribute-time
covers this.

---

## On-chain account sketch

### New PDA — `FunderContribution`

- Seeds: `["funder", funder_pubkey, pack_pda]`
- Fields:
  - `funder: Pubkey`
  - `pack: Pubkey`
  - `amount_lamports: u64`
  - `contributed_at: i64`
  - `status: enum { Locked, Repaid, PartiallyRepaid, Defaulted }`
  - `repaid_amount: u64`

### New instructions

- `contribute_to_pack(pack, amount)` — opens a `FunderContribution`, transfers lamports to pack escrow.
- `release_funder_contributions(pack)` — anyone may call once the pack is in `Repaid` / `InsurancePaid` / past maturity. Distributes pro-rata to every `FunderContribution` pointing at this pack.
- `withdraw_funder_contribution(contribution)` — funder withdraws once `status != Locked`.
- `cancel_contribution(contribution)` — within 24 h of contributing AND before pack auto-disburses (Consumer Protection Act cooling-off).

### Changes to existing accounts

- `GrowPack` gets a `funded_amount: u64` field and a `funding_source: enum { Cooperative, Insurer, Peer, Mixed }` field.
- `trigger_insurance_payout` is updated so payout flows to pack escrow first; `release_funder_contributions` handles downstream distribution.

---

## Regulatory mitigations

| Risk | Mitigation |
|-|-|
| **NCA — anyone lending for compensation needs NCR registration** | Strict 0%. No compensation. Genuinely interest-free. Embed the no-return promise in the on-chain disclaimer hash. |
| **FSCA — Financial Markets Act, securities classification** | No return = no security. Same mitigation as NCA. |
| **SARB Exchange Control (Circular 3-2026) — cross-border crypto flow** | Phase 4a/4b: SA-domestic only. Phase 4c+: route foreign funders through PAPSS with prior SARB approval. |
| **FICA — AML/KYC** | Light KYC for funders (email + ID-hash). Co-op handles the farmer side. |
| **POPIA** | Funders see farmer first name + region only. Never full ID, never location finer than province. |
| **Consumer Protection Act 2008** | 24 h cooling-off via `cancel_contribution`. Plain-language disclaimer at contribute-time. |
| **Insurance Act 2017** | Unchanged — parametric insurance still routed through the licensed underwriter. Phase 4 does not touch the insurance leg, only the credit leg. |

---

## What this is NOT

- ❌ Not a yield-bearing investment.
- ❌ Not microfinance (microfinance charges interest).
- ❌ Not crowdfunding for equity.
- ❌ Not a token sale.
- ❌ Not an opportunity for funders to *make* money — only to do good and recover principal.

If marketing copy ever drifts toward *"earn"*, *"yield"*, *"return on
impact"* — flag it and stop. Phase 4 is solidarity. The mission is moved by
the funder's intent, not by their wallet.

---

## Milestones

| Phase | Window | Goal |
|-|-|-|
| **4a — Devnet demo** | After Pilot v2 (2027 H2 at earliest) | `/fund` route live on devnet. SA-only. ≤ 10 demo packs. |
| **4b — Domestic pilot** | 2028 H1 | Real ZAR, SA funders only. ≤ 50 packs. NCR opinion letter on file. |
| **4c — Regional** | 2028 H2 | SADC funders via PAPSS. SARB approval secured. |
| **4d — Global** | 2029+ | International funders via a licensed FX corridor. |

**Phase 4 follows Pilot v2 — it does not run in parallel.** Do not pull
engineering off finishing the insurer + lending pilot to chase this.

---

## Open questions

1. **Trust mechanism beyond the co-op?** If we scale past co-op-curated farmers, what stops fraud at the funder-input end? Leaning answer: stay co-op-only indefinitely.
2. **Reputation for repeat funders?** Should a funder repaid 5+ times unlock higher caps? Risk: this looks like ranked-investor logic and drifts toward "platform".
3. **Defaulted-funder accounts?** Close the `FunderContribution` PDA, or keep it as a permanent record? Lean toward keep, for transparency.
4. **Marketplace-deal-never-happens edge case.** If the farmer harvests but does not sell via our marketplace, funders are stuck. Need a maturity-window auto-claim against the insurance pool, or an arbitration path.

---

## Why we are documenting this now (May 2026) but not building it

1. The hackathon is finite. Engineering energy goes to finishing the insurer rail (the [Critical path remaining](../app/CLAUDE.md) items), not opening a second one.
2. Locking in the **0% principle** *before* there is code prevents drift later. The temptation to add "just a tiny yield to attract funders" is enormous. This doc is the load-bearing argument against that temptation.
3. Showing Phase 4 in the pitch demonstrates we see the bigger picture without claiming we built it.

---

*Drafted: 2026-05-15 by Tumo & Pitsi (with Claude). Status: roadmap only —
not implemented. Do not start work without re-reading the "0% principle"
section.*
