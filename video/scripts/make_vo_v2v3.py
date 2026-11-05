#!/usr/bin/env python3
"""Generate v2/v3 narration with ElevenLabs (Brian, eleven_v4), normalize, build manifests.

  python3 scripts/make_vo_v2v3.py gen v2 [ids...]   # synthesize (spends ElevenLabs characters!)
  python3 scripts/make_vo_v2v3.py build v2          # normalize + manifest only (free)

Raw takes: raw/vo/<v>/<id>.mp3 + .align.json   Final: public/vo/<v>/<id>.mp3 + <id>.json + manifest.json
"""
import difflib, json, pathlib, re, subprocess, sys, tempfile
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[1]
VOICE = "nPczCjzI2devNBz1zQrb"  # Brian
MODEL = "eleven_v4"

def lines(v):
    return json.load(open(ROOT / f"scripts/vo_lines_{v}.json"))

def gen(v, ids):
    L = lines(v)
    for i, l in enumerate(L):
        if ids and l["id"] not in ids:
            continue
        say = l.get("tts", l["text"])
        cmd = ["python3", str(ROOT / "scripts/eleven_tts.py"), "--voice", VOICE, "--model", MODEL, "--text", say,
               "--out", str(ROOT / f"raw/vo/{v}/{l['id']}.mp3"), "--note", f"{v} final {l['id']}",
               "--stability", str(l.get("stability", 0.5)), "--style", str(l.get("style", 0.3))]
        if i > 0:
            cmd += ["--prev", L[i - 1].get("tts", L[i - 1]["text"])]
        if i + 1 < len(L):
            cmd += ["--next", L[i + 1].get("tts", L[i + 1]["text"])]
        r = subprocess.run(cmd, capture_output=True, text=True)
        print(r.stdout.strip() or r.stderr.strip()[-300:])
        if r.returncode:
            sys.exit(1)

def strip_tags(chars, starts, ends):
    """Drop ElevenLabs audio tags like [softly] (and the space after them) from the character alignment."""
    out, depth = [], 0
    for c, a, b in zip(chars, starts, ends):
        if c == "[": depth += 1; continue
        if c == "]": depth = max(0, depth - 1); continue
        if depth: continue
        out.append((c, a, b))
    while out and out[0][0].isspace(): out.pop(0)
    return [o[0] for o in out], [o[1] for o in out], [o[2] for o in out]

def words_from_chars(text, chars, starts, ends):
    """Group character timings into whitespace-separated words of `text`."""
    chars, starts, ends = strip_tags(chars, starts, ends)
    s = "".join(chars)
    if s != text:  # fall back to aligning via the joined string
        text = s
    out, cur, ws, we = [], "", None, None
    for c, a, b in zip(chars, starts, ends):
        if c.isspace():
            if cur:
                out.append({"word": cur, "start": ws, "end": we}); cur = ""
            continue
        if not cur:
            ws = a
        cur += c; we = b
    if cur:
        out.append({"word": cur, "start": ws, "end": we})
    return out

def norm(w):
    return re.sub(r"[^a-z0-9]", "", w.lower())

def map_display(display, tw):
    """Map display tokens (e.g. '70%') onto timed TTS words (e.g. 'seventy percent')."""
    dt = display.split()
    sm = difflib.SequenceMatcher(a=[norm(w) for w in dt], b=[norm(w["word"]) for w in tw], autojunk=False)
    res = []
    for op, a0, a1, b0, b1 in sm.get_opcodes():
        if op == "equal":
            for k in range(a1 - a0):
                res.append({"word": dt[a0 + k], "start": tw[b0 + k]["start"], "end": tw[b0 + k]["end"]})
        elif a1 > a0:
            if b1 > b0:
                t0, t1 = tw[b0]["start"], tw[b1 - 1]["end"]
            else:  # display-only token: zero-length at neighbour
                t0 = t1 = res[-1]["end"] if res else (tw[0]["start"] if tw else 0)
            n = a1 - a0
            for k in range(n):
                res.append({"word": dt[a0 + k], "start": t0 + (t1 - t0) * k / n, "end": t0 + (t1 - t0) * (k + 1) / n})
    return [{"word": w["word"], "start": round(w["start"], 3), "end": round(w["end"], 3)} for w in res]

def dur(p):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)]))

def measure_i(path):
    e = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True).stderr
    i = [l for l in e.splitlines() if l.strip().startswith("I:")][-1]
    return float(i.split()[1])

def loudnorm(src, dst, target=-16.0):
    """Static gain to `target` LUFS (integrated) + a transparent peak limiter at -1.5 dBFS.
    (ffmpeg's loudnorm falls back to dynamic mode on short clips, so we use measured gain instead.)"""
    g = target - measure_i(src)
    for _ in range(2):
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-af",
                        f"volume={g:.2f}dB,alimiter=limit=0.84:attack=2:release=40:level=disabled,aresample=44100",
                        "-c:a", "libmp3lame", "-b:a", "192k", str(dst)], check=True)
        err = target - measure_i(dst)
        if abs(err) < 0.3: break
        g += err

SR = 44100
MAX_PAUSE = {"v2": 0.26, "v3": 0.40}   # reel is punchier than the demo
TAIL = 0.15
TEMPO = {"v2": 1.03, "v3": 1.0}   # v2 reel: +3% pace (pitch-preserving) to land at ~110 s

def decode(p):
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", str(p), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"])
    return np.frombuffer(raw, dtype=np.float32).copy()

