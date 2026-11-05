# SafetySense v2 REEL: narration script + shot list

Format: 9:16, 1080x1920, 30 fps. Runtime: **104.1 s** (VO 89.3 s + gaps + 3.5 s end hold).
Voice: ElevenLabs **Brian** (`nPczCjzI2devNBz1zQrb`), model `eleven_v4`, stability 0.5, style 0.3-0.35, speaker boost; per-beat clips, -16 LUFS. Audio: `public/vo/v2/<id>.mp3`; word timings: `public/vo/v2/manifest.json`; absolute timeline: `scripts/v2_timeline.json`.
Music/SFX: `public/music/*.wav` (-24 LUFS beds) and `public/sfx/*.wav` (see `public/sfx/README.md`).

## Concept
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
Top-right, the running gag: **`CALLS SHE MADE 0`** (big number; same metric as the end card "CALLS SHE HAD TO MAKE 0").
It never moves off 0; it punches and glows at every escalation (words heard, contacts ring, police, no answer, server alarm, duress).
The HUD hides on the clean chapter-card frames and collapses on the close.
Under it, a time chip like the reference's "+25 MIN": `11:31 PM` in-scene clock, or `+0:45` / `+1:30` during the ladder.

Facts on screen and in VO were checked against README.md and docs/SPEC.md (45 s check-in, 90 s to dispatch,
60 s heartbeat, duress PIN -> dispatch, dispatcher calls first, Ride = route deviation -> check-in, no drug detection
claim, Möller et al. 2017: 70% of 298 women). Dispatch is a Noonlight **sandbox** in the prototype; the dispatch beat
carries an on-screen "simulated in our demo" strip.

**Round 4 picture notes (review fixes):** HD characters (src/kit3d/CharacterHD.tsx, additive): real hands (knuckles,
two-segment fingers + thumb), skin eyelids that blink/widen, iris + catchlights, arched brows that bend, lips/teeth,
Fresnel rim light; Maya has one chin-length bob from every angle; the brother has his own face. Chapter cards
(THE WALK / DRINK / PHONE / RIDE) own a clean 0.9 s full frame with a punch-zoom burst, then 0.1-0.3 s of air before
the line. Cold open: her phone face-up on the wet sidewalk (textured concrete, puddle, leaves), cut to her face on
"Maya", back to the phone flipping to "Calling for help" on "Her phone will". THE WALK: a hard-edged walking human
shadow stretches up the sidewalk to her heels; "She screams" = the phone drops and bounces on the sidewalk under a red
light, her shoes at the top of frame. Freeze: bullet-time orbit / ECU of her eyes / orbit / phone out of reach at
ground level / crane-up as the phone calls for help. Contacts: three fast full-frame cuts. Dispatch HUD: "Dispatcher
calling" until NO ANSWER, then "Police to her location"; 1 s relief beat (help reached her). Drink: silhouetted
sleeved forearm hovers over the cup; caption on a dark plate high on the wall. "Notices": X-ray phone in her back
pocket + on-device motion trace. Ride: the driver is a neutral silhouette, eyes in a modelled mirror (bezel, mount,
windshield slice). Duress: POV thumb on the PIN pad -> "LOOKS CALM" -> glitch split (driver unaware / hidden silent
alert). Close: one living comfort plate under the lockup and end card; RAINN fades in with "it's not your fault" and
the full end card holds 5 s.

**Round 6 picture/mix notes:** cold open shows the 12:06 'Calling for help' screen from frame 0 (phone centered, dark lit
sidewalk, no grey lift); THE WALK card now starts 0.27 s after "wrong." ends so the whole word plays and is captioned;
relief beat frames the police car with its light bar washing over Maya; the thrown phone falls screen-up and large in
frame; the smash accent is a 3-frame red tint (no white); the duress "calm" label is a dashed yellow viewer sticker
("DRIVER SEES: ALL NORMAL"), not app UI; the roommate's mouth stays closed under the narrator's close; transition SFX
are trimmed ~4.7 dB (full level kept only for the four chapter cards, "She screams" and the smash).

