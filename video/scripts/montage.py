#!/usr/bin/env python3
"""montage.py out.jpg in1.png in2.png ... [--w 360] : side-by-side contact sheet for reviewing stills."""
import sys
from PIL import Image
args=[a for a in sys.argv[1:]]
w=360
if '--w' in args:
    i=args.index('--w'); w=int(args[i+1]); del args[i:i+2]
out, ins = args[0], args[1:]
ims=[Image.open(p).convert('RGB') for p in ins]
ims=[im.resize((w, int(im.height*w/im.width))) for im in ims]
H=max(im.height for im in ims)
sheet=Image.new('RGB',(w*len(ims)+4*(len(ims)-1),H),'black')
x=0
for im in ims:
    sheet.paste(im,(x,0)); x+=w+4
sheet.save(out,quality=88)
