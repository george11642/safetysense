#!/usr/bin/env python3
"""v2_contact.py video.mp4 outdir : extract 5 fps frames and tile them into labelled contact sheets panel_XX.jpg (10x5 per sheet)."""
import os, subprocess, sys, glob, shutil
from PIL import Image, ImageDraw
video, out = sys.argv[1], sys.argv[2]
fr = os.path.join(out, "frames")
shutil.rmtree(fr, ignore_errors=True); os.makedirs(fr)
for p in glob.glob(os.path.join(out, "panel_*.jpg")): os.remove(p)
subprocess.run(["ffmpeg", "-v", "error", "-i", video, "-vf", "fps=5,scale=216:384", os.path.join(fr, "f_%04d.jpg")], check=True)
fs = sorted(glob.glob(os.path.join(fr, "f_*.jpg")))
C, R = 10, 5
for s in range(0, len(fs), C * R):
    chunk = fs[s:s + C * R]
    sheet = Image.new("RGB", (C * 218, R * 386), "black"); d = ImageDraw.Draw(sheet)
    for i, p in enumerate(chunk):
        x, y = (i % C) * 218, (i // C) * 386
        sheet.paste(Image.open(p), (x, y))
        t = (s + i) / 5
        d.rectangle([x, y + 364, x + 60, y + 384], fill="black"); d.text((x + 3, y + 368), f"{t:5.1f}s", fill="yellow")
    sheet.save(os.path.join(out, f"panel_{s // (C * R):02d}.jpg"), quality=80)
print(len(fs), "frames")
