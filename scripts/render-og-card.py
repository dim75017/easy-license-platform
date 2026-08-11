"""Render the hand-composed Symbiose social card."""

from __future__ import annotations

from pathlib import Path
import math
import random

from PIL import Image, ImageDraw, ImageFont


WIDTH = 1732
HEIGHT = 876
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "og.png"

NIGHT = "#292832"
NIGHT_SOFT = "#36333d"
OAT = "#f3ece0"
PAPER = "#fbf7ef"
CLAY = "#b97864"
SAGE = "#7e8976"
LAMP = "#d1a25e"


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(Path("C:/Windows/Fonts") / name), size=size)


def rounded(draw: ImageDraw.ImageDraw, box, radius: int, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def main() -> None:
    random.seed(75017)
    image = Image.new("RGB", (WIDTH, HEIGHT), NIGHT)
    draw = ImageDraw.Draw(image, "RGBA")

    # Quiet, deterministic paper grain.
    for _ in range(6200):
        x = random.randrange(WIDTH)
        y = random.randrange(HEIGHT)
        alpha = random.randrange(4, 15)
        tone = (243, 236, 224, alpha) if random.random() > 0.45 else (0, 0, 0, alpha)
        draw.point((x, y), fill=tone)

    # Editorial frame and soft listening-room glow.
    rounded(draw, (32, 32, WIDTH - 32, HEIGHT - 32), 36, None, (243, 236, 224, 40), 2)
    for radius, alpha in ((360, 10), (270, 16), (185, 22)):
        draw.ellipse((1325 - radius, 262 - radius, 1325 + radius, 262 + radius), fill=(209, 162, 94, alpha))

    # Wordmark and restrained proof line.
    brand = font("seguisb.ttf", 34)
    label = font("segoeui.ttf", 25)
    title = font("seguisb.ttf", 112)
    body = font("segoeui.ttf", 31)
    chip = font("seguisb.ttf", 23)

    draw.text((112, 91), "SYMB", font=brand, fill=OAT)
    symb_width = draw.textlength("SYMB", font=brand)
    draw.text((112 + symb_width, 91), "IOSE", font=brand, fill=CLAY)
    draw.text((112, 143), "by Lofi Girl", font=label, fill=(243, 236, 224, 155))

    draw.text((108, 254), "Music for", font=title, fill=OAT, stroke_width=1, stroke_fill=OAT)
    draw.text((108, 368), "every project.", font=title, fill=OAT, stroke_width=1, stroke_fill=OAT)
    draw.text((112, 515), "High-quality instrumental music for creators", font=body, fill=(243, 236, 224, 205))
    draw.text((112, 558), "and businesses. Made by people.", font=body, fill=(243, 236, 224, 205))

    chip_y = 666
    rounded(draw, (108, chip_y, 415, chip_y + 62), 31, (243, 236, 224, 22), (243, 236, 224, 54), 1)
    rounded(draw, (429, chip_y, 746, chip_y + 62), 31, (185, 120, 100, 32), (185, 120, 100, 90), 1)
    draw.text((136, chip_y + 17), "10,000+ TRACKS", font=chip, fill=OAT)
    draw.text((457, chip_y + 17), "ZERO AI MUSIC", font=chip, fill=OAT)

    # Code-built listening-room vignette: record, sleeve, desk and lamp.
    rounded(draw, (1010, 180, 1548, 695), 30, PAPER, None)
    draw.rectangle((1010, 180, 1105, 695), fill=CLAY)
    draw.ellipse((855, 78, 1255, 478), fill=(185, 120, 100, 225))
    draw.ellipse((908, 131, 1202, 425), fill=NIGHT_SOFT)

    # Vinyl with subtle grooves.
    cx, cy = 1312, 455
    for radius in range(215, 52, -13):
        shade = 58 + int(10 * math.sin(radius / 17))
        draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), outline=(shade, shade - 2, shade + 8, 165), width=4)
    draw.ellipse((cx - 220, cy - 220, cx + 220, cy + 220), outline=(41, 40, 50, 255), width=22)
    draw.ellipse((cx - 64, cy - 64, cx + 64, cy + 64), fill=CLAY)
    draw.ellipse((cx - 8, cy - 8, cx + 8, cy + 8), fill=NIGHT)

    # Wooden desk and a small warm lamp.
    rounded(draw, (872, 684, 1650, 786), 18, (54, 45, 42, 255), (243, 236, 224, 28), 2)
    draw.ellipse((1425, 546, 1627, 665), fill=(185, 120, 100, 255))
    rounded(draw, (1515, 635, 1534, 748), 9, LAMP)
    rounded(draw, (1460, 735, 1594, 758), 12, LAMP)
    draw.ellipse((1487, 629, 1562, 702), fill=(209, 162, 94, 40))

    # A minimal plant silhouette softens the edge without becoming illustrative.
    draw.line((1644, 445, 1600, 696), fill=(126, 137, 118, 170), width=9)
    for x, y, angle in ((1615, 508, -18), (1642, 548, 20), (1598, 583, -22), (1625, 625, 18)):
        leaf = Image.new("RGBA", (96, 52), (0, 0, 0, 0))
        leaf_draw = ImageDraw.Draw(leaf, "RGBA")
        leaf_draw.ellipse((3, 6, 92, 47), fill=(126, 137, 118, 150))
        leaf = leaf.rotate(angle, expand=True, resample=Image.Resampling.BICUBIC)
        image.paste(leaf, (x - leaf.width // 2, y - leaf.height // 2), leaf)

    image.save(OUTPUT, optimize=True, quality=95)
    print(f"Rendered {OUTPUT} ({WIDTH}x{HEIGHT})")


if __name__ == "__main__":
    main()
