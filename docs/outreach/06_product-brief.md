# Vuna — Product Brief for Underwriting Partners

*Draft for circulation to licensed South African agri-insurers exploring an underwriting partnership for Project Vuna's smallholder Grow Pack product.*

*Sent following an introductory conversation. This is not a solicitation, a quote, or a binding offer. It is a structured starting point for due diligence and partnership scoping.*

---

## 1. Executive summary

Project Vuna is a digital platform that bundles credit, certified inputs, and parametric drought insurance into a single product — the **Grow Pack** — distributed to South African smallholder farmers through their cooperatives. We are seeking a licensed underwriting partner to issue the parametric crop policy embedded in each Grow Pack. Vuna provides distribution, onboarding, data, and automated payout execution. The underwriter provides the licence, the actuarial discipline, and the balance sheet. This brief outlines the product, the data we can supply, the proposed pilot, and the partnership structures we would like to discuss.

## 2. The Grow Pack

A Grow Pack is a single bundled product issued at the start of a planting season:

| Component | Typical for 2 ha maize |
|-|-:|
| Certified maize seed (25 kg) | R 420 |
| NPK fertilizer (100 kg) | R 1,150 |
| Parametric drought insurance policy | R 85 |
| **Total cost issued on credit** | **R 1,655** |
| Service fee at harvest (10%) | R 165 |
| **Total repaid at harvest** | **≈ R 1,820** |

The farmer never receives cash. Inputs are paid directly to vetted suppliers and physically delivered through the cooperative's existing logistics. Repayment is auto-deducted from the harvest sale, which is also routed through the cooperative.

The insurance policy is the smallest line item by Rand value but the most consequential by impact: without it, one drought year destroys the household.

## 3. The parametric insurance product

We are proposing a **parametric drought policy** because it is the only structure where unit economics work at smallholder scale. Indemnity insurance requires per-policy claims investigation that costs more than the premium. Parametric pays automatically against an objective measurable trigger.

**Proposed structure for the pilot product:**

| Parameter | Default value | Notes |
|-|-|-|
| Crop | White maize | Most-planted SA staple; deepest historical data |
| Coverage period | 1 Sept → 31 Mar | Eastern Cape summer planting window |
| Trigger | Cumulative rainfall < 70% of 30-year regional norm over coverage period | Adjustable per region grid |
| Data source for trigger | SAWS station data + remote-sensing rainfall index (CHIRPS) | Two independent sources for cross-validation |
| Policy size | R 60–120 per hectare | Tied to seed + fertilizer cost |
| Payout | Up to 80% of input cost, scaled to severity | Three-tier payout: 30% / 60% / 80% |
| Geographic granularity | District level for pilot; ward level for scale | We can ingest finer-grained data as needed |

**What we are explicitly open to negotiating:**
- Trigger threshold (60% / 70% / 80%)
- Payout structure (linear vs stepped)
- Whether the trigger is rainfall, temperature-stress days, or a composite
- Whether rainfall data uses SAWS, CHIRPS, ERA5, or a blend

The parametric trigger is **off-chain on the underwriter's side**. The underwriter computes whether the trigger has fired using whatever data they trust, then signs a simple attestation. Vuna's payout contract releases funds on the signature. This means the underwriter retains full actuarial control of the product; Vuna handles only execution and data presentation.

## 4. What data Vuna can provide

We will provide the underwriter with:

| Data | Source | Cadence |
|-|-|-|
| Farmer KYC pack | Cooperative-mediated, FICA-light tier | Per-farmer, at registration |
| Plot location (GPS centroid + ha) | Cooperative-verified | Per-farmer |
| Crop type and variety | Farmer + supplier-confirmed | Per-pack |
| Input delivery confirmation | Supplier signed | Per-pack |
| Real-time weather feed for plot region | SAWS + CHIRPS via API | Daily |
| Harvest yield | Cooperative-attested, off-taker confirmed | End-of-season |
| Repayment status | Auto-tracked via marketplace settlement | Daily |
| Default and loss data | System-generated | End-of-season |

All data flows are POPIA-compliant. PII is encrypted at rest, hashed before any on-chain reference, and shared with the underwriter under a Data Sharing Agreement scoped strictly to underwriting purposes.

## 5. Distribution and operational controls

The cooperative is the operational anchor of the product. They are not a technology layer; they are the human layer that prevents fraud and builds farmer trust.

- **Onboarding:** Farmers register through a cooperative officer in person. KYC documents are collected and verified before any policy is issued.
- **Approval:** A 48-hour cooperative review on every Grow Pack request. This is a feature, not a bug — it kills ghost-farmer fraud.
- **Disbursement:** Inputs go to suppliers, never to farmer wallets. No cash handling.
- **Trigger monitoring:** Independent dual-source weather data with alerting if sources diverge.
- **Payout:** On underwriter signature. Funds settled to farmer's cooperative-linked account. Reconciled to SARS-aligned reporting.
- **Repayment:** Marketplace-mediated. Auto-deducted from harvest sale.

