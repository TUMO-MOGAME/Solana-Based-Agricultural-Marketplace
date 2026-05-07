"""
Generates UI mockups for Project Vuna into design/mockups/:
  - mobile.png  -> 4 phone screens (welcome, home, apply, payout)
  - web.png     -> cooperative-officer dashboard

Run from anywhere: `python design/build_mockups.py`

Design language:
  - earthy, trustworthy, agricultural - NOT crypto-flashy
  - hides all wallet / blockchain language from the farmer
  - mobile-first; the web view is for the partner co-op staff, not the farmer
"""

from PIL import Image, ImageDraw, ImageFont
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "design", "mockups")
os.makedirs(OUT_DIR, exist_ok=True)

# ---------- palette ----------
INK         = (26, 26, 26)
INK_SOFT    = (102, 102, 102)
INK_FAINT   = (165, 160, 150)
BG          = (245, 242, 234)        # warm cream
CARD        = (255, 255, 255)
BORDER      = (229, 224, 213)
GREEN       = (11, 61, 46)           # primary deep forest
GREEN_MID   = (31, 107, 73)
GREEN_SOFT  = (224, 234, 226)
GOLD        = (232, 185, 49)
GOLD_SOFT   = (250, 235, 195)
SUCCESS     = (46, 125, 50)
WARN        = (230, 126, 34)
DANGER      = (192, 57, 43)
SHADOW      = (0, 0, 0, 18)

# ---------- fonts ----------
def font(size, bold=False):
    path = "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf"
    return ImageFont.truetype(path, size)

# ---------- drawing helpers ----------
def rounded(draw, box, radius, fill=None, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)