def tighten(x, max_pause, thresh_db=-45.0):
    """Shorten internal pauses longer than max_pause (keep half on each side, 8 ms crossfade) and trim the tail.
    Returns (audio, remap) where remap(t_orig) -> t_new."""
    win = int(0.01 * SR)
    n = len(x) // win
    rms = np.sqrt(np.mean(x[: n * win].reshape(n, win) ** 2, axis=1) + 1e-12)
    quiet = 20 * np.log10(rms) < thresh_db
    voiced = np.where(~quiet)[0]
    if len(voiced) == 0:
        return x, (lambda t: t)
    first, last = voiced[0], voiced[-1]
    cuts = []  # (start_sample, end_sample) removed
    i = first
    while i <= last:
        if quiet[i]:
            j = i
            while j <= last and quiet[j]:
                j += 1
            dur_s = (j - i) * win / SR
            if dur_s > max_pause:
                # soft-knee: keep the cap plus 30% of the excess, so longer pauses stay longer (no "bullet list" feel)
                target = max_pause + 0.3 * (dur_s - max_pause)
                keep = int(target / 2 * SR)
                if j * win - keep > i * win + keep:
                    cuts.append((i * win + keep, j * win - keep))
            i = j
        else:
            i += 1
    end_keep = min(len(x), (last + 1) * win + int(TAIL * SR))
    xf = int(0.008 * SR)
    out, pos = [], 0
    for a, b in cuts:
        seg = x[pos:a].copy()
        if out and len(seg) > xf:
            prev = out[-1]
            ramp = np.linspace(0, 1, xf, dtype=np.float32)
            prev[-xf:] = prev[-xf:] * (1 - ramp) + seg[:xf] * ramp
            seg = seg[xf:]
        out.append(seg)
        pos = b
    tail = x[pos:end_keep].copy()
    if out and len(tail) > xf:
        prev = out[-1]
        ramp = np.linspace(0, 1, xf, dtype=np.float32)
        prev[-xf:] = prev[-xf:] * (1 - ramp) + tail[:xf] * ramp
        tail = tail[xf:]
    out.append(tail)
    y = np.concatenate(out)
    fade = int(0.03 * SR)
    y[-fade:] *= np.linspace(1, 0, fade, dtype=np.float32)
    removed = [(a / SR, (b - a) / SR) for a, b in cuts]
    def remap(t):
        shift = 0.0
        for a, d in removed:
            if t >= a + d:
                shift += d + 0.008
            elif t > a:
                shift += (t - a)
        return max(0.0, t - shift)
    return y, remap

def build(v):
    out_dir = ROOT / f"public/vo/{v}"
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest, total = [], 0.0
    for l in lines(v):
        raw = ROOT / f"raw/vo/{v}/{l['id']}.mp3"
        al = json.load(open(raw.with_suffix(".align.json")))
        a = al["alignment"]
        x = decode(raw)
        y, remap0 = tighten(x, l.get("maxPause", MAX_PAUSE[v]))
        tempo = TEMPO[v]
        remap = (lambda f, k: (lambda t: f(t) / k))(remap0, tempo)
        a = {"characters": a["characters"],
             "character_start_times_seconds": [round(remap(t), 3) for t in a["character_start_times_seconds"]],
             "character_end_times_seconds": [round(remap(t), 3) for t in a["character_end_times_seconds"]]}
        tw = words_from_chars(al["text"], a["characters"], a["character_start_times_seconds"], a["character_end_times_seconds"])
        words = map_display(l["text"], tw)
        dst = out_dir / f"{l['id']}.mp3"
        with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
            subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-"]
                           + (["-af", f"atempo={tempo}"] if tempo != 1.0 else []) + [tmp.name],
                           input=y.astype(np.float32).tobytes(), check=True)
            # optional dramatic pauses inserted after given words (e.g. {"still.": 0.6}); shifts later words + chars
            for pw, psec in (l.get("pauseAfter") or {}).items():
                hit = next((w for w in words if w["word"] == pw), None)
                if not hit:
                    sys.exit(f"pauseAfter: no word {pw!r} in {l['id']}")
                nxt = [w for w in words if w["start"] > hit["end"] - 1e-6 and w is not hit]
                cut = (hit["end"] + nxt[0]["start"]) / 2 if nxt else hit["end"]
                z = decode(tmp.name)
                k = int(cut * SR)
                z = np.concatenate([z[:k], np.zeros(int(psec * SR), dtype=np.float32), z[k:]])
                subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", tmp.name],
                               input=z.astype(np.float32).tobytes(), check=True)
                for w in words:
                    if w["start"] >= cut:
                        w["start"] = round(w["start"] + psec, 3); w["end"] = round(w["end"] + psec, 3)
                a["character_start_times_seconds"] = [round(t + psec, 3) if t >= cut else t for t in a["character_start_times_seconds"]]
                a["character_end_times_seconds"] = [round(t + psec, 3) if t >= cut else t for t in a["character_end_times_seconds"]]
            loudnorm(tmp.name, dst)
        d = round(dur(dst), 3)
        total += d
        last_end = min(d, max(w["end"] for w in words))
        for w in words:
            w["end"] = min(w["end"], d)
        entry = {"id": l["id"], "file": f"vo/{v}/{l['id']}.mp3", "durationSec": d, "text": l["text"],
                 "spoken": re.sub(r"\[[^\]]*\]\s*", "", al["text"]), "words": words}
        (out_dir / f"{l['id']}.json").write_text(json.dumps({**entry, "charAlignment": a}, indent=1, ensure_ascii=False))
        manifest.append(entry)
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False))
    print(f"{v}: {len(manifest)} clips, {total:.2f} s total")

if __name__ == "__main__":
    cmd, v, *ids = sys.argv[1:]
    if cmd == "gen":
        gen(v, ids)
    if cmd in ("gen", "build") and not ids:
        build(v)
