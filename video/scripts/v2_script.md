# SafetySense v2 REEL: narration script + shot list

Format: 9:16, 1080x1920, 30 fps. Runtime: **116.1 s** (VO 105.5 s + gaps + 3.0 s end hold).
Voice: ElevenLabs **Brian** (`nPczCjzI2devNBz1zQrb`), model `eleven_v4`, stability 0.5, style 0.3-0.35, speaker boost; per-beat clips, -16 LUFS. Audio: `public/vo/v2/<id>.mp3`; word timings: `public/vo/v2/manifest.json`; absolute timeline: `scripts/v2_timeline.json`.
Music/SFX: `public/music/*.wav` (-24 LUFS beds) and `public/sfx/*.wav` (see `public/sfx/README.md`).

## Concept
Pure animated storytelling, modeled on the reference reels (raw/ref): low-poly 3D characters in stylized night sets,
second-person/narrator VO in short sentences, word-by-word bold captions in the lower-middle third (keyword in accent
color), a sticky game-like HUD, sticker title cards per scenario, a cause -> effect beat every 3-5 s.

**Round 3 picture notes (review fixes):** cold open starts on the glowing phone in frame 1 (push-in, flash on "Tonight"),
cuts to Maya's face on "Maya"; THE WALK uses a soft follower shadow that slides in and closes on her heels, and the
"She screams" cut-away is her phone dropped on the sidewalk (she can't reach it); the freeze is a rigid pose in a
near-grey, time-stopped world with a slow push-in; contacts are centered medium close-ups with a dedicated caption band;
the spiking arm belongs to a back-lit hooded figure (no face) with a rack focus; the driver is seen only as eyes in a
modelled rear-view mirror; the end card is a solid card.

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
Top-right, the running gag: **`CALLS SHE MADE 0`** (big number). Same metric as the end card ("CALLS SHE HAD TO MAKE 0").
It never moves off 0, including during the duress PIN (that beat gets its own `🔒 DURESS PIN` chip instead).
Under the state pill, a game-like `RISK` bar (0-100, teal -> amber -> red) spikes on each danger beat.
Under it, a time chip like the reference's "+25 MIN": `11:31 PM` in-scene clock, or `+0:45` / `+1:30` during the ladder.

Facts on screen and in VO were checked against README.md and docs/SPEC.md (45 s check-in, 90 s to dispatch,
60 s heartbeat, duress PIN -> dispatch, dispatcher calls first, Ride = route deviation -> check-in, no drug detection
claim, Möller et al. 2017: 70% of 298 women). Dispatch is a Noonlight **sandbox** in the prototype; the dispatch beat
carries an on-screen "simulated in our demo" strip.

## Beat table

| id | start | dur | VO line | on-screen visual / animation | caption highlight | HUD state | SFX / music |
|---|---|---|---|---|---|---|---|
| v2_01 | 0.15 | 4.26 | Tonight, Maya won't be able to call for help. Her phone will. | COLD OPEN. Extreme close-up: Maya's phone glowing face-down on a dark sidewalk, rain sheen. Fast push-in to a lock screen showing 'Guard on'. Cut to black on 'call for help', then the HUD stamps in on 'Her phone will'. | **Her phone will** | HUD hidden until 'Her phone will', then slams in: GUARD ● ON · TAPS 0 | impact_hit on 'Tonight'; heartbeat_calm under; whoosh_hard as HUD slams in |
| v2_02 | 4.56 | 2.58 | This is Maya. Walking home after midnight. | Wide establishing: low-poly campus path at night (UNM-style adobe buildings, pink/teal streetlights). Maya (low-poly college student, backpack, hoodie) walks toward camera. Name sticker pops: 'MAYA · UNM'. | **midnight** | GUARD ○ OFF · MODE — · RISK 0 · TAPS 0 · clock chip 12:04 AM | night_ambience_loop starts; footsteps_walk (her steps) |
| v2_03 | 7.29 | 6.07 | One tap: Walk Home Guard is on. It listens on the phone only. Nothing is saved unless something's wrong. | Over-shoulder: thumb taps 'Walk Home' in the app (stylized UI matching design/screens/11-home-walk.png). A soft teal ring pulses out of the phone into the street = 'listening'. Small lock icon + 'on-device' tag floats by 'Nothing is saved'. | **Walk Home** | GUARD ● ON · WALK HOME · RISK 4 · ladder chips CHECK-IN / CONTACTS / DISPATCH all dim (TAPS counts taps needed DURING an emergency, so arming does not increment it) | ui_tap; notify_ping (soft) |
| v2_04 | 13.56 | 1.46 | Footsteps behind her. | Sticker title card 'THE WALK' animates in over 6 frames and holds 24 frames. Then low angle behind Maya; a second long shadow stretches into frame from behind. Camera slowly pushes toward her back. Never show the person's face. | **behind her** | RISK 4 -> 12 (slow creep) | sticker_pop for the title card; music: tension_loop fades in; footsteps_behind (heavier, closer, slightly out of sync with hers) |
| v2_05 | 15.12 | 2.56 | Someone comes up behind her. She screams. | Shadow reaches her; HARD CUT AWAY to the phone in her pocket before any contact (no contact shown). Screen shake 4 frames. | **screams** | RISK spikes 12 -> 88 (meter flashes red) | distant_cry_abstract (abstract, short, ducked); whoosh_hard; music cuts to silence for 0.4 s |
| v2_06 | 18.23 | 4.01 | Her phone hears it. A scream. The words: get off me. | Inside-the-phone view: stylized waveform, two detection chips light up (SoundAnalysis 'screaming', SpeechAnalyzer phrase). Captions show the quoted words in quotes. | **get off me** | Signal icons pop beside RISK: 🔊 SCREAM ✓  🗣 'GET OFF ME' ✓  (both tagged ON-DEVICE) | glitch (tiny, under icon pops); sticker_pop x2 |
| v2_07 | 22.39 | 8.74 | Then she freezes. In one study of 298 survivors, 70% froze. She can't reach her phone. She doesn't have to. | Maya frozen mid-step, desaturated, time-freeze effect (particles hang in the air). On-screen stat card: '70% of 298 women reported significant tonic immobility (Möller et al., 2017)'. On 'She doesn't have to': color returns, camera pulls back, TAPS 0 glows. | **She doesn't have to** | LADDER: CHECK-IN skipped -> CONTACTS lights (high risk goes straight to Alert) · TAPS 0 pulses | heartbeat_fast under 'freezes', drops out on 'She doesn't have to' |
| v2_08 | 31.83 | 3.20 | Three phones ring. Each one gets her live location. | Triptych split-screen: Mom (kitchen), roommate (dorm), brother (car) — each phone lights up 'SafetySense alert: Maya' with a mini live map pin pulsing on the same street. | **live location** | LADDER: CONTACTS ● · CONTACTS NOTIFIED 3/3 · clock chip +0:08 | phone_ring (layered x3, staggered 0.15 s, panned L/C/R) |
| v2_09 | 35.17 | 6.88 | 90 seconds, no safety PIN. A dispatcher calls. If she can't answer, police head to her live location. | Clock chip fast-forwards 90 s. A dispatcher desk (low-poly, headset) sees Maya's pin; phone rings unanswered; map zooms out to show a patrol car icon routing to the pin. Text strip: 'Simulated in our demo · Noonlight sandbox'. | **live location** | LADDER: DISPATCH ● · clock chip +1:38 · HELP: DISPATCH | alert_step; siren_far (very soft, starts on 'police') |
| v2_10 | 42.86 | 3.00 | Saturday. A party. Night Out Guard is on. | Sticker title card 'THE DRINK' (6-frame pop-in, holds 24+ frames). Low-poly house party: string lights, red cups, friends dancing. Maya starts Night Out on her phone, waves at her roommate. | **Night Out** | Reset: GUARD ● ON · NIGHT OUT · RISK 3 · TAPS 0 · clock 10:48 PM | sticker_pop + impact_hit for title card; party_muffled_loop starts |
| v2_11 | 45.97 | 2.74 | 11:02. Someone spikes her drink. | Close-up of Maya's cup on a counter; she has turned away to laugh with a friend (cup stays in frame). A second person's back-lit hand (different sleeve) enters from the far side and lingers over the cup for a moment, back-lit, and leaves. Nothing visible happens to the drink (no fizz, no color change: these drugs usually can't be seen, smelled or tasted, so we never imply she should have noticed). Cut on the hand leaving. | **Someone spikes** | clock 11:02 PM | glass_clink |
| v2_12 | 48.92 | 2.90 | 11:20. The room starts to tilt. | Camera Dutch-tilts 12°, edges blur, string lights smear. Maya steadies herself on the wall. Keep her dignified: no mocking, no stumbling gag. | **tilt** | clock 11:20 PM · RISK 3 -> 15 | party_muffled_loop gets low-passed and slowed (wooziness); heartbeat_calm |
| v2_13 | 51.93 | 4.48 | No phone can detect a drug. But SafetySense notices what happens next. | Freeze frame + white outline on Maya's phone in her back pocket; motion icons (accelerometer squiggle) draw on. | **notices** | Card under HUD: 'Can't detect drugs. Can notice you've stopped responding.' | whoosh_soft |
| v2_14 | 56.53 | 6.21 | 11:31. She stumbles. Then she goes still. Her phone asks: You okay? | Hallway, Maya sits down against a wall, then is still (eyes closed, like asleep; no injury). Lock screen Live Activity 'You okay? I'm okay / Need help' glows, a 45 s ring starts draining. | **You okay?** | clock 11:31 PM · motion chip: STUMBLE ✓ STILL ✓ · LADDER: CHECK-IN ● with 45 s ring | phone_buzz on 'You okay?' |
| v2_15 | 62.89 | 2.40 | 45 seconds. No answer. | Time-lapse: the ring empties, the phone buzzes again, nobody taps. | **No answer** | 45 s ring drains to 0 · LADDER: CONTACTS ● | tick-tock: ui_tap every second for 6 s, sped up; then alert_step |
| v2_16 | 65.39 | 3.50 | Her roommate's phone rings. She taps: I'm on my way. | Roommate in the next room sees the alert with live map; taps the big 'I'm on my way' button on the live-link page (matches web/ live page). Runs down the hallway. End beat on her reaching Maya (cut away before any medical detail). | **I'm on my way** | CONTACTS NOTIFIED 1/1 · contact status chip 'ROOMMATE: ON THE WAY' | phone_ring; ui_tap |
| v2_17 | 69.69 | 3.93 | What if someone takes her phone? Smashes it? Switches it off? | Sticker title card 'THE PHONE' (6-frame pop-in, holds 24+ frames). Low-poly phone in slow motion hitting pavement, screen cracking into polygons; screen goes black. | **Smashes it** | Reset: GUARD ● ON · NIGHT OUT · HEARTBEAT ♥ 60 s | sticker_pop + impact_hit (title); phone_smash on 'Smashes it'; signal_lost |
| v2_18 | 73.74 | 6.08 | Her phone checks in with our server every minute. If it goes dark, the server raises the alarm itself. | Split: left = dead phone; right = a server rack (cloud icon) with a heartbeat line receiving pings every 60 s; pings stop; the server stamps 'NO HEARTBEAT' and fires the alert with the last-known-location pin. | **raises the alarm itself** | HEARTBEAT ♥ stops -> 'NO HEARTBEAT · 60 s' -> 'SERVER ALERT' -> LADDER: CONTACTS ● | heartbeat_calm stops; alert_step; phone_ring |
| v2_19 | 80.63 | 3.88 | A ride home. Ride Guard is on. The car turns the wrong way. | Sticker title card 'THE RIDE' (6-frame pop-in, holds 24+ frames). Back seat of a low-poly car at night. Mini-map in the corner: planned route (teal) vs actual route peeling off (red). | **wrong way** | Reset: GUARD ● ON · RIDE · plate chip '7ABC123' (fictional) · ROUTE ✓ -> ROUTE ✗ | sticker_pop + impact_hit (title); car_interior_loop; turn_signal |
| v2_20 | 84.62 | 3.92 | Her phone asks: You okay? The driver says: cancel it. | Phone shows 'You okay?'. Driver seen ONLY from behind (headrest + eyes in mirror, no face detail), says 'cancel it' (caption in quotes, VO reports it). | **cancel it** | LADDER: CHECK-IN ● (route deviation) | phone_buzz; music drops to drone only |
| v2_21 | 88.66 | 7.04 | She types her duress PIN. The check-in disappears, like everything's fine. It isn't. Dispatch is already on it. | Close-up: thumb types 4 PIN digits on the check-in PIN pad (same pad for both PINs, digits never shown); the check-in closes and the phone looks normal. On 'It isn't', the frame splits: the visible screen stays calm, while behind it (x-ray layer) a hidden alert goes straight to dispatch. | **It isn't** | HUD fakes calm: CHECK-IN chip clears to 'OK ✓' and RISK drops... then on 'It isn't' it glitches to LADDER: DISPATCH ● (silent, hidden alert) | keypad_pin; glitch on 'It isn't'; alert_step (very soft) |
| v2_22 | 96.14 | 6.28 | New Mexico still has no text-to-911. When you can't call, SafetySense calls for you. | Montage of the four scenes' end frames as polaroids sliding off a New Mexico map silhouette. On-screen: 'New Mexico: still no text-to-911'. | **calls for you** | HUD collapses to a single line: TAPS 0 | music: resolve_pad crossfades in over 1.5 s; siren_far out |
| v2_23 | 102.67 | 2.79 | SafetySense. Calls for help when you can't. | Logo lockup: SafetySense icon + wordmark, tagline 'Calls for help when you can't.' on brand background (theme.ts C.bg / accent). | **can't** | HUD off | notify_ping (soft, tonal resolve) |
| v2_24 | 105.67 | 3.29 | It supplements 911. It never replaces it. | Logo lockup holds; supplement-to-911 line types on under the tagline. | **never replaces it** | End card text builds: 'SafetySense supplements 911. It never replaces it.' + 'In an emergency, call 911.' | resolve_pad continues |
| v2_25 | 109.81 | 3.32 | And if something happened to you, it's not your fault. | Soft cut to Maya at home, wrapped in a blanket, roommate beside her, morning light (safe, calm, no injury). RAINN line fades in and stays on screen for the final 4 s. | **not your fault** | End card adds: 'Support 24/7: RAINN 1-800-656-4673' | resolve_pad swells 2 dB in the 0.8 s pause before this line; no SFX |

End hold: 3.0 s after the last line (end card + RAINN line on screen).

## Music map (suggested)
- 0-3 s: no bed, heartbeat_calm + impact on "Tonight".
- THE WALK: `tension_loop` from v2_04, hard stop for 0.4 s on "She screams", back in at v2_06, `tension_build` under v2_08-v2_09.
- THE DRINK / THE PHONE / THE RIDE: `tension_loop` (low-passed at the woozy beat), `tension_build` under v2_20-v2_21.
- Close (v2_22 on): crossfade to `resolve_pad`.
All beds already sit at -24 LUFS, so they can be placed at volume 1.0 under the -16 LUFS VO; duck a further 3 dB under dense lines if needed.
