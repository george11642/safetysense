# SafetySense v3 HYBRID: narration script + shot list

Format: 16:9, 1920x1080, 30 fps. Runtime: **155.8 s** (VO 137.9 s + gaps + 5.0 s end hold).
Voice: ElevenLabs **Brian** (`nPczCjzI2devNBz1zQrb`), model `eleven_v4`, stability 0.5, style 0.3-0.35, speaker boost; per-beat clips, -16 LUFS. Audio: `public/vo/v3/<id>.mp3`; word timings: `public/vo/v3/manifest.json`; absolute timeline: `scripts/v3_timeline.json`.
Music/SFX: `public/music/*.wav` (-24 LUFS beds) and `public/sfx/*.wav` (see `public/sfx/README.md`).

## Concept
A premier product demo: animated low-poly vignettes (same Maya, same sets as v2) set up each moment in 2-4 s, then
the REAL app (simulator recording `public/appflow.mp4`, screenshots `design/screens/*.png`, contact page
`public/img/share_full.png`) shows it working inside an iPhone frame. Structure: cold open -> problem -> meet ->
features (arm, watch, check-in, contacts, live link, dispatch, PINs, heartbeat, fake call) -> privacy ->
architecture -> team -> close. Captions: phrase-level (2-6 words), lower third, keyword in accent color.
Same HUD ladder chips as v2, but small and bottom-left (product-film restraint). Dispatch is labeled simulated.

## Beat table

