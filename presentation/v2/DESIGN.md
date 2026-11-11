# SafetySense finalist deck v2: build spec

Status: built Nov 10, 2026, then revised the same day after a four-reviewer pass (fit, visual, timing, honesty). The slide text, notes and timings below are as built; section 11 lists what else differs from the original spec. Written Nov 10, 2026. Deck is due Mon Nov 16, 12:00 pm (George sends it).

Base: the "story-first" proposal (two clips, one job each), with the judges' grafts. Sections 1 to 3 are the design; 4 to 6 are the content; 7 to 10 are build and checks.

## 1. Why this fixes George's complaint

In v1 the slides explained the signals and the ladder, then a 58-second video with its own title card, narrator and tagline explained them again. So it played like a recap dropped into the middle.

In v2 the video stops being a summary and becomes two pieces of the talk itself:

- **Clip A (10 s) opens the talk.** It shows the one thing no slide can: a person who can't reach her phone, and the phone already acting. It ends on the SafetySense logo, and George starts talking from there.
- **Clip B (52 s) is the only place the ladder is told.** The slides before it never describe the check-in, the contacts step, dispatch, the two PINs or the smashed phone. The signals list is cut from the video, because slide 5 owns it.
- **Neither clip has a title card or tagline card.** The slides own the title and the close.
- **The slide after clip B builds on it** (what the recording is, what works outside it, what is simulated) and does not retell it. Later slides point back to scenes ("the two PINs you saw").

Every key idea now has one home (section 6).

## 2. Structure and timing

14 slides plus 4 appendix slides. Scripted total **7:19**, leaving 41 s of slack. The script is 877 spoken words in 373 s of speaking time (the two clip slots excluded), about 141 words a minute; no slide is above 147. At 130 words a minute the talk runs about 7:54.

| # | Slide | Speaker | Start | End | Secs |
|---|---|---|---|---|---|
| 1 | Holding card (on screen before the timer starts) | none | | | 0 |
| 2 | Clip A: cold open (autoplays on advance) | none | 0:00 | 0:12 | 12 |
| 3 | Team and tagline | George, Mary | 0:12 | 0:40 | 28 |
| 4 | The problem | George | 0:40 | 1:25 | 45 |
| 5 | Our answer: a Guard | George | 1:25 | 1:57 | 32 |
| 6 | Hand-in: watch three things | George | 1:57 | 2:17 | 20 |
| 7 | Clip B: proof (autoplays on advance) | none | 2:17 | 3:11 | 54 |
| 8 | What the video is, and what works today | George | 3:11 | 3:55 | 44 |
| 9 | How it differs | George | 3:55 | 4:38 | 43 |
| 10 | Design and wording | Mary | 4:38 | 5:13 | 35 |
| 11 | Privacy | Mary | 5:13 | 5:53 | 40 |
| 12 | Technology | George | 5:53 | 6:26 | 33 |
| 13 | Proof, limits and next steps | George | 6:26 | 7:02 | 36 |
| 14 | Close | George, Mary | 7:02 | 7:19 | 17 |
| A1–A3 | Q&A appendix (v1 slides 13–15, three answers corrected) | | | | |
| A4 | Ladder fallback (v1 slide 5, dispatch labelled simulated) | | | | |

The stamps in the notes are computed from one `SECS` table in `build_deck_v2.js`, so they always add up.

Rubric check: team, app, problem and technology are all covered by 2:00 (the stack line is on slide 5).

## 3. Video

Two MP4s, both 1920x1080, 30 fps, H.264 + AAC, cut from the existing film with its existing voice-over. **No new narration is recorded.** (Only 42 ElevenLabs characters remain, so none could be.)

Frame numbers below are absolute film frames, computed from `video/scripts/v3_timeline.json` with the same formulas as `CUTS` in `HybridV3.tsx`. In code, use the `CUTS` names, not the numbers.

### 3.1 Clip A, "ColdOpen" → `presentation/v2/SafetySense-DemoClip-v2-ColdOpen.mp4`

| | |
|---|---|
| Film range | `[CUTS.cold[0], CUTS.problem[0])` = frames 0 to 262 (0.00 to 8.73 s) |
| Shots | Ava on the night path, freezes (0 to 5.6 s); alert card "Your people are being told" (5.7 s); three phones ringing on the map (6.8 s); SafetySense logo sting (7.9 to 8.7 s) |
| Voice-over (existing v3_01, v3_02) | "Someone's right behind Ava. She freezes. She can't reach her phone. / Her phone is already calling for help." |
| Captions | The film's own, kept |
| Start | First frame is the film's frame 0. Audio starts with the film's night ambience. No title card |
| End | Picture holds the last logo frame (film frame 261) for 1.2 s. Audio fades to silence over the final 1.0 s. No fade to black, so PowerPoint rests on the logo |
| Length | 8.73 + 1.2 = **9.9 s** |

I viewed this range at 2 fps. The follower is only an out-of-focus shoulder and a shadow, it cuts away before any contact, and the range ends on the logo, before the "Most safety apps wait for" card.

Note that the timeline's v3_01 wording ("Someone's right behind Ava. She freezes.") differs from the older table in `v3_script.md`. The timeline is what plays.

### 3.2 Clip B, "Proof" → `presentation/v2/SafetySense-DemoClip-v2-Proof.mp4`

Two film segments in one composition.

| Seg | Film range | Frames | Secs | What it shows | Voice-over |
|---|---|---|---|---|---|
| B1 | `CUTS.party` = 1169 to 1224 | 55 | 1.8 | Ava at the party taps her phone | None. The v3_06 line started earlier, so `ClipCtx` drops it |
| B2 | `[CUTS.checkin[0], CUTS.heart[1])` = 1673 to 3130 | 1457 | 48.6 | Check-in, Maya, live link, dispatch, "Cancel it." and the two PINs, smashed phone and heartbeat | Existing v3_08 to v3_13, unchanged |
| Tail | hold of film frame 3129 | 30 | 1.0 | "Alert raised by itself → CONTACTS" | Audio fades out |

