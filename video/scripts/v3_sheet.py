#!/usr/bin/env python3
"""v3_sheet.py <out.jpg> <img...>: tile stills 3-wide with a time label."""
import sys, re
from PIL import Image, ImageDraw
out, fs = sys.argv[1], sys.argv[2:]
ims = [Image.open(f).convert('RGB') for f in fs]
w, h = ims[0].size
cols = 3 if len(ims) > 4 else 2
rows = (len(ims) + cols - 1) // cols
S = Image.new('RGB', (w * cols, h * rows), (40, 40, 40))
for i, (f, im) in enumerate(zip(fs, ims)):
    im = im.resize((w, h))
    d = ImageDraw.Draw(im)
    m = re.search(r'_(\d+)\.', f)
    if m: d.text((8, 8), f"{int(m.group(1))/30:.2f}s f{int(m.group(1))}", fill=(255, 255, 0))
    S.paste(im, ((i % cols) * w, (i // cols) * h))
S.save(out, quality=82)
