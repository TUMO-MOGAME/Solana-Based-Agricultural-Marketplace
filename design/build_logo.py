"""
Generates the Mazra'at albaan logo as 1:1 square PNGs.

Run from anywhere: `python design/build_logo.py`

Output (into design/):
  logo-mark-1024.png   1024x1024 main asset (use this for hackathon submission)
  logo-mark-512.png     512x512 medium
  logo-mark-256.png     256x256 thumbnail
  logo-mark-64.png       64x64 favicon

Palette: earthy tokens from design/palette.md
  primary-green #0B3D2E       gold #E8B931       gold-soft #FAEBC3
"""

from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "design")

GREEN     = (11, 61, 46, 255)     # primary-green #0B3D2E
GOLD      = (232, 185, 49)        # gold #E8B931
GOLD_SOFT = (250, 235, 195)       # gold-soft #FAEBC3


def diagonal_gradient(size: int) -> Image.Image:
    """RGBA square — gold (bottom-left) to gold-soft (top-right)."""
    n = size - 1
    xs = np.arange(size) / n
    ys = (n - np.arange(size)) / n
    t = (xs[None, :] + ys[:, None]) / 2
    r = (GOLD[0] + (GOLD_SOFT[0] - GOLD[0]) * t).astype(np.uint8)
    g = (GOLD[1] + (GOLD_SOFT[1] - GOLD[1]) * t).astype(np.uint8)
    b = (GOLD[2] + (GOLD_SOFT[2] - GOLD[2]) * t).astype(np.uint8)
    a = np.full_like(r, 255)
    return Image.fromarray(np.stack([r, g, b, a], axis=-1), "RGBA")


def cubic(p0, p1, p2, p3, steps=80):
    out = []
    for i in range(steps + 1):
        t = i / steps; u = 1 - t
        out.append((
            u**3 * p0[0] + 3 * u**2 * t * p1[0] + 3 * u * t**2 * p2[0] + t**3 * p3[0],
            u**3 * p0[1] + 3 * u**2 * t * p1[1] + 3 * u * t**2 * p2[1] + t**3 * p3[1],
        ))
    return out


def quadratic(p0, p1, p2, steps=60):
    out = []
    for i in range(steps + 1):
        t = i / steps; u = 1 - t
        out.append((
            u**2 * p0[0] + 2 * u * t * p1[0] + t**2 * p2[0],
            u**2 * p0[1] + 2 * u * t * p1[1] + t**2 * p2[1],
        ))
    return out


def render(final_size: int) -> Image.Image:
    # 2x supersample then LANCZOS down — gives clean antialiasing
    s = final_size * 2
    cx = cy = s // 2

    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Forest-green disc
    R = int(s * 0.493)
    d.ellipse((cx - R, cy - R, cx + R, cy + R), fill=GREEN)

    # Warm gold glow inside the disc — blurred bright spot, slightly below center
    glow = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    glow_r = int(s * 0.30)
    glow_cy = int(cy + s * 0.04)
    gd.ellipse((cx - glow_r, glow_cy - glow_r,
                cx + glow_r, glow_cy + glow_r),
               fill=(*GOLD, 70))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=int(s / 14)))
    img.alpha_composite(glow)

    # Thin gold ring outline
    rr = int(s * 0.477)
    ring_w = max(2, int(s * 0.004))
    d.ellipse((cx - rr, cy - rr, cx + rr, cy + rr),
              outline=(*GOLD, 110), width=ring_w)

    # Sprout shape on a luminance mask, then mask the gradient through it
    mask = Image.new("L", (s, s), 0)
    md = ImageDraw.Draw(mask)
    sc = lambda x, y: (x / 512 * s, y / 512 * s)

    # Stem — straight thick line + circle caps for rounded ends
    stem_w = max(2, int(14 / 512 * s))
    md.line([sc(256, 400), sc(256, 195)], fill=255, width=stem_w)
    cap = stem_w // 2
    for (px, py) in (sc(256, 400), sc(256, 195)):
        md.ellipse((px - cap, py - cap, px + cap, py + cap), fill=255)

    # Right leaf — outer curve bulges up-left, inner bulges down-right; meets at sharp tip
    right = (
        cubic(sc(256, 268), sc(265, 198), sc(303, 152), sc(370, 130))
        + cubic(sc(370, 130), sc(361, 200), sc(323, 246), sc(256, 268))
    )
    md.polygon(right, fill=255)

    # Left leaf — mirror across x=256
    left = (
        cubic(sc(256, 268), sc(247, 198), sc(209, 152), sc(142, 130))
        + cubic(sc(142, 130), sc(151, 200), sc(189, 246), sc(256, 268))
    )
    md.polygon(left, fill=255)

    grad = diagonal_gradient(s)
    sprout = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    sprout.paste(grad, (0, 0), mask)
    img.alpha_composite(sprout)

    # Earth line — gentle curve under the sprout, gold-soft
    earth_pts = quadratic(sc(164, 410), sc(256, 425), sc(348, 410), steps=60)
    earth_w = max(2, int(3.5 / 512 * s))
    for a, b in zip(earth_pts, earth_pts[1:]):
        d.line([a, b], fill=(*GOLD, 130), width=earth_w)

    return img.resize((final_size, final_size), Image.LANCZOS)


if __name__ == "__main__":
    for size in (1024, 512, 256, 64):
        out_path = os.path.join(OUT_DIR, f"logo-mark-{size}.png")
        render(size).save(out_path, optimize=True)
        print(f"  wrote {out_path} ({size}x{size})")
