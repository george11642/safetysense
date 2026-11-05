#!/usr/bin/env python3
"""Splice ElevenLabs takes at sentence boundaries (keeps character alignment).
vo_splice.py OUT.mp3 SRC1.mp3:START_TEXT:END_TEXT SRC2.mp3:... [--gap 0.3]
Each segment keeps the source characters from the first occurrence of START_TEXT through END_TEXT (inclusive),
'^'/'$' meaning start/end of the take. Writes OUT.mp3 + OUT.align.json (alignment shifted onto the new timeline)."""
import json, pathlib, subprocess, sys
import numpy as np
SR = 44100
def decode(p):
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", str(p), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"])
    return np.frombuffer(raw, dtype=np.float32).copy()
args = sys.argv[1:]; gap = 0.3
if "--gap" in args:
    i = args.index("--gap"); gap = float(args[i + 1]); del args[i:i + 2]
out = pathlib.Path(args[0]); segs = args[1:]
audio, chars, st, en, texts, t = [], [], [], [], [], 0.0
for k, s in enumerate(segs):
    src, a_txt, b_txt = s.split(":")
    al = json.load(open(pathlib.Path(src).with_suffix(".align.json")))
    A = al["alignment"]; text = "".join(A["characters"])
    i0 = 0 if a_txt == "^" else text.index(a_txt)
    i1 = len(text) - 1 if b_txt == "$" else text.index(b_txt, i0) + len(b_txt) - 1
    x = decode(src)
    t0 = 0.0
    if i0 > 0:  # cut at the quietest 20 ms between the previous word and this one (alignment onsets can run late)
        lo, hi = A["character_end_times_seconds"][max(0, i0 - 2)], A["character_start_times_seconds"][i0] + 0.02
        win = int(0.02 * SR); best, t0 = 1e9, max(0.0, hi - 0.1)
        for k in range(int(lo * SR), max(int(lo * SR) + 1, int(hi * SR) - win), int(0.005 * SR)):
            e = float(np.mean(x[k:k + win] ** 2)) if k + win <= len(x) else 1e9
            if e < best: best, t0 = e, k / SR
    t1 = len(x) / SR if i1 == len(text) - 1 else min(len(x) / SR, A["character_end_times_seconds"][i1] + 0.14)
    seg = x[int(t0 * SR):int(t1 * SR)].copy()
    f = int(0.012 * SR); seg[:f] *= np.linspace(0, 1, f); seg[-f:] *= np.linspace(1, 0, f)
    if k:
        audio.append(np.zeros(int(gap * SR), np.float32)); t += gap
        chars.append(" "); st.append(round(t - gap / 2, 3)); en.append(round(t - gap / 2, 3))
    for c, a, b in zip(A["characters"][i0:i1 + 1], A["character_start_times_seconds"][i0:i1 + 1], A["character_end_times_seconds"][i0:i1 + 1]):
        chars.append(c); st.append(round(a - t0 + t, 3)); en.append(round(b - t0 + t, 3))
    audio.append(seg); t += len(seg) / SR
    texts.append(text[i0:i1 + 1].strip())
y = np.concatenate(audio)
subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", "-c:a", "libmp3lame", "-b:a", "192k", str(out)],
               input=y.astype(np.float32).tobytes(), check=True)
txt = " ".join(texts)
assert "".join(chars).replace("  ", " ") .strip() == "".join(chars).strip()
A = {"characters": chars, "character_start_times_seconds": st, "character_end_times_seconds": en}
out.with_suffix(".align.json").write_text(json.dumps({"text": "".join(chars), "spliced_from": segs, "alignment": A, "normalized_alignment": None}, indent=1))
print("ok", out.name, round(t, 2), "s:", "".join(chars))