## Beat table

| id | start | dur | VO line | on-screen visual / animation | caption highlight | HUD state | SFX / music |
|---|---|---|---|---|---|---|---|
| v2_01 | 0.15 | 4.26 | Tonight, Maya won't be able to call for help. Her phone will. | COLD OPEN on a staged set: the wet campus sidewalk under one streetlight; the phone lies face-up on the wet pavement (reflections, puddle), a long shadow falls across it. Lock screen 12:06 'Calling for help' (flash-forward, tagged 'LATER TONIGHT'). Hard cut to Maya walking (same lighting), then back to the phone on 'Her phone will' as the HUD slams in. | **Her phone will** | HUD hidden until 'Her phone will', then slams in: GUARD ● ON · CALLS SHE MADE 0 | impact_hit on 'Tonight'; heartbeat_calm under; whoosh_hard as HUD slams in |
| v2_03 | 4.76 | 6.07 | One tap: Walk Home Guard is on. It listens on the phone only. Nothing is saved unless something's wrong. | Maya walks toward camera on the campus path (name sticker 'MAYA · UNM STUDENT', HUD clock 12:04 AM). Over-shoulder: thumb taps 'Walk Home' in the app. A soft teal ring pulses out of the phone = 'listening'. Lock + 'on-device' tag by 'Nothing is saved'. | **Walk Home** | GUARD ● ON · WALK HOME · RISK 4 · ladder chips CHECK-IN / CONTACTS / DISPATCH all dim (CALLS SHE MADE counts calls needed DURING an emergency, so arming does not increment it) | ui_tap; notify_ping (soft) |
| v2_05 | 12.27 | 2.56 | Someone comes up behind her. She screams. | Sticker title card 'THE WALK' (colored wipe in, no white flash). Low angle behind Maya; a second long shadow stretches into frame and reaches her. HARD CUT AWAY to the phone on the sidewalk before any contact; music drops to silence on 'She screams'. | **screams** | RISK spikes 12 -> 88 (meter flashes red) | distant_cry_abstract (abstract, short, ducked); whoosh_hard; music cuts to silence for 0.4 s |
| v2_06 | 15.38 | 4.01 | Her phone hears it. A scream. The words: get off me. | Inside-the-phone view: stylized waveform, two detection chips light up (SoundAnalysis 'screaming', SpeechAnalyzer phrase). Captions show the quoted words in quotes. | **get off me** | Signal icons pop beside RISK: 🔊 SCREAM ✓  🗣 'GET OFF ME' ✓  (both tagged ON-DEVICE) | glitch (tiny, under icon pops); sticker_pop x2 |
| v2_07 | 19.54 | 9.61 | Then she freezes. In one study of 298 survivors, 70% reported freezing. She can't reach her phone. She doesn't have to. | Maya frozen mid-step, desaturated, time-freeze effect (particles hang in the air). On-screen stat card: '70% of 298 women reported significant tonic immobility (Möller et al., 2017)'. On 'She doesn't have to': color returns, camera pulls back, CALLS SHE MADE 0 glows. | **She doesn't have to** | LADDER: CHECK-IN skipped -> CONTACTS lights (high risk goes straight to Alert) · CALLS SHE MADE 0 pulses | heartbeat_fast under 'freezes', drops out on 'She doesn't have to' |
| v2_08 | 29.85 | 3.20 | Three phones ring. Each one gets her live location. | Triptych split-screen: Mom (kitchen), roommate (dorm), brother (car) — each phone lights up 'SafetySense alert: Maya' with a mini live map pin pulsing on the same street. | **live location** | LADDER: CONTACTS ● · CONTACTS NOTIFIED 3/3 · clock chip +0:08 | phone_ring (layered x3, staggered 0.15 s, panned L/C/R) |
| v2_09 | 33.20 | 7.21 | 90 seconds. Nobody cancels. A dispatcher calls. If she can't answer, police head to her live location. | Clock chip fast-forwards 90 s. A dispatcher (headset, desk, monitor with Maya's pin) takes the call; 'NO ANSWER'. Then a readable top-down street map: a police car (light bar, wheels) drives along a drawn route line to Maya's pin. Then a 0.8 s relief beat. Card: 'SIMULATED IN OUR DEMO · NOONLIGHT SANDBOX' stays up through the relief beat. | **live location** | LADDER: DISPATCH ● · clock chip +1:38 · HELP: DISPATCH | alert_step; siren_far (very soft, starts on 'police') |
| v2_11 | 42.96 | 2.74 | 11:02. Someone spikes her drink. | Sticker title card 'THE DRINK' (colored wipe). Party establishing shot (HUD: NIGHT OUT ON, clock 10:48 PM). Close-up of Maya's cup on a counter while she laughs with a friend; a back-lit sleeved hand passes over the cup and leaves. Nothing visible happens to the drink. | **Someone spikes** | clock 11:02 PM | glass_clink |
| v2_13 | 45.82 | 4.48 | No phone can detect a drug. But SafetySense notices what happens next. | The party tilts and smears (Maya steadies herself, dignified). Phone-only insert (no body framing) gets a glowing outline; card: can't detect a drug / can notice she stopped responding + MOTION / CHECK-INS / HEARTBEAT chips. | **notices** | Card under HUD: 'Can't detect drugs. Can notice you've stopped responding.' | whoosh_soft |
| v2_14 | 50.42 | 6.21 | 11:31. She stumbles. Then she goes still. Her phone asks: You okay? | Hallway, Maya sits down against a wall, then is still (eyes closed). Lock-screen 'You okay?' with a 45 s ring. Then, with no VO, the ring drains: chip '+45 SEC', stamp 'NO ANSWER', ladder moves to CONTACTS. | **You okay?** | clock 11:31 PM · motion chip: STUMBLE ✓ STILL ✓ · LADDER: CHECK-IN ● with 45 s ring | phone_buzz on 'You okay?' |
| v2_16 | 57.73 | 3.50 | Her roommate's phone rings. She taps: I'm on my way. | Roommate in the next room sees the alert with live map; taps the big 'I'm on my way' button on the live-link page (matches web/ live page). Runs down the hallway. End beat on her reaching Maya (cut away before any medical detail). | **I'm on my way** | CONTACTS NOTIFIED 1/1 · contact status chip 'ROOMMATE: ON THE WAY' | phone_ring; ui_tap |
| v2_17 | 62.28 | 3.02 | What if someone takes her phone? Smashes it? | Sticker title card 'THE PHONE' (colored wipe). Maya on a dark street, an out-of-focus figure in shadow beside her; a shadowed hand pulls the phone from her hand; the phone hits the pavement and cracks; screen goes black. | **Smashes it** | Reset: GUARD ● ON · NIGHT OUT · HEARTBEAT ♥ 60 s | sticker_pop + impact_hit (title); phone_smash on 'Smashes it'; signal_lost |
| v2_18 | 65.50 | 3.81 | If it goes dark, the server raises the alarm itself. | Split: left = dead phone; right = a server with a heartbeat line ('PHONE CHECKS IN EVERY 60 S'); pings stop; the server stamps 'NO HEARTBEAT' and fires the alert with the last-known-location pin. | **raises the alarm itself** | HEARTBEAT ♥ stops -> 'NO HEARTBEAT · 60 s' -> 'SERVER ALERT' -> LADDER: CONTACTS ● | heartbeat_calm stops; alert_step; phone_ring |
| v2_19 | 70.37 | 3.88 | A ride home. Ride Guard is on. The car turns the wrong way. | Sticker title card 'THE RIDE' (6-frame pop-in, holds 24+ frames). Back seat of a low-poly car at night. Mini-map in the corner: planned route (teal) vs actual route peeling off (red). | **wrong way** | Reset: GUARD ● ON · RIDE · plate chip '7ABC123' (fictional) · ROUTE ✓ -> ROUTE ✗ | sticker_pop + impact_hit (title); car_interior_loop; turn_signal |
| v2_20 | 74.36 | 3.92 | Her phone asks: You okay? The driver says: cancel it. | Phone shows 'You okay?'. Driver seen ONLY from behind (headrest + eyes in mirror, no face detail), says 'cancel it' (caption in quotes, VO reports it). | **cancel it** | LADDER: CHECK-IN ● (route deviation) | phone_buzz; music drops to drone only |
| v2_21 | 78.40 | 7.04 | She types her duress PIN. The check-in disappears, like everything's fine. It isn't. Dispatch is already on it. | Close-up: thumb types 4 PIN digits on the check-in PIN pad (same pad for both PINs, digits never shown); the check-in closes and the phone looks normal. On 'It isn't', the frame splits: the visible screen stays calm, while behind it (x-ray layer) a hidden alert goes straight to dispatch. | **It isn't** | HUD fakes calm: CHECK-IN chip clears to 'OK ✓' and RISK drops... then on 'It isn't' it glitches to LADDER: DISPATCH ● (silent, hidden alert) | keypad_pin; glitch on 'It isn't'; alert_step (very soft) |
| v2_22 | 85.88 | 7.14 | New Mexico is still listed with no text-to-911. When you can't call, SafetySense calls for you. | New Mexico map with the four scenes as polaroids; stamp 'NO TEXT-TO-911 / NEW MEXICO · STILL LISTED, NOV 2026'. On 'SafetySense calls for you' the logo lockup takes over (hard cut). | **calls for you** | HUD collapses to a single line: CALLS SHE MADE 0 | music: resolve_pad crossfades in over 1.5 s; siren_far out |
| v2_24 | 93.38 | 3.29 | It supplements 911. It never replaces it. | Logo lockup + 'Calls for help when you can't.' with the supplement-to-911 lines (one end card layout from here to the end, no crossfade). | **never replaces it** | End card text builds: 'SafetySense supplements 911. It never replaces it.' + 'In an emergency, call 911.' | resolve_pad continues |
| v2_25 | 97.27 | 3.32 | And if something happened to you, it's not your fault. | Same end card layout, now over a clean brand background with a small inset of Maya safe at home with her roommate; RAINN line on screen to the end. | **not your fault** | End card adds: 'Support 24/7: RAINN 1-800-656-4673' | resolve_pad swells 2 dB in the 0.8 s pause before this line; no SFX |

