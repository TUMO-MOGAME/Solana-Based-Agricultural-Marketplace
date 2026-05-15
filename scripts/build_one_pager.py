"""
Generates docs/outreach/Vuna_one-pager.pdf

This is the attachment that goes with cold-outreach emails to insurers.
Single page, professional, no crypto language.

Run: python scripts/build_one_pager.py
"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_JUSTIFY, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, ListFlowable, ListItem,
)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT = os.path.join(ROOT, "docs", "outreach", "Vuna_one-pager.pdf")

# styles
styles = getSampleStyleSheet()
GREEN = colors.HexColor("#0B3D2E")
GREEN_MID = colors.HexColor("#1F6B49")
INK = colors.HexColor("#111111")
INK_SOFT = colors.HexColor("#555555")
RULE = colors.HexColor("#CFCAC0")

TITLE = ParagraphStyle("Title", parent=styles["Title"], fontName="Helvetica-Bold",
                       fontSize=22, leading=26, alignment=TA_LEFT,
                       spaceAfter=2, textColor=GREEN)
LEAD = ParagraphStyle("Lead", parent=styles["Normal"], fontName="Helvetica",
                      fontSize=10.5, leading=14, alignment=TA_LEFT,
                      spaceAfter=10, textColor=INK_SOFT)
H = ParagraphStyle("H", parent=styles["Heading2"], fontName="Helvetica-Bold",
                   fontSize=11.5, leading=14, spaceBefore=10, spaceAfter=4,
                   textColor=GREEN_MID)
BODY = ParagraphStyle("Body", parent=styles["BodyText"], fontName="Helvetica",
                      fontSize=10, leading=13.5, alignment=TA_JUSTIFY,
                      spaceAfter=6, textColor=INK)
BULLET = ParagraphStyle("Bullet", parent=BODY, leftIndent=12, bulletIndent=2,
                        spaceAfter=2)
SMALL = ParagraphStyle("Small", parent=BODY, fontSize=9, leading=12,
                       textColor=INK_SOFT)
FOOTER_NAME = ParagraphStyle("FN", parent=BODY, fontName="Helvetica-Bold",
                             fontSize=10.5, leading=13, textColor=GREEN)


def p(t, s=BODY): return Paragraph(t, s)
def bullets(items):
    return ListFlowable(
        [ListItem(Paragraph(t, BULLET), leftIndent=8, value="bullet") for t in items],
        bulletType="bullet", start="circle",
        leftIndent=10, bulletFontSize=8,
    )


story = [
    p("Project Vuna", TITLE),
    p("A digital platform for credit, certified inputs, and parametric drought "
      "insurance — bundled and delivered to South African smallholder farmers "
      "through their cooperatives.", LEAD),

    p("The problem", H),
    p("Smallholders produce around 70&#37; of Sub-Saharan Africa&rsquo;s food yet "
      "receive less than 5&#37; of commercial bank lending. Crop-insurance "
      "penetration in Sub-Saharan Africa is below 3&#37;. One failed season "
      "wipes out a family. Inputs are unaffordable, often counterfeit, and "
      "middlemen capture 40&ndash;60&#37; of the final crop value."),

    p("The product", H),
    p("A registered farmer applies through her cooperative for a <b>Grow Pack</b> &mdash; "
      "a pre-configured bundle of certified seed, fertilizer, and a parametric "
      "drought policy. The cooperative reviews and approves. Suppliers deliver "
      "directly. At harvest, the cost is auto-deducted from sale proceeds. "
      "Each successful season builds a portable credit history."),

    p("Why we are reaching out", H),
    p("We do not seek to underwrite insurance. We seek a <b>licensed underwriting "
      "partner</b> who can issue the parametric crop policy while we provide:"),
    bullets([
        "Digital distribution into the smallholder market",
        "Cooperative-mediated KYC and on-the-ground trust",
        "Real-time data ingestion for parametric triggers",
        "Automated, transparent payout execution",
        "POPIA-compliant farmer data handling",
    ]),

    p("What we offer the underwriter", H),
    bullets([
        "A distribution channel into a market that is uneconomic to serve through brokers",
        "Lower per-policy operating cost via automated payouts",
        "Auditable, real-time policy and claims data",
        "Public-impact alignment for development-finance and ESG reporting",
    ]),

    p("Where we are", H),
    p("Hackathon-stage MVP for the Solana 2026 Frontier Hackathon. Complete "
      "product proposal, regulatory analysis (NCA, FAIS, FSCA, SARB, POPIA), "
      "and design mockups in hand. No real money deployed. We are speaking to "
      "a small number of South African agri-insurers before committing to an "
      "architecture."),

    p("Regulatory awareness", H),
    p("We understand that under the <b>FAIS Act</b> and the <b>Insurance Act 2017</b>, "
      "the parametric product must be underwritten by a licensed FSP and "
      "insurer. That is precisely why we are seeking a partner and not building "
      "this alone."),

    p("What we are asking for", H),
    p("A 30-minute introductory conversation in the next two weeks."),

    Spacer(1, 0.4 * cm),
    Table([[colors.HexColor("#0B3D2E")]],
          colWidths=[16 * cm], rowHeights=[1],
          style=TableStyle([("BACKGROUND", (0, 0), (-1, -1), RULE)])),
    Spacer(1, 0.2 * cm),

    p("<b>Tumo Mogame</b> &mdash; Founder, Project Vuna",
      FOOTER_NAME),
    p("[Email]&nbsp;&nbsp;&middot;&nbsp;&nbsp;[Phone]&nbsp;&nbsp;&middot;&nbsp;&nbsp;[LinkedIn]",
      SMALL),
]


doc = SimpleDocTemplate(
    OUTPUT, pagesize=A4,
    leftMargin=2 * cm, rightMargin=2 * cm,
    topMargin=1.6 * cm, bottomMargin=1.6 * cm,
    title="Vuna — One-page summary",
    author="Tumo Mogame",
)
doc.build(story)
print(f"Wrote {OUTPUT}")
