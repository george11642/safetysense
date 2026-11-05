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
| v3_15 | 106.19 | 11.00 | It only listens when you turn it on. While guarding, audio stays on your phone. No recordings are saved unless an alert fires. Then evidence is encrypted before it's uploaded. | Clean brand-color section. Four promise cards build in. REAL: 19-vault-locked.png -> 20-vault-unlocked.png in the iPhone frame. | **No recordings are saved** | Privacy chips: ON ONLY WHEN YOU START · AUDIO STAYS ON PHONE · SAVED ONLY ON ALERT · AES-GCM + FACE ID | whoosh_soft; music thins to pad |
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

## Review round 6 changes
- VO: only v3_15's middle sentence was re-voiced ("No recordings are saved unless an alert fires.", 46 chars, scoped to match SPEC §privacy) and spliced between the approved halves; later beats shift +1.09 s. Ledger 7,958 / 8,000. Absolute timings: `scripts/v3_timeline.json` (the table above is the original plan, not the current timing).


## Review round 7 changes (no VO regenerated; ledger unchanged at 7,958 / 8,000)
- Timing: +0.20 s breath before v3_02 (a real drop-out before the smash cut), +0.35 s before v3_08 ("If something seems wrong") and +0.40 s before v3_09 ("No answer?"); end hold 5.0 -> 4.5 s. Runtime 158.0 s.
- Listening -> check-in: the listening shot plays the guard screen forward and lands on src 174 at the cut (no blank frames 176-177, no early check-in); the check-in shot opens on the drawn check-in (src 184), so it appears once and the timer never rewinds. "+6 S" skip gets a ring wipe.
- Dispatch: one skip chip ("+80 S · 2× speed", ~1.5 s); "90 s · still no answer" is the only lasting time cue; the "Supplements 911" pill moved off this beat (end card carries it). Police-insert "Simulated" pill pushed below the ladder.
- Mode carousel: tagline above the phones (>= 60 px clear), phones pushed down, icon tiles sit in the gaps between phones.
- Cold open: frame 0 is a long-lens two-shot (his dark shape on the right third, Ava ahead), no centre occluder.
- Rideshare: camera in the empty front passenger seat; the driver is never shown face-on (dark, out of frame). Close-up pulled back to a medium shot, key/rim/screen glow lowered ~1 stop.
- Captions restored for v3_14 and v3_15; captions ~1.15x larger. PIN phones smaller so captions clear the tab bars.
- Privacy: the phone changes on every promise (home -> Guard on with the mic toggle; sound waves stay inside the screen and an upload arrow bounces off; "0 recordings saved"; vault lock -> Face ID -> unlocked on "encrypted").
- Party listening shot reframed (Ava's whole head in the left two-thirds). Drugs insert: the friend faces away, smiling.
- Problem: SOS button slow push-in + a hand that reaches and stops short (freezes). NM card: a "To 911" SMS bubble bounces back "Not delivered"; date kept on one line. Stat label inside title-safe; DOI added.
- Smash: the 3D phone screen goes black on impact; shards fall faster, then shrink away. Architecture: nodes the camera would crop fade out. Team: one home-screen still, b-roll dimmed, SwiftUI chip removed. End card: slow 3% push. Home-safe macro graded from frame 1.
- Mix: hit lands after a ~0.45 s drop-out at the cold-open smash cut and at "Meet SafetySense"; feature-section bed -3 dB; rings/pings/clink/smash pulled 4-6 dB or moved into word gaps (mom-cut ring starts after "No answer?").
- Open: "Teifel" pronunciation still needs George's confirmation (Gemini listening checks hear "TIE-ful"; whisper-1 spells it "Teufel"). Only 42 ElevenLabs chars remain, not enough to re-voice v3_17 (143 chars).

## Fix round 2 changes (no VO regenerated; ledger unchanged)
- Characters: every 3D actor runs the kit's opt-in toon path (eye whites + iris + catchlight, warm skin, smaller hands with relaxed curled fingers and a closed grip on held props). Ava uses the `maya2` cast (one smooth bob shell, no side ponytail chunk). Soft contact shadows under everyone standing. Police cap now sits on the head (12% wider, hides the hair).
- Cold open (trauma-informed): the follower is never staged. Shot A shows only an out-of-focus dark shoulder at the frame edge; shot B his long shadow reaching her heels; footsteps carry the rest. No hip phone slab (only the screen glow through her pocket). Freeze shots are medium (chest-up) pushes, not full-screen faces.
- Hook sticker: one large cue, "No response → contacts alerted" (the "45 s later · check-in skipped" sticker is gone).
- Stat card: centred 4% push (no leftward drift), every line inside title-safe; removed from the global drift. Barriers: capped drift, NM bubble lands under the outline, NOT DELIVERED inside the safe area.
- Party: friend's wave removed (hand clipped her face); the floor ring is a soft wide sonar pulse; the listening HUD is a smaller corner panel; the glass that breaks is a stemmed wine glass in the counter's clear spot (no red cups in the burst).
- Check-in: gentler push (the phone bezel stays in frame); "6 s later" chip moved below the copy. "+35 s · no answer" chip at the cut to Mom; the kitchen opener is wider (Mom at the back counter, mug, glasses, keys) and a 6-frame whip bridges the kitchen -> UI cut.
- Rideshare: one continuous push-in (no cuts, no lighting jump), seatbelt, headrests, seat seams, armrest + handle, street lights streaming past the windows, a lamp sweep across her; tense expression; a car-door thunk opens the scene; "OFF-SCREEN" label; a 3-frame dip from the dispatch UI (no double exposure).
- Pins: "Same screen" frame + badge wait until both phones show Support, badge sits on the phone bezel; the safety column is one line.
- Privacy: headlines quote the VO word for word; each claim is its own camera beat (card push, then glide to the phone); the "audio stays on your phone" visual is a 30 s ring buffer with a write head over a fully dimmed screen (nothing drawn over the app's labels).
- Team: both name plates land in the first ~1.3 s; each lights up on its VO name. End card: a push that runs to the last frame, drifting particles, staggered hotline reveal. Home safe: they turn to each other and smile.
- Captions: run under privacy (v3_15) and the team (v3_17) too; "Still no answer after 90 seconds?" and "and a timeline." are captioned again (mute ranges are clamped to end before the next beat's first word, and the v3_10 mute matches the 2nd "And"); chunks may hold 7 words / 44 chars, so no orphan "location.".
- Mix: an extra -4.4 dB duck under "freezing is a normal, involuntary response" and "quietly keeps help coming".

## Fix round 3 changes (no VO regenerated; ledger unchanged)
- Captions: words animate by opacity + colour only (one size, no per-word scale), so the line never jitters. Late
  sentence-final highlights fixed by `scripts/v3_fix_late_words.py` (silencedetect -40 dB / 0.1 s on each clip):
  fires. 117.16 -> 116.74, uploaded. 120.23 -> 119.85, dispatch. 133.84 -> 133.34, people, leave. location, demo, ...
- One caption rule for the whole film: a sentence is muted only as a whole and only when the on-screen headline quotes
  it word for word. Now captioned: "Most safety apps...", the 70% study line, "Start a Guard for a walk home...",
  "...and a text with a live link". Muted (verbatim headlines): NM line, Meet, "You okay?", "One tap...", "And they
  can tap", "Professional dispatch calls you.", privacy sentences 2-4.
- Police: real peaked cap (taller domed crown over the hair, band, angled brim); he walks TO Ava, stops ~1.2 m away
  and raises an open hand; she turns to him, fear easing to relief. Side-on two-shot.
- Date: both seated at 0.47 m (his chair was 0.25 m), her hips on the booth cushion, his forearms on the table, phone
  raised from frame 0 (it poked through the tabletop), glasses off the plates, cut-off diner and neon ring removed.
- Phones get taken: a dark motion-blurred swipe from off-screen left snatches the phone (no hand detail, no contact);
  startled expression after.
- Rideshare: two shots. A: from the back seat looking forward (driver from behind, dash glow, instrument cluster,
  rear-view mirror, windshield lights streaming, door handles) with the PIN pad in her hands; "Cancel it." lands here.
  B: tight on her face from the empty passenger side (no giant seat-back), lamp sweeps.
- Characters (v3 only): anisotropic two-lobe hair sheen and a warm skin rim (premiumShade in scenes3d); opt-in `grin`
  face key (smile line + happy-eye lower lids, unused by v2); per-beat expressions (freeze fear, startle, relief,
  smiles at home). Kitchen contact is "Maya Chen · trusted contact" on the soft-haired mom2 rig; toast moved into
  title-safe.
- Transitions: light-leak whip removed; 3D -> UI cuts are push-throughs (zoom-blur out / settle in, no crossfade).
- Holds: stat card keyed push onto "reported freezing" (pulses on the word) + DOI line; freeze insert arcs and pushes;
  a 1.5 s 3D check-in cutaway breaks the "You okay?" hold; privacy opens on a 3D beat (her phone wakes into a Guard on
  "turn it on"); team camera glides from George to Mary; PIN pads get 1.55x close-ups while typed.
- Readability: party listening panel 0.44 -> 0.8 scale; Guard HUD moved to the lower-left safe corner; live-link and
  watch eyebrows removed where phones crossed them; live-link column inside the caption-safe band, larger timeline
  card; architecture zones end above the caption band; dispatch time badges merged into one sticker.
- End card: logo settles, number counts in digit by digit and breathes, drift; hotline lines 40-44 px (number 104 px);
  hold trimmed (runtime 158.0 -> 156.4 s). Hook gets a "+45 s · no check-in" cue; "Everyday" chip removed; letterbox
  retracts on the smash cut; drug-beat blur masked off her face.
