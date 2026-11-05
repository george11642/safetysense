#!/usr/bin/env python3
"""v2_sheet.py out.jpg cols w img... : grid contact sheet with frame labels."""
import sys, os
from PIL import Image, ImageDraw
out, cols, w = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
ins = sys.argv[4:]
ims = [Image.open(p).convert('RGB') for p in ins]
h = int(ims[0].height * w / ims[0].width)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (w + 4), rows * (h + 4)), 'black')
d = ImageDraw.Draw(sheet)
for i, (im, p) in enumerate(zip(ims, ins)):
    x, y = (i % cols) * (w + 4), (i // cols) * (h + 4)
    sheet.paste(im.resize((w, h)), (x, y))
    d.rectangle([x, y, x + 70, y + 18], fill='black')
    d.text((x + 3, y + 3), os.path.basename(p).split('.')[0][-5:], fill='yellow')
sheet.save(out, quality=85)
