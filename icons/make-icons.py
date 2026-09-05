"""Five Minute Frenzy app icons: an orange tile with a 3 x 3 corner of the
frenzy grid (headers, a plus, two sums) and a stopwatch in the last square.
Run from the repo root: python3 icons/make-icons.py"""
from PIL import Image, ImageDraw, ImageFont
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ORANGE = (232, 89, 12, 255)
ORANGE_DARK = (184, 67, 10, 255)
INK = (35, 32, 28, 255)
PAPER = (255, 253, 248, 255)
HD = (255, 216, 184, 255)
GREEN = (47, 158, 68, 255)


def font(px):
    for name in ("/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf",
                 "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
                 "/Library/Fonts/Arial Bold.ttf"):
        if os.path.exists(name):
            return ImageFont.truetype(name, px)
    return ImageFont.load_default()


def text_centered(d, box, s, f, fill):
    x0, y0, x1, y1 = box
    l, t, r, b = d.textbbox((0, 0), s, font=f)
    d.text(((x0 + x1 - (r - l)) / 2 - l, (y0 + y1 - (b - t)) / 2 - t), s, font=f, fill=fill)


def make(size, maskable=False):
    # draw at 4x and downsample for smooth edges
    S = size * 4
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    radius = 0 if maskable else S * 0.22
    # full-bleed layers first; the rounded corners are cut with a mask at the end
    d.rectangle([0, 0, S - 1, S - 1], fill=ORANGE)
    d.rectangle([0, S * 0.62, S - 1, S - 1], fill=ORANGE_DARK)   # darker band for depth

    safe = S * (0.20 if maskable else 0.13)
    inner = S - 2 * safe
    gap = inner * 0.035
    cell = (inner - 2 * gap) / 3
    labels = [["+", "3", "8"], ["5", "8", "13"], ["2", "5", None]]
    f_big = font(int(cell * 0.62))
    f_mid = font(int(cell * 0.52))
    for r in range(3):
        for c in range(3):
            x = safe + c * (cell + gap)
            y = safe + r * (cell + gap)
            box = [x, y, x + cell, y + cell]
            is_hd = r == 0 or c == 0
            if r == 0 and c == 0:
                d.rounded_rectangle(box, radius=cell * 0.16, fill=INK)
                text_centered(d, box, "+", f_big, PAPER)
            elif is_hd:
                d.rounded_rectangle(box, radius=cell * 0.16, fill=HD)
                text_centered(d, box, labels[r][c], f_big, INK)
            elif labels[r][c] is None:
                # stopwatch
                d.rounded_rectangle(box, radius=cell * 0.16, fill=PAPER)
                cx, cy = x + cell / 2, y + cell * 0.55
                rad = cell * 0.30
                w = max(2, int(cell * 0.07))
                d.rectangle([cx - cell * 0.07, cy - rad - cell * 0.14, cx + cell * 0.07, cy - rad + w], fill=INK)
                d.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], outline=INK, width=w)
                d.line([cx, cy, cx + rad * 0.55, cy - rad * 0.45], fill=ORANGE, width=w)
                d.ellipse([cx - w, cy - w, cx + w, cy + w], fill=INK)
            else:
                d.rounded_rectangle(box, radius=cell * 0.16, fill=PAPER)
                text_centered(d, box, labels[r][c], f_mid if len(labels[r][c]) > 1 else f_big, GREEN)
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=radius, fill=255)
    img.putalpha(mask)
    return img.resize((size, size), Image.LANCZOS)


make(512).save(os.path.join(HERE, "icon-512.png"))
make(192).save(os.path.join(HERE, "icon-192.png"))
make(180).save(os.path.join(HERE, "icon-180.png"))
make(512, maskable=True).save(os.path.join(HERE, "icon-maskable-512.png"))
print("icons written")
