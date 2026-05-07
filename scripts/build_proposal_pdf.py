"""
Generates docs/proposal.pdf
Authors: Tumo Mogame & Pitsi Kgaume
Run from anywhere: `python scripts/build_proposal_pdf.py`
"""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_JUSTIFY, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    KeepTogether, ListFlowable, ListItem
)
from reportlab.pdfgen import canvas
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT = os.path.join(ROOT, "docs", "proposal.pdf")

# ---------- styles ----------
styles = getSampleStyleSheet()

TITLE = ParagraphStyle(
    "Title", parent=styles["Title"], fontName="Helvetica-Bold",
    fontSize=24, leading=30, alignment=TA_CENTER, spaceAfter=14,
    textColor=colors.HexColor("#0B3D2E"),
)
SUBTITLE = ParagraphStyle(
    "Subtitle", parent=styles["Normal"], fontName="Helvetica",
    fontSize=13, leading=18, alignment=TA_CENTER, spaceAfter=6,
    textColor=colors.HexColor("#444444"),
)
AUTHOR = ParagraphStyle(
    "Author", parent=styles["Normal"], fontName="Helvetica-Oblique",
    fontSize=11, leading=14, alignment=TA_CENTER, spaceAfter=4,
    textColor=colors.HexColor("#222222"),
)
H1 = ParagraphStyle(
    "H1", parent=styles["Heading1"], fontName="Helvetica-Bold",
    fontSize=16, leading=20, spaceBefore=18, spaceAfter=8,
    textColor=colors.HexColor("#0B3D2E"),
)
H2 = ParagraphStyle(
    "H2", parent=styles["Heading2"], fontName="Helvetica-Bold",
    fontSize=12.5, leading=16, spaceBefore=12, spaceAfter=4,
    textColor=colors.HexColor("#1F4E3D"),
)
BODY = ParagraphStyle(
    "Body", parent=styles["BodyText"], fontName="Helvetica",
    fontSize=10.5, leading=15, alignment=TA_JUSTIFY, spaceAfter=8,
    textColor=colors.HexColor("#111111"),
)
BULLET = ParagraphStyle(
    "Bullet", parent=BODY, leftIndent=14, bulletIndent=2, spaceAfter=4,
)
QUOTE = ParagraphStyle(
    "Quote", parent=BODY, fontName="Helvetica-Oblique",
    leftIndent=20, rightIndent=20, textColor=colors.HexColor("#333333"),
    spaceBefore=6, spaceAfter=10,
)
SMALL = ParagraphStyle(
    "Small", parent=BODY, fontSize=9, leading=12,
    textColor=colors.HexColor("#444444"),
)

# ---------- helpers ----------
def p(text, style=BODY):
    return Paragraph(text, style)

def bullets(items, style=BULLET):
    return ListFlowable(
        [ListItem(Paragraph(t, style), leftIndent=8, value="bullet") for t in items],
        bulletType="bullet", start="circle",
        leftIndent=12, bulletFontSize=9,
    )

def numbered(items, style=BULLET):
    return ListFlowable(
        [ListItem(Paragraph(t, style)) for t in items],
        bulletType="1", start="1",
        leftIndent=18, bulletFontSize=10,
    )