def shadow_card(im, box, radius=18):
    """Drop a soft shadow under a card by compositing a translucent blurred rect."""
    from PIL import ImageFilter
    x0, y0, x1, y1 = box
    pad = 14
    sh = Image.new("RGBA", (x1 - x0 + pad * 2, y1 - y0 + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(sh)
    d.rounded_rectangle((pad, pad + 4, sh.width - pad, sh.height - pad + 4),
                        radius=radius, fill=(0, 0, 0, 32))
    sh = sh.filter(ImageFilter.GaussianBlur(8))
    im.alpha_composite(sh, dest=(x0 - pad, y0 - pad))

def text_w(s, f):
    return f.getbbox(s)[2] - f.getbbox(s)[0]

def progress_bar(draw, x, y, w, h, pct, color=GREEN_MID, track=BORDER):
    rounded(draw, (x, y, x + w, y + h), h // 2, fill=track)
    if pct > 0:
        fw = max(int(w * pct), h)
        rounded(draw, (x, y, x + fw, y + h), h // 2, fill=color)

def dotted_hr(draw, x0, x1, y, color=BORDER):
    for x in range(x0, x1, 6):
        draw.rectangle((x, y, x + 3, y + 1), fill=color)

# ---------- phone-screen primitives ----------
PHONE_W, PHONE_H = 420, 860
NOTCH_H = 36
NAV_H = 70

def new_phone():
    """Return an image of a single phone-screen frame (with bezel)."""
    w, h = PHONE_W, PHONE_H
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # bezel
    rounded(d, (0, 0, w, h), 46, fill=(20, 20, 22))
    # screen
    rounded(d, (8, 8, w - 8, h - 8), 38, fill=BG)
    # notch
    rounded(d, (w // 2 - 60, 14, w // 2 + 60, 38), 12, fill=(20, 20, 22))
    # status bar text
    sf = font(13, bold=True)
    d.text((28, 18), "9:41", fill=INK, font=sf)
    d.text((w - 70, 18), "▮▮▮▮", fill=INK, font=font(11, bold=True))
    return im

def screen_area():
    """Returns (x0, y0, x1, y1) of usable screen content above nav, below status bar."""
    return (24, 50, PHONE_W - 24, PHONE_H - NAV_H - 16)

def _icon_home(d, cx, cy, col, size=12):
    # roof
    d.polygon([(cx - size, cy + 2), (cx, cy - size + 2), (cx + size, cy + 2)],
              fill=col)
    # body
    d.rectangle((cx - size + 2, cy + 2, cx + size - 2, cy + size),
                fill=col)
    # door
    d.rectangle((cx - 2, cy + 5, cx + 2, cy + size), fill=BG)

def _icon_pack(d, cx, cy, col, size=12):
    # bag body
    rounded(d, (cx - size + 2, cy - size + 6, cx + size - 2, cy + size),
            3, fill=col)
    # handle
    d.arc((cx - 6, cy - size + 1, cx + 6, cy - size + 9),
          start=180, end=360, fill=col, width=2)

def _icon_cart(d, cx, cy, col, size=12):
    # cart body trapezoid
    d.polygon([(cx - size + 1, cy - 4),
               (cx + size - 1, cy - 4),
               (cx + size - 4, cy + 5),
               (cx - size + 4, cy + 5)], fill=col)
    # handle
    d.line((cx - size + 1, cy - 4, cx - size - 3, cy - 8),
           fill=col, width=2)
    # wheels
    d.ellipse((cx - 6, cy + 6, cx - 2, cy + 10), fill=col)
    d.ellipse((cx + 2, cy + 6, cx + 6, cy + 10), fill=col)

def _icon_help(d, cx, cy, col, size=12):
    d.ellipse((cx - size, cy - size, cx + size, cy + size),
              outline=col, width=2)
    f = font(15, bold=True)
    d.text((cx - text_w("?", f) // 2, cy - 9), "?", fill=col, font=f)

def draw_bottom_nav(d, active_index):
    items = [
        ("Home",   _icon_home),
        ("Pack",   _icon_pack),
        ("Market", _icon_cart),
        ("Help",   _icon_help),
    ]
    y = PHONE_H - NAV_H - 8
    rounded(d, (16, y, PHONE_W - 16, y + NAV_H), 26, fill=CARD, outline=BORDER, width=1)
    seg = (PHONE_W - 32) // len(items)
    for i, (label, drawer) in enumerate(items):
        cx = 16 + seg * i + seg // 2
        col = GREEN if i == active_index else INK_SOFT
        drawer(d, cx, y + 24, col)
        d.text((cx - text_w(label, font(11, bold=(i == active_index))) // 2, y + 44),
               label, fill=col, font=font(11, bold=(i == active_index)))

def primary_button(d, x, y, w, h, label, color=GREEN, text_color=(255, 255, 255)):
    rounded(d, (x, y, x + w, y + h), h // 2, fill=color)
    f = font(15, bold=True)
    d.text((x + w // 2 - text_w(label, f) // 2, y + h // 2 - 11),
           label, fill=text_color, font=f)

def ghost_button(d, x, y, w, h, label):
    rounded(d, (x, y, x + w, y + h), h // 2, outline=GREEN, width=2, fill=CARD)
    f = font(15, bold=True)
    d.text((x + w // 2 - text_w(label, f) // 2, y + h // 2 - 11),
           label, fill=GREEN, font=f)

def header(d, title, subtitle=None):
    x0, y0, x1, _ = screen_area()
    d.text((x0, y0 + 4), title, fill=INK, font=font(22, bold=True))
    if subtitle:
        d.text((x0, y0 + 36), subtitle, fill=INK_SOFT, font=font(13))

# ============================================================
#                       PHONE SCREEN 1: WELCOME
# ============================================================
def screen_welcome():
    im = new_phone()
    d = ImageDraw.Draw(im)

    # Hero block
    cx = PHONE_W // 2
    # Logo mark
    rounded(d, (cx - 38, 130, cx + 38, 206), 38, fill=GREEN)
    f = font(44, bold=True)
    d.text((cx - text_w("V", f) // 2, 140), "V", fill=GOLD, font=f)

    d.text((cx - text_w("Vuna", font(36, bold=True)) // 2, 230),
           "Vuna", fill=INK, font=font(36, bold=True))
    sub = "Smarter farming. Fairer credit."
    d.text((cx - text_w(sub, font(14)) // 2, 280), sub, fill=INK_SOFT, font=font(14))

    # Welcome message
    y = 360
    msg1 = "Sawubona, Molo, Welcome."
    d.text((cx - text_w(msg1, font(15, bold=True)) // 2, y),
           msg1, fill=INK, font=font(15, bold=True))
    msg2 = "Get certified seeds, fertilizer and"
    msg3 = "drought protection in one package,"
    msg4 = "paid back at harvest."
    for i, m in enumerate([msg2, msg3, msg4]):
        d.text((cx - text_w(m, font(13)) // 2, y + 28 + i * 20),
               m, fill=INK_SOFT, font=font(13))

    # Buttons
    primary_button(d, 40, 540, PHONE_W - 80, 52, "Continue with my Cooperative")
    ghost_button(d, 40, 608, PHONE_W - 80, 52, "Use my phone number")

    # Trust footer
    rounded(d, (40, 700, PHONE_W - 40, 770), 14, fill=GREEN_SOFT)
    msgT = "Backed by your local extension office"
    d.text((cx - text_w(msgT, font(12, bold=True)) // 2, 716),
           msgT, fill=GREEN, font=font(12, bold=True))
    msgT2 = "FSCA registered  ·  Your data is yours"
    d.text((cx - text_w(msgT2, font(11)) // 2, 740),
           msgT2, fill=GREEN_MID, font=font(11))

    return im

# ============================================================
#                     PHONE SCREEN 2: HOME / DASHBOARD
# ============================================================
def screen_home():
    im = new_phone()
    d = ImageDraw.Draw(im)
    x0, y0, x1, _ = screen_area()

    # Greeting
    d.text((x0, y0 + 4), "Sawubona, Nomsa", fill=INK, font=font(22, bold=True))
    d.text((x0, y0 + 34), "Tuesday, 6 May 2026 · Eastern Cape",
           fill=INK_SOFT, font=font(12))

    # Active Grow Pack card (the hero)
    cy = y0 + 76
    ch = 240
    rounded(d, (x0, cy, x1, cy + ch), 18, fill=GREEN)
    d.text((x0 + 18, cy + 14), "ACTIVE GROW PACK",
           fill=GOLD, font=font(11, bold=True))
    d.text((x0 + 18, cy + 36), "Maize  ·  2.0 ha",
           fill=(255, 255, 255), font=font(22, bold=True))
    d.text((x0 + 18, cy + 70), "Day 60 of 120",
           fill=(220, 230, 222), font=font(12))
    progress_bar(d, x0 + 18, cy + 96, x1 - x0 - 36, 10, 0.5,
                 color=GOLD, track=(40, 90, 70))

    # checklist inside hero
    items = [
        ("Seeds delivered",      True),
        ("Fertilizer delivered", True),
        ("Drought cover active", True),
        ("Harvest scheduled",    False),
    ]
    for i, (label, done) in enumerate(items):
        ix = x0 + 18 + (i % 2) * ((x1 - x0 - 36) // 2)
        iy = cy + 124 + (i // 2) * 38
        circle_col = GOLD if done else (60, 110, 90)
        d.ellipse((ix, iy, ix + 16, iy + 16), fill=circle_col)
        if done:
            d.text((ix + 4, iy - 1), "✓", fill=GREEN, font=font(13, bold=True))
        d.text((ix + 26, iy - 1), label,
               fill=(255, 255, 255) if done else (180, 195, 187),
               font=font(11, bold=done))

    # Weather card
    wy = cy + ch + 18
    wh = 90
    rounded(d, (x0, wy, x1, wy + wh), 14, fill=CARD, outline=BORDER, width=1)
    d.text((x0 + 16, wy + 12), "Weather · 7 days", fill=INK_SOFT, font=font(11, bold=True))
    d.text((x0 + 16, wy + 30), "22°C  Light rain expected Thu",
           fill=INK, font=font(15, bold=True))
    d.text((x0 + 16, wy + 56), "Rainfall this month: 47 mm  (normal)",
           fill=SUCCESS, font=font(12, bold=True))
    # tiny bars
    bx = x1 - 130
    for i, h in enumerate([10, 14, 8, 22, 30, 18, 12]):
        d.rectangle((bx + i * 16, wy + wh - 14 - h,
                     bx + i * 16 + 10, wy + wh - 14),
                    fill=GREEN_MID)

    # Credit score card
    sy = wy + wh + 14
    sh = 86
    rounded(d, (x0, sy, x1, sy + sh), 14, fill=CARD, outline=BORDER, width=1)
    d.text((x0 + 16, sy + 12), "Your credit history", fill=INK_SOFT, font=font(11, bold=True))
    d.text((x0 + 16, sy + 30), "720", fill=GREEN, font=font(28, bold=True))
    d.text((x0 + 80, sy + 38), "Good standing", fill=INK, font=font(13, bold=True))
    d.text((x0 + 80, sy + 58), "+40 since last season", fill=SUCCESS, font=font(11, bold=True))
    # arrow
    d.text((x1 - 32, sy + 32), "›", fill=INK_SOFT, font=font(28, bold=True))

    draw_bottom_nav(d, 0)
    return im

# ============================================================
#                  PHONE SCREEN 3: APPLY FOR GROW PACK
# ============================================================
def screen_apply():
    im = new_phone()
    d = ImageDraw.Draw(im)
    x0, y0, x1, _ = screen_area()

    d.text((x0, y0 + 4), "Plan next season", fill=INK, font=font(22, bold=True))
    d.text((x0, y0 + 34), "Tell us what you want to grow",
           fill=INK_SOFT, font=font(12))

    # Crop selector
    cy = y0 + 78
    rounded(d, (x0, cy, x1, cy + 56), 12, fill=CARD, outline=BORDER, width=1)
    d.text((x0 + 14, cy + 8), "CROP", fill=INK_SOFT, font=font(10, bold=True))
    d.text((x0 + 14, cy + 24), "Maize", fill=INK, font=font(17, bold=True))
    d.text((x1 - 28, cy + 18), "▾", fill=INK_SOFT, font=font(20, bold=True))

    # Hectares + region row
    cy2 = cy + 70
    half = (x1 - x0 - 12) // 2
    rounded(d, (x0, cy2, x0 + half, cy2 + 56), 12, fill=CARD, outline=BORDER, width=1)
    d.text((x0 + 14, cy2 + 8), "HECTARES", fill=INK_SOFT, font=font(10, bold=True))
    d.text((x0 + 14, cy2 + 24), "2.5", fill=INK, font=font(17, bold=True))

    rounded(d, (x0 + half + 12, cy2, x1, cy2 + 56), 12, fill=CARD, outline=BORDER, width=1)
    d.text((x0 + half + 26, cy2 + 8), "REGION", fill=INK_SOFT, font=font(10, bold=True))
    d.text((x0 + half + 26, cy2 + 24), "Eastern Cape",
           fill=INK, font=font(15, bold=True))

    # Bundle preview
    by = cy2 + 80
    bh = 240
    rounded(d, (x0, by, x1, by + bh), 16, fill=CARD, outline=BORDER, width=1)
    d.text((x0 + 16, by + 14), "YOUR GROW PACK",
           fill=GREEN, font=font(11, bold=True))
    rows = [
        ("25 kg certified maize seed",      "R   420"),
        ("100 kg NPK fertilizer",           "R 1,150"),
        ("Drought insurance (parametric)",  "R    85"),
    ]
    for i, (label, price) in enumerate(rows):
        ry = by + 44 + i * 38
        d.text((x0 + 16, ry), label, fill=INK, font=font(13))
        d.text((x1 - 16 - text_w(price, font(13, bold=True)), ry),
               price, fill=INK, font=font(13, bold=True))
        if i < len(rows) - 1:
            dotted_hr(d, x0 + 16, x1 - 16, ry + 26)
    # total
    ty = by + 44 + len(rows) * 38 + 8
    d.rectangle((x0 + 16, ty, x1 - 16, ty + 1), fill=BORDER)
    d.text((x0 + 16, ty + 12), "Total today", fill=INK, font=font(14, bold=True))
    total = "R 1,655"
    d.text((x1 - 16 - text_w(total, font(15, bold=True)), ty + 11),
           total, fill=INK, font=font(15, bold=True))
    d.text((x0 + 16, ty + 38), "Repay at harvest",
           fill=INK_SOFT, font=font(12))
    repay = "≈ R 1,820"
    d.text((x1 - 16 - text_w(repay, font(13, bold=True)), ty + 38),
           repay, fill=GREEN, font=font(13, bold=True))

    # Apply button
    primary_button(d, x0, by + bh + 22, x1 - x0, 54,
                   "Apply for this Grow Pack", color=GOLD, text_color=GREEN)

    # tiny disclosure
    d.text((x0, by + bh + 90),
           "Your cooperative reviews requests within 48 hours",
           fill=INK_SOFT, font=font(11))

    draw_bottom_nav(d, 1)
    return im

# ============================================================
#                  PHONE SCREEN 4: INSURANCE PAYOUT
# ============================================================
def screen_payout():
    im = new_phone()
    d = ImageDraw.Draw(im)
    x0, y0, x1, _ = screen_area()

    d.text((x0, y0 + 4), "Drought protection", fill=INK, font=font(22, bold=True))
    d.text((x0, y0 + 34), "1 Sept 2026 → 30 Nov 2026  ·  Maize",
           fill=INK_SOFT, font=font(12))

    # Big payout banner
    by = y0 + 78
    bh = 156
    rounded(d, (x0, by, x1, by + bh), 18, fill=GOLD_SOFT, outline=GOLD, width=2)
    d.text((x0 + 18, by + 14), "PAYOUT SENT",
           fill=WARN, font=font(11, bold=True))
    d.text((x0 + 18, by + 36), "R 1,400",
           fill=INK, font=font(40, bold=True))
    d.text((x0 + 18, by + 90),
           "Sent to your account on 14 Oct 2026.",
           fill=INK, font=font(13, bold=True))
    d.text((x0 + 18, by + 110),
           "No paperwork. No claim form.",
           fill=INK_SOFT, font=font(12))

    # Why payout fired
    wy = by + bh + 22
    rounded(d, (x0, wy, x1, wy + 220), 16, fill=CARD, outline=BORDER, width=1)
    d.text((x0 + 16, wy + 14), "WHY YOU WERE PAID",
           fill=INK_SOFT, font=font(11, bold=True))
    d.text((x0 + 16, wy + 36), "Rainfall in your area",
           fill=INK, font=font(13))
    d.text((x0 + 16, wy + 56), "32 mm",
           fill=INK, font=font(28, bold=True))
    d.text((x0 + 16 + 100, wy + 70), "of expected 80 mm",
           fill=INK_SOFT, font=font(12))

    # Mini bar chart - rainfall vs threshold
    chart_x = x0 + 16
    chart_y = wy + 110
    chart_w = x1 - x0 - 32
    chart_h = 70
    bars = [22, 18, 14, 10, 6, 4]
    labels = ["W1", "W2", "W3", "W4", "W5", "W6"]
    bar_w = (chart_w - 50) // len(bars)
    threshold_y = chart_y + 22
    # threshold dashed line
    for x in range(chart_x, chart_x + chart_w - 30, 8):
        d.rectangle((x, threshold_y, x + 4, threshold_y + 1), fill=DANGER)
    d.text((chart_x + chart_w - 28, threshold_y - 8),
           "min", fill=DANGER, font=font(10, bold=True))

    for i, (h, lab) in enumerate(zip(bars, labels)):
        bx = chart_x + i * bar_w + 6
        bh2 = h * 2
        col = SUCCESS if h * 2 > (chart_y + chart_h - threshold_y) else WARN
        d.rectangle((bx, chart_y + chart_h - bh2,
                     bx + bar_w - 14, chart_y + chart_h),
                    fill=col)
        d.text((bx, chart_y + chart_h + 4), lab,
               fill=INK_SOFT, font=font(10))

    # Footer reassurance
    fy = wy + 234
    rounded(d, (x0, fy, x1, fy + 60), 14, fill=GREEN_SOFT)
    d.text((x0 + 16, fy + 10), "Your Grow Pack is still active.",
           fill=GREEN, font=font(13, bold=True))
    d.text((x0 + 16, fy + 32),
           "Talk to your co-op about replanting options.",
           fill=GREEN_MID, font=font(11))

    draw_bottom_nav(d, 1)
    return im

# ============================================================
#                       MOBILE COMPOSITE
# ============================================================
def build_mobile():
    screens = [
        ("Welcome", screen_welcome()),
        ("Home", screen_home()),
        ("New Grow Pack", screen_apply()),
        ("Drought payout", screen_payout()),
    ]
    pad = 50
    title_h = 110
    cap_h = 50
    total_w = pad + (PHONE_W + pad) * len(screens)
    total_h = pad + title_h + PHONE_H + cap_h + pad

    canvas = Image.new("RGBA", (total_w, total_h), BG)
    d = ImageDraw.Draw(canvas)

    # Title block
    d.text((pad, pad), "Project Vuna  —  Mobile",
           fill=INK, font=font(34, bold=True))
    d.text((pad, pad + 46),
           "Farmer-facing app.  Designed mobile-first.  No mention of crypto, wallets, or stablecoins.",
           fill=INK_SOFT, font=font(15))
    d.text((pad, pad + 70),
           "Authors: Tumo Mogame & Pitsi Kgaume",
           fill=INK_FAINT, font=font(13))

    # Place screens
    for i, (caption, scr) in enumerate(screens):
        x = pad + i * (PHONE_W + pad)
        y = pad + title_h
        canvas.alpha_composite(scr, dest=(x, y))
        cap_y = y + PHONE_H + 12
        cap_f = font(14, bold=True)
        d.text((x + PHONE_W // 2 - text_w(caption, cap_f) // 2, cap_y),
               caption, fill=INK, font=cap_f)

    out = os.path.join(OUT_DIR, "mobile.png")
    canvas.convert("RGB").save(out, "PNG", optimize=True)
    print(f"Wrote {out}")

# ============================================================
#                         WEB / DESKTOP MOCKUP
# ============================================================
def build_web():
    W, H = 1640, 1080
    canvas = Image.new("RGBA", (W, H), BG)
    d = ImageDraw.Draw(canvas)

    # Title strip
    d.text((40, 32), "Project Vuna  —  Cooperative Dashboard",
           fill=INK, font=font(30, bold=True))
    d.text((40, 72),
           "Web view used by co-op staff & extension officers, NOT by farmers.",
           fill=INK_SOFT, font=font(15))

    # Browser chrome
    bx0, by0, bx1, by1 = 40, 120, W - 40, H - 40
    rounded(d, (bx0, by0, bx1, by1), 14, fill=CARD, outline=BORDER, width=1)
    # browser top bar
    rounded(d, (bx0, by0, bx1, by0 + 36), 14, fill=(245, 240, 232))
    d.rectangle((bx0, by0 + 30, bx1, by0 + 36), fill=(245, 240, 232))  # square bottom
    for i, col in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
        d.ellipse((bx0 + 14 + i * 22, by0 + 12, bx0 + 14 + i * 22 + 12, by0 + 24),
                  fill=col)
    rounded(d, (bx0 + 100, by0 + 8, bx0 + 700, by0 + 28), 10, fill=BG)
    d.text((bx0 + 112, by0 + 12), "vuna.app/coop/dashboard",
           fill=INK_SOFT, font=font(12))

    # Sidebar
    sb_x0 = bx0
    sb_x1 = bx0 + 240
    sb_y0 = by0 + 36
    sb_y1 = by1
    rounded(d, (sb_x0, sb_y0, sb_x1, sb_y1), 0, fill=GREEN)

    # Logo
    d.text((sb_x0 + 24, sb_y0 + 24), "VUNA", fill=GOLD, font=font(22, bold=True))
    d.text((sb_x0 + 24, sb_y0 + 52), "co-op portal",
           fill=(200, 215, 205), font=font(11))

    nav = [
        ("Dashboard",    True),
        ("Farmers",      False),
        ("Grow Packs",   False),
        ("Suppliers",    False),
        ("Insurance",    False),
        ("Repayments",   False),
        ("Reports",      False),
        ("Settings",     False),
    ]
    for i, (label, active) in enumerate(nav):
        ny = sb_y0 + 110 + i * 44
        if active:
            rounded(d, (sb_x0 + 14, ny - 6, sb_x1 - 14, ny + 28), 8, fill=(20, 80, 60))
        d.text((sb_x0 + 30, ny), label,
               fill=(255, 255, 255) if active else (190, 210, 200),
               font=font(14, bold=active))

    # Profile bottom
    pf_y = sb_y1 - 80
    d.ellipse((sb_x0 + 24, pf_y, sb_x0 + 60, pf_y + 36), fill=GOLD)
    d.text((sb_x0 + 33, pf_y + 9), "TM", fill=GREEN, font=font(13, bold=True))
    d.text((sb_x0 + 72, pf_y + 4), "Tumo Mogame",
           fill=(255, 255, 255), font=font(13, bold=True))
    d.text((sb_x0 + 72, pf_y + 22), "Hala Co-op · Eastern Cape",
           fill=(190, 210, 200), font=font(11))

    # Main content area
    mx = sb_x1 + 30
    my = sb_y0 + 24
    mw = bx1 - mx - 30

    # Top bar (search + alerts)
    d.text((mx, my), "Dashboard", fill=INK, font=font(28, bold=True))
    d.text((mx, my + 38), "Tuesday, 6 May 2026  ·  Season: 2026/27",
           fill=INK_SOFT, font=font(13))

    # search bar
    sb_x = mx + mw - 360
    rounded(d, (sb_x, my + 4, sb_x + 280, my + 38), 18,
            fill=CARD, outline=BORDER, width=1)
    # magnifier icon: small circle + handle
    mg_cx, mg_cy = sb_x + 22, my + 21
    d.ellipse((mg_cx - 7, mg_cy - 7, mg_cx + 5, mg_cy + 5),
              outline=INK_SOFT, width=2)
    d.line((mg_cx + 4, mg_cy + 4, mg_cx + 10, mg_cy + 10),
           fill=INK_SOFT, width=2)
    d.text((sb_x + 42, my + 13), "Search farmers, packs…",
           fill=INK_SOFT, font=font(12))
    rounded(d, (sb_x + 296, my + 4, sb_x + 360, my + 38), 18, fill=GOLD)
    d.text((sb_x + 308, my + 12), "+ New", fill=GREEN, font=font(13, bold=True))

    # ---------- Stat cards ----------
    cards = [
        ("Active farmers",    "142",          "+8 this week",   GREEN_MID, SUCCESS),
        ("Capital deployed",  "R 2.84m",      "across 138 packs", GREEN_MID, INK_SOFT),
        ("Repayment rate",    "78%",          "season to date",  SUCCESS, INK_SOFT),
        ("Insurance triggered","12 farmers",   "R 14,800 paid out", WARN, INK_SOFT),
    ]
    cy = my + 80
    cw = (mw - 30) // 4
    ch = 130
    for i, (lab, val, sub, val_col, sub_col) in enumerate(cards):
        cx = mx + i * (cw + 10)
        rounded(d, (cx, cy, cx + cw, cy + ch), 16, fill=CARD, outline=BORDER, width=1)
        d.text((cx + 18, cy + 18), lab, fill=INK_SOFT, font=font(12, bold=True))
        d.text((cx + 18, cy + 42), val, fill=val_col, font=font(30, bold=True))
        d.text((cx + 18, cy + 92), sub, fill=sub_col, font=font(12))

    # ---------- Farmers table ----------
    ty = cy + ch + 28
    # left: table panel
    tw = int(mw * 0.62)
    rounded(d, (mx, ty, mx + tw, ty + 480), 16, fill=CARD, outline=BORDER, width=1)
    d.text((mx + 20, ty + 16), "Active farmers",
           fill=INK, font=font(16, bold=True))
    d.text((mx + tw - 90, ty + 22), "View all ›",
           fill=GREEN, font=font(12, bold=True))

    cols_x = [mx + 20, mx + 200, mx + 320, mx + 400, mx + 500, mx + 620, mx + tw - 60]
    headers = ["FARMER", "CROP", "HA", "STAGE", "STATUS", "SCORE", ""]
    for i, h in enumerate(headers):
        d.text((cols_x[i], ty + 60), h, fill=INK_SOFT, font=font(11, bold=True))
    d.rectangle((mx + 20, ty + 84, mx + tw - 20, ty + 85), fill=BORDER)

    rows = [
        ("Nomsa Dlamini",   "Maize",   "2.0",  "Day 60",  "On track",       "720",  GREEN),
        ("Pitsi Mokoena",   "Maize",   "1.5",  "Day 24",  "On track",       "650",  GREEN),
        ("Sipho Khumalo",   "Beans",   "0.8",  "Day 90",  "Drought paid",   "680",  WARN),
        ("Thandi Nkosi",    "Maize",   "3.2",  "Day 60",  "On track",       "740",  GREEN),
        ("Lebo Mthembu",    "Sorghum", "1.0",  "Day 45",  "Late inputs",    "590",  WARN),
        ("Ayanda Zulu",     "Maize",   "2.5",  "Day 110", "Repay due",      "710",  GREEN),
        ("Bongani Sithole", "Maize",   "1.2",  "Day 70",  "On track",       "640",  GREEN),
        ("Refilwe Modise",  "Beans",   "0.6",  "Day 30",  "On track",       "620",  GREEN),
    ]
    for i, (name, crop, ha, stage, status, score, sc) in enumerate(rows):
        ry = ty + 104 + i * 44
        if i % 2 == 0:
            d.rectangle((mx + 12, ry - 6, mx + tw - 12, ry + 30), fill=(250, 248, 242))
        # avatar
        d.ellipse((cols_x[0], ry, cols_x[0] + 26, ry + 26), fill=GREEN_SOFT)
        d.text((cols_x[0] + 7, ry + 4), name[0],
               fill=GREEN, font=font(12, bold=True))
        d.text((cols_x[0] + 36, ry + 5), name, fill=INK, font=font(13, bold=True))
        d.text((cols_x[1], ry + 5), crop, fill=INK, font=font(13))
        d.text((cols_x[2], ry + 5), ha, fill=INK, font=font(13))
        d.text((cols_x[3], ry + 5), stage, fill=INK_SOFT, font=font(13))
        # status pill
        sw = text_w(status, font(11, bold=True)) + 18
        pill_bg = (252, 234, 215) if sc == WARN else (224, 240, 230)
        rounded(d, (cols_x[4], ry, cols_x[4] + sw, ry + 24), 12, fill=pill_bg)
        d.text((cols_x[4] + 9, ry + 4), status, fill=sc, font=font(11, bold=True))
        d.text((cols_x[5], ry + 5), score, fill=GREEN, font=font(13, bold=True))
        d.text((cols_x[6], ry + 4), "›", fill=INK_SOFT, font=font(18, bold=True))

    # ---------- Right column: Alerts + Recent activity ----------
    rx = mx + tw + 20
    rw = mw - tw - 20

    # Alerts card
    rounded(d, (rx, ty, rx + rw, ty + 244), 16, fill=CARD, outline=BORDER, width=1)
    d.text((rx + 20, ty + 16), "Needs your attention",
           fill=INK, font=font(15, bold=True))

    alerts = [
        (DANGER,  "Drought trigger fired",    "Eastern Cape · 12 farmers · R 14,800 paid"),
        (WARN,    "12 repayments due in 14d", "Total R 41,300 across 12 packs"),
        (GREEN_MID,"3 new Grow Pack requests", "Pending your review"),
    ]
    for i, (col, title, body) in enumerate(alerts):
        ay = ty + 54 + i * 60
        d.rectangle((rx + 20, ay, rx + 24, ay + 44), fill=col)
        d.text((rx + 36, ay - 2), title, fill=INK, font=font(13, bold=True))
        d.text((rx + 36, ay + 20), body, fill=INK_SOFT, font=font(11))

    # Recent activity card
    ay0 = ty + 264
    rounded(d, (rx, ay0, rx + rw, ay0 + 216), 16, fill=CARD, outline=BORDER, width=1)
    d.text((rx + 20, ay0 + 16), "Recent activity",
           fill=INK, font=font(15, bold=True))
    activity = [
        ("09:42",  "Nomsa Dlamini",  "Insurance payout R 1,400"),
        ("08:15",  "Sipho Khumalo",  "Repayment received R 2,240"),
        ("Yest.",  "Pitsi Mokoena",  "Grow Pack approved · R 1,655"),
        ("Yest.",  "Thandi Nkosi",   "Fertilizer delivery confirmed"),
    ]
    for i, (t, who, what) in enumerate(activity):
        ry = ay0 + 54 + i * 38
        d.text((rx + 20, ry), t, fill=INK_SOFT, font=font(11, bold=True))
        d.text((rx + 80, ry), who, fill=INK, font=font(12, bold=True))
        d.text((rx + 80, ry + 16), what, fill=INK_SOFT, font=font(11))

    # Footer note
    d.text((40, H - 24),
           "Authors: Tumo Mogame & Pitsi Kgaume",
           fill=INK_FAINT, font=font(11))

    out = os.path.join(OUT_DIR, "web.png")
    canvas.convert("RGB").save(out, "PNG", optimize=True)
    print(f"Wrote {out}")


if __name__ == "__main__":
    build_mobile()
    build_web()