End hold: 3.5 s after the last line (end card + RAINN line on screen).

## Music map (suggested)
- 0-3 s: no bed, heartbeat_calm + impact on "Tonight".
- THE WALK: `tension_loop` from the THE WALK card, hard stop for 0.4 s on "She screams", back in at v2_06, `tension_build` under v2_08-v2_09.
- r5 mix: every SFX is ducked 8 dB under narration; music beds duck 6-8 dB (more under THE PHONE / server lines); phone rings start just after the word "ring(s)".
- r5 cut (122.8 s -> 104 s): v2_02, v2_04, v2_10, v2_12, v2_15, v2_23 removed (picture-only beats now); v2_17/v2_18 trimmed from the same takes; word starts re-timed with scripts/v2_retime.py (whisper-1 + speech onsets; run after every `make_vo_v2v3.py build v2`).
- THE DRINK / THE PHONE / THE RIDE: `tension_loop` (low-passed at the woozy beat), `tension_build` under v2_20-v2_21.
- Close (v2_22 on): crossfade to `resolve_pad`.
All beds already sit at -24 LUFS, so they can be placed at volume 1.0 under the -16 LUFS VO; duck a further 3 dB under dense lines if needed.

## r7 (review round 4 fixes, no new VO)
- Close: ONE locked end layout from "SafetySense calls for you" (91 s) to the last frame: wordmark, tagline (static, fades in after "you."), a living 3D inset (Maya walking home safe, then the dorm morning with her roommate), the supplement line (word-synced), the caption band, "In an emergency, call 911" and RAINN (both on screen from 91 s). Captions say "SafetySense calls for you." in sync; nothing reflows.
- Cold open: phone framed at ~55% of frame width, "CALLING FOR HELP..." sticker; the shadow blob is gone.
- Freeze (v2_07): bullet-time orbit -> eye close-up -> low orbit -> dolly-zoom on "70%" -> rack focus on the phone (her figure soft behind) -> crane-up.
- HUD: DISTRESS HEARD on "get off me", CONTACTS ALERTED on "She doesn't have to". Chapter cards: no "scenario N of 4", each has its own motion.
- Characters: anatomical arms (deltoid, elbow, wrist, sleeve creases), sneakers, hair sway, idle acting (src/v2/Actor.tsx).

