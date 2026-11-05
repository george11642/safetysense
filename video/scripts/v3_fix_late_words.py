#!/usr/bin/env python3
"""v3_fix_late_words.py [--write]: pull sentence-final words whose aligned start sits inside the trailing pause
back onto the speech (silencedetect -40 dB, d=0.1 on each public/vo/v3/<id>.mp3). Rule: if a word starts within
60 ms of (or after) a silence_start and before that silence ends, start = previous word end + 0.06, end = silence_start."""
import json, re, subprocess, sys
TL = 'scripts/v3_timeline.json'
t = json.load(open(TL))
changes = []
for b in t['beats']:
    out = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', f"public/{b['file']}", '-af', 'silencedetect=noise=-40dB:d=0.1', '-f', 'null', '-'], capture_output=True, text=True).stderr
    ss = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', out)]
    se = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', out)]
    sil = [(b['startSec'] + a, b['startSec'] + (se[i] if i < len(se) else 1e9)) for i, a in enumerate(ss)]
    ws = b['words']
    for i in range(1, len(ws)):
        wd, prev = ws[i], ws[i - 1]
        for a, z in sil:
            if a - 0.06 <= wd['start'] < z - 0.05 and a > prev['end'] + 0.1:
                ns, ne = round(prev['end'] + 0.06, 3), round(a, 3)
                if ne - ns > 0.08:
                    changes.append((b['id'], wd['word'], wd['start'], wd['end'], ns, ne))
                    wd['start'], wd['end'] = ns, ne
                break
        else:
            # a long gap after the previous word with no pause in it: the aligner parked the start late
            gap = wd['start'] - prev['end']
            if gap > 0.25 and re.search(r'[.,?!;:]$', wd['word']) and not any(prev['end'] - 0.05 <= a <= wd['start'] for a, z in sil):
                ns = round(prev['end'] + 0.06, 3)
                nxt = [a for a, z in sil if ns < a < wd['end']]
                ne = round(nxt[0], 3) if nxt else wd['end']
                changes.append((b['id'], wd['word'], wd['start'], wd['end'], ns, ne))
                wd['start'], wd['end'] = ns, ne
for c in changes: print('%s %-14s %.2f-%.2f -> %.2f-%.2f' % c)
if '--write' in sys.argv: json.dump(t, open(TL, 'w'), indent=1); print('written')
