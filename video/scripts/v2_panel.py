#!/usr/bin/env python3
"""Adversarial review panel for the v2 reel.

Usage: python3 scripts/v2_panel.py <video.mp4> <sheets_dir> <out.json> [round_label]
  - Judges 1-2 (Gemini 3.1 Pro, Gemini 3.8 Flash) watch the full MP4 WITH audio.
  - Judge 3 (GPT-5.5) reads 5 fps contact sheets + the script.
Every judge must answer JSON {verdict: APPROVE|REVISE, score: 0-10, blocking: [...], nits: [...]}.
Keys come from ~/.config/global.env (never printed).
"""
import base64, glob, json, os, sys, time
import requests

VIDEO, SHEETS, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
LABEL = sys.argv[4] if len(sys.argv) > 4 else "round"
HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = open(os.path.join(HERE, "v2_script.md")).read()
REF = open(os.path.join(HERE, "..", "raw", "ref", "t1.txt")).read()[:900]

BRIEF = f"""You are on an ADVERSARIAL review panel for a 110-second vertical (9:16) animated explainer reel for SafetySense, an
iOS personal-safety / sexual-assault-prevention app built by two students for the UNM/CNM 2026 App Contest. It will be shown
to judges on Presentation Day and posted as a reel. The goal is a PREMIER demo video in the style of viral Instagram 3D explainer
reels (example reference VO: "{REF[:300]}..."): stylized 3D characters, punchy narrator VO, word-by-word bold captions in the lower
middle with highlighted keywords, a persistent game-like HUD (here: Guard status, risk meter, escalation ladder, and a running
gag "TAPS 0" counter), sticker title cards per scenario, a cold-open hook in the first 3 seconds, a cause->effect beat every 3-5 s,
camera push-ins and snappy cuts.

Non-negotiable rules: trauma-informed (never show an assault or contact, never blame the victim, no gore, no visible drugging
beyond a hand passing over a cup); SafetySense supplements 911 and never replaces it; the end must show the logo, the tagline
"Calls for help when you can't.", "SafetySense supplements 911. It never replaces it." and the RAINN line 1-800-656-4673.
Facts must match the script (45 s check-in, 90 s to dispatch, heartbeat every minute, duress PIN silently escalates,
70% of 298 women / Möller et al. 2017, NM has no text-to-911, dispatch is simulated with a Noonlight sandbox).

The approved narration script + shot list (the picture should follow it):
---
{SCRIPT}
---

Be adversarial and specific: hunt for anything that looks amateur, broken, confusing, off-sync, illegible, ugly 3D framing
(characters cropped, camera inside geometry, unreadable dark shots), text collisions (HUD vs captions vs cards), audio problems
(music too loud vs voice, missing SFX, abrupt cuts), pacing dead spots, factual or tone violations. But APPROVE if it is genuinely
contest-ready and premier quality for a student team; do not invent problems. Give timestamps (seconds) for every issue.

Answer ONLY with JSON:
{{"verdict": "APPROVE" or "REVISE", "score": <0-10 overall quality>, "blocking": [{{"t": <sec>, "issue": "...", "fix": "..."}}],
 "nits": [{{"t": <sec>, "issue": "..."}}], "strengths": ["..."]}}
"blocking" = must-fix before you would approve. Approve only with score >= 8 and no blocking items.
"""

PERSONAS = {
    "gemini-3.1-pro-preview": "Persona: senior motion-design creative director who makes viral 3D explainer reels. Judge craft, pacing, hook, readability, audio mix and polish against the reference style.",
    "gemini-3.8-flash": "Persona: trauma-informed advocate (sexual-assault survivor services) AND a fact-checker. Judge tone, safety messaging, accuracy vs the script, and whether anything could mislead or retraumatize. Also flag sync errors between VO and picture.",
    "gpt-5.5": "Persona: a skeptical App Contest judge and QA lead looking at frame grabs (5 fps contact sheets, every frame labelled by time). Judge visual quality, framing, legibility of HUD/captions/cards, consistency, and whether the story and product are clear.",
}