Length: **52.4 s** (a 1 s hold on the party shot's first frame was added so the lower third can be read).

Voice-over that plays, verbatim (all existing):

> If something seems wrong, it asks quietly: You okay? You have 45 seconds. One tap if you're fine. / No answer? Your trusted contacts get an automated call, and a text with a live link. / They see your location, your battery, and a timeline. And they can tap: I'm on my way, or send help now. / Still no answer after 90 seconds? Professional dispatch calls you. If you can't answer, they send police to your live location. In this demo, dispatch is simulated. / Your safety PIN stops it. Your duress PIN looks exactly the same, but quietly keeps help coming. / And if your phone is smashed or switched off mid-session, our server notices the missing heartbeat, and raises the alert by itself.

Overlay added in the deck composition (not in the film):

- **Lower third over B1**, frames 0 to 85 of the clip (30-frame hold, then the shot), on the film's dark pill backing, left 80 px, bottom 132 px: a kicker "A NIGHT OUT" (mono, 34 px, light grey) over the line "Ava turns her **Guard on**." (display font, 84 px, "Guard on" in teal). Fades in over 8 frames from the clip's first frame and out over the last 6. The kicker is neutral on purpose: clip B is not the same night as the cold open (there the Guard was already on, on a walk home), and slide 6 says so: "You saw her phone already calling. Here's how it gets there."

Start and end:

- **Start:** no picture fade. Frame 0 is the clean party shot, the same picture as the slide 6 still and the slide 7 poster, and the lower third fades in from there. Audio is the film's music bed under B1, fading in over 8 frames.
- **B1 to B2 join:** hard cut. The film's own phone buzz lands at the start of B2. B1 keeps playing for 4 frames underneath B2 (hidden by it), so the music bed overlaps the join; measured level stays at about -30 dB through the cut, with no dropout.
- **End:** the picture holds the last heartbeat frame for 1.0 s and audio fades out over that second. No fade to black, no tagline card, no chips.

What is deliberately not in clip B:

- The signals list (v3_07). Slide 5 owns it.
- The v1 intro card and tagline card. This also removes the "never replaces it" chips.
- The fake call (v3_14). It gives the clip a second job. If practice feedback asks for it, extend B2's end to `CUTS.privacy3d[0]` (3247), which adds 3.9 s.

### 3.3 Composition file (new): `video/src/v3/deckIndexV2.tsx`

Same pattern as `deckIndex.tsx` (which stays untouched). Two compositions:

```tsx
// ColdOpenV2: render 262 + 36 frames so effect tails ring out; ffmpeg replaces the picture after 262.
<ClipCtx.Provider value={{ from: 0, to: CUTS.problem[0], deck: true }}>
  <Sequence from={0}><HybridV3 /></Sequence>
</ClipCtx.Provider>

// ProofV2: B1 then B2, each in its own provider so each range gates its own VO and effects.
const P = CUTS.party, A = CUTS.checkin[0], B = CUTS.heart[1], L1 = P[1] - P[0];
<Sequence from={0} durationInFrames={L1}>
  <ClipCtx.Provider value={{ from: P[0], to: P[1], deck: true }}>
    <Sequence from={-P[0]}><HybridV3 /></Sequence>
  </ClipCtx.Provider>
</Sequence>
<Sequence from={L1} durationInFrames={B - A + 30}>
  <ClipCtx.Provider value={{ from: A, to: B, deck: true }}>
    <Sequence from={-A}><HybridV3 /></Sequence>
  </ClipCtx.Provider>
</Sequence>
<Sequence from={0} durationInFrames={L1}><GuardOnLowerThird /></Sequence>
```

Music is not gated by `ClipCtx`, so it keeps playing in the extra 30 to 36 frames; that is the tail the fade uses. `ClipCtx` already excludes the next beat's voice-over (v3_03 at 262, v3_14 at 3133) because they start at or after `to`.

ffmpeg finishing pass (per clip): replace the picture after the range with a clone of its last frame, fade the audio, and normalise loudness to the film's level.

```
# Clip A (raw render = 298 frames)
rtk ffmpeg -i coldopen_raw.mp4 -vf "trim=end_frame=262,tpad=stop_mode=clone:stop_duration=1.2" \
  -af "afade=t=out:st=8.9:d=1.0" -t 9.93 -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart SafetySense-DemoClip-v2-ColdOpen.mp4
# Clip B (raw render = 30 hold + 55 + 1457 + 30 frames)
rtk ffmpeg -i proof_raw.mp4 -vf "trim=end_frame=1542,tpad=stop_mode=clone:stop_duration=1.0" \
  -af "afade=t=in:st=0:d=0.27,afade=t=out:st=51.4:d=1.0" -t 52.4 -c:v libx264 -crf 23 -preset slow -maxrate 1.2M -bufsize 2.4M -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart SafetySense-DemoClip-v2-Proof.mp4
```

Raw renders go in the scratch folder, not the repo.

### 3.4 Opt-in legibility pass in `HybridV3.tsx` (required)

Additive only. Extend the context type with one optional field:

```ts
export const ClipCtx = React.createContext<{ from: number; to: number; deck?: boolean } | null>(null);
```

Every change below is behind `clip?.deck === true`. With `ClipCtx` null, or with `deck` absent (as in the v1 `deckIndex.tsx`), output must be identical to today.

| Element | In deck mode |
|---|---|
| `LadderStrip` (CHECK-IN · CONTACTS · DISPATCH chips) | Hidden |
| `GuardOnBadge` in the party shot | Hidden (the lower third replaces it) |
| `Captions16` | Only beats that pass `inClip` are captioned, so B1 shows no orphan "Tap it, press the Action Button" caption |
| Small mono eyebrows ("STEP 1 · A QUIET CHECK-IN", "IF THE PHONE GOES DARK", "TWO PINS") | Hidden |
| `SkipChip` labels ("+35 s · no answer", "6 s later", "+80 S · 2× speed", "+3 min · 3 missed heartbeats") | 1.4x larger, kept inside title-safe |
| Simulated labels (`DispatchOverlay` "SIMULATED IN THIS DEMO / Noonlight sandbox · no real police", and the strip on the police shot) | 1.5x larger; cap height at least 34 px |
| Phones on dark cards in `CheckIn`, `ContactsReal`, `LiveLink`, `Pins`, `Heartbeat` | Scale the phone up about 1.25x where the layout allows without touching the headline or the caption band |
| "Can't answer? They send police…" sub-line, "Real page · test alert" | At least 34 px |
| Maya's SMS toast | 1.3x |

Acceptance rule: at 1080p, any text a judge is meant to read is at least 34 px tall; anything smaller is hidden or is inside an app screenshot.

Proof that the full film is unchanged: before and after the edit, render stills of the default `HybridV3` composition at film frames 100, 220, 1200, 1700, 1950, 2200, 2400, 2750, 3000, 3100 and compare checksums. They must match. Never re-render over `presentation/SafetySense-Demo.mp4`.

## 4. Slides

Build with a new `presentation/build/build_deck_v2.js`, copied from `build_deck.js` (which stays untouched). Same palette (`C`), fonts, `eyebrow`, `title`, `card`, `iconBadge`, `phone` and `footer` helpers, and the same framed screenshots in `presentation/build/frames/`. Output: `presentation/v2/SafetySense-Finalist-Deck-v2.pptx` and `.pdf`.

Global rules:

- One idea per slide. Body text is at least 16 pt; captions at least 14 pt; nothing smaller except the footer.
- At most 9 text blocks per slide (v1 slide 9 had about 22).
- Terminology matches the video: Guard, check-in, trusted contacts, professional dispatch, safety PIN, duress PIN, heartbeat.
- Speaker notes below are the full script. Stamps are `[start to end, seconds]`.

### Slide 1. Holding card (0 s)

- **Purpose:** on screen while the team walks up, so the film does not start until George clicks.
- **On slide:** clip A's own last frame (`stills/logo-frame.png`) as the background, so the wordmark is the same lockup the film ends on ten seconds later; below it "George Teifel · Mary Teifel" (20 pt); bottom line "UNM & CNM App Contest 2026" (mono, 12 pt). Nothing else. No tagline (slide 3 owns it).
- **Notes:**

```
[before the timer. 0 s]
(Wait for the go-ahead. Say nothing. Click once: the next slide is a 10-second film that starts by itself.)
1
```

### Slide 2. Clip A, cold open

- **On slide:** `SafetySense-DemoClip-v2-ColdOpen.mp4` full-bleed (x 0, y 0, 13.333 x 7.5 in). No chrome and no footer.
- **Poster:** frame 0 of the finished MP4, extracted with ffmpeg (no darkening, no badge, no caption), so the advance has no jump.
- **Autoplay:** yes, via `presentation/build/autoplay.py`.
- **Notes:**

```
[0:00 to 0:12, 12 s]
(The film plays by itself with sound: 10 seconds. Don't talk over it. It ends on the SafetySense logo. Let the logo sit for one beat, then advance.)
(If it doesn't start: click the picture once. If it still doesn't, advance and say: "Picture someone walking home. Someone comes up behind her, she freezes, and she can't reach her phone. We built an app for that moment.")
2
```

### Slide 3. Team and tagline

- **Eyebrow:** "Who we are". **Title:** "SafetySense calls for help when you can't."
- **On slide:** two cards side by side, reusing the v1 slide 2 people cards:
  - George Teifel · University of New Mexico · Senior, Electrical Engineering · "Built the iOS app and the backend"
  - Mary Teifel · Central New Mexico Community College · Freshman, Mechanical Engineering · "Led research, UX and the app's wording"
- **Visual:** the two cards take the left 60%; one phone mockup (home screen, Night Out) on the right. The v1 "app in 30 seconds" paragraph and the stack list are gone.
- **Notes:**

```
[0:12 to 0:40, 28 s]
GEORGE: That's the moment we built SafetySense for. I'm George Teifel, a senior in electrical engineering at UNM. I built the app and the backend.
MARY: And I'm Mary Teifel, a freshman in mechanical engineering at CNM. I led the research, the design and every word the app says.
GEORGE: SafetySense is an iPhone app that calls for help when you can't.
3
```

### Slide 4. The problem

- **Eyebrow:** "The problem". **Title:** "Most safety apps wait for you to press a button or set a timer" (30 pt, one line; Check In is a timer, so the title names both)
- **On slide:**
  - Left: the big "70%" with "of 298 women reported significant tonic immobility, an involuntary freeze, during sexual assault" and the citation "Möller et al., Acta Obstet Gynecol Scand, 2017 (n = 298)".
  - Right: three short cards, heading only plus one line each, 16 pt:
    1. "Freezing is involuntary" / "It is a normal response, not a choice."
    2. "Phones get taken, broken or switched off" / "A dead phone sends nothing."
    3. "Speaking isn't always possible" / "New Mexico is still listed as the only state without text-to-911."
  - Bottom, full width, pink, 26 pt bold: "What should a phone do when she can't?"
- **Cut from v1:** the "our users" sub-line moves to the notes; card 2 no longer mentions our server (it leaked the solution).
- **Notes:**

```
[0:40 to 1:25, 45 s]
Our users are UNM and CNM students out at night: parties, first dates, rideshares, the walk back to the car.
Most safety apps we reviewed wait for you to press a button or set a timer.
That fails exactly when it matters. In a clinical study of 298 women seen after a sexual assault, 70 percent reported significant tonic immobility: an involuntary freeze. It's a normal response, not a choice.
Phones also get taken, broken or switched off, and a dead phone sends nothing. And New Mexico is still listed as the only state without text-to-911.
So we asked one question: what should a phone do when she can't?
(Source if asked: Möller, Söndergaard and Helström, 2017. 298 women at a Stockholm emergency clinic; 70% significant, 48% extreme.)
(Re-check the text-to-911 status before Nov 20. Never say there is "no way at all" to text.)
4
```

### Slide 5. Our answer: a Guard

- **Eyebrow:** "Our answer". **Title:** "You turn on a Guard. If you can't respond, it acts for you."
- **On slide, three blocks only:**
  1. **Start it** (left card): "Before a walk home, a night out, a date or a ride, tap Start Guard." Below, smaller: "Or skip straight to an alert with the Action Button or Siri." (not the safe word: it is only heard while a Guard is on)
  2. **What it watches for** (centre, one row of four icon badges with short labels): Screams · Breaking glass · Safe word · Fall, then stillness. No check-in badge: the check-in belongs to clip B. Under the row: "It only listens while a Guard is on."
  3. **Built with** (two lines across the bottom, 16 pt, body colour): "Native SwiftUI on iOS 26 · Apple on-device sound, speech and motion" / "Supabase · Twilio · Noonlight (sandbox)". Twilio and Noonlight are shown but not spoken here; slide 12 says what each does.
- **Visual:** one phone mockup on the right (`14-guard-active`, with the cut-off last card masked so the screen ends cleanly). No three-promises column (v1's layout bug goes with it).
- **Must not appear here:** the check-in, 45 or 90 seconds, contacts, dispatch, PINs, heartbeat, the 30-second buffer. Those live in clip B and on slide 11.
- **Notes:**

```
[1:25 to 1:57, 32 s]
Our answer starts before anything goes wrong. Before a walk home, a night out, a date or a ride, you turn on a Guard. One tap.
It's a native iPhone app using Apple's on-device sound, speech and motion frameworks, on a Supabase backend.
Then the phone watches for signs that something's wrong: a scream, breaking glass, your safe word, or a fall followed by stillness. It only listens while a Guard is on.
(Twilio and Noonlight are on the slide. Don't read them out: slide 12 explains what each one does.)
5
```

### Slide 6. Hand-in: watch three things

- **On slide:** full-bleed dark slide, no eyebrow. Heading, 44 pt: "Watch three things." (it does not repeat the clip's lower third; the spoken line sets that up) Then three numbered lines, 26 pt, each with a teal number:
  1. It asks before it alerts.
  2. What her friend sees.
  3. What happens if someone makes her cancel, or breaks her phone.
- **Visual:** left-aligned text on the left 60%; on the right, one still of Ava at the party (the clean frame from `PartyStillV2`, cropped to her), rounded corners, so the slide and the clip share a picture.
- **Notes:**

```
[1:57 to 2:17, 20 s]
You saw her phone already calling. Here's every step behind that, on another night out. Ava turns her Guard on at a party. Watch three things: it asks before it alerts, what her friend sees, and what happens if someone makes her cancel or breaks her phone.
(Advance. The clip starts by itself.)
6
```

### Slide 7. Clip B, proof

- **On slide:** `SafetySense-DemoClip-v2-Proof.mp4` full-bleed. No chrome: the picture needs every pixel to be legible from the back of the room.
- **Poster:** frame 0 of the finished MP4 (the clean party shot, the same picture as slide 6), so the advance looks like the still coming to life.
- **Autoplay:** yes.
- **Notes:**

```
[2:17 to 3:11, 54 s]
(52-second clip with its own voice. Don't talk over it. It ends holding on "Alert raised by itself". Advance when the sound has faded.)
(If the video won't play: jump to appendix slide A4 and give the 40-second spoken version in its notes, then come back to slide 8.)
7
```

### Slide 8. What the video is, and what works today

- **Eyebrow:** "What you just saw". **Title:** "The app is real. Here's exactly what was simulated."
- **On slide:** a row of five stills from clip B, each 2.27 x 2.85 in, cropped to the phone so the screen is readable. They are rendered from `ProofStillV2` (caption band off), so no still carries a half-lit caption. One pill per column on one baseline, and a 16 pt caption below. The slide separates the recording from the system today. Teal pill = real, amber pill = simulated.

| Still (clip frame) | Pill | Caption |
|---|---|---|
| Check-in screen (112) | REAL APP | Recorded in the simulator, in demo mode |
| Contacts step (490) | CALLS WORK | Real calls in our tests, not in this recording. Texts don't arrive yet. (last sentence amber) |
| Live-link page (606) | REAL PAGE | Screenshot of a test alert |
| Dispatch card (832) | SIMULATED | No police contacted. We test with Noonlight's sandbox |
| Heartbeat (1539), cropped to the server card "Alert raised by itself" | ANIMATION | Of a server check we've deployed |

- Two lines under the row, 16 pt, body ink (it is a disclosure, so not dimmed): "Waits are sped up, and Ava and Maya are animated characters." / "The duress PIN is built; what it reaches is the same simulated dispatch."
- Why the wording: the clip was recorded in demo mode (mock backend, scripted night), so the recording itself placed no call and did not touch the sandbox, and a few screens are redrawn. The slide and notes say that plainly.
- **Must not appear here:** 45 s, 90 s, or any re-walk of the steps.
- **Notes:**

```
[3:11 to 3:55, 44 s]
Those phone screens are our app, recorded in the iPhone simulator in demo mode, with a scripted night and the waits sped up. A few, including the alert in the opening film, are redrawn for the big screen.
Outside the video, the app places real calls to a verified number, and the friend's page is a real web page. The text is written, but doesn't arrive yet on our trial account.
Dispatch is simulated: we've only used Noonlight's sandbox, and no police were contacted. The duress PIN keeps that same simulated dispatch coming.
And the smashed phone is an animation of a server check we've deployed.
(If asked "was that call real in the video?": no. The recording used demo mode, which places no calls. Real calls work in our tests, to a verified number.)
(Only say "deployed" for the heartbeat check. Don't say it has been tested in a live alert unless that test has been run by then.)
8
```

### Slide 9. How it differs

- **Eyebrow:** "Originality". **Title:** "Others have pieces. We connected the chain."
- **On slide:** the v1 comparison table cut to five rows, with the same columns (UNM Safe, Noonlight, bSafe, Apple built-in, SafetySense) and the same cell values as v1 for those rows. Row height 0.7 in, text 15 pt. The SafetySense cells for rows 2 and 3 point back to the video:

| Row | SafetySense cell |
|---|---|
| Notices distress on its own | ✓ Sound, motion, context |
| Acts when the phone goes dark | ✓ Server heartbeat (deployed) |
| Duress PIN (fake cancel) | ✓ The two PINs you saw |
| Professional dispatch | ✓ Noonlight (sandbox) |
| Live location to a friend | ✓ |

- Noonlight's cell in the phone-goes-dark row is "Not documented" (unknown, not absent).
- Dropped rows: "Date details sealed until needed" and "Voice trigger" (still available for Q&A).
- Footnote, 15 pt, two lines, lighter ink: "From each product's documentation; not tested by us. These are four tools a student could already have." / "Their columns are shipped products. Ours is a prototype; dispatch runs in Noonlight's sandbox." The "other apps have a duress PIN" detail is spoken, not printed.
- The notes name Centinela and aegis+, so the four dashes in the duress row are never left to imply that no one else has one.
- **Notes:**

```
[3:55 to 4:38, 43 s]
We compared tools a student could already have: UNM Safe, Noonlight, bSafe and the iPhone itself, from their documentation.
Other apps have pieces of this, and we'll name them. Centinela listens for a scream and has a duress PIN, but stops at your friends. aegis+ has a duress PIN and dispatch, but its listing describes nothing that notices on its own. We found no product that documents the whole chain.
Ours notices on its own, tells your people, and reaches dispatch, in a sandbox today, including the two cases you just saw: the forced cancel and the smashed phone.
And we link to UNM Safe.
(Say "we found no product that documents", never "no one else does this". Their columns are shipped products; ours is a prototype.)
9
```

### Slide 10. Design and wording (Mary)

- **Eyebrow:** "Design and experience". **Title:** "Designed for the worst night of someone's life"
- **On slide:** three principle cards on the left (heading plus one line, 16 pt), two phone mockups on the right (the practice drill screen and the Support screen) with one-line captions.
  1. "Calm words, never blame" / "Written to be calm and never blaming. Advocate review is our next step."
  2. "Your first alert is a drill" / "Onboarding ends with a practice run marked TEST."
  3. "Afterward, you choose" / "An advocate, medical care, reporting, or keeping it private."
- **Cut from v1:** "Duress PIN, Face ID vault" (the PIN lives in clip B, the vault on slide 11).
- **Notes:**

```
[4:38 to 5:13, 35 s]
MARY: We designed this for the worst night of someone's life, so the words matter as much as the features.
Every line in the app is calm, and none of it blames the person holding the phone. You saw it in the video: the first thing it says is just "You okay?"
Onboarding ends with a practice drill marked TEST, so your first alert is a practice one.
And afterward, the Support screen offers an advocate, medical care, reporting, or keeping it private. Nothing is required.
10
```

### Slide 11. Privacy (Mary)

- **Eyebrow:** "Privacy and security". **Title:** "Private by default. Evidence only when it matters."
- **On slide:** the four-step audio pipeline as one horizontal row of four large boxes (3.5 in tall) with arrows, 18 pt:
  1. "Guard on" / "Listening happens on the phone"
  2. "30-second buffer" / "In memory, overwriting itself"
  3. "Only if an alert fires" / "Audio is kept and encrypted on the phone"
  4. "Vault" / "Opens with your Face ID. You decide who hears it"
- Under the row, three short pills: "No audio is saved unless an alert fires" · "No ad or analytics SDKs" · "Live links are built to expire after the alert".
- **Cut from v1:** the six cards and the phone; the duress card and the smashed-phone card (both live in clip B).
- **Notes:**

```
[5:13 to 5:53, 40 s]
MARY: An app that listens has to earn trust, so here's exactly what happens to audio.
All the listening happens on the phone. Audio sits in a 30-second buffer in memory that keeps overwriting itself. No audio is saved.
Only if an alert fires is audio kept. It's encrypted on the phone before upload, so our server only holds ciphertext.
It goes into a vault that opens with your Face ID, and you decide whether anyone hears it.
There are no ad or analytics SDKs, and the live link is built to expire when the alert ends.
(Say "no audio is saved". Never "nothing is saved": location does go to the server during a Guard.)
11
```

### Slide 12. Technology (George)

- **Eyebrow:** "Technology". **Title:** "A real app on a real backend"
- **On slide:** a three-box diagram drawn in pptxgenjs shapes (not the v1 PNG, which was illegible), with arrows left to right. Box headings 20 pt, lines 15 pt:
  1. **On the iPhone:** "Apple sound, speech and motion models" / "Rules-based risk engine" / "On-device language model as a second opinion"
  2. **Our server (Supabase):** "Alerts and the ladder" / "Heartbeat watchdog, once a minute"
  3. **Reaching people:** "Twilio: calls and texts to contacts" / "Live-link web page" / "Noonlight: professional dispatch (sandbox today)"
- Arrow label between 1 and 2: "heartbeat + location · no audio while guarding" (audio is uploaded, encrypted, once an alert fires).
- **Cut from v1:** the long sandbox sentence (slide 8 owns it; here it is one clause) and "AI that stays on the phone" in the title (slide 11 owns where listening happens).
- **Notes:**

```
[5:53 to 6:26, 33 s]
GEORGE: Under the hood, it's a native iOS 26 app on a live backend.
On the phone, Apple's sound, speech and motion frameworks feed a rules-based risk engine, so it can always explain why it escalated. Apple's on-device language model gives a second opinion, but can never be the only reason to escalate.
The server runs the alert steps and a once-a-minute heartbeat check. Twilio carries the calls, and Noonlight, still in sandbox, is the dispatch service.
12
```

### Slide 13. Proof, limits and next steps (George)

- **Eyebrow:** "Pathway". **Title:** "How we'll know it works, and what we haven't proven yet"
- **On slide, two columns:**
  - Left, "Targets" (four big-number tiles reused from v1 slide 11): "< 1 false alert per 10 h" · "< 60 s scream to ringing phone" · "< 8% battery per hour" · "80% finish onboarding". Small label above: "Targets, not yet measured".
  - Right, "Not proven yet" (amber heading, four lines, 16 pt): "No field test in real, noisy places" · "Real-device run on an iPhone 16e is pending" · "Live dispatch and our relay still need Noonlight's sign-off" · "Internal TestFlight only". 18 pt.
  - Bottom strip, three steps with arrows: "Student usability tests and advocate review → TestFlight pilot → campus partnership".
- **Notes:**

```
[6:26 to 7:02, 36 s]
Here's how we'll know it works. Our targets are on the left: under one false alert in ten hours of guarding, and under a minute from a scream to a ringing phone.
Those are targets; we haven't field-tested them. The app is on internal TestFlight only, our real-device run is still to come, and we still need Noonlight's sign-off before any live dispatch.
Next: usability tests with UNM and CNM students, a review of our wording by advocates, then a TestFlight pilot and a campus partnership.
(If the iPhone 16e run is done by Nov 20, replace that line with the measured numbers.)
13
```

### Slide 14. Close

- **On slide:** the v1 close slide: "When you can't call for help, SafetySense does." (40 pt), the two phone mockups, the line "SafetySense supplements 911. It never replaces it.", and "George Teifel · Mary Teifel". This is the only place the tagline and the 911 line appear.
- **Notes:**

```
[7:02 to 7:19, 17 s. Total 7:19, leaving 41 s of slack.]
GEORGE: SafetySense supplements 911. It never replaces it. But when you can't call for help, SafetySense does.
MARY: We'd love to pilot it with students at UNM and CNM. Thank you. We're happy to take your questions.
(Stop. Stay on this slide for Q&A. The appendix slides are only for answering questions.)
14
```

### Appendix

- **A1 to A3:** v1 slides 13 to 15, with three answers corrected: battery ("We haven't measured it on a real phone yet; an iPhone 16e run is next"), Apple ("dispatch would go through Noonlight, a professional monitoring service many apps already use. Apple hasn't reviewed it"; no "partner"), and live links ("built to expire after the alert").
- **A4, ladder fallback:** v1 slide 5 as built (four phones, "One calm ladder, from 'You okay?' to dispatch"), with the footer "A4". Step 3's pill reads "3 · Dispatch (simulated)" and its caption "…a monitoring center calls and can send police. Simulated here." Notes:

```
[Only if clip B fails. About 40 s.]
Here's what the video shows. When something seems wrong, the app asks quietly: "You okay?" One tap ends it.
If there's no answer in 45 seconds, her trusted contacts get a phone call and a link to her live location, and they can tap "I'm on my way" or "Send help now".
After 90 more seconds with no answer, a professional dispatch service calls her and can send police. In our demo that step is simulated.
If someone forces her to cancel, a duress PIN looks exactly like cancelling, but help keeps coming. And if the phone is smashed, our server notices the missing heartbeat and raises the alert itself.
18
```

## 5. Spoken hand-offs

| Where | Line |
|---|---|
| Into clip A | Nothing. One click from the holding card; the film starts itself |
| Out of clip A (slide 3) | "That's the moment we built SafetySense for. I'm George Teifel…" |
| Out of the problem (slide 4) | "So we asked one question: what should a phone do when she can't?" |
| Toward clip B (slide 5) | None. Slide 5 ends on "It only listens while a Guard is on." |
| Into clip B (slide 6) | "You saw her phone already calling. Here's every step behind that, on another night out. Ava turns her Guard on at a party. Watch three things: it asks before it alerts, what her friend sees, and what happens if someone makes her cancel or breaks her phone." |
| Out of clip B (slide 8) | "Those phone screens are our app, recorded in the iPhone simulator in demo mode, with a scripted night and the waits sped up." |
| Call-backs | Slide 9: "the two cases you just saw: the forced cancel and the smashed phone". Slide 10: "You saw it in the video: the first thing it says is just 'You okay?'" |

## 6. "Said once" table

This is the acceptance test for the notes and the slide text. Search the built deck's notes and slide text for each idea; it should be explained only in its home.

| Idea | Its one home | Allowed elsewhere |
|---|---|---|
| The human stake (she can't reach her phone) | Clip A | |
| Team facts | Slide 3 | Names on slides 1 and 14 |
| Tagline | Slide 3 title | Its mirror on slide 14 |
| 70% freeze statistic, text-to-911 | Slide 4 | |
| How a Guard starts | Slide 5 | Clip B's 2-second lower third ("Ava turns her Guard on") |
| Signals list | Slide 5 | A two-word row label on slide 9 |
| Check-in, 45 seconds, one tap | Clip B | A4 fallback only |
| Trusted contacts: call, text, live link | Clip B | Slide 8 says only what is live |
| 90 seconds, professional dispatch, police | Clip B | A4 fallback only |
| Safety PIN and duress PIN | Clip B | "You saw" call-backs on slide 9 |
| Smashed phone, server heartbeat | Clip B | Call-back on slide 9; a diagram label on slide 12 |
| Dispatch is simulated (Noonlight sandbox) | Slide 8 | The label and one line inside clip B; a short "sandbox" qualifier wherever dispatch is shown (slides 5, 9, 12, A4). Slide 13 says only the new fact: Noonlight's sign-off is still needed. |
| Recorded in the simulator in demo mode, sped up, texts pending | Slide 8 | |
| Listening happens on the phone | Slide 11 | Arrow label on slide 12 |
| 30-second buffer, "no audio is saved", encryption, vault | Slide 11 | |
| Tone and wording, drill, Support | Slide 10 | |
| Stack and architecture | Slide 12 | One spoken sentence on slide 5 (the rubric wants it early); vendor roles are spoken on slide 12 only |
| Targets and what is untested | Slide 13 | |
| Internal TestFlight | Slide 13 | |
| Supplements 911, never replaces it | Slide 14 | |

## 7. What is cut from v1

| v1 | Fate in v2 |
|---|---|
| Slide 1 title and pitch subtitle | Split: holding card (slide 1) and team slide (3). The pitch sentence is cut |
| Slide 2 "the app in 30 seconds" paragraph and stack list | Cut. Clip A does the hook; the stack is one line on slide 5 |
| Slide 3 card 2's "our server treats a lost heartbeat…" | Cut (it leaked the solution) |
| Slide 4 three promises, six-signal column, buffer mention | Replaced by slide 5. The buffer moves to slide 11 only |
| Slide 5 ladder | Out of the talk. Kept as appendix A4 |
| Slide 6 video: intro card, v3_07 signals section, tagline card, "never replaces it" chips | Cut. Replaced by clips A and B |
| Slide 6 notes: "Two things to notice…" | Replaced by slide 8 |
| Slide 7 two rows, long title, Centinela and aegis+ names in the script | Rows cut; the names stay available for Q&A |
| Slide 8 "Duress PIN, Face ID vault, discreet icon" | Cut from this slide |
| Slide 9 six cards, phone, duress and smashed-phone cards | Cut; pipeline only |
| Slide 10 architecture PNG and sandbox sentence | Replaced by a three-box diagram; the sandbox lives on slide 8 |
| Slides 11 and 12 | Kept; limits added to 13 |

## 8. Build order

1. `video/src/v3/HybridV3.tsx`: add the opt-in `deck` field (section 3.4). Run the checksum comparison.
2. `video/src/v3/deckIndexV2.tsx`: the two compositions and the lower third.
3. Render raw clips to the scratch folder (`npx remotion render src/v3/deckIndexV2.tsx ColdOpenV2 … --gl=angle`, same for `ProofV2`), then run the ffmpeg pass into `presentation/v2/`.
4. Export stills for slides 6, 7 (poster) and 8 from the finished clip B, and the slide 2 poster from clip A, into `presentation/v2/stills/`.
5. `presentation/build/build_deck_v2.js`: build the 18 slides. Embed both MP4s (not linked).
6. `rtk python3 presentation/build/autoplay.py presentation/v2/SafetySense-Finalist-Deck-v2.pptx` so both videos start when their slide appears.
7. Export the PDF backup. In the PDF, slides 2 and 7 show their posters.
8. Do not touch `presentation/v1/`, the v1 deck files, `SafetySense-Demo.mp4`, `build_deck.js` or `deckIndex.tsx`. No commits, no email.

## 9. Acceptance checks

- Notes stamps sum to 7:19; no slide is scripted above about 150 words a minute; a read-through at speaking pace, with both clips playing, ends at or under 7:35.
- The "said once" table holds for slide text and notes.
- Neither clip contains a title card, a tagline card, or the words "never replaces it".
- Clip A ends on the logo and never shows the "Most safety apps wait for" card. Clip B's last frame shows "Alert raised by itself", and the "+3 min" chip is readable.
- Clip B shows no caption during the first 1.8 s and no CHECK-IN · CONTACTS · DISPATCH chips anywhere.
- The simulated label is readable on a 1080p frame shrunk to 25%.
- The full film's checksum stills are unchanged.
- In real PowerPoint (Mac, and Windows if one is available): both videos start on slide advance, with sound; the audio level of the clips is close to a speaking voice; the last frame holds.
- Forbidden wording does not appear anywhere: "replaces 911" as a claim, "calls 911", "nothing is saved", "first", "only" or "novel" about a feature, "on the App Store", "approved", "we tested" about competitors or real devices.
- Render every slide to PNG and look at each one for overlap, wrapping and small text.

## 10. Risks and decisions for George and Mary

- **Tone of the opening.** The talk opens on Ava being followed. The film handles it carefully, but George and Mary should confirm it at the practice session. If they or the staff find it too heavy, swap slides 2 and 3 (team first, then the cold open) and change George's first line to "Here is the moment we built it for."
- **Two autoplay videos on an unfamiliar machine.** Both have a spoken fallback in the notes. Ask at practice to test the PPTX on the Rainforest machine or one like it, with sound.
- **Start-alert wording on slide 5.** The film shows the Action Button and Siri starting an alert, and tapping in the app starting a Guard. I did not confirm what the Lock Screen control starts, so slide 5 leaves it out. Add it only after checking the app.
- **Heartbeat tag on slide 8.** QA_PREP says the backend was confirmed by reading the deployed code, not by running a live alert. The slide therefore says "animation" and "deployed". Upgrade the wording only if an end-to-end heartbeat test is run.
- **Time skips remain** in clip B (the ring jumps, the 90 s countdown runs fast). They are labelled on screen, and slide 8 says "sped up".
- **Scene changes remain** (kitchen, street, car). The lower third and the hand-in line frame it as one night; if practice feedback says it still confuses, the fix is a spoken clause on slide 6, not a re-edit.
- **Music join in clip B**: fixed by overlapping the bed (section 3.2). Still worth one listen on speakers.
- **Text-to-911 claim** must be re-checked before Nov 20.
- **Practice feedback (Nov 10 to 13)** has to be folded in. The 41 s of slack is for that: give it to slides 5 and 8 first, not to new content.

## 11. As built (Nov 10, 2026, after the review pass)

Files:

- `presentation/v2/SafetySense-Finalist-Deck-v2.pptx` (18 slides, 18.0 MB, both clips embedded, autoplay set) and `.pdf` (backup; slides 2 and 7 show their posters).
- `presentation/v2/SafetySense-DemoClip-v2-ColdOpen.mp4` (9.93 s) and `presentation/v2/SafetySense-DemoClip-v2-Proof.mp4` (52.40 s, 8.4 MB). Both 1080p30, H.264 + AAC, about -16 LUFS (the same level as the v1 clip).
- `video/src/v3/deckIndexV2.tsx` (compositions `ColdOpenV2`, `ProofV2`, plus `PartyStillV2` and `ProofStillV2` for slide stills), `presentation/build/build_deck_v2.js`, stills in `presentation/v2/stills/`.

Differences from the original spec (sections 1 to 10 already carry the slide text, notes and timings as built):

- **File names.** The clips are `SafetySense-DemoClip-v2-ColdOpen.mp4` and `-Proof.mp4`, and the composition file is `deckIndexV2.tsx`.
- **Encode.** Clip A: crf 24, preset slow. Clip B: crf 23, preset slow, capped at 1.2 Mb/s with 128k audio (SSIM 0.990 against the raw render), which brought the PPTX from 21.6 to 18.0 MB.
- **Posters** are frame 0 of each finished MP4 (`ffmpeg -frames:v 1`). Clip B has no picture fade-in.
- **Deck-mode layout** (all behind `deck: true`; the film is unchanged):
  - Cold open: the Guard badge is 38 px and the "Sudden stop" / "then no movement" chips are 44 px, stacked. The SMS toast over the map is hidden.
  - Check-in phone is 10% larger. The contacts and live-link phones are not pushed in and sit higher, so each ends above the caption band and no caption crosses a phone.
  - The live-link timeline card is cropped at a row boundary. It reads "test only, not sent", which now agrees with slide 8 ("not in this recording", "Screenshot of a test alert").
  - Heartbeat: no push-in and the group sits at 0.9 scale, so on the resting frame the server card and the "Phone offline" pill are inside title-safe. "+3 min · 3 missed heartbeats" sits above the server card.
  - Every pill tag and mono kicker is at least 34 px; the small CHECK-IN / CONTACTS / DISPATCH list in the duress column is hidden; the simulated labels are 1.5x; the time-skip chips are 1.4x.
- **Slide 14.** The 911 line is 20 pt pink.

Review findings declined, and why:

- "EARLIER THAT NIGHT / Ava's Guard is on." for the lower third. Two reviewers disagreed; the neutral "A NIGHT OUT" with "Ava turns her Guard on." was used, and slide 6 frames clip B as how the phone gets to the state the opening showed. Calling it the same night would need the party to lead into the walk home, which the film does not show.
- Cutting 90 to 100 words. The script lost about 28 words and gained 20 s instead (7:00 to 7:20). Every slide is now at or under 147 words a minute and 40 s of slack remain.

Checks run after the review pass:

- Full film unchanged: stills of `HybridV3` at frames 100, 220, 1200, 1700, 1950, 2200, 2400, 2750, 3000, 3100 are byte-identical to the stills taken before any edit.
- Clip A (re-rendered once in this pass) and clip B (re-rendered after the last source change) were looked at as 5 fps contact sheets, and clip B's frames at 14.6, 17.2, 19.2 and 51.3 s at larger size: no caption touches a phone, the last frame is inside title-safe, no title or tagline card, no ladder chips.
- Clip B audio through the B1 to B2 join stays at about -30 dB RMS in every 10 ms window (no silent gap). Integrated loudness -16.2 LUFS.
- Autoplay timing is present in the XML of slides 2 and 7 (`playFrom(0.0)`, 9933 ms and 51400 ms).
- All 18 PDF pages were rendered and looked at after the final build.
- Wording scan: no "replaces 911" claim, "calls 911", "partner" about Noonlight, "we tested", "first", "only" or "novel" about a feature. "nothing is saved" appears once, in a stage direction telling the speaker not to say it.

Not checked (needs a person):

- Playback in real PowerPoint on Mac and on Windows: that both clips start on advance with sound, the level sits near a speaking voice, and the last frame holds. Do this before Nov 16 and at the practice session, and write the result here.
- A timed spoken read-through by George and Mary.
- A listen to the clip B join on speakers.
- The tone of the opening.

## 12. Second review pass (Nov 10, 2026, evening)

Fixed in the sources and rebuilt (sections 2 to 4 above carry the new text and timings):

- **Honesty.** Slide 12 wire label is "no audio while guarding". Slide 5 no longer offers the safe word as a way to skip starting a Guard. Slide 13 says Noonlight's sign-off is still needed (nothing shows it has been asked for). Slide 9: "tools a student could already have", and aegis+ is described by its listing. Slide 4 title names the timer. Slide 8 notes say the alert in the opening film is redrawn. Clip B's duress column carries an amber "DISPATCH IS SIMULATED" line (deck mode only).
- **Fit.** The check-in is gone from slide 5 (four signals), so clip B is the only place it is told. Slide 6 heading is "Watch three things." and its hand-in line says "every step behind that, on another night out". Slide 12 names who does what without re-walking the steps. Slide 5 says "It only listens while a Guard is on" once.
- **Visual.** Slide 5 "BUILT WITH" kicker and stack are separate boxes. Slide 9 has one two-line footnote at 15 pt. Slide 8's bottom note is body ink and tile 5 shows the server card. Clip B's lower third sits on the film's dark pill with a light kicker, and holds 1 s longer. In the PIN close-ups the phones end above the caption band (deck mode only).
- **Size.** PPTX 18.0 MB (was 21.6). About 24.6 MB once an email encodes it, so George should still send himself a test email and confirm it arrives as an attachment.

Declined:

- Rendering slide headlines as PNG text in the film's display face. The slide 6 heading no longer repeats the clip's caption, which was the visible seam; picture headlines would stop George and Mary from editing text after practice and would drop out of the PDF's text.
- Re-rendering clip A to relabel "68 TO DISPATCH". The slide 8 notes line covers it; clip A's source is unchanged, so it was not re-rendered.
- A spoken sentence about audio on slide 12. Slide 11 already says it; the label carries the qualifier.

Checks after this pass:

- Full film unchanged: `HybridV3` stills at frames 100, 220, 1200, 1700, 1950, 2200, 2400, 2750, 3000, 3100 are byte-identical to stills rendered from the committed (HEAD) sources.
- Clip B (re-rendered once) was read as 2.5 fps contact sheets plus larger frames at 1.0, 38.6 and 43.0 s. 52.40 s, 1080p30, -16.2 LUFS. Clip A was not touched.
- Autoplay XML: `playFrom(0.0)` with 9933 ms on slide 2 and 52400 ms on slide 7.
- All 18 PDF pages were rendered and looked at; slides 4, 5, 6, 8, 9, 12 and 13 at full size.
- Slide 6's still is a later frame of the party shot than clip B's poster (same scene, not the same frame).
- Still not checked: playback in real PowerPoint on Mac and Windows, and a timed read-through.
