#!/usr/bin/env python3
"""Make v2-specific copies of app screenshots so on-screen details match the story:
Maya is the user (not a contact), the clock matches the scene, and the mode chip matches the scenario.
Writes public/v2/screens/*.png. Source screenshots in ../design/screens are never modified."""
import pathlib
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT.parent / "design/screens"
OUT = ROOT / "public/v2/screens"
OUT.mkdir(parents=True, exist_ok=True)
SF = "/System/Library/Fonts/SFNS.ttf"
MONO = "/System/Library/Fonts/SFNSMono.ttf"


def font(path, size, wght):
    f = ImageFont.truetype(path, size)
    if path == MONO:
        f.set_variation_by_axes([wght, wght])
    else:
        f.set_variation_by_axes([100, 28, 400, wght])  # width, optical size, grade, weight
    return f


def patch(im, box, text, size, wght=500, color=(240, 238, 248), align="l", bg_at=None, mono=False, pad=0):
    d = ImageDraw.Draw(im)
    x0, y0, x1, y1 = box
    bx, by = bg_at or (x0 - 6, (y0 + y1) // 2)
    bg = im.getpixel((bx, by))
    d.rectangle([x0 - pad, y0, x1 + pad, y1], fill=bg)
    if not text:
        return
    f = font(MONO if mono else SF, size, wght)
    l, t, r, b = d.textbbox((0, 0), text, font=f)
    w = r - l
    cy = (y0 + y1) / 2 - (t + b) / 2
    x = x0 - l if align == "l" else (x1 - w - l if align == "r" else (x0 + x1) / 2 - w / 2 - l)
    d.text((x, cy), text, font=f, fill=color)


def status(im, t):
    patch(im, (150, 62, 300, 132), t, 50, 650, color=(255, 255, 255), align="c", bg_at=(140, 40))


def guard(name, clock, mode, elapsed, checkin, left):
    im = Image.open(SRC / "14-guard-active.png").convert("RGB")
    status(im, clock)
    if mode:
        patch(im, (835, 222, 1150, 302), mode, 46, 560, color=(196, 192, 214), align="r", bg_at=(1170, 260))
    if elapsed:
        patch(im, (420, 625, 790, 765), elapsed, 128, 600, color=(244, 242, 250), align="c", bg_at=(600, 610))
    patch(im, (880, 1215, 1105, 1290), checkin, 46, 650, color=(244, 242, 250), align="r", bg_at=(860, 1250))
    patch(im, (770, 1335, 1105, 1405), left, 44, 450, color=(178, 174, 196), align="r", bg_at=(750, 1370))
    patch(im, (215, 2475, 1110, 2550), "Your 3 trusted contacts get a call and", 44, 420, color=(178, 174, 196), bg_at=(200, 2510))
    im.save(OUT / f"{name}.png")


def home(src, name, clock):
    im = Image.open(SRC / f"{src}.png").convert("RGB")
    status(im, clock)
    patch(im, (55, 222, 600, 268), "GOOD EVENING, MAYA", 36, 500, color=(239, 123, 155), mono=True, bg_at=(40, 245))
    patch(im, (100, 2135, 420, 2205), "Mom", 46, 450, color=(240, 238, 248), bg_at=(90, 2170))
    patch(im, (112, 1995, 200, 2068), "MO", 34, 600, color=(239, 123, 155), align="c", bg_at=(155, 2000))
    im.save(OUT / f"{name}.png")


def checkin(name, clock):
    im = Image.open(SRC / "15-check-in.png").convert("RGB")
    status(im, clock)
    patch(im, (40, 1868, 1166, 1940), "If you don't answer, your 3 contacts will be", 41, 420, color=(150, 146, 170), align="c", bg_at=(30, 1900))
    im.save(OUT / f"{name}.png")


home("11-home-walk", "home-walk", "12:04")
home("13-home-ride", "home-ride", "1:40")
guard("guard-walk", "12:04", "Walk Home", "0:04", "12:19 AM", "14 min, 56 sec")
guard("guard-night", "10:48", None, None, "11:15 PM", "26 min, 40 sec")
guard("guard-ride", "1:41", "Ride", "0:31", "1:58 AM", "17 min, 12 sec")
checkin("checkin-night", "11:31")
checkin("checkin-ride", "1:44")
print("ok", sorted(p.name for p in OUT.iterdir()))