def env():
    p = os.path.expanduser("~/.config/global.env")
    out = {}
    for line in open(p):
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            out[k.replace("export ", "").strip()] = v.strip().strip('"').strip("'")
    return out


E = env()


def parse(txt):
    t = txt.strip()
    if t.startswith("```"):
        t = t.split("\n", 1)[1].rsplit("```", 1)[0]
    s, e = t.find("{"), t.rfind("}")
    return json.loads(t[s : e + 1])


def gemini_upload(path):
    key = E["GEMINI_API_KEY"]
    size = os.path.getsize(path)
    r = requests.post(
        f"https://generativelanguage.googleapis.com/upload/v1beta/files?key={key}",
        headers={"X-Goog-Upload-Protocol": "resumable", "X-Goog-Upload-Command": "start", "X-Goog-Upload-Header-Content-Length": str(size),
                 "X-Goog-Upload-Header-Content-Type": "video/mp4", "Content-Type": "application/json"},
        json={"file": {"display_name": os.path.basename(path)}}, timeout=60)
    url = r.headers["X-Goog-Upload-URL"]
    with open(path, "rb") as fh:
        r = requests.post(url, headers={"X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize"}, data=fh.read(), timeout=600)
    f = r.json()["file"]
    for _ in range(90):
        g = requests.get(f"https://generativelanguage.googleapis.com/v1beta/{f['name']}?key={key}", timeout=60).json()
        if g.get("state") == "ACTIVE":
            return g
        time.sleep(4)
    raise RuntimeError("file never became ACTIVE")


def gemini_judge(model, fileinfo):
    key = E["GEMINI_API_KEY"]
    body = {
        "contents": [{"role": "user", "parts": [
            {"file_data": {"mime_type": "video/mp4", "file_uri": fileinfo["uri"]}},
            {"text": PERSONAS[model] + "\n\n" + BRIEF + "\nWatch and LISTEN to the whole video before answering."},
        ]}],
        "generationConfig": {"temperature": 0.4, "responseMimeType": "application/json"},
    }
    for attempt in range(3):
        r = requests.post(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}", json=body, timeout=900)
        j = r.json()
        try:
            return parse(j["candidates"][0]["content"]["parts"][0]["text"])
        except Exception:
            err = json.dumps(j)[:400]
            time.sleep(10)
    return {"verdict": "ERROR", "error": err}


def gpt_judge(model):
    key = E["OPENAI_API_KEY"]
    content = [{"type": "input_text", "text": PERSONAS[model] + "\n\n" + BRIEF}]
    for p in sorted(glob.glob(os.path.join(SHEETS, "panel_*.jpg"))):
        b = base64.b64encode(open(p, "rb").read()).decode()
        content.append({"type": "input_text", "text": f"Contact sheet {os.path.basename(p)}:"})
        content.append({"type": "input_image", "image_url": f"data:image/jpeg;base64,{b}"})
    r = requests.post("https://api.openai.com/v1/responses", headers={"Authorization": f"Bearer {key}"},
                      json={"model": model, "input": [{"role": "user", "content": content}], "reasoning": {"effort": "medium"}}, timeout=900)
    j = r.json()
    try:
        txt = "".join(c.get("text", "") for o in j["output"] if o.get("type") == "message" for c in o["content"])
        return parse(txt)
    except Exception:
        return {"verdict": "ERROR", "error": json.dumps(j)[:400]}


def main():
    res = {"label": LABEL}
    fi = gemini_upload(VIDEO)
    for m in ["gemini-3.1-pro-preview", "gemini-3.8-flash"]:
        res[m] = gemini_judge(m, fi)
        print(m, res[m].get("verdict"), res[m].get("score"), flush=True)
    res["gpt-5.5"] = gpt_judge("gpt-5.5")
    print("gpt-5.5", res["gpt-5.5"].get("verdict"), res["gpt-5.5"].get("score"), flush=True)
    json.dump(res, open(OUT, "w"), indent=1, ensure_ascii=False)


if __name__ == "__main__":
    main()
