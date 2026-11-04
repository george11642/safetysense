"""Wrap app screenshots in a simple dark phone frame (rounded corners, transparent outside).

Usage: python3 presentation/build/frame_screens.py
Reads design/screens/*.png, writes presentation/build/frames/<name>.png (about 640 px wide).
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "design" / "screens"
OUT = Path(__file__).resolve().parent / "frames"
OUT.mkdir(exist_ok=True)

SCREENS = [
    "01-onboarding-welcome", "02-onboarding-promises", "05-onboarding-triggers",
    "09-onboarding-drill", "10-home-night-out", "14-guard-active", "15-check-in",
    "16-alert-countdown", "17-alert-active", "18-support", "20-vault-unlocked",
    "23-date-setup", "26-live-activity-lock", "integration-09-alert-active-dispatch",
    "integration-10-alert-active-contact-events", "22-settings",
]

W = 640           # target screen width in px
BEZEL = 18        # frame thickness
RADIUS = 92       # outer corner radius
FRAME = (46, 44, 64, 255)     # bezel colour, a lighter tone of the app card colour
EDGE = (78, 75, 102, 255)     # thin highlight ring


def rounded_mask(size, radius):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=radius, fill=255)
    return m


for name in SCREENS:
    src = SRC / f"{name}.png"
    if not src.exists():
        print("missing", src)
        continue
    im = Image.open(src).convert("RGB")
    h = round(im.height * W / im.width)
    im = im.resize((W, h), Image.LANCZOS)
    ow, oh = W + 2 * BEZEL, h + 2 * BEZEL
    canvas = Image.new("RGBA", (ow, oh), (0, 0, 0, 0))
    d = ImageDraw.Draw(canvas)
    d.rounded_rectangle([0, 0, ow - 1, oh - 1], radius=RADIUS, fill=EDGE)
    d.rounded_rectangle([3, 3, ow - 4, oh - 4], radius=RADIUS - 3, fill=FRAME)
    canvas.paste(im, (BEZEL, BEZEL), rounded_mask((W, h), RADIUS - BEZEL))
    canvas.save(OUT / f"{name}.png", optimize=True)
    print("framed", name, canvas.size)
