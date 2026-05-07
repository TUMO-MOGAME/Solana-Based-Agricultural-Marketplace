# docs/outreach/ — CLAUDE context

Materials for reaching out to licensed South African agri-insurers about an underwriting partnership.

## Files

| File | Purpose |
|-|-|
| `01_insurer-targets.md` | Who to contact, why each, the angle for each. **Read first.** |
| `02_one-pager.md` | The single-page attachment. Source for the PDF. |
| `03_email-template.md` | Cover-email template, with per-insurer customization fields. |
| `04_meeting-brief.md` | Prep notes for the call. What to ask, what to listen for. |
| `05_followup-template.md` | After-meeting follow-up email template. |
| `06_product-brief.md` | The follow-up document — sent within 7 working days of a successful first call when the underwriter asks "send us more". |
| `Vuna_one-pager.pdf` | Generated. The cold-email attachment. Regenerate via `python scripts/build_one_pager.py`. |
| `Vuna_product-brief.pdf` | Generated. The follow-up attachment. Regenerate via `python scripts/build_product_brief.py`. |

## Tone — non-negotiable

- **Professional. South African business.** Polite, brief, respectful of their time.
- **Lead with social impact and regulatory awareness, NOT crypto.** Insurance executives glaze at "blockchain". The product is parametric crop insurance for smallholders. The underlying tech is implementation detail.
- **Acknowledge our stage.** We are early. Pretending otherwise damages credibility.
- **Specific ask.** A 30-minute introductory call within two weeks. Not a partnership commitment.

## Process

1. Read `01_insurer-targets.md`. Pick one to start with — recommend **LBIC** because it is purpose-built for smallholder agriculture.
2. Customise `03_email-template.md` with the insurer's name and the angle from `01_insurer-targets.md`.
3. Attach `Vuna_one-pager.pdf` (build it with `python scripts/build_one_pager.py`).
4. Send. Log the date and contact in `01_insurer-targets.md`.
5. Before any meeting, re-read `04_meeting-brief.md`.
6. After the meeting, send `05_followup-template.md` within 24 hours.

## What this is NOT

- Not a sales pitch. We are not selling them anything. We are exploring whether they would underwrite for us.
- Not a commitment. Nothing in these documents binds either party.
- Not for retail communication. This is B2B only.
