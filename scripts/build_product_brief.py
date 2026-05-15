"""
Generates docs/outreach/Vuna_product-brief.pdf

The follow-up document sent to an agri-insurer after a successful first
introductory call, when they ask "send us more". Sits between the
one-pager and the full proposal in depth.

Run: python scripts/build_product_brief.py
"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    ListFlowable, ListItem,
)
from reportlab.pdfgen import canvas

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT = os.path.join(ROOT, "docs", "outreach", "Vuna_product-brief.pdf")

# styles
styles = getSampleStyleSheet()
GREEN = colors.HexColor("#0B3D2E")
GREEN_MID = colors.HexColor("#1F6B49")
INK = colors.HexColor("#111111")
INK_SOFT = colors.HexColor("#555555")

TITLE = ParagraphStyle("Title", parent=styles["Title"], fontName="Helvetica-Bold",
                       fontSize=22, leading=26, alignment=TA_LEFT,
                       spaceAfter=4, textColor=GREEN)
SUBTITLE = ParagraphStyle("Sub", parent=styles["Normal"], fontName="Helvetica-Oblique",
                          fontSize=10, leading=13, alignment=TA_LEFT,
                          spaceAfter=14, textColor=INK_SOFT)
H1 = ParagraphStyle("H1", parent=styles["Heading1"], fontName="Helvetica-Bold",
                    fontSize=14, leading=18, spaceBefore=14, spaceAfter=6,
                    textColor=GREEN)
H2 = ParagraphStyle("H2", parent=styles["Heading2"], fontName="Helvetica-Bold",
                    fontSize=11.5, leading=14, spaceBefore=10, spaceAfter=4,
                    textColor=GREEN_MID)
BODY = ParagraphStyle("Body", parent=styles["BodyText"], fontName="Helvetica",
                      fontSize=10, leading=14, alignment=TA_JUSTIFY,
                      spaceAfter=8, textColor=INK)
BULLET = ParagraphStyle("Bullet", parent=BODY, leftIndent=14, bulletIndent=2,
                        spaceAfter=3)
SMALL = ParagraphStyle("Small", parent=BODY, fontSize=9, leading=12,
                       textColor=INK_SOFT)
NUM = ParagraphStyle("Num", parent=BULLET)


def p(text, style=BODY): return Paragraph(text, style)


def bullets(items):
    return ListFlowable(
        [ListItem(Paragraph(t, BULLET), leftIndent=8, value="bullet") for t in items],
        bulletType="bullet", start="circle",
        leftIndent=12, bulletFontSize=8,
    )


def numbered(items):
    return ListFlowable(
        [ListItem(Paragraph(t, NUM)) for t in items],
        bulletType="1", start="1",
        leftIndent=18, bulletFontSize=10,
    )


def wrap(rows, style=None):
    cs = style or ParagraphStyle("c", parent=BODY, fontSize=9, leading=12,
                                  spaceAfter=0, alignment=TA_LEFT)
    return [[Paragraph(str(c), cs) for c in r] for r in rows]


def table(data, col_widths=None):
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("FONT", (0, 0), (-1, -1), "Helvetica", 9.5),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#888888")),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#BBBBBB")),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("BACKGROUND", (0, 0), (-1, 0), GREEN),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 10),
    ]))
    return t


def on_page(canv: canvas.Canvas, doc):
    canv.saveState()
    canv.setFont("Helvetica", 8)
    canv.setFillColor(colors.HexColor("#666666"))
    canv.drawString(2 * cm, 1.2 * cm,
                    "Vuna  |  Product brief  |  Confidential — for partnership discussion only")
    canv.drawRightString(A4[0] - 2 * cm, 1.2 * cm, f"Page {doc.page}")
    canv.restoreState()


story = [
    p("Project Vuna — Product Brief", TITLE),
    p("For licensed South African agri-insurers exploring an underwriting "
      "partnership for the Grow Pack product. Draft. Not a solicitation, "
      "quote, or binding offer.", SUBTITLE),

    p("1. Executive summary", H1),
    p("Project Vuna is a digital platform that bundles credit, certified inputs, and "
      "parametric drought insurance into a single product — the <b>Grow Pack</b> — "
      "distributed to South African smallholder farmers through their cooperatives. "
      "We are seeking a licensed underwriting partner to issue the parametric crop "
      "policy embedded in each Grow Pack. Vuna provides distribution, onboarding, data, "
      "and automated payout execution. The underwriter provides the licence, the "
      "actuarial discipline, and the balance sheet."),

    p("2. The Grow Pack", H1),
    p("A Grow Pack is a single bundled product issued at the start of a planting season:"),
    table(wrap([
        ["Component", "Typical for 2 ha maize"],
        ["Certified maize seed (25 kg)", "R 420"],
        ["NPK fertilizer (100 kg)", "R 1,150"],
        ["Parametric drought insurance policy", "R 85"],
        ["<b>Total cost issued on credit</b>", "<b>R 1,655</b>"],
        ["Service fee at harvest (10%)", "R 165"],
        ["<b>Total repaid at harvest</b>", "<b>≈ R 1,820</b>"],
    ]), col_widths=[10 * cm, 6 * cm]),
    Spacer(1, 0.2 * cm),
    p("The farmer never receives cash. Inputs are paid directly to vetted suppliers and "
      "physically delivered through the cooperative's existing logistics. Repayment is "
      "auto-deducted from the harvest sale, which is also routed through the cooperative."),
    p("The insurance policy is the smallest line item by Rand value but the most "
      "consequential by impact: without it, one drought year destroys the household."),

    p("3. The parametric insurance product", H1),
    p("We propose a <b>parametric drought policy</b> because it is the only structure "
      "where unit economics work at smallholder scale. Indemnity insurance requires "
      "per-policy claims investigation that costs more than the premium. Parametric "
      "pays automatically against an objective measurable trigger."),
    p("Proposed structure for the pilot product:", H2),
    table(wrap([
        ["Parameter", "Default value", "Notes"],
        ["Crop", "White maize", "Most-planted SA staple; deepest historical data"],
        ["Coverage period", "1 Sept → 31 Mar", "Eastern Cape summer planting window"],
        ["Trigger", "Cumulative rainfall &lt; 70% of 30-year norm", "Adjustable per region grid"],
        ["Data source", "SAWS + CHIRPS remote-sensing", "Two independent sources; cross-validated"],
        ["Policy size", "R 60–120 per hectare", "Tied to seed + fertilizer cost"],
        ["Payout", "Up to 80% of input cost, scaled to severity", "Three-tier: 30% / 60% / 80%"],
        ["Geographic granularity", "District (pilot) → ward (scale)", "Finer-grained data ingestible"],
    ]), col_widths=[3.8 * cm, 5.5 * cm, 6.7 * cm]),
    Spacer(1, 0.2 * cm),
    p("<b>Open to negotiation:</b> trigger threshold (60/70/80%); payout structure (linear "
      "vs stepped); whether the trigger is rainfall, temperature-stress days, or a "
      "composite; data source (SAWS / CHIRPS / ERA5 / blend)."),
    p("The parametric trigger is computed <b>off-chain on the underwriter's side</b>. "
      "The underwriter computes whether the trigger has fired using whatever data they "
      "trust, then signs an attestation. Vuna's payout contract releases funds on the "
      "signature. The underwriter retains full actuarial control of the product; Vuna "
      "handles only execution and data presentation."),

    p("4. What data Vuna can provide", H1),
    table(wrap([
        ["Data", "Source", "Cadence"],
        ["Farmer KYC pack", "Cooperative-mediated, FICA-light tier", "Per farmer, at registration"],
        ["Plot location (GPS centroid + ha)", "Cooperative-verified", "Per farmer"],
        ["Crop type and variety", "Farmer + supplier-confirmed", "Per pack"],
        ["Input delivery confirmation", "Supplier signed", "Per pack"],
        ["Real-time weather feed for plot region", "SAWS + CHIRPS via API", "Daily"],
        ["Harvest yield", "Cooperative-attested, off-taker confirmed", "End of season"],
        ["Repayment status", "Marketplace settlement system", "Daily"],
        ["Default and loss data", "System-generated", "End of season"],
    ]), col_widths=[5.5 * cm, 6.5 * cm, 4 * cm]),
    Spacer(1, 0.2 * cm),
    p("All data flows are POPIA-compliant. PII is encrypted at rest, hashed before any "
      "on-chain reference, and shared with the underwriter under a Data Sharing Agreement "
      "scoped strictly to underwriting purposes."),

    p("5. Distribution and operational controls", H1),
    p("The cooperative is the operational anchor. They are not a technology layer; they "
      "are the human layer that prevents fraud and builds farmer trust."),
    bullets([
        "<b>Onboarding:</b> in-person registration through a co-op officer; KYC verified before policy issue.",
        "<b>Approval:</b> 48-hour cooperative review on every Grow Pack request.",
        "<b>Disbursement:</b> inputs go to suppliers, never to farmer wallets. No cash handling.",
        "<b>Trigger monitoring:</b> dual-source weather data with alerting if sources diverge.",
        "<b>Payout:</b> on underwriter signature; settled to farmer's cooperative-linked account.",
        "<b>Repayment:</b> marketplace-mediated; auto-deducted from harvest sale.",
    ]),
    p("Loss-control levers we expect to use in the pilot: cohort cap (max 100 farmers), "
      "regional exposure cap, individual policy cap (R 240/ha), and an "
      "underwriter-controlled kill-switch."),

    p("6. Proposed pilot", H1),
    p("A contained, observable pilot in the 2026/27 summer planting season:"),
    table(wrap([
        ["Pilot parameter", "Proposed value"],
        ["Region", "Eastern Cape — one district, recommended Mhlontlo or Mbizana"],
        ["Crop", "White maize"],
        ["Cohort size", "50–100 farmers"],
        ["Average plot", "2 hectares"],
        ["Total insured ha", "100–200 ha"],
        ["Total credit deployed", "R 75,000 – R 150,000"],
        ["Total premium pool (5–7% of credit)", "R 5,000 – R 10,000"],
        ["Coverage period", "1 Sept 2026 → 31 Mar 2027"],
        ["Underwriter capital at risk", "Capped per pilot agreement"],
        ["Reinsurance", "Likely not required at this pool size"],
        ["Primary success metrics", "Loss ratio · repayment rate · farmer NPS · payout latency"],
        ["Pilot exit / scale gate",
         "&lt;30% loss ratio AND &gt;65% repayment AND zero fraud incidents &gt;5% of pool"],
    ]), col_widths=[5.5 * cm, 10.5 * cm]),
    Spacer(1, 0.2 * cm),
    p("This pool is small enough that the underwriter can absorb the risk on its own "
      "balance sheet without external reinsurance. Scaling beyond ~500 farmers per region "
      "is where reinsurance discussions become material."),

    p("7. Partnership structures we are open to", H1),
    table(wrap([
        ["Structure", "Vuna's role", "Underwriter's role", "Comment"],
        ["<b>Tied intermediation</b>", "Distribution, onboarding, payout execution",
         "Issues policy directly to farmer", "Simplest. Lowest commitment."],
        ["<b>White-label / co-branded</b>", "Distribution and operations",
         "Issues under co-branded paper", "Mid-tier complexity. Defined commercial split."],
        ["<b>Cell captive</b>", "Holds capital in a cell, operates inside underwriter's licence",
         "Provides licence, governance, reinsurance gateway",
         "Highest commitment. Likely post-pilot."],
        ["<b>MGA</b>", "Delegated underwriting authority",
         "Carrier and balance sheet",
         "Requires Vuna FSP licence we do not yet hold."],
    ]), col_widths=[3.5 * cm, 4 * cm, 4 * cm, 4.5 * cm]),
    Spacer(1, 0.2 * cm),
    p("For the pilot, <b>tied intermediation or white-label</b> is the realistic starting "
      "point. Cell captive and MGA become discussions for the post-pilot scaling phase."),

    p("8. Regulatory positioning", H1),
    bullets([
        "<b>Insurance:</b> the parametric product is underwritten by the partner. Vuna acts as a tied intermediary or under white-label cover, in either case under FAIS oversight.",
        "<b>Credit:</b> the credit component is fronted by an NCR-registered partner (cooperative MFI or development-finance lender). Vuna provides technology and operations.",
        "<b>Crypto:</b> on-chain settlement runs under a partner CASP licence or under a closed pilot until Vuna's own CASP application clears.",
        "<b>Data:</b> POPIA-compliant from day one. Information Officer registered.",
        "<b>Cross-border:</b> none in the pilot. SARB pre-approval before any pan-African expansion.",
    ]),
    p("Full regulatory analysis available on request.", SMALL),

    p("9. Team", H1),
    p("<b>Tumo Mogame</b> — Founder. [Background, qualifications, prior work — to be completed.]"),
    p("I am early-stage. I do not pretend otherwise. The product proposal, "
      "regulatory analysis, technical architecture, and outreach materials are "
      "documented; I am happy to share any of these in full."),

    p("10. Open questions for the underwriter", H1),
    numbered([
        "What is your appetite for parametric crop products in 2026/27? Have you written parametric maize before, and at what scale?",
        "What is the smallest cohort size and pool you would consider for a pilot?",
        "What partnership structure (tied / white-label / cell / MGA) is easiest inside your existing licensing and approval framework?",
        "What is the minimum data set you would need for an actuary to price this — and over what historical window?",
        "What governance and reporting cadence would you expect during the pilot?",
        "Are there reinsurance arrangements you already have that could absorb a smallholder parametric portfolio at scale?",
        "What are the deal-killers — the things that make this a non-starter for [Insurer]?",
        "Who internally would own this partnership through to a signed agreement?",
    ]),

    p("Next steps", H1),
    numbered([
        "A second, longer conversation with your product / agriculture lead and (where possible) an actuary, in the next 2–3 weeks.",
        "A jointly drafted pilot scoping document by end of June 2026, ahead of the 2026/27 summer planting registration window.",
        "A non-binding memorandum of understanding by end of July 2026 if scoping aligns.",
    ]),
    p("We are talking to a small number of South African agri-insurers in parallel and "
      "will be transparent about progress with each. We are not pursuing exclusivity "
      "at this stage on either side."),

    Spacer(1, 0.6 * cm),
    p("<b>Tumo Mogame</b> — Founder, Project Vuna", BODY),
    p("[Email] · [Phone]", SMALL),
]


doc = SimpleDocTemplate(
    OUTPUT, pagesize=A4,
    leftMargin=2 * cm, rightMargin=2 * cm,
    topMargin=2 * cm, bottomMargin=2 * cm,
    title="Vuna — Product Brief",
    author="Tumo Mogame",
)
doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
print(f"Wrote {OUTPUT}")
