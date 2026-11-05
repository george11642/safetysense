#!/usr/bin/env python3
"""Build scripts/v{2,3}_script.md + scripts/v{2,3}_timeline.json from beats_v*.py + public/vo/v*/manifest.json,
and an audio-only animatic (VO + music bed) at raw/vo/v*_animatic.wav for timing/mix review."""
import importlib.util, json, pathlib, subprocess, sys
ROOT = pathlib.Path(__file__).resolve().parents[1]

def load(v):
    spec = importlib.util.spec_from_file_location(f"beats_{v}", ROOT / f"scripts/beats_{v}.py")
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m

HEADER = {
"v2": """## Concept
Pure animated storytelling, modeled on the reference reels (raw/ref): low-poly 3D characters in stylized night sets,
second-person/narrator VO in short sentences, word-by-word bold captions in the lower-middle third (keyword in accent
color), a sticky game-like HUD, sticker title cards per scenario, a cause -> effect beat every 3-5 s.

**Protagonist:** Maya, a UNM student (fictional). Supporting: her mom, roommate, brother (contacts); a dispatcher;
an unseen follower (only a shadow), an unseen driver (seen from behind only).

**Trauma-informed rules for the animators:** never show an assault or contact; cut away at the moment of threat;
no gore, no injury, no drugging close-up beyond a hand passing over a cup; Maya is never mocked or blamed; the
follower/driver have no faces. The app supplements 911, never replaces it (end card). RAINN line on screen at the end.

### The HUD (sticky element, like "SHOTS 25 / BAC 0.20%")
Top-left stack, 1080x1920 safe area (top 180 px reserved for the IG UI, so the HUD starts at y=200):
- `GUARD ● ON` (teal dot pulses with the 60 s heartbeat) + mode chip `WALK HOME` / `NIGHT OUT` / `RIDE`.
- `RISK` meter (0-100 bar, teal -> amber -> red), with signal icons that pop next to it when detected
  (🔊 SCREAM, 🗣 "GET OFF ME", 〰 STUMBLE, ▁ STILL, ⤴ OFF ROUTE, ♥ HEARTBEAT).
- `ALERT LADDER` chip row: `CHECK-IN → CONTACTS → DISPATCH`; the current step fills with color.
Top-right, the running gag: **`TAPS 0`** (big mono number). It counts the taps Maya needed to get help.
It never moves off 0. On the close the whole HUD collapses to just `TAPS 0`.
Under it, a time chip like the reference's "+25 MIN": `11:31 PM` in-scene clock, or `+0:45` / `+1:30` during the ladder.

Facts on screen and in VO were checked against README.md and docs/SPEC.md (45 s check-in, 90 s to dispatch,
60 s heartbeat, duress PIN -> dispatch, dispatcher calls first, Ride = route deviation -> check-in, no drug detection
claim, Möller et al. 2017: 70% of 298 women). Dispatch is a Noonlight **sandbox** in the prototype; the dispatch beat
carries an on-screen "simulated in our demo" strip.
""",
"v3": """## Concept
A premier product demo: animated low-poly vignettes (same Maya, same sets as v2) set up each moment in 2-4 s, then
the REAL app (simulator recording `public/appflow.mp4`, screenshots `design/screens/*.png`, contact page
`public/img/share_full.png`) shows it working inside an iPhone frame. Structure: cold open -> problem -> meet ->
features (arm, watch, check-in, contacts, live link, dispatch, PINs, heartbeat, fake call) -> privacy ->
architecture -> team -> close. Captions: phrase-level (2-6 words), lower third, keyword in accent color.
Same HUD ladder chips as v2, but small and bottom-left (product-film restraint). Dispatch is labeled simulated.
""",
}