| id | start | dur | VO line | on-screen visual / animation | caption highlight | HUD state | SFX / music |
|---|---|---|---|---|---|---|---|
| v3_01 | 0.30 | 5.33 | Ava is walking home. Someone comes up behind her. She can't reach her phone. | ANIMATED (same low-poly set as v2): Ava (fictional user) on the night path, a shadow enters from behind, camera pushes in; cut away before contact. Letterboxed 2.39:1 for the cold open. | **can't reach her phone** | — | night_ambience_loop; footsteps_behind; tension_loop in |
| v3_02 | 5.83 | 2.17 | Her phone is already calling for help. | Smash cut to three phones ringing with a live map (animated), then cut to black. | **already** | Ladder chip strip appears bottom-left: CONTACTS ● | phone_ring x3 staggered; whoosh_hard |
| v3_03 | 8.60 | 12.41 | Most safety apps wait for you to press a button. But freezing is a normal, involuntary response. In one study, 70% of women seen after a sexual assault reported freezing. | Title 'SafetySense' holds 24 frames (logo + wordmark), then PROBLEM section on dark brand background: kinetic type 'Most safety apps wait for a button.' Big stat card '70%' counting up, sub 'of 298 women reported significant tonic immobility after sexual assault (Möller et al., 2017)'. | **freezing** | — | impact_hit on title; music drops to tension drone |
| v3_04 | 22.27 | 7.51 | Drugs can take away the ability to act. Phones get taken. And New Mexico still has no text-to-911. | Three cards slide in on each sentence: pill icon 'Drugs take away the ability to act' · phone icon 'Phones get taken' · NM outline 'New Mexico: still no text-to-911'. | **text-to-911** | — | whoosh_soft per card |
| v3_05 | 31.08 | 3.48 | Meet SafetySense. It calls for help when you can't. | 'Meet SafetySense': app icon flies in, iPhone frame resolves on the Home screen (design/screens/10-home-night-out.png). Tagline lockup. | **when you can't** | — | riser into impact_hit; music: product_pulse_loop starts |
| v3_06 | 34.86 | 9.21 | Start a Guard for a walk home, a night out, a date, or a ride. Tap it, press the Action Button, ask Siri, or use the Lock Screen. | ANIMATED 3 s: Ava pressing the Action Button on her phone at the party door. Then REAL: iPhone frame cycling home screens 10/11/12/13 (Night Out, Walk, Date, Ride) + trigger icons (Action Button, Siri, Lock Screen control from 05-onboarding-triggers.png and 26-live-activity-lock.png). | **Guard** | Mode chips row: EVERYDAY · WALK HOME · NIGHT OUT · DATE · RIDE | ui_tap per trigger icon |
| v3_07 | 44.32 | 11.31 | While it's on, your phone listens for screams, breaking glass, distress words, and your safe word. It feels for a fall, then stillness. All the listening happens on your phone. | ANIMATED 3 s: party, a glass shatters, waveform rings pulse from Ava's phone. Then REAL: appflow.mp4 0.0-5.0 s (guard on) in the iPhone frame with the signal chips around it; lock-icon tag 'Processed on-device'. | **on your phone** | Signal chips light in sequence: SCREAM · GLASS · WORDS · SAFE WORD · FALL→STILL | glass_clink on 'breaking glass'; sticker_pop per chip |
| v3_08 | 55.88 | 7.32 | If something seems wrong, it asks quietly: You okay? You have 45 seconds. One tap if you're fine. | REAL: appflow.mp4 5.0-10.0 s (check-in screen). Side-callout: '45 s · one tap if you're fine'. | **You okay?** | LADDER: CHECK-IN ● 45 s ring | phone_buzz |
| v3_09 | 63.41 | 5.45 | No answer? Your trusted contacts get an automated call, and a text with a live link. | ANIMATED 3 s: kitchen at home (distinct set): her mom at the counter, the phone on the counter lights up, push-in to the phone. Then REAL: appflow.mp4 10.0-14.0 s (contacts alerted). | **live link** | LADDER: CONTACTS ● | phone_ring; alert_step |
| v3_10 | 69.06 | 6.98 | They see your location, your battery, and a timeline. And they can tap: I'm on my way, or send help now. | REAL: public/img/share_full.png (contact live-link page) in a second phone frame, slow scroll; highlight rings on location map, battery, timeline, then the 'I'm on my way' and 'Send help now' buttons. | **I'm on my way** | — | ui_tap on button highlight |
| v3_11 | 76.29 | 10.35 | Still no answer after 90 seconds? Professional dispatch calls you. If you can't answer, they send police to your live location. In this demo, dispatch is simulated. | REAL: appflow.mp4 14.0-23.0 s (still no answer -> professional dispatch). Lower-third: 'Noonlight Dispatch API · sandbox in this demo · no real police dispatched'. | **police** | LADDER: DISPATCH ● | alert_step; siren_far (soft) |
| v3_12 | 88.04 | 6.10 | Your safety PIN stops it. Your duress PIN looks exactly the same, but quietly keeps help coming. | ANIMATED first (from v3_11's tail): rideshare exterior, then the back seat with the driver seen from behind; sticker 'DRIVER: CANCEL IT' (on-screen text only, no dialogue audio). Then the app: the same PIN screen twice, side by side, filling the frame: SAFETY PIN -> alert stops; DURESS PIN -> looks identical, dispatch quietly continues. | **quietly keeps help coming** | Two PIN chips: SAFETY PIN → STOP · DURESS PIN → looks like stop, DISPATCH continues | keypad_pin; glitch (tiny) |
| v3_13 | 94.44 | 7.51 | And if your phone is smashed or switched off mid-session, our server notices the missing heartbeat, and raises the alert by itself. | ANIMATED 3 s: phone hits pavement and goes black. Then MOTION GRAPHIC: phone -> cloud heartbeat line with a ping every 60 s; pings stop; Supabase pg_cron watchdog card fires 'alert with last known location'. | **by itself** | HEARTBEAT ♥ every 60 s -> NO HEARTBEAT -> CONTACTS ● | phone_smash; signal_lost; heartbeat_calm stops |
| v3_14 | 102.25 | 3.44 | Need a way out? A fake call gives you a reason to leave. | ANIMATED 2 s: Ava on an awkward date glances at her phone. Then REAL: 40-fake-call-incoming.png -> 42-fake-call-in-call.png in the iPhone frame. | **reason to leave** | — | phone_ring (single, friendly) |
| v3_15 | 106.19 | 11.00 | It only listens when you turn it on. While guarding, audio stays on your phone. Nothing is saved unless an alert fires. Then evidence is encrypted before it's uploaded. | Clean brand-color section. Four promise cards build in. REAL: 19-vault-locked.png -> 20-vault-unlocked.png in the iPhone frame. | **Nothing is saved** | Privacy chips: ON ONLY WHEN YOU START · AUDIO STAYS ON PHONE · SAVED ONLY ON ALERT · AES-GCM + FACE ID | whoosh_soft; music thins to pad |
| v3_16 | 118.39 | 12.32 | On the phone, Apple's sound and speech models feed a rules-based risk engine. In the cloud, Supabase watches heartbeats, Twilio calls your people, and Noonlight handles dispatch. | ARCHITECTURE: animated diagram mirroring README: iPhone (SoundAnalysis, SpeechAnalyzer, CoreMotion, Foundation Models 2nd opinion -> risk engine) -> HTTPS -> Supabase (Postgres RLS, Vault, pg_cron heartbeat watchdog) -> Twilio (voice+SMS to contacts) / Noonlight (dispatch) / live-link page (Vercel). | **Noonlight** | — | ui_tap per node |
| v3_17 | 131.97 | 9.48 | SafetySense was built by George Teifel, an electrical engineering senior at UNM, and Mary Teifel, a mechanical engineering freshman at CNM. | TEAM: two cards (photos from the team bio if George approves; otherwise initials) 'George Teifel · UNM · Electrical Engineering, Senior' and 'Mary Teifel · CNM · Mechanical Engineering, Freshman'. | **George Teifel · Mary Teifel** | — | music: resolve_pad crossfade in |
| v3_18 | 144.04 | 3.04 | SafetySense. Calls for help when you can't. | ANIMATED 3 s: Ava home safe, roommate beside her, phone on the table showing 'Session ended'. Then logo lockup + tagline. | **can't** | — | notify_ping (tonal) |
| v3_19 | 147.34 | 3.42 | It supplements 911. It never replaces it. | End card: 'SafetySense supplements 911. It never replaces it.' · 'In an emergency, call 911.' · 'Support 24/7: RAINN 1-800-656-4673' · 'UNM & CNM App Contest 2026'. Hold 3 s. | **never replaces it** | — | resolve_pad tail |

End hold: 5.0 s after the last line (end card + RAINN line on screen).

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

## Review round 2 -> round 3 changes (no VO regenerated; ledger unchanged at 7,548 / 8,000)
- Check-in: footage continues from the listening shot (guard timer never rewinds); holds the guard screen to src 175, crossfades into the drawn check-in (src 184; the recording blanks at 176-177); ring at 0.6x, no time skip. "You okay?" type arrives with the screen at the top of the beat.
- Rideshare moved ahead of v3_12 (86.7-88.0 s): 0.4 s exterior, then one shot from between the front seats onto Ava (plush cabin via `CarInterior plush`).
- PINs: two large real PIN screens; each PIN is typed (dots + key flashes) and lands on the app's Support screen. Safety side: STOPPED + struck-through ladder. Duress side: DRIVER "Cancel it." sticker on "Your duress PIN" (~2.7 s), then "Help keeps coming" with DISPATCH lit and pulsing.
- Architecture: nodes inside title-safe, zoom 1.22 max, camera slides phone column -> cloud + responders, out-of-focus columns dimmed and blurred; right column split into "Your people" (Twilio, live link) and "Dispatch" (Noonlight). Pill: "Audio never leaves the phone · the server gets only a heartbeat + location".
- Team footer removed (it sat behind the caption); contest name moved into the top kicker.
- Home safe: top-down macro of the phone on the duvet, then a shoulder-to-shoulder two-shot (no hug, no intersections).
- Text: NM sub-line "Still listed as the only US state without it (Nov 2026)"; privacy card "No recordings saved unless an alert fires"; end card adds Rape Crisis Center of Central NM 24/7, 505-266-7711.
