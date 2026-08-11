"""Render the hand-composed Symbiome social card."""

from __future__ import annotations

from pathlib import Path
import math
import random
import re
from xml.etree import ElementTree

from PIL import Image, ImageDraw, ImageFont


WIDTH = 1732
HEIGHT = 876
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "og.png"
ICON = ROOT / "app" / "icon.svg"

NIGHT = "#292832"
NIGHT_SOFT = "#36333d"
OAT = "#f7ebdd"
PAPER = "#fff9f1"
CLAY = "#e06343"
SAGE = "#8b6347"
LAMP = "#f0b84c"


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(Path("C:/Windows/Fonts") / name), size=size)


def rounded(draw: ImageDraw.ImageDraw, box, radius: int, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


SVG_TOKEN = re.compile(r"[MCZ]|-?\d+(?:\.\d+)?")


def flatten_cubic_path(path_data: str, scale: float, steps: int = 32) -> list[tuple[float, float]]:
    """Flatten this mark's absolute M/C/Z path without changing its 100x100 geometry."""
    tokens = SVG_TOKEN.findall(path_data)
    points: list[tuple[float, float]] = []
    index = 0
    current = (0.0, 0.0)
    start = current

    while index < len(tokens):
        command = tokens[index]
        index += 1
        if command == "M":
            current = (float(tokens[index]), float(tokens[index + 1]))
            index += 2
            start = current
            points.append((current[0] * scale, current[1] * scale))
        elif command == "C":
            control_1 = (float(tokens[index]), float(tokens[index + 1]))
            control_2 = (float(tokens[index + 2]), float(tokens[index + 3]))
            end = (float(tokens[index + 4]), float(tokens[index + 5]))
            index += 6
            origin = current
            for step in range(1, steps + 1):
                t = step / steps
                inverse = 1.0 - t
                x = (
                    inverse**3 * origin[0]
                    + 3 * inverse**2 * t * control_1[0]
                    + 3 * inverse * t**2 * control_2[0]
                    + t**3 * end[0]
                )
                y = (
                    inverse**3 * origin[1]
                    + 3 * inverse**2 * t * control_1[1]
                    + 3 * inverse * t**2 * control_2[1]
                    + t**3 * end[1]
                )
                points.append((x * scale, y * scale))
            current = end
        elif command == "Z":
            points.append((start[0] * scale, start[1] * scale))
        else:
            raise ValueError(f"Unsupported SVG command: {command}")

    return points


def render_symbiome_mark(size: int) -> Image.Image:
    """Render the two canonical icon paths with their original spacing and proportions."""
    supersample = 4
    canvas_size = size * supersample
    mark = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    mark_draw = ImageDraw.Draw(mark, "RGBA")
    icon_root = ElementTree.parse(ICON).getroot()
    paths = [node for node in icon_root.iter() if node.tag.endswith("path")]
    if len(paths) != 2:
        raise ValueError(f"Expected two Symbiome paths in {ICON}, found {len(paths)}")

    for path in paths:
        polygon = flatten_cubic_path(path.attrib["d"], canvas_size / 100)
        mark_draw.polygon(polygon, fill=path.attrib["fill"])

    return mark.resize((size, size), Image.Resampling.LANCZOS)


def main() -> None:
    random.seed(75017)
    image = Image.new("RGB", (WIDTH, HEIGHT), NIGHT)
    draw = ImageDraw.Draw(image, "RGBA")

    # Quiet, deterministic paper grain.
    for _ in range(6200):
        x = random.randrange(WIDTH)
        y = random.randrange(HEIGHT)
        alpha = random.randrange(4, 15)
        tone = (247, 235, 221, alpha) if random.random() > 0.45 else (0, 0, 0, alpha)
        draw.point((x, y), fill=tone)

    # Editorial frame and soft listening-room glow.
    rounded(draw, (32, 32, WIDTH - 32, HEIGHT - 32), 36, None, (247, 235, 221, 40), 2)
    for radius, alpha in ((360, 10), (270, 16), (185, 22)):
        draw.ellipse((1325 - radius, 262 - radius, 1325 + radius, 262 + radius), fill=(240, 184, 76, alpha))

    # Wordmark and restrained proof line.
    brand = font("seguisb.ttf", 34)
    label = font("segoeui.ttf", 25)
    title = font("seguisb.ttf", 112)
    body = font("segoeui.ttf", 31)
    chip = font("seguisb.ttf", 23)

    rounded(draw, (108, 80, 176, 148), 16, PAPER)
    mark = render_symbiome_mark(58)
    image.paste(mark, (113, 85), mark)
    wordmark_x = 196
    draw.text((wordmark_x, 91), "SYMB", font=brand, fill=OAT)
    symb_width = draw.textlength("SYMB", font=brand)
    draw.text((wordmark_x + symb_width, 91), "IOME", font=brand, fill=CLAY)
    draw.text((wordmark_x, 143), "by Lofi Girl", font=label, fill=(247, 235, 221, 155))

    draw.text((108, 254), "Music for", font=title, fill=OAT, stroke_width=1, stroke_fill=OAT)
    draw.text((108, 368), "every project.", font=title, fill=OAT, stroke_width=1, stroke_fill=OAT)
    draw.text((112, 515), "High-quality instrumental music for creators", font=body, fill=(247, 235, 221, 205))
    draw.text((112, 558), "and businesses. Made by people.", font=body, fill=(247, 235, 221, 205))

    chip_y = 666
    rounded(draw, (108, chip_y, 415, chip_y + 62), 31, (247, 235, 221, 22), (247, 235, 221, 54), 1)
    rounded(draw, (429, chip_y, 746, chip_y + 62), 31, (224, 99, 67, 32), (224, 99, 67, 90), 1)
    draw.text((136, chip_y + 17), "10,000+ TRACKS", font=chip, fill=OAT)
    draw.text((457, chip_y + 17), "ZERO AI MUSIC", font=chip, fill=OAT)

    # Code-built listening-room vignette: record, sleeve, desk and lamp.
    rounded(draw, (1010, 180, 1548, 695), 30, PAPER, None)
    draw.rectangle((1010, 180, 1105, 695), fill=CLAY)
    draw.ellipse((855, 78, 1255, 478), fill=(224, 99, 67, 225))
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
    rounded(draw, (872, 684, 1650, 786), 18, (54, 45, 42, 255), (247, 235, 221, 28), 2)
    draw.ellipse((1425, 546, 1627, 665), fill=(224, 99, 67, 255))
    rounded(draw, (1515, 635, 1534, 748), 9, LAMP)
    rounded(draw, (1460, 735, 1594, 758), 12, LAMP)
    draw.ellipse((1487, 629, 1562, 702), fill=(240, 184, 76, 40))

    # A minimal plant silhouette softens the edge without becoming illustrative.
    draw.line((1644, 445, 1600, 696), fill=(139, 99, 71, 170), width=9)
    for x, y, angle in ((1615, 508, -18), (1642, 548, 20), (1598, 583, -22), (1625, 625, 18)):
        leaf = Image.new("RGBA", (96, 52), (0, 0, 0, 0))
        leaf_draw = ImageDraw.Draw(leaf, "RGBA")
        leaf_draw.ellipse((3, 6, 92, 47), fill=(139, 99, 71, 150))
        leaf = leaf.rotate(angle, expand=True, resample=Image.Resampling.BICUBIC)
        image.paste(leaf, (x - leaf.width // 2, y - leaf.height // 2), leaf)

    image.save(OUTPUT, optimize=True, quality=95)
    print(f"Rendered {OUTPUT} ({WIDTH}x{HEIGHT})")


if __name__ == "__main__":
    main()