def build(v):
    m = load(v); man = {e["id"]: e for e in json.load(open(ROOT / f"public/vo/{v}/manifest.json"))}
    t = 0.0; rows = []; tl = []
    for bid, gap, hl, hud, sfx, vis in m.BEATS:
        e = man[bid]; t += gap; start = round(t, 2); d = e["durationSec"]
        rows.append((bid, start, d, e["text"], vis, hl, hud, sfx))
        tl.append({"id": bid, "file": e["file"], "startSec": start, "durationSec": d, "highlight": hl,
                   "words": [{"word": w["word"], "start": round(start + w["start"], 3), "end": round(start + w["end"], 3)} for w in e["words"]]})
        t += d
    total = round(t + m.END_HOLD, 2)
    json.dump({"format": m.FORMAT, "totalSec": total, "voSec": round(sum(man[b[0]]["durationSec"] for b in m.BEATS), 2),
               "beats": tl}, open(ROOT / f"scripts/{v}_timeline.json", "w"), indent=1, ensure_ascii=False)
    md = [f"# {m.TITLE}: narration script + shot list", "",
          f"Format: {m.FORMAT}. Runtime: **{total:.1f} s** (VO {sum(r[2] for r in rows):.1f} s + gaps + {m.END_HOLD:.1f} s end hold).",
          "Voice: ElevenLabs **Brian** (`nPczCjzI2devNBz1zQrb`), model `eleven_v4`, stability 0.5, style 0.3-0.35, speaker boost; per-beat clips, "
          "-16 LUFS. Audio: `public/vo/%s/<id>.mp3`; word timings: `public/vo/%s/manifest.json`; absolute timeline: `scripts/%s_timeline.json`." % (v, v, v),
          "Music/SFX: `public/music/*.wav` (-24 LUFS beds) and `public/sfx/*.wav` (see `public/sfx/README.md`).", "",
          HEADER[v], "## Beat table", "",
          "| id | start | dur | VO line | on-screen visual / animation | caption highlight | HUD state | SFX / music |",
          "|---|---|---|---|---|---|---|---|"]
    esc = lambda s: str(s).replace("|", "\\|")
    for r in rows:
        md.append(f"| {r[0]} | {r[1]:.2f} | {r[2]:.2f} | {esc(r[3])} | {esc(r[4])} | **{esc(r[5])}** | {esc(r[6])} | {esc(r[7])} |")
    md += ["", f"End hold: {m.END_HOLD:.1f} s after the last line (end card + RAINN line on screen).", ""]
    (ROOT / f"scripts/{v}_script.md").write_text("\n".join(md) + EXTRA.get(v, ""))
    # audio animatic: VO at timeline + music bed
    inputs, filt = [], []
    for k, b in enumerate(tl):
        inputs += ["-i", str(ROOT / "public" / b["file"])]
        filt.append(f"[{k}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={int(b['startSec']*1000)}|{int(b['startSec']*1000)}[a{k}]")
    n = len(tl)
    bed = MUSIC[v]
    for j, (f, at, dur, loop) in enumerate(bed):
        inputs += (["-stream_loop", "-1"] if loop else []) + ["-i", str(ROOT / "public/music" / f)]
        filt.append(f"[{n+j}:a]atrim=0:{dur},afade=t=in:d=1.0,afade=t=out:st={max(0,dur-1.5)}:d=1.5,asetpts=PTS-STARTPTS,adelay={int(at*1000)}|{int(at*1000)}[m{j}]")
    filt.append("".join(f"[a{k}]" for k in range(n)) + f"amix=inputs={n}:normalize=0:duration=longest,asplit=2[vo][key]")
    filt.append("".join(f"[m{j}]" for j in range(len(bed))) + f"amix=inputs={len(bed)}:normalize=0:duration=longest[bed]")
    # duck the bed ~3-4 dB while the narrator talks (what the Remotion mix should do with volume keyframes)
    filt.append("[bed][key]sidechaincompress=threshold=0.05:ratio=3:attack=60:release=450:makeup=1[duck]")
    filt.append(f"[vo][duck]amix=inputs=2:normalize=0:duration=longest,atrim=0:{total}[out]")
    out = ROOT / f"raw/vo/{v}_animatic.wav"
    subprocess.run(["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", ";".join(filt), "-map", "[out]", str(out)], check=True)
    print(v, "total", total, "s; animatic", out)