def table(data, col_widths=None, header=True):
    t = Table(data, colWidths=col_widths, repeatRows=1 if header else 0)
    style = [
        ("FONT", (0, 0), (-1, -1), "Helvetica", 9.5),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#888888")),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#BBBBBB")),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    if header:
        style += [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0B3D2E")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 10),
        ]
    t.setStyle(TableStyle(style))
    return t

def wrap_cells(rows):
    """Wrap every cell in a Paragraph so long text breaks cleanly."""
    cell_style = ParagraphStyle("c", parent=BODY, fontSize=9, leading=12, spaceAfter=0, alignment=TA_LEFT)
    return [[Paragraph(str(c), cell_style) for c in r] for r in rows]

# ---------- page footer (page numbers) ----------
def on_page(canv: canvas.Canvas, doc):
    canv.saveState()
    canv.setFont("Helvetica", 8)
    canv.setFillColor(colors.HexColor("#666666"))
    canv.drawString(2 * cm, 1.2 * cm, "Project Vuna  |  Tumo Mogame & Pitsi Kgaume")
    canv.drawRightString(A4[0] - 2 * cm, 1.2 * cm, f"Page {doc.page}")
    canv.restoreState()

# ---------- build content ----------
story = []

# Cover
story += [
    Spacer(1, 4 * cm),
    p("Project Vuna", TITLE),
    p("A Solana-Based Agricultural Marketplace for South African Smallholder Farmers", SUBTITLE),
    Spacer(1, 0.6 * cm),
    p("Hackathon Proposal &amp; Build Plan", SUBTITLE),
    Spacer(1, 2.5 * cm),
    p("Authors: Tumo Mogame &amp; Pitsi Kgaume", AUTHOR),
    p(f"Date: {date.today().strftime('%d %B %Y')}", AUTHOR),
    p("Built for the Solana 2026 Frontier Hackathon &mdash; Physical World Applications track", AUTHOR),
    Spacer(1, 3 * cm),
    p(
        "<i>&ldquo;Vuna&rdquo; means &ldquo;harvest&rdquo; in isiZulu and isiXhosa. "
        "This document is intentionally honest. We do not promise a unicorn. "
        "We propose a real, slow, compounding piece of agricultural infrastructure, "
        "and we are clear about what could kill it.</i>",
        QUOTE,
    ),
    PageBreak(),
]

# 1. Executive Summary
story += [
    p("1. Executive Summary", H1),
    p(
        "Project Vuna is a Solana-based agricultural marketplace that gives South African smallholder farmers "
        "access to a single bundled service &mdash; certified seeds, fertilizer, and parametric crop insurance &mdash; "
        "delivered on credit and repaid at harvest. We borrow the proven bundled-service model pioneered by "
        "Apollo Agriculture (Kenya) and rebuild it on Solana to (a) lower per-loan transaction overhead so we can "
        "serve the smallest farmers profitably, (b) automate insurance payouts via on-chain weather oracles, and "
        "(c) build portable, verifiable credit histories that follow the farmer across lenders and borders.",
    ),
    p(
        "This document is deliberately blunt about what we can and cannot achieve. For the hackathon we will build "
        "a working prototype on Solana devnet that demonstrates the end-to-end flow. Building a real production "
        "system that touches real farmers&rsquo; livelihoods is a multi-year effort that requires partnerships, "
        "regulatory licensing, lending capital, and field presence we do not yet have. We separate those two "
        "tracks throughout this document.",
    ),
    p(
        "We are not selling a dream. We are proposing a piece of agricultural infrastructure that could matter "
        "if &mdash; and only if &mdash; we survive the hard, slow, off-chain work that the blockchain does not solve "
        "for us.",
    ),
]

# 2. The Problems
story += [
    p("2. The Problems We Are Solving", H1),
    p(
        "The source research paper identifies a financing gap of US$75bn&ndash;US$200bn per year in Sub-Saharan "
        "African agriculture. That headline number is real, but it hides five distinct problems that compound on "
        "each other. Each one needs to be named.",
    ),

    p("2.1  The financing gap that traps farmers in subsistence", H2),
    p(
        "Smallholder farmers produce roughly 70% of Sub-Saharan Africa&rsquo;s food, yet receive less than 5% of "
        "total commercial bank lending. In practical terms: a farmer in the Eastern Cape who could triple her "
        "yield with certified seeds and fertilizer cannot get a loan, because she has no formal collateral, no "
        "credit history, and no bank branch within reasonable distance. Yields stay low. She sells at the worst "
        "moment of the market because she cannot afford to wait. Next season starts the same way.",
    ),

    p("2.2  Inputs are expensive, imported, and shock-prone", H2),
    p(
        "About 80% of fertilizer used in Sub-Saharan Africa is imported. The 2026 disruptions in the Strait of "
        "Hormuz have already pushed prices up. Even when farmers can afford inputs, they often buy adulterated or "
        "counterfeit seeds from informal traders. Counterfeit-seed studies in East Africa have found rejection "
        "rates above 30% in some regions. A farmer who plants fake seed loses the entire season.",
    ),

    p("2.3  One bad season wipes the farmer out", H2),
    p(
        "Without insurance, a single drought, pest outbreak, or unseasonal frost means default, hunger, and "
        "selling productive assets to survive. Crop-insurance penetration in Sub-Saharan Africa is below 3%. "
        "Traditional indemnity insurance is too expensive to underwrite for small policies, and the claims process "
        "is too slow to matter when a family is hungry now.",
    ),

    p("2.4  Middlemen capture most of the margin", H2),
    p(
        "Smallholders typically sell to aggregators at the farm gate at prices well below the urban wholesale "
        "rate. They have no real-time price information, no storage to wait for better prices, and no direct "
        "access to formal market channels. Estimates from a number of African staple-crop value chains suggest "
        "intermediaries capture 40&ndash;60% of the final consumer value.",
    ),

    p("2.5  No portable credit history", H2),
    p(
        "Even if a farmer succeeds for five seasons in a row, that record exists nowhere a future lender can "
        "see. Each new loan application starts from zero. There is no rural-informal equivalent of a credit "
        "score. Years of good behaviour produce no compounding benefit.",
    ),
]

# 3. Why this matters
story += [
    p("3. Why This Actually Matters", H1),
    p(
        "This is a livelihoods problem, not a payments problem. The case for working on it does not rest on the "
        "blockchain story; it rests on the development one.",
    ),
    bullets([
        "Roughly 60% of South Africa&rsquo;s poor live in rural areas. Rural economies are where the poverty actually is.",
        "Food inflation in Sub-Saharan Africa is consistently higher than headline inflation. That gap is paid by the poor.",
        "Rural youth unemployment in South Africa exceeds 60%. Without functional rural economies, urban-migration pressure on Johannesburg, Cape Town, and Durban worsens, and so does crime and infrastructure strain.",
        "Climate change is shortening the planning cycle. Drought years that used to come every seven now come every three or four. Risk-bearing capacity at the smallholder level is gone.",
        "Sub-Saharan Africa imports ~US$50bn of food annually. Productivity at the smallholder level is the most direct path to reducing that bill.",
    ]),
    p(
        "If you make smallholder farming bankable, you simultaneously address food security, rural employment, "
        "urban-migration pressure, and climate adaptation. That makes it one of the highest-leverage "
        "interventions available in African development. It is also one of the hardest.",
    ),
]

# 4. The proposed solution
story += [
    p("4. The Proposed Solution &mdash; How Vuna Works", H1),
    p(
        "Vuna is a mobile-first marketplace built on Solana. The user-facing flow is deliberately boring &mdash; "
        "the farmer never needs to know what a wallet is or what a stablecoin is.",
    ),
    p("4.1  The farmer journey", H2),
    numbered([
        "A farmer registers via a partner cooperative or extension officer. KYC is light-touch and field-mediated.",
        "She submits a planting plan: crop, hectares, region, expected planting date.",
        "Vuna matches her to a <b>Grow Pack</b> &mdash; a bundled smart contract that locks credit denominated in USDC (or a ZAR-pegged stablecoin once one is available with regulatory clarity).",
        "The credit is paid directly to <b>vetted suppliers</b> for certified seeds, fertilizer, and a parametric weather-insurance policy. The farmer never touches the cash.",
        "Pyth oracles feed regional weather data on-chain. If rainfall in her grid square falls below a defined threshold for a defined window, the smart contract <b>auto-pays out</b> a percentage of the loan to the farmer&rsquo;s account.",
        "At harvest, the farmer sells through a marketplace partner (cooperative or aggregator). An automated deduction repays the loan from sale proceeds. The farmer keeps the surplus.",
        "The full transaction history &mdash; inputs received, weather events, harvest, repayment &mdash; builds a portable, on-chain credit record tied to her wallet. Future lenders can read it without re-onboarding her.",
    ]),
    p("4.2  What is novel here", H2),
    p(
        "The bundled-service model is not new &mdash; Apollo Agriculture, Pula, and ThriveAgric have proven it. "
        "What Solana adds is three specific things:",
    ),
    bullets([
        "<b>Cost floor.</b> Solana fees of well under one cent per transaction make it economically viable to issue Grow Packs to the very smallest farmers, where traditional MFI origination cost (US$20&ndash;50) makes a US$200 loan impossible.",
        "<b>Instant insurance.</b> Parametric, oracle-triggered payouts go out in seconds, not months. That is the difference between recovering and losing the farm.",
        "<b>Portable credit history.</b> An on-chain record can be read by any lender. A farmer who repays three loans on Vuna can be approved by a European agricultural impact fund without re-applying. Today, her history dies with the lender.",
    ]),
    p("4.3  What Vuna is <b>not</b> building", H2),
    p(
        "Scope discipline is the difference between a project that ships and a project that doesn&rsquo;t. We are "
        "explicitly not building any of the following ourselves:",
    ),
    bullets([
        "A supply chain &mdash; we partner with existing seed and fertilizer suppliers.",
        "A logistics network &mdash; suppliers fulfill orders through their existing channels.",
        "An underwriting fund &mdash; we connect to existing DeFi pools and / or partner lenders.",
        "A general-purpose blockchain &mdash; we use Solana.",
        "A new payments rail &mdash; we settle in USDC and reconcile to ZAR via existing on/off-ramps and PayShap once licensed.",
    ]),
]

# 5. Technical architecture
story += [
    p("5. Technical Architecture", H1),
    p("5.1  On-chain (Solana / Anchor)", H2),
    bullets([
        "<b>FarmerAccount PDA</b> &mdash; stores farmer ID hash, region, crop history hash, repayment record, current credit score.",
        "<b>GrowPack instruction</b> &mdash; locks credit, registers insurance policy parameters (threshold, window, payout percentage), records linked supplier addresses.",
        "<b>OracleCheck cron</b> &mdash; off-chain crank reads Pyth weather feed at policy expiry, calls payout instruction if threshold breached.",
        "<b>Repayment instruction</b> &mdash; deducts from sale proceeds, updates credit history, marks pack closed.",
        "<b>CreditScore view</b> &mdash; deterministic function of on-chain history; queryable by other programs and external lenders.",
    ]),
    p("5.2  Off-chain", H2),
    bullets([
        "Mobile-first frontend (Next.js PWA for hackathon, React Native for production).",
        "Custodial / abstracted wallet so the farmer never sees a seed phrase. Magic.link or a similar embedded-wallet provider for production.",
        "USSD bridge for feature-phone farmers &mdash; <b>not in MVP</b>, but on the roadmap because realistic reach in rural SA requires it.",
        "Backend service in Node.js for farmer registration, supplier inventory, marketplace listings, and reconciliation reporting to SARS / FSCA.",
        "PostgreSQL (Supabase) for non-critical data; IPFS / Arweave for supporting documents.",
    ]),
    p("5.3  Tech stack summary", H2),
    table(wrap_cells([
        ["Layer", "Choice", "Why"],
        ["Blockchain", "Solana", "Sub-cent fees, sub-second finality (Alpenglow), strong RWA and stablecoin tooling, hackathon target."],
        ["Smart contracts", "Anchor (Rust)", "Standard for Solana, well-documented, Tumo and Pitsi can ramp on it."],
        ["Oracle", "Pyth Network", "Native to Solana, weather feeds available, low latency."],
        ["Frontend (MVP)", "Next.js + Tailwind", "Fastest path to a credible demo. Solid wallet adapter ecosystem."],
        ["Frontend (prod)", "React Native PWA", "Real reach to mobile users; offline-first sync."],
        ["Wallet UX", "Phantom (demo) / Magic.link (prod)", "Demo can use Phantom; production must abstract crypto away entirely."],
        ["Stablecoin", "USDC (demo); ZAR-pegged once available", "USDC is most liquid; ZAR-pegged removes FX exposure for the farmer."],
        ["Backend", "Node.js + Express", "Speed of development."],
        ["Database", "PostgreSQL via Supabase", "Auth, storage, realtime included."],
        ["Hosting", "Vercel + Railway", "Cheap, fast, minimal ops."],
    ]), col_widths=[3 * cm, 4.5 * cm, 9 * cm]),
]

# 6. Advantages
story += [
    PageBreak(),
    p("6. Advantages of Building This on Solana", H1),
    p(
        "We are biased toward this stack, so we are going to be specific rather than vague.",
    ),
    numbered([
        "<b>Unit economics.</b> Solana fees of &lt;US$0.01 per transaction vs. US$20&ndash;50 origination cost in a traditional MFI. This is the single biggest reason a US$150 loan is viable on Vuna and not at a bank.",
        "<b>Settlement speed.</b> Alpenglow consensus brings finality to 100&ndash;150ms. Insurance payouts and supplier payments clear in seconds, not days.",
        "<b>Programmable insurance.</b> Parametric (rule-based) policies via oracles are dramatically cheaper to operate than traditional indemnity insurance, because there is no claims-adjuster step.",
        "<b>Composability.</b> A Vuna credit history is readable by any other Solana program or any lender that integrates. We do not own the farmer&rsquo;s data; she does. This makes it easier for follow-on lenders to take her on.",
        "<b>Auditability.</b> Every disbursement, every voucher, every repayment is publicly verifiable. This is attractive to donors, impact investors, and regulators &mdash; all of whom we will need.",
        "<b>Cross-border capital pools.</b> Solana RWA lending pools have surpassed US$1.2bn. This is global liquidity that has historically never reached an Eastern Cape farmer. Even capturing a fraction of it is meaningful.",
        "<b>Hackathon alignment.</b> The Solana 2026 Frontier Hackathon has explicit tracks for Physical World Applications and DeFi / Financial Infrastructure. Vuna fits both, which improves our chance of mentorship and prize capital.",
    ]),
]

# 7. Disadvantages and limitations - the honest section
story += [
    p("7. Disadvantages and Honest Limitations", H1),
    p(
        "This is the section most pitch decks skip. We are putting it before the build plan on purpose. If any "
        "of these break us, we want to know now.",
    ),
    numbered([
        "<b>Crypto on-ramp friction.</b> The farmer must never see a seed phrase, a wallet address, or the word &ldquo;blockchain&rdquo;. Abstracting that is solvable but adds engineering burden &mdash; and a custodial wallet means we are responsible for key management, with all the regulatory weight that brings.",
        "<b>FX and stablecoin risk.</b> USDC is dollar-pegged; the farmer earns and spends Rand. Currency conversion exposure is real and can wipe out a season&rsquo;s margin. ZAR-pegged stablecoins exist but have thin liquidity and unclear regulatory footing.",
        "<b>The oracle problem is not solved.</b> Pyth gives us weather data. It does <b>not</b> tell us whether the farmer&rsquo;s harvest happened, whether seeds were planted, whether fertilizer was applied to the right field, or whether the produce sold was actually grown by her. Ground-truth verification is the hardest part of this entire system, and Solana does not solve it for us. We need field officers, cooperative validation, photo / GPS attestations &mdash; all off-chain.",
        "<b>Default risk without enforceable collateral.</b> If a farmer defaults, what do we do? Customary land cannot be foreclosed in any practical sense. Apollo Agriculture relies on group lending, social collateral, and cooperative-level enforcement. We will need the same. <b>The blockchain does not enforce repayment.</b>",
        "<b>Connectivity.</b> Rural Eastern Cape and Limpopo have patchy 3G/4G. Our app must be offline-first with sync, or accessible via SMS/USSD. That is a real engineering effort, not a checkbox.",
        "<b>Smartphone penetration.</b> Roughly 60% of South Africans have smartphones; among rural smallholders the share is lower. USSD reach is essential for production but will not exist in the hackathon MVP.",
        "<b>Crypto stigma.</b> Mirror Trading International (US$1.7bn collapse), Africrypt, and other South African scams have left the public rightly skeptical. Branding must lead with &ldquo;agricultural finance&rdquo;, never with &ldquo;crypto&rdquo; or &ldquo;blockchain&rdquo;.",
        "<b>Regulatory cost.</b> To operate in production we must be a Crypto Asset Service Provider (CASP) under the FAIS Act. Application is non-trivial, ongoing compliance is expensive, and the 2026 exchange-control rules add a 30-day reporting requirement on cross-border transfers. Penalties for non-compliance now include up to five years&rsquo; jail and compulsory surrender of digital assets.",
        "<b>Capital cost.</b> We do not own a lending pool. For the hackathon we simulate it. For production we must either raise it, partner with an existing MFI, or bridge to DeFi &mdash; each path has tradeoffs we have not yet resolved.",
        "<b>Existing competition.</b> Apollo Agriculture, Pula, ThriveAgric, HelloChoice, and Khula are real and well-funded. None are on Solana, but they have farmer relationships and supplier networks we will spend years building. Our edge has to be specific (cost, instant insurance, portable history) and defensible &mdash; not just &ldquo;same thing on a blockchain&rdquo;.",
    ]),
]

# 8. Challenges
story += [
    p("8. Challenges We Will Hit, in Rough Order of Severity", H1),
    p("The list above is structural. The list below is operational. These are the things most likely to kill us.",),
    numbered([
        "<b>Trust building takes years, not weeks.</b> No farmer accepts a loan from an unknown app. The path to the farmer goes through cooperatives, NGOs, and extension officers. That trust is earned slowly through presence on the ground. We do not yet have it.",
        "<b>Unit economics may not hold.</b> Even with cheap Solana fees, customer-acquisition cost, KYC, fraud monitoring, and supplier vetting are real expenses. We must model this with conservative defaults before we deploy a single Rand of real capital.",
        "<b>Fraud will happen.</b> Fake farmers. Ghost harvests. Collusion with suppliers. Phantom GPS coordinates. Even Apollo Agriculture, with field officers, struggles. We will struggle more.",
        "<b>Partner dependency.</b> We rely on cooperatives, suppliers, and possibly off-takers. Any of them can change terms or pull out and break our flow.",
        "<b>Regulatory shift.</b> South Africa&rsquo;s crypto stance could tighten further. The 2026 framework is already strict; a 2027 framework that is more restrictive is plausible.",
        "<b>Climate event in pilot region.</b> One bad season wipes out our pool faster than premiums recover. Reinsurance is not optional once we cross a threshold.",
        "<b>Team bandwidth.</b> Two founders building part-time will move slowly. The window between an exciting pilot and capital running out is unforgiving.",
        "<b>Smart contract risk.</b> A bug in a financial contract is irreversible by design. We must audit before mainnet and run a bug-bounty before serving real users.",
    ]),
]

# 9. Realistic outcomes
story += [
    p("9. What Success Looks Like &mdash; Realistic Version", H1),
    p("9.1  Hackathon (3&ndash;8 weeks)", H2),
    bullets([
        "A working demo on Solana devnet, end-to-end.",
        "Smart contracts that mint a Grow Pack, hold credit, trigger oracle-based insurance, and accept repayment.",
        "A frontend a judge can walk through as a farmer would.",
        "5&ndash;10 simulated farmers and one mock cooperative partner.",
        "A clear, defensible pitch and a roadmap that does not over-promise.",
    ]),
    p("9.2  Year 1 (if we win or get seed funding)", H2),
    bullets([
        "Live pilot with one cooperative in one province (likely Eastern Cape or KZN).",
        "50&ndash;200 farmers, one crop (likely maize).",
        "US$50k&ndash;US$200k in deployed credit.",
        "Active CASP licence application with the FSCA.",
        "Real partnership with one seed and one fertilizer supplier.",
        "<b>60&ndash;80% repayment rate</b> in year 1. Banks would consider this poor; for previously unbanked smallholders it is reasonable for a first cohort.",
    ]),
    p("9.3  Year 2&ndash;3 (if year 1 works)", H2),
    bullets([
        "1,000&ndash;5,000 farmers, 2&ndash;3 provinces, multiple crops.",
        "Possible expansion to Zambia or Kenya through existing Solana hubs.",
        "On-chain credit history attracts second-round impact lenders, lowering our cost of capital.",
        "Full CASP licence in place; reconciliation pipe to SARS automated.",
    ]),
    p("9.4  Year 5+", H2),
    bullets([
        "A meaningful regional player &mdash; <b>only</b> if we have survived year 1, year 2, and at least one bad climate year.",
        "Real impact: thousands of farmers with verifiable credit, lower input costs, faster insurance, higher yields.",
        "This is not a Series A unicorn pitch. It is development infrastructure that compounds slowly. Most of the value is in year 5, not year 1.",
    ]),
]

# 10. Failure modes
story += [
    p("10. What Failure Could Look Like", H1),
    p("Every project this ambitious has a few failure modes. We list ours so we can plan against them, not to be dramatic.",),
    table(wrap_cells([
        ["Failure mode", "How it happens", "What we do about it"],
        ["No real cooperative partner",
         "MVP wins the hackathon, no co-op signs on, project dies in Q3.",
         "Begin co-op outreach in week 1 of the build, not after the demo. Have at least three live conversations before submission."],
        ["Repayment collapse",
         "First cohort comes in at 30% repayment. Follow-on capital does not arrive. We close.",
         "Group lending, social collateral, conservative loan sizing, very small first cohort."],
        ["Climate wipeout",
         "A regional drought hits, pool exhausted, no reinsurance, claims unpaid, lawsuits.",
         "Pre-arrange a reinsurance partner before pool exceeds US$50k. Cap exposure per region."],
        ["Regulatory action",
         "Flagged for unlicensed financial-services activity before CASP licence is granted. Personal liability under 2026 exchange-control rules.",
         "Legal review before any retail solicitation. Stay in pilot mode and document closely until licensed."],
        ["Smart contract exploit",
         "Bug drains a Grow Pack pool. Funds gone, trust gone.",
         "External audit before mainnet. Bug bounty. Pause-able admin authority on critical paths."],
        ["Acquisition / absorption",
         "Apollo, Pula, or another incumbent absorbs us before we hit independent scale.",
         "This is the best of the failure cases. Negotiate carefully and protect farmer data ownership in any term sheet."],
    ]), col_widths=[3.5 * cm, 6 * cm, 7 * cm]),
]

# 11. Build plan
story += [
    PageBreak(),
    p("11. Build Plan &mdash; Hackathon Track (~6 weeks)", H1),
    p(
        "This is aggressive for a two-person team. We will cut scope rather than ship something broken. "
        "Anything marked <i>(stretch)</i> goes only if we are clearly ahead.",
    ),

    p("Week 1 &mdash; Research, validation, scaffolding", H2),
    bullets([
        "Confirm hackathon track, rules, and submission requirements.",
        "Conduct 3&ndash;5 conversations: an agronomist, a cooperative leader, and at least one smallholder farmer (Tumo / Pitsi network).",
        "Lock the demo crop (default: maize) and region (default: Eastern Cape).",
        "Define the exact MVP user journey end-to-end on a whiteboard.",
        "Set up monorepo, project board, weekly retro cadence, shared comms.",
    ]),

    p("Week 2 &mdash; Smart contract MVP", H2),
    bullets([
        "Anchor project scaffold; <code>FarmerAccount</code> and <code>GrowPack</code> programs on localnet.",
        "Initial Pyth weather-feed integration on devnet (read-only first).",
        "Unit tests for happy path on each instruction.",
    ]),

    p("Week 3 &mdash; Smart contract continued, frontend skeleton", H2),
    bullets([
        "<code>Repayment</code> and <code>CreditScore</code> instructions.",
        "Next.js skeleton with wallet adapter (Phantom for demo).",
        "Basic farmer onboarding screens (mock data).",
    ]),

    p("Week 4 &mdash; Frontend buildout, backend service", H2),
    bullets([
        "Grow Pack purchase flow end-to-end on devnet.",
        "Marketplace listings (mocked supplier inventory).",
        "Backend API for farmer profile, supplier directory, reporting stub.",
    ]),

    p("Week 5 &mdash; Integration, oracle simulation, test data", H2),
    bullets([
        "End-to-end testing on devnet.",
        "Seed 5&ndash;10 test farmers with realistic data.",
        "Simulate a drought event and confirm payout fires.",
        "Bug fixing, polish, accessibility pass.",
    ]),

    p("Week 6 &mdash; Pitch, polish, ship", H2),
    bullets([
        "Demo video (3&ndash;5 minutes).",
        "Pitch deck (10&ndash;12 slides).",
        "Documentation (README, architecture diagram, security notes).",
        "Submit; rest; retro.",
    ]),

    p("11.7  Cut-list (in this order, if we fall behind)", H2),
    bullets([
        "USSD / feature-phone bridge &mdash; explicitly out of scope, mention in roadmap.",
        "isiZulu / isiXhosa localization &mdash; English only for the demo.",
        "Marketplace UI for buyers &mdash; mock the off-take side, focus on farmer side.",
        "On-chain credit-score visualizer &mdash; show the data structure, defer the chart.",
        "Real Pyth integration &mdash; if the feed proves flaky, mock it deterministically with a clearly labelled flag.",
    ]),
]

# 12. Roadmap beyond hackathon
story += [
    p("12. Roadmap Beyond the Hackathon", H1),
    table(wrap_cells([
        ["Phase", "Window", "Goal", "Gate to next phase"],
        ["Pilot prep", "H2 2026", "Co-op partnership signed; CASP licence application filed; supplier MOUs.", "Co-op + supplier letters in hand."],
        ["Pilot v1", "H1 2027", "50&ndash;200 farmers, one crop, one province. Real money, small.", "&ge;60% repayment, no fraud incident &gt; 5% of pool."],
        ["Pilot v2 / scale-out", "H2 2027", "Add second province and second crop. Begin reinsurance arrangement.", "Sustainable unit economics modelled and confirmed."],
        ["Regional expansion", "2028", "Zambia and / or Kenya via Superteam network. Multi-currency settlement.", "CASP licence active; on-chain credit history attracts third-party lenders."],
    ]), col_widths=[3 * cm, 2.5 * cm, 6 * cm, 5 * cm]),
]

# 13. Risk register
story += [
    p("13. Risk Register", H1),
    table(wrap_cells([
        ["Risk", "Likelihood", "Impact", "Mitigation"],
        ["No cooperative partner", "High", "High", "Begin outreach week 1. Maintain three live options."],
        ["Repayment below 50%", "Medium", "Critical", "Group lending, social collateral, conservative loan size."],
        ["Climate event in pilot", "Medium", "High", "Reinsurance partner before pool exceeds US$50k; cap regional exposure."],
        ["Regulatory action pre-licence", "Medium", "Critical", "No retail solicitation pre-licence. Pilot under co-op cover. Legal review."],
        ["Stablecoin de-peg", "Low", "Medium", "Buffer reserve. Plan ZAR settlement bridge. Daily monitoring."],
        ["Smart contract exploit", "Medium", "High", "External audit pre-mainnet. Bounty program. Pause authority."],
        ["Founder burnout", "High", "Medium", "Realistic scope. Weekly retros. Take Sundays off."],
        ["Existing incumbent moves to Solana", "Low", "High", "Defensible moat: portable credit history + insurance speed, not just &lsquo;same product on Solana&rsquo;."],
    ]), col_widths=[5 * cm, 2 * cm, 2 * cm, 7.5 * cm]),
]

# 14. Conclusion
story += [
    p("14. Conclusion", H1),
    p(
        "The agricultural financing gap in Sub-Saharan Africa is real, large, and is not closing on its own. "
        "Solana gives us a meaningfully better cost structure for serving small loans, and on-chain oracles give "
        "us meaningfully faster insurance. Those two ingredients can shift the unit economics of smallholder "
        "finance in a way that traditional rails cannot.",
    ),
    p(
        "But the blockchain is the easy part. The hard part is building trust with cooperatives, finding "
        "suppliers, managing fraud, surviving a bad climate year, and not getting fined by the FSCA. That hard "
        "part is also where most projects in this space have died, and we should be sober about it.",
    ),
    p(
        "For the hackathon, our goal is a credible prototype and a clear, realistic plan. After the hackathon, "
        "our goal is to find one cooperative, one province, one crop, and serve a few hundred farmers <b>well</b> "
        "before we even think about scaling. Slow, careful, honest work.",
    ),
    p(
        "This is not a get-rich proposition. It is a development one. If it works, it pays back over a decade. "
        "If it does not, the failure modes hurt real people and we should plan accordingly.",
    ),
    Spacer(1, 0.6 * cm),
    p("&mdash; Tumo Mogame &amp; Pitsi Kgaume", AUTHOR),
]

# Sources / appendix
story += [
    p("Appendix A &mdash; Source Material", H1),
    p(
        "This proposal is grounded in the research paper <i>&ldquo;Socio-Economic Transformation through "
        "High-Velocity Distributed Ledger Technology: A Strategic Analysis for Solana-Based Applications in "
        "the South African and Pan-African Context&rdquo;</i> (2026). Specifically, Module 2 of the SATL "
        "framework proposed in that paper, on agricultural bundled-service marketplaces, is the parent of "
        "Project Vuna.",
        SMALL,
    ),
    p(
        "Comparative reference projects: Apollo Agriculture (Kenya), Pula, ThriveAgric, HelloChoice, Khula. "
        "We have read about each; we have not partnered with any. They are well-funded competitors and our "
        "differentiation must be specific, not vague.",
        SMALL,
    ),
    p(
        "Regulatory anchors: FSCA CASP licensing under FAIS, SARB Exchange Control Circular 3-2026, "
        "IFWG stablecoin policy work in progress.",
        SMALL,
    ),
]

# ---------- build ----------
doc = SimpleDocTemplate(
    OUTPUT, pagesize=A4,
    leftMargin=2 * cm, rightMargin=2 * cm,
    topMargin=2 * cm, bottomMargin=2 * cm,
    title="Project Vuna Proposal",
    author="Tumo Mogame & Pitsi Kgaume",
)

doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
print(f"Wrote {OUTPUT}")
