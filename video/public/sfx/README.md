# SFX and music library (v2 reel, v3 hybrid)

Every sound here is synthesized by code: `scripts/synth_audio.py` (numpy + ffmpeg only, fixed RNG seed,
no samples, no downloads, no third-party audio). Re-run `python3 scripts/synth_audio.py` to regenerate.
48 kHz, 16-bit stereo WAV. The v1 files `chime.wav`, `pad.wav`, `thud.wav`, `tick.wav` and `whoosh.wav` are
from the v1 video and are never touched by the script.

Mix targets: narration (`public/vo/v2|v3`) is -16 LUFS. Music beds are already at **-24 LUFS**, so they can play
at Remotion `volume={1}` and sit 8 LU under the voice. Duck them about 3 dB more while the narrator talks
(the animatics in `raw/vo/v*_animatic.wav` do this with a sidechain compressor). One-shots are peak-normalized,
so use the suggested `volume` below as a starting point.

## SFX (`public/sfx/`)

| file | length | what it is | suggested volume | where it's used |
|---|---|---|---|---|
| whoosh_soft.wav | 1.6 s | band-passed noise sweep 400 Hz to 4 kHz, light room | 0.35 | card slides, soft transitions |
| whoosh_hard.wav | 1.3 s | faster, brighter sweep 200 Hz to 8 kHz | 0.4 | hard cuts, HUD slam-in |
| impact_hit.wav | 4.2 s | sub boom with a short crack and long tail | 0.45 | hook, sticker title cards |
| sticker_pop.wav | 0.7 s | pitched "pop" for stickers and chips | 0.4 | title cards, signal chips |
| riser.wav | 3.5 s | noise and tone rising into a hit | 0.35 | into "Meet SafetySense" |
| glitch.wav | 0.6 s | short digital stutter | 0.25 | detection chips, duress reveal |
| ui_tap.wav | 0.08 s | UI tap click | 0.35 | button taps, ticking countdown |
| keypad_pin.wav | 1.2 s | four keypad taps | 0.5 | PIN entry |
| notify_ping.wav | 2.6 s | soft bell ping (inharmonic partials) | 0.25 | Guard on, logo lockup |
| alert_step.wav | 2.4 s | gentle two-note rise, calm rather than alarming | 0.3 | each ladder step |
| phone_buzz.wav | 1.5 s | two haptic buzz pulses (motor rattle) | 0.2 | "You okay?" check-in |
| phone_ring.wav | 3.7 s | original 4-note marimba-style ring, twice (not any trademarked ringtone) | 0.3 | contacts' phones ringing (layer x3, panned) |
| signal_lost.wav | 3.4 s | three falling tones plus a held tone ("connection lost", not a medical flatline) | 0.3 | phone goes dark |
| phone_smash.wav | 3.0 s | thump, crack and glass shards | 0.4 | phone hits the pavement |
| glass_clink.wav | 2.5 s | high inharmonic clink | 0.35 | party cup, "breaking glass" chip |
| heartbeat_calm.wav | 5.8 s | 68 bpm lub-dub, 6 beats | 0.5 | hook, wooziness |
| heartbeat_fast.wav | 4.6 s | 118 bpm, 8 beats | 0.5 | freeze moment |
| footsteps_walk.wav | 7.6 s | 10 light steps on pavement | 0.35 | Maya walking |
| footsteps_behind.wav | 5.5 s | 8 heavier steps that get louder | 0.4 | someone behind her |
| distant_cry_abstract.wav | 3.0 s | deliberately abstract filtered vocal-formant swell, not a realistic scream | 0.2 | "She screams" (keep it short and under the VO) |
| siren_far.wav | 9.4 s | slow two-tone wail, heavily filtered and reverbed, distant | 0.25 | dispatch beat (soft) |
| turn_signal.wav | 3.0 s | car turn-signal tick-tock | 0.3 | ride turns off route |
| night_ambience_loop.wav | 11.5 s | wind, crickets, streetlight hum; loops seamlessly | 0.6 | walk-home scenes |
| party_muffled_loop.wav | 12.0 s | next-room party: muffled kick and bass with crowd murmur, 120 bpm; loops seamlessly | 0.5 | party scenes (low-pass it more for the woozy beat) |
| car_interior_loop.wav | 9.5 s | road rumble and engine drone; loops seamlessly | 0.6 | ride scene |

## Music (`public/music/`), all -24 LUFS

| file | length | description | use |
|---|---|---|---|
| tension_loop.wav | 22.86 s (8 bars at 84 bpm), seamless loop | D minor: warm additive pad an octave above the voice, low bass, soft heartbeat kick on beats 1 and 3, sparse felt-piano ostinato. HPF 60 Hz, -6 dB at 260 Hz, -8 dB VO pocket around 2.5 kHz, LPF 1.5 kHz | scenario scenes, v3 cold open |
| tension_build.wav | 24 s | same palette; the ostinato goes from half notes to quarter notes and the kick and level rise, with no bright filter sweep | the escalation in each scenario |
| resolve_pad.wav | 24 s, fades in and out | D major (I-V-vi-IV), slow swell, a few felt-piano notes, breathing LFO, HPF 110 Hz | the close in both videos |
| product_pulse_loop.wav | 22.86 s, seamless loop | D major pad that pumps gently with a soft kick on 1 and 3, very quiet felt notes; no hats, no plucks | v3 feature walkthrough |

Review notes: the music went through three adversarial listening rounds. Raw saws were replaced with
additive tones, a high-frequency whine was removed from the build, and the busy pluck arpeggio was removed
from the product loop. A spectrum check gave -37 to -59 dB in the 2-5 kHz band relative to total energy.
Mixed under the narration at the target levels, the final round approved all three pairings.
