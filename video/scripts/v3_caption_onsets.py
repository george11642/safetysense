#!/usr/bin/env python3
"""v3_caption_onsets.py: caption-only onset snap. The aligner parks phrase-initial word starts 0.15-0.25 s late after
every pause. For each word that follows a pause (or opens a beat), find the measured speech onset (silencedetect
-40 dB, d=0.08 on public/vo/v3/<id>.mp3: the silence_end right before the aligned start) and write it to
scripts/v3_caption_onsets.json as {beatId: {wordIndex: absoluteOnsetSec}}. Cut timing (w()/bStart) is untouched;
only the caption highlight uses these."""
import json, re, subprocess
t = json.load(open('scripts/v3_timeline.json'))
out, n = {}, 0
for b in t['beats']:
    err = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', f"public/{b['file']}", '-af', 'silencedetect=noise=-40dB:d=0.08', '-f', 'null', '-'], capture_output=True, text=True).stderr
    se = [b['startSec'] + float(x) for x in re.findall(r'silence_end: ([\d.]+)', err)]
    ws = b['words']
    for i, wd in enumerate(ws):
        # any word that sits right after a measured pause (the aligner also stretches the previous word's end into
        # the pause, so the gap in the alignment can look tiny)
        prevStart = ws[i - 1]['start'] if i else b['startSec'] - 1
        cands = [e for e in se if wd['start'] - 0.4 <= e <= wd['start'] + 0.06 and e >= prevStart + 0.12]
        if not cands: continue
        on = round(max(cands), 3)
        if wd['start'] - on > 0.04:
            out.setdefault(b['id'], {})[str(i)] = on
            n += 1
            print(f"{b['id']} {wd['word']:<14} {wd['start']:.2f} -> {on:.2f} ({(wd['start']-on)*1000:.0f} ms)")
json.dump(out, open('scripts/v3_caption_onsets.json', 'w'), indent=1)
print(n, 'onsets')
