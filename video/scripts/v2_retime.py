#!/usr/bin/env python3
"""r5 caption sync: ElevenLabs character alignment drags some onsets (worst on each clip's last word).
Re-time every word start in public/vo/<v>/manifest.json against (a) whisper-1 word timestamps and (b) the clip's own
speech envelope, so no caption appears after its word is spoken. Caches whisper JSON in raw/vo/<v>/whisper/.
  python3 scripts/v2_retime.py v2"""
import json, os, pathlib, re, subprocess, sys, difflib
import numpy as np
ROOT = pathlib.Path(__file__).resolve().parents[1]
SR = 16000
v = sys.argv[1] if len(sys.argv) > 1 else "v2"
cache = ROOT / f"raw/vo/{v}/whisper"; cache.mkdir(parents=True, exist_ok=True)
norm = lambda w: re.sub(r"[^a-z0-9]", "", w.lower())

def whisper(mp3, out):
    if out.exists(): return json.load(open(out))
    r = subprocess.run(["curl", "-s", "https://api.openai.com/v1/audio/transcriptions", "-H", f"Authorization: Bearer {os.environ['OPENAI_API_KEY']}",
                        "-F", f"file=@{mp3}", "-F", "model=whisper-1", "-F", "response_format=verbose_json", "-F", "timestamp_granularities[]=word"],
                       capture_output=True, text=True, check=True)
    j = json.loads(r.stdout); out.write_text(json.dumps(j, indent=1)); return j

def onsets(mp3):
    x = np.frombuffer(subprocess.check_output(["ffmpeg", "-v", "error", "-i", str(mp3), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"]), np.float32)
    hop = int(0.005 * SR); win = int(0.02 * SR)
    n = (len(x) - win) // hop
    db = np.array([10 * np.log10(np.mean(x[i * hop:i * hop + win] ** 2) + 1e-12) for i in range(n)])
    on = db > (db.max() - 38)
    res, last_off = [], -1
    for i in range(1, n):
        if on[i] and not on[i - 1]:
            if (i - last_off) * 0.005 >= 0.04: res.append(i * 0.005)
        if not on[i] and on[i - 1]: last_off = i
    ends = np.where(on)[0]
    return res, (ends[-1] * 0.005 + 0.02 if len(ends) else len(x) / SR)

man = json.load(open(ROOT / f"public/vo/{v}/manifest.json"))
report = []
for e in man:
    mp3 = ROOT / "public" / e["file"]
    wj = whisper(mp3, cache / f"{e['id']}.json")
    ww = wj.get("words", [])
    ons, speech_end = onsets(mp3)
    W = e["words"]
    sm = difflib.SequenceMatcher(a=[norm(w["word"]) for w in W], b=[norm(w["word"]) for w in ww], autojunk=False)
    wmap = {}
    for op, a0, a1, b0, b1 in sm.get_opcodes():
        if op == "equal":
            for k in range(a1 - a0): wmap[a0 + k] = ww[b0 + k]["start"]
        elif op == "replace" and b1 > b0:
            wmap[a0] = ww[b0]["start"]
    prev = -1.0
    for i, w in enumerate(W):
        s0 = w["start"]; cand = [s0]
        if i in wmap and wmap[i] < s0 and s0 - wmap[i] < 0.7: cand.append(wmap[i])
        # nearest speech onset shortly before the aligned start (onsets after the previous word started)
        near = [o for o in ons if s0 - 0.4 <= o <= s0 + 0.02 and o > prev + 0.08]
        if near: cand.append(near[-1])
        s = min(cand) - 0.03
        if i == len(W) - 1: s = min(s, speech_end - 0.3)
        s = max(s, prev + 0.06, 0.0)
        if abs(s - s0) > 0.1: report.append(f"{e['id']} {w['word']!r}: {s0:.2f} -> {s:.2f}")
        w["start"] = round(s, 3); w["end"] = round(max(w["end"], s + 0.06), 3); prev = s
    j = json.load(open(mp3.with_suffix(".json"))); j["words"] = W
    mp3.with_suffix(".json").write_text(json.dumps(j, indent=1, ensure_ascii=False))
(ROOT / f"public/vo/{v}/manifest.json").write_text(json.dumps(man, indent=1, ensure_ascii=False))
print("\n".join(report)); print(len(report), "words moved >0.1 s")
