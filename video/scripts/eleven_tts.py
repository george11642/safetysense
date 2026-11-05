#!/usr/bin/env python3
"""ElevenLabs TTS with character timestamps + a character ledger.

Usage: eleven_tts.py --voice ID --model MODEL --text "..." --out path.mp3 [--note "..."]
Writes path.mp3, path.align.json (raw alignment) and appends to video/raw/vo/ELEVEN_LEDGER.md.
Refuses to run if the ledger total would exceed HARD_CAP characters.
Reads ELEVENLABS_API_KEY from the environment (never printed).
"""
import argparse, base64, json, os, re, sys, urllib.request, pathlib

HARD_CAP = 8000
ROOT = pathlib.Path(__file__).resolve().parents[1]
LEDGER = ROOT / "raw/vo/ELEVEN_LEDGER.md"

def spent():
    if not LEDGER.exists():
        return 0
    return sum(int(m) for m in re.findall(r"^\| [^|]+ \| (\d+) \|", LEDGER.read_text(), re.M))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", required=True)
    ap.add_argument("--model", default="eleven_v3")
    ap.add_argument("--text", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--note", default="")
    ap.add_argument("--stability", type=float, default=0.5)
    ap.add_argument("--similarity", type=float, default=0.75)
    ap.add_argument("--style", type=float, default=0.3)
    ap.add_argument("--speed", type=float, default=None)
    ap.add_argument("--prev", default=None)
    ap.add_argument("--next", default=None)
    a = ap.parse_args()
    n = len(a.text)
    total = spent()
    if total + n > HARD_CAP:
        sys.exit(f"REFUSED: ledger {total} + {n} > {HARD_CAP}")
    vs = {"stability": a.stability, "similarity_boost": a.similarity, "style": a.style, "use_speaker_boost": True}
    if a.speed:
        vs["speed"] = a.speed
    body = {"text": a.text, "model_id": a.model, "voice_settings": vs}
    if a.prev and a.model != "eleven_v3":
        body["previous_text"] = a.prev
    if a.next and a.model != "eleven_v3":
        body["next_text"] = a.next
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{a.voice}/with-timestamps?output_format=mp3_44100_128",
        data=json.dumps(body).encode(), method="POST",
        headers={"xi-api-key": os.environ["ELEVENLABS_API_KEY"], "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            d = json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code}: {e.read()[:400]!r}")
    out = pathlib.Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(base64.b64decode(d["audio_base64"]))
    al = d.get("normalized_alignment") or d.get("alignment")
    out.with_suffix(".align.json").write_text(json.dumps({"text": a.text, "voice": a.voice, "model": a.model,
        "voice_settings": vs, "alignment": d.get("alignment"), "normalized_alignment": d.get("normalized_alignment")}, indent=1))
    if not LEDGER.exists():
        LEDGER.write_text("# ElevenLabs character ledger\n\nHard cap for this job: 8,000 characters. Account (free tier) had 9,115 left at start (885/10,000 used).\n\n| file | chars | model | voice | note |\n|---|---|---|---|---|\n")
    with LEDGER.open("a") as f:
        f.write(f"| {out.relative_to(ROOT) if out.is_relative_to(ROOT) else out} | {n} | {a.model} | {a.voice} | {a.note} |\n")
    print(f"ok {out.name} chars={n} ledger_total={total+n}")

if __name__ == "__main__":
    main()