def T(v, bid):
    return next(b for b in json.load(open(ROOT / f"scripts/{v}_timeline.json"))["beats"] if b["id"] == bid)["startSec"]

MUSIC = {}
EXTRA = {
"v2": """
## Music map (suggested)
- 0-3 s: no bed, heartbeat_calm + impact on "Tonight".
- THE WALK: `tension_loop` from v2_04, hard stop for 0.4 s on "She screams", back in at v2_06, `tension_build` under v2_08-v2_09.
- THE DRINK / THE PHONE / THE RIDE: `tension_loop` (low-passed at the woozy beat), `tension_build` under v2_20-v2_21.
- Close (v2_22 on): crossfade to `resolve_pad`.
All beds already sit at -24 LUFS, so they can be placed at volume 1.0 under the -16 LUFS VO; duck a further 3 dB under dense lines if needed.
""",
"v3": """
## Real-footage cut list (appflow.mp4, 31.4 s, recorded from the simulator; see src/scenes.tsx callouts)
| use | in | out | speed | content |
|---|---|---|---|---|
| v3_07 | 0.0 | 5.0 | 1.0 | Night Out guard on |
| v3_08 | 5.0 | 10.0 | 1.0 | "You okay?" check-in, 45 s ring |
| v3_09 | 10.0 | 14.0 | 1.0 | Trusted contacts alerted |
| v3_11 | 14.0 | 23.0 | 1.0-1.3 | Still no answer -> professional dispatch (simulated) |
| v3_12 | 25.5 | 31.4 | 1.0 | Safety PIN cancel -> support |
Stills: 10/11/12/13 homes, 05 triggers, 26 live activity, 27 dynamic island, 40/42 fake call, 19/20 vault, share_full.png.

## Music map (suggested)
- Cold open (v3_01-v3_02): `tension_loop`. Problem (v3_03-v3_04): tension drone only (the loop low-passed).
- Meet + features (v3_05-v3_14): `product_pulse_loop`. Privacy/architecture (v3_15-v3_16): product loop thinned.
- Team + close (v3_17 on): `resolve_pad`.
""",
}

if __name__ == "__main__":
    for v in sys.argv[1:] or ["v2", "v3"]:
        # first pass writes the timeline, so music cues can reference beat starts
        MUSIC[v] = [("tension_loop.wav", 0, 1, True)]
        build(v)
        if v == "v2":
            MUSIC[v] = [("tension_loop.wav", T(v, "v2_04"), T(v, "v2_05") + 0.2 - T(v, "v2_04"), True),
                        ("tension_loop.wav", T(v, "v2_06"), T(v, "v2_08") - T(v, "v2_06"), True),
                        ("tension_build.wav", T(v, "v2_08"), T(v, "v2_10") - T(v, "v2_08"), False),
                        ("tension_loop.wav", T(v, "v2_10"), T(v, "v2_20") - T(v, "v2_10"), True),
                        ("tension_build.wav", T(v, "v2_20"), T(v, "v2_22") + 1.0 - T(v, "v2_20"), False),
                        ("resolve_pad.wav", T(v, "v2_22") - 0.5, 24.0, False)]  # resolve bed runs to the end
        else:
            MUSIC[v] = [("tension_loop.wav", 0, T(v, "v3_05"), True),
                        ("product_pulse_loop.wav", T(v, "v3_05") - 0.3, T(v, "v3_17") - T(v, "v3_05") + 0.8, True),
                        ("resolve_pad.wav", T(v, "v3_17") - 0.5, 24.0, False)]
        build(v)
