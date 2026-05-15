"""
Generates docs/Vuna_hackathon-presentation.pdf

Hackathon-judges + general-audience presentation. Covers:
  - The problem
  - The Grow Pack product
  - What's shipped (Phase 1)
  - Phase 2 — on-chain marketplace escrow (next iteration)
  - Governance (graduated trust)
  - Roadmap, tech stack, regulatory honesty

Visual style matches docs/outreach/Vuna_one-pager.pdf and the formal
proposal: green palette, Helvetica, A4 portrait. Single document,
multiple pages, page break per major section so judges can flip.

Run: python scripts/build_hackathon_presentation.py
"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_JUSTIFY, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    ListFlowable, ListItem, KeepTogether,
)
from reportlab.pdfgen import canvas

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT = os.path.join(ROOT, "docs", "Vuna_hackathon-presentation.pdf")

# ─── Palette (matches the brand: earthy green, gold accent) ──────────
GREEN = colors.HexColor("#0B3D2E")
GREEN_MID = colors.HexColor("#1F6B49")
GOLD = colors.HexColor("#E8B931")
INK = colors.HexColor("#111111")
INK_SOFT = colors.HexColor("#555555")
INK_FAINT = colors.HexColor("#888888")
CREAM = colors.HexColor("#F5F2EA")
RULE = colors.HexColor("#CFCAC0")

styles = getSampleStyleSheet()

COVER_TITLE = ParagraphStyle(
    "CoverTitle", parent=styles["Title"], fontName="Helvetica-Bold",
    fontSize=44, leading=50, alignment=TA_LEFT,
    spaceAfter=2, textColor=GREEN,
)
COVER_SUB = ParagraphStyle(
    "CoverSub", parent=styles["Normal"], fontName="Helvetica",
    fontSize=14, leading=18, alignment=TA_LEFT,
    spaceAfter=20, textColor=GREEN_MID,
)
COVER_TAG = ParagraphStyle(
    "CoverTag", parent=styles["Normal"], fontName="Helvetica-Oblique",
    fontSize=11, leading=16, alignment=TA_LEFT,
    spaceAfter=12, textColor=INK_SOFT,
)
COVER_META = ParagraphStyle(
    "CoverMeta", parent=styles["Normal"], fontName="Helvetica",
    fontSize=10, leading=14, alignment=TA_LEFT,
    spaceAfter=4, textColor=INK,
)
COVER_LABEL = ParagraphStyle(
    "CoverLabel", parent=styles["Normal"], fontName="Helvetica-Bold",
    fontSize=8, leading=11, alignment=TA_LEFT,
    spaceAfter=2, textColor=INK_FAINT,
)

H1 = ParagraphStyle(
    "H1", parent=styles["Heading1"], fontName="Helvetica-Bold",
    fontSize=20, leading=24, spaceBefore=0, spaceAfter=8,
    textColor=GREEN,
)
H2 = ParagraphStyle(
    "H2", parent=styles["Heading2"], fontName="Helvetica-Bold",
    fontSize=12, leading=16, spaceBefore=12, spaceAfter=4,
    textColor=GREEN_MID,
)
LEAD = ParagraphStyle(
    "Lead", parent=styles["Normal"], fontName="Helvetica",
    fontSize=11, leading=15, alignment=TA_LEFT,
    spaceAfter=10, textColor=INK_SOFT,
)
BODY = ParagraphStyle(
    "Body", parent=styles["BodyText"], fontName="Helvetica",
    fontSize=10, leading=14, alignment=TA_JUSTIFY,
    spaceAfter=6, textColor=INK,
)
BODY_LEFT = ParagraphStyle(
    "BodyLeft", parent=BODY, alignment=TA_LEFT,
)
BULLET = ParagraphStyle(
    "Bullet", parent=BODY_LEFT, leftIndent=12, bulletIndent=2,
    spaceAfter=3,
)
QUOTE = ParagraphStyle(
    "Quote", parent=BODY, fontName="Helvetica-Oblique",
    fontSize=10.5, leading=15, leftIndent=14, rightIndent=14,
    textColor=GREEN_MID, spaceAfter=10,
)
STAT_BIG = ParagraphStyle(
    "StatBig", parent=styles["Normal"], fontName="Helvetica-Bold",
    fontSize=24, leading=28, alignment=TA_LEFT,
    spaceAfter=0, textColor=GREEN,
)
STAT_LABEL = ParagraphStyle(
    "StatLabel", parent=styles["Normal"], fontName="Helvetica",
    fontSize=9, leading=12, alignment=TA_LEFT,
    spaceAfter=0, textColor=INK_SOFT,
)
SMALL = ParagraphStyle(
    "Small", parent=BODY, fontSize=9, leading=12,
    textColor=INK_SOFT,
)
FOOTNOTE = ParagraphStyle(
    "Footnote", parent=BODY, fontName="Helvetica-Oblique",
    fontSize=8.5, leading=11, alignment=TA_LEFT,
    spaceAfter=4, textColor=INK_FAINT,
)


def p(text, style=BODY):
    return Paragraph(text, style)


def bullets(items, style=BULLET):
    return ListFlowable(
        [ListItem(Paragraph(t, style), leftIndent=8, value="bullet") for t in items],
        bulletType="bullet", start="circle",
        leftIndent=12, bulletFontSize=7,
    )


def numbered(items):
    return ListFlowable(
        [ListItem(Paragraph(t, BULLET)) for t in items],
        bulletType="1", start="1",
        leftIndent=20, bulletFontSize=10,
    )


def stat_block(value, label):
    """Return a small flowable showing a big stat with a label below."""
    return Table(
        [[Paragraph(value, STAT_BIG)], [Paragraph(label, STAT_LABEL)]],
        colWidths=[5.5 * cm],
        style=TableStyle([
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]),
    )


def stat_row(stats):
    """A row of stat blocks side-by-side."""
    cells = [stat_block(v, l) for (v, l) in stats]
    cw = [17.5 / len(stats) * cm] * len(stats)
    return Table([cells], colWidths=cw, style=TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))


def green_table(headers, rows, col_widths=None):
    data = [headers] + rows
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("FONT", (0, 0), (-1, -1), "Helvetica", 9.5),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.5, RULE),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, RULE),
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
    """Footer with project name, doc title, page number — except cover."""
    if doc.page == 1:
        # Cover page: just a thin gold accent line at the top.
        canv.saveState()
        canv.setStrokeColor(GOLD)
        canv.setLineWidth(2)
        canv.line(2 * cm, A4[1] - 1.5 * cm, A4[0] - 2 * cm, A4[1] - 1.5 * cm)
        canv.restoreState()
        return

    canv.saveState()
    canv.setStrokeColor(RULE)
    canv.setLineWidth(0.4)
    canv.line(2 * cm, 1.6 * cm, A4[0] - 2 * cm, 1.6 * cm)

    canv.setFont("Helvetica", 8)
    canv.setFillColor(INK_FAINT)
    canv.drawString(
        2 * cm, 1.0 * cm,
        "Mazra'at albaan  |  Project Vuna  |  Solana 2026 Frontier Hackathon",
    )
    canv.drawRightString(A4[0] - 2 * cm, 1.0 * cm, f"Page {doc.page}")
    canv.restoreState()


# ──────────────────────────────────────────────────────────────────────
#  Build the story
# ──────────────────────────────────────────────────────────────────────
story = []

# ─── Cover ──────────────────────────────────────────────────────────
story += [
    Spacer(1, 5 * cm),
    p("MAZRA'AT", COVER_TITLE),
    p("ALBAAN", COVER_TITLE),
    Spacer(1, 0.4 * cm),
    p("Project Vuna", COVER_SUB),
    Spacer(1, 0.6 * cm),
    p("Credit, certified inputs, and parametric drought insurance — "
      "bundled and delivered to South African smallholder farmers "
      "through their cooperatives. On Solana.", COVER_TAG),
    Spacer(1, 5 * cm),
    p("HACKATHON", COVER_LABEL),
    p("Solana 2026 Frontier — Physical World Applications", COVER_META),
    Spacer(1, 0.3 * cm),
    p("AUTHOR", COVER_LABEL),
    p("Tumo Mogame", COVER_META),
    Spacer(1, 0.3 * cm),
    p("REPOSITORY", COVER_LABEL),
    p("github.com/TUMO-MOGAME/Solana-Based-Agricultural-Marketplace", COVER_META),
    p("solana-based-agricultural-marketpla.vercel.app", COVER_META),
    PageBreak(),
]

# ─── Page 2: The problem ─────────────────────────────────────────────
story += [
    p("The problem", H1),
    p("Africa's smallholders feed the continent — and they do it on the "
      "thinnest financial margin of any farmer category in the world.", LEAD),

    Spacer(1, 0.2 * cm),
    stat_row([
        ("70&#37;", "of Sub-Saharan Africa's food is grown by smallholders"),
        ("&lt;5&#37;", "of commercial bank lending reaches them"),
        ("&lt;3&#37;", "of crops are insured against weather risk"),
    ]),
    Spacer(1, 0.5 * cm),

    p("Five real things going wrong", H2),
    bullets([
        "<b>Credit is locked behind collateral they don't have.</b> "
        "No title deed, no nearby branch, no formal payslip means no loan — "
        "even when they've farmed the same land for thirty years.",

        "<b>Inputs are unaffordable, imported, and often counterfeit.</b> "
        "A farmer who pays for fake seed loses the entire season.",

        "<b>One drought wipes out a family.</b> "
        "There's no buffer — savings, insurance, or otherwise. "
        "Recovery takes years that the next season doesn't grant.",

        "<b>Middlemen capture 40&ndash;60&#37; of crop value.</b> "
        "Cash-on-delivery quotes at the gate are deliberately low. "
        "The farmer accepts because the alternative is the crop rotting.",

        "<b>Good farmers can't prove they're good.</b> "
        "Every season starts from zero. Lenders have no way to "
        "tell a reliable repayer from a first-time defaulter.",
    ]),
    PageBreak(),
]

# ─── Page 3: The product ─────────────────────────────────────────────
story += [
    p("The Grow Pack", H1),
    p("Our product is a single bundled offer farmers actually want to take: "
      "<b>credit + certified inputs + parametric drought cover</b>, "
      "repaid at harvest, sold through their cooperative.", LEAD),

    p("How a season looks for a farmer named Sipho", H2),
    numbered([
        "Sipho registers at his cooperative. The co-op vouches he is who he "
        "says he is.",
        "He <b>applies for a Grow Pack</b> through the app: 2 hectares of "
        "maize, drought cover, total around R 1,650.",
        "The cooperative approves it. <b>Suppliers deliver seed and fertilizer "
        "directly</b> to the depot. Sipho never handles cash for the inputs.",
        "<b>Drought cover goes live</b>. If rainfall in his area drops below "
        "an agreed threshold, the policy pays out automatically — no claim "
        "form, no investigator visit.",
        "At harvest, Sipho sells his maize. <b>The bundle cost plus a small "
        "service fee is auto-deducted</b> from the proceeds. He keeps the rest.",
        "His <b>credit history is portable</b>. Next season's offer is better "
        "because this season's was repaid.",
    ]),

    Spacer(1, 0.4 * cm),
    p("Three rules we never break", H2),
    bullets([
        "<b>Hide the chain.</b> Sipho never sees \"blockchain\", \"wallet\", "
        "\"USDC\", or \"Solana\". He sees Rand and his own language.",
        "<b>Mobile-first.</b> Built for a R 800 Android, often offline. "
        "Voice support for low-literacy users.",
        "<b>Cooperative as referee.</b> The trust isn't in the code — "
        "it's in the partner organisation Sipho already knows.",
    ]),
    PageBreak(),
]

# ─── Page 4: What we've shipped (Phase 1) ────────────────────────────
story += [
    p("What we've shipped", H1),
    p("Phase 1 is a working devnet demo with end-to-end integration "
      "between the on-chain program and a real farmer-facing dashboard.", LEAD),

    p("On-chain (Solana / Anchor / Rust)", H2),
    bullets([
        "<b>Six instructions</b> covering the full Grow Pack lifecycle: "
        "register_farmer, request_grow_pack, approve, disburse, "
        "trigger_insurance_payout, settle_repayment.",
        "<b>99 TypeScript tests + 44 Rust tests</b> (143 total) covering "
        "credit-score logic, pricing, parametric trigger tiers, "
        "harvest-settlement math, and the full end-to-end lifecycle "
        "in an in-process litesvm runtime.",
        "<b>Deployed to Solana devnet.</b> Real PDAs, real transactions, "
        "real on-chain reads from the dashboard.",
    ]),

    p("Farmer dashboard (Next.js, deployed on Vercel)", H2),
    bullets([
        "<b>Active</b> tab — current Grow Pack status, weather, "
        "credit history, voice-narrated daily summary.",
        "<b>Apply</b> tab — submit a Grow Pack request directly to "
        "devnet, signed by the connected wallet. Pre-flight check "
        "prevents duplicate seasonal packs.",
        "<b>Insurance</b> tab — drought-payout banner with rainfall "
        "tier visualisation. Voice-narrated payout announcement.",
        "<b>History</b> tab — past seasons (last three years) read "
        "from the chain, status pills, jump to detailed view.",
        "<b>Marketplace</b> tab — Phase 1 UI showing direct buyer "
        "offers (mills, retailers, brewers) with explicit "
        "&#43;X&#37;-vs-middleman comparison. Phase 2 escrow logic "
        "outlined in this document.",
        "<b>Wallet</b> connect for Phantom and Solflare via "
        "wallet-adapter-react. Persisted via Wallet Standard.",
    ]),

    p("Accessibility", H2),
    bullets([
        "<b>Voice playback (ElevenLabs).</b> Active-tab summary and "
        "drought-payout banner read aloud — designed for low-literacy "
        "farmers who'd rather hear than read. Streams progressively "
        "so playback starts within ~2 seconds.",
        "<b>Hide-the-chain.</b> Currency is Rand throughout. No "
        "wallet jargon in any farmer-facing copy.",
    ]),
    PageBreak(),
]

# ─── Page 5: Phase 2 — On-chain marketplace escrow ──────────────────
story += [
    p("Phase 2 — On-chain marketplace escrow", H1),
    p("Phase 1 shows direct-buyer prices. Phase 2 makes those matches "
      "<b>actually move money</b> safely between buyer and farmer.", LEAD),

    p("The story", H2),
    p("Sipho sees that Lebone Mills is buying maize at R 5,400/ton — "
      "around 28&#37; more than the local middleman pays. He taps "
      "<b>Match buyer</b> for 2 tons.", BODY),
    p("Lebone Mills receives the match request and <b>locks R 10,800</b> "
      "(2 tons &times; R 5,400) into a holding pool that neither side "
      "can pull back unilaterally. Sipho can see the funds are committed.", BODY),
    p("Sipho harvests, delivers to the mill. The cooperative officer "
      "opens the co-op app and confirms: <b>\"Yes, Sipho delivered 2 "
      "tons of maize on October 12.\"</b>", BODY),
    p("That confirmation triggers automatic release. <b>R 10,800 lands "
      "in Sipho's account within minutes</b> &mdash; not 30 days, not "
      "60 days, not after a phone call begging for payment.", BODY),

    p("What this fixes — for both sides", H2),
    bullets([
        "<b>Sipho can't be scammed at the gate.</b> The price is locked "
        "the moment the buyer commits. No \"actually I'll pay R 4,200\" "
        "at the truck.",
        "<b>Lebone Mills can't be scammed either.</b> Funds only move "
        "after the cooperative confirms the maize arrived.",
        "<b>The cooperative becomes a referee, not a collector.</b> "
        "They already know Sipho. The app turns their trust into a "
        "single tap that moves real money.",
        "<b>No 30-90 day payment lag.</b> Working capital, on time. "
        "That alone changes whether a smallholder survives the next "
        "input cycle.",
    ]),
    PageBreak(),
]

# ─── Page 6: Governance ──────────────────────────────────────────────
story += [
    p("Governance — graduated trust", H1),
    p("Code that holds money has to be honest about who can change "
      "the rules and when. Our plan tightens control as real money "
      "starts flowing — never the other way around.", LEAD),

    p("Three stages of control", H2),
    green_table(
        ["Stage", "Who can change rules", "Why this is right"],
        [
            ["Hackathon (now)",
             "Authors only — single signing key",
             "No real money at stake. Speed of iteration matters more than rule stability."],
            ["Pilot v1 (50&ndash;200 farmers, 2027)",
             "<b>Multisig:</b> at least 2 of [authors, auditor, cooperative leads]",
             "Real money is starting to flow. No one party can change rules unilaterally."],
            ["Production (regional, 2028+)",
             "<b>DAO:</b> farmers, cooperatives, and partners vote on changes",
             "Trust scales with the user base. Eventually, no one has unilateral upgrade power."],
        ],
        col_widths=[3.5 * cm, 5.5 * cm, 8.5 * cm],
    ),

    Spacer(1, 0.5 * cm),
    p("The two non-negotiables", H2),
    bullets([
        "<b>Old deals always keep old rules.</b> If a buyer locks "
        "R 10,000 under the rule \"release in 30 days\", and we later "
        "change the default to 45, the original R 10,000 still "
        "releases on day 30. New rules apply only to <i>new</i> "
        "commitments.",

        "<b>Rule changes are announced, never silent.</b> Every farmer "
        "and buyer using the platform sees what changed before the "
        "change goes live. Quiet upgrades are how trust dies.",
    ]),

    p("Why this matters", H2),
    p("Smallholder farmers have been burned by unilateral changes "
      "before — by lenders who hike rates mid-loan, by buyers who "
      "haggle down at the gate, by regulators who change subsidies "
      "without notice. The graduated-trust governance is the part "
      "of Phase 2 that says <i>we're not building another tool that "
      "can be turned against you</i>. The code has to prove it.", BODY),
    PageBreak(),
]

# ─── Page 7: Roadmap + what we're NOT building ──────────────────────
story += [
    p("Roadmap", H1),
    p("Slow, careful, honest scaling. Each step proves a hypothesis "
      "before the next one is funded.", LEAD),

    green_table(
        ["Phase", "Window", "Goal"],
        [
            ["Hackathon",
             "6 weeks (now)",
             "Working devnet demo, end-to-end. 5&ndash;10 simulated farmers."],
            ["Pilot v1",
             "H1 2027",
             "50&ndash;200 real farmers, one province, one crop. Target <b>60&ndash;80&#37; repayment</b> &mdash; not 95&#37;."],
            ["Pilot v2",
             "H2 2027",
             "Second province, second crop. Reinsurance partnership begins. Phase 2 escrow live with multisig governance."],
            ["Regional",
             "2028+",
             "Zambia and Kenya through Superteam Africa. Multi-currency settlement. DAO governance launch."],
        ],
        col_widths=[2.8 * cm, 2.8 * cm, 11.9 * cm],
    ),

    Spacer(1, 0.5 * cm),
    p("What we are deliberately NOT building", H2),
    bullets([
        "<b>A supply chain</b> &mdash; we partner with existing certified-seed "
        "and fertilizer suppliers.",
        "<b>Logistics</b> &mdash; suppliers fulfil through their own channels.",
        "<b>An underwriting fund</b> &mdash; we pair with a licensed insurer or "
        "DeFi pool. We are not the balance sheet.",
        "<b>A new payments rail</b> &mdash; settlement is in stablecoin, then "
        "reconciled to Rand via existing on/off-ramps and PayShap.",
    ]),

    p("Failure modes we plan against, not around", H2),
    bullets([
        "Cooperatives never sign on &rarr; outreach starts week one, not month six.",
        "Repayment crashes below 50&#37; &rarr; conservative loan size, group lending fallback.",
        "Climate wipes out the pool &rarr; reinsurance partner before it grows beyond R 1m.",
        "Regulatory action &rarr; no retail solicitation pre-licence.",
        "Smart-contract exploit &rarr; audit before mainnet, bounty programme.",
    ]),
    PageBreak(),
]

# ─── Page 8: Tech stack + regulatory honesty ────────────────────────
story += [
    p("Tech stack", H1),

    green_table(
        ["Layer", "Tool", "Why this one"],
        [
            ["Blockchain",
             "Solana (devnet now, mainnet for pilot)",
             "Sub-cent fees, sub-second finality, the right ecosystem for African mobile-first work."],
            ["Smart contracts",
             "Anchor (Rust)",
             "Standard Solana framework, audit-friendly, mature toolchain."],
            ["Oracle",
             "TBD (alternative to Pyth)",
             "Pyth has no weather data &mdash; we are evaluating Switchboard custom feeds and direct meteo APIs."],
            ["Frontend",
             "Next.js + Tailwind (App Router, React 19)",
             "Fast to ship, good wallet adapters, Vercel deployment."],
            ["Wallet",
             "Phantom / Solflare (now), Magic.link or Privy (production)",
             "Custodial in production so the farmer never sees a seed phrase."],
            ["Voice",
             "ElevenLabs (Flash v2.5)",
             "Low-latency multilingual TTS; we are auditing isiZulu and isiXhosa quality."],
            ["Backend / DB",
             "Supabase (Postgres + Auth)",
             "Fastest path to working auth + KYC storage. Replace with proprietary stack if scale demands it."],
            ["Hosting",
             "Vercel + Supabase",
             "Cheap, fast, low ops &mdash; right for early stage."],
        ],
        col_widths=[3 * cm, 4.5 * cm, 10 * cm],
    ),

    Spacer(1, 0.4 * cm),
    p("Regulatory — South Africa", H2),
    p("These are non-negotiable. We are designing for compliance from "
      "day one, not retrofitting it after a headline.", BODY),
    bullets([
        "<b>National Credit Act</b> &mdash; NCR registration to lend.",
        "<b>FAIS</b> &mdash; FSP licence to sell insurance product.",
        "<b>FSCA / CASP framework</b> &mdash; licence to handle crypto.",
        "<b>SARB Exchange Control 2026</b> &mdash; approval before any "
        "cross-border crypto flow.",
        "<b>POPIA</b> &mdash; strict farmer-data handling. R 10m fine on breach.",
        "<b>Insurance Act 2017</b> &mdash; parametric insurance still requires "
        "a licensed underwriter.",
    ]),
    p("We hold these licences ourselves <i>or</i> partner with a holder. "
      "There are no shortcuts.", FOOTNOTE),
    PageBreak(),
]

# ─── Page 9: Closing / call to action ───────────────────────────────
story += [
    p("What we're looking for", H1),
    p("This stage of the project is partnership-bound. The hardest "
      "problems are off-chain — trust, distribution, and licence "
      "coverage — and we want partners on each.", LEAD),

    p("Three asks", H2),
    bullets([
        "<b>A licensed agri-insurer</b> willing to underwrite the parametric "
        "drought policy embedded in each Grow Pack. We bring distribution, "
        "onboarding, data, and automated payout execution. They bring the "
        "licence and the balance sheet. We have a draft product brief ready.",

        "<b>A cooperative pilot partner</b> &mdash; one province, one crop, "
        "50&ndash;200 farmers. We provide the technology, training, and "
        "support. The cooperative provides KYC, trust, and the human layer "
        "we cannot automate.",

        "<b>An audit partner</b> for the on-chain code before any real "
        "Rand flows. Phase 2 escrow goes nowhere near mainnet without it.",
    ]),

    Spacer(1, 0.4 * cm),
    p("Closing thought", H2),
    p("Smallholders grow most of the food in our country and on our continent. "
      "They get under five percent of the credit. The gap is not a market "
      "failure &mdash; it's a distribution and trust failure. Mazra'at albaan "
      "closes a slice of it with software that the farmer never has to "
      "understand to benefit from.", QUOTE),

    Spacer(1, 0.4 * cm),
    p("Contact", H2),
    p("Tumo Mogame", BODY_LEFT),
    p("emma.m.strategy@gmail.com", BODY_LEFT),
    p("github.com/TUMO-MOGAME/Solana-Based-Agricultural-Marketplace", BODY_LEFT),
    p("solana-based-agricultural-marketpla.vercel.app", BODY_LEFT),
]


# ──────────────────────────────────────────────────────────────────────
#  Render
# ──────────────────────────────────────────────────────────────────────
def main():
    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    doc = SimpleDocTemplate(
        OUTPUT, pagesize=A4,
        leftMargin=2 * cm, rightMargin=2 * cm,
        topMargin=2 * cm, bottomMargin=2 * cm,
        title="Mazra'at albaan — Hackathon presentation",
        author="Tumo Mogame",
    )
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
