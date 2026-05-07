# Regulatory analysis — South Africa

> The non-negotiable list. Skipping any one of these is how similar projects ended in headlines, not balance sheets.

## The five laws that matter

### 1. National Credit Act (NCA)

**What it requires.** Anyone who lends money must be registered with the National Credit Regulator (NCR). Unregistered lending is a criminal offence under §40.

**How it applies to Vuna.** A Grow Pack is credit. Without NCR registration, every disbursement is illegal.

**How we comply.**
- Option A: Vuna registers as a credit provider directly (slow, expensive).
- Option B: Partner with an NCR-registered co-op or MFI that fronts the loan; Vuna provides the technology stack and reporting layer. **Default plan.**

### 2. FAIS Act (Financial Advisory and Intermediary Services Act)

**What it requires.** Anyone selling, advising on, or intermediating insurance needs an FSP (Financial Service Provider) licence from the FSCA.

**How it applies to Vuna.** Even parametric (rule-based) insurance is still legally insurance. We cannot underwrite or sell it without a licence.

**How we comply.**
- Partner with a licensed insurer who underwrites the parametric product.
- Vuna positions itself as a *technology platform*, not the insurer. The smart contract executes payouts on the insurer's behalf.

### 3. FSCA / CASP framework (Crypto Asset Service Provider)

**What it requires.** Any entity providing crypto-asset services (custody, exchange, transfer) must hold a CASP licence under the FAIS Act. As of March 2026 the FSCA had approved 310 CASPs.

**How it applies to Vuna.** We custody USDC for farmers (in the custodial wallet abstraction). We move USDC between accounts. That is a CASP activity.

**How we comply.**
- File the CASP application early. It takes time.
- Until licensed, run only as a closed pilot under a partner's umbrella.

### 4. SARB Exchange Control Regulations (Circular 3-2026)

**What it requires.** The 2026 update brought crypto explicitly under exchange-control rules. Cross-border crypto flows require prior SARB approval. Penalty: up to **5 years jail and compulsory surrender of digital assets**.

**How it applies to Vuna.**
- A South African farmer receiving USDC from a foreign DeFi pool = cross-border flow.
- Reporting: any transaction above the threshold must be declared within 30 days, with counterparty and purpose details.

**How we comply.**
- Until pilot is purely domestic, no cross-border flow.
- For Pan-African expansion, route via the Pan-African Payment and Settlement System (PAPSS) integration, with SARB approval.

### 5. POPIA (Protection of Personal Information Act)

**What it requires.** Lawful, minimal, secure handling of personal information. Mandatory breach notification. Penalties up to **R10 million or 10 years imprisonment**.

**How it applies to Vuna.** We collect farmer ID, phone numbers, location, payment history, harvest data. All of this is personal information.

**How we comply.**
- Store **no PII on-chain.** On-chain we store only hashes and aggregate scores.
- Encrypt PII at rest in PostgreSQL. Restrict access by role.
- Get explicit, informed consent at onboarding (in isiZulu / isiXhosa where appropriate).
- Register an Information Officer with the Information Regulator.
- Have a breach response plan from day one.

## Other laws on the radar

| Law | Why it matters |
|-|-|
| Insurance Act 2017 | Parametric insurance must still be underwritten by a licensed insurer. Drives the partnership model. |
| Consumer Protection Act 2008 | Disclosure, fair dealing, cooling-off rights. Affects UI copy and contracts. |
| FICA (Financial Intelligence Centre Act) | KYC / AML. Co-op handles in-person verification under our partnership. |
| Co-operatives Act 2005 | Defines co-op governance — relevant when negotiating partnerships. |

## Compliance phasing

| Phase | What we need |
|-|-|
| Hackathon (devnet only) | Nothing. No real money, no real users. |
| Pilot v1 (real money, ≤200 farmers) | NCA partner, FAIS partner (insurer), POPIA controls live, CASP application filed. |
| Pilot v2 (scale) | CASP licence granted. Reinsurance partner active. |
| Pan-African | SARB approval for cross-border. PAPSS integration. |

## Red lines we will not cross

- Disburse credit without NCR cover.
- Sell or imply we sell insurance without an FSP partner.
- Take farmer custody of crypto without a CASP licence (or licensed partner).
- Move USDC across borders without SARB approval.
- Solicit retail users before regulatory cover is in place.

If a deadline pushes us toward any of these, we miss the deadline.