Loss-control levers we expect to use in the pilot: cohort cap (max 100 farmers), regional exposure cap, individual policy cap (R 240/ha), and an underwriter-controlled kill-switch.

## 6. Proposed pilot

We propose a contained, observable pilot in the 2026/27 summer planting season.

| Pilot parameter | Proposed value |
|-|-|
| Region | Eastern Cape — one district, recommended Mhlontlo or Mbizana |
| Crop | White maize |
| Cohort size | 50–100 farmers |
| Average plot | 2 hectares |
| Total insured ha | 100–200 ha |
| Total credit deployed | R 75,000 – R 150,000 |
| Total premium pool (5–7% of credit) | R 5,000 – R 10,000 |
| Coverage period | 1 Sept 2026 → 31 Mar 2027 |
| Underwriter capital at risk | Capped per pilot agreement |
| Reinsurance | Likely not required at this pool size |
| Primary success metrics | Loss ratio, repayment rate, farmer NPS, payout latency |
| Pilot exit / scale gate | <30% loss ratio AND >65% repayment AND zero fraud incidents >5% of pool |

The pilot is small enough that the underwriter can absorb the risk on its own balance sheet without external reinsurance arrangements. If the pilot succeeds, scaling beyond ~500 farmers per region is where reinsurance discussions become material — and where we would expect to introduce a reinsurance partner the underwriter already works with.

## 7. Partnership structures we are open to

We are open to several structures and would value the underwriter's view on which is most workable:

| Structure | Vuna's role | Underwriter's role | Comment |
|-|-|-|-|
| **Tied intermediation** | Distribution, onboarding, payout execution | Issues policy directly to farmer | Simplest. Vuna registers as a tied agent if required by FAIS. Lowest commitment from both sides. |
| **White-label / co-branded** | Distribution and operations | Issues policy under co-branded paper | Mid-tier complexity. Requires defined commercial split. |
| **Cell captive** | Holds capital in a cell, operates inside underwriter's licence | Provides licence, governance, reinsurance gateway | Highest commitment, highest control for Vuna. Requires significant capital and FSCA awareness. Probably out of scope until after pilot. |
| **MGA (Managing General Agent)** | Delegated underwriting authority | Carrier and balance sheet | Requires Vuna to hold an FSP licence we do not yet have. Probably out of scope. |

For the pilot, **tied intermediation or white-label** is the realistic starting point. Cell captive and MGA become discussions for the post-pilot scaling phase.

## 8. Regulatory positioning

Project Vuna will not underwrite, sell, or imply that it sells insurance until appropriate regulatory cover is in place.

- **Insurance:** The parametric product is underwritten by the partner. We act as a tied intermediary or under the partner's white-label cover, in either case under FAIS oversight.
- **Credit:** The credit component is fronted by an NCR-registered partner (a cooperative MFI or development-finance lender). Vuna provides the technology and operations layer.
- **Crypto:** Where the platform uses on-chain settlement (for transparency and automated payouts), it does so under a partner CASP licence or under a closed pilot with no retail solicitation, until Vuna's own CASP application clears.
- **Data:** POPIA-compliant data handling from day one. Information Officer registered with the Information Regulator.
- **Cross-border:** No cross-border crypto flows in the pilot. SARB pre-approval will be sought before any pan-African expansion.

We are happy to share our full regulatory analysis on request.

## 9. Team

**Tumo Mogame** — Founder. [Background, qualifications, prior work — fill in.]

I am early-stage. I do not pretend otherwise. The product proposal, regulatory analysis, technical architecture, and outreach materials are documented; I am happy to share any of these in full.

## 10. Open questions for the underwriter

Questions we would value your view on, ahead of any formal proposal:

1. What is your appetite for parametric crop products in 2026/27? Have you written parametric maize before, and if so at what scale?
2. What is the smallest cohort size and pool you would consider for a pilot?
3. What partnership structure (tied / white-label / cell / MGA) would your team find easiest to operationalise inside your existing licensing and approval framework?
4. What is the minimum data set you would need for an actuary to price this — and over what historical window?
5. What governance and reporting cadence would you expect during the pilot?
6. Are there reinsurance arrangements you already have in place that could absorb a smallholder parametric portfolio at scale?
7. What are the deal-killers — the things that would make this a non-starter for [Insurer]?
8. Who internally would own this partnership through to a signed agreement?

## Next steps

If this brief is useful as a starting point, we would propose:

1. A second, longer conversation with your product / agriculture lead and (where possible) an actuary, in the next 2–3 weeks.
2. A jointly drafted pilot scoping document by end of June 2026, ahead of the 2026/27 summer planting registration window.
3. A memorandum of understanding (non-binding) by end of July 2026 if scoping aligns.

We are talking to a small number of South African agri-insurers in parallel and will be transparent about progress with each. We are not pursuing exclusivity at this stage on either side.

---

**Tumo Mogame**
Founder, Project Vuna
[Email] · [Phone]