## r8 (review round 5 fixes, no new VO; ledger unchanged at 7,912 / 8,000)
- Cold open: frame 1 is Maya on the night street (lamp posts, sidewalk), phone glowing in her hand, slow push; the
  "LATER TONIGHT · 12:06 AM" chip sits high (y 250) and is gone before the phone shot, so the lock-screen clock reads clean.
  Slam to her phone on the sidewalk + CALLING FOR HELP sticker on "Her phone will."
- v2_03 "One tap": a big phone (56% of frame width, cropped below the HUD) over a soft over-the-shoulder 3D street plate;
  caption sits under the phone. Pills: "Audio stays on this phone" / "No audio saved unless something's wrong".
- THE WALK: she flinches as she turns (flinchBack). Freeze: medium close-up (hiked shoulders, fists locked at her chest,
  no blink) replaces the eye ECU; new lockUp pose throughout; the 70% card is bigger and leaves after "freezing."
- Relief beat (1.1 s): black-and-white patrol car with a roof light bar that lights the street red/blue; push in to her
  relieved face. THE DRINK card trimmed to keep v2_11 on time.
- THE DRINK: no ghosted double exposure; woozy = camera roll + soft breathing blur. Chips: MOTION · CHECK-INS · LOCATION.
- THE PHONE / server: all 3D; a check-in beacon on the server rack pulses (tick) with each phone check-in, flatlines grey
  when the phone goes dark, floods red on the alarm. Stamps NO CHECK-IN / SERVER ALERT. HUD: "Server check-in · 60 s",
  "SIGNAL LOST" (no heart glyph, no "heartbeat" wording on screen).
- THE RIDE: on "the wrong way" the route map blows up full frame (teal planned vs red actual) + OFF ROUTE stamp.
  Back-seat shots framed chest-up. The rear-view mirror glass is lit (reads as a mirror). While the "Cancel it." bubble
  is up the word caption is hidden. Duress: pad lower in frame, caption locked above it from the first word;
  DRIVER SEES: ALL NORMAL moved to the bottom. App screens say "your 3 contacts" (no stray names).
- Captions: every line is locked to one position from its first word (no mid-line jumps).
- HUD labels shortened (DISTRESS / ALERTED / SIGNAL LOST / DISPATCH) and width-capped so they never run under the
  CALLS SHE MADE chip; RISK text and the SIMULATED footer ~20% bigger.
- Close: full-bleed 3D. "SafetySense calls for you" over Maya walking home safe; on "It supplements 911" a soft cut to
  the morning two-shot (Maya + roommate) that drifts to the end. The compliance line and "it's not your fault" are big
  word captions; 911 pill + RAINN at the bottom; after "fault." the supplement line settles in for the ~3.5 s end hold.
- Characters (CharacterHD `anatomy`): continuous shoulder yoke + trapezius (no ball-joint shoulders), slimmer deltoid
  and elbow, thicker neck, strand clumps on bob / long hair, combed ridges on hair caps, matte hair (no specular hotspot).
