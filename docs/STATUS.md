# SafetySense: project status

Last checked 2026-11-04 by the final verification pass (build, all tests, simulator screens, live backend end to end, docs, secret scan).
**Technical submission due Fri Nov 6, 2026, 11:59 pm MT** to itevents@unm.edu. George sends it; no agent sends email.

## What George must still do

**Before Fri Nov 6, 11:59 pm MT (required):**

1. **Mary's eligibility.** Confirm she's taking at least 3 credit hours at CNM this fall, or is in a Deep Dive cohort. If she isn't on the registration, email itevents@unm.edu **before Nov 6** to add her.
2. **Fill in the team bio.** `submission/01-team-bio/SafetySense-TeamBio.html`: years and majors are filled in (George: senior EE; Mary: freshman ME, 3+ CNM credits confirmed). Only Mary's email is left (yellow `[FILL IN]`). Check both "why we care" lines and Mary's role. Re-render with `submission/_assets/render.sh` (needs network for Google Fonts) and open the PDF.
3. **Finish the email draft.** `submission/EMAIL_DRAFT.md`: Mary's email, and the extra-credit line (keep it only if one of you went to the Sep 17 kickoff or an Oct 8/20 mentoring session; delete it otherwise).
4. **Send the email** from gteifel@unm.edu with the 5 PDFs attached. Subject: `App Contest Technical Submission – SafetySense`. Record the time and message id in `docs/SUBMISSION_CHECKLIST.md`. No agent sends email.
5. ~~Commit the work.~~ Done: everything is committed and pushed to the public repo https://github.com/george11642/safetysense. Your personal Gmail address has been removed from the docs. The secret and phone-number scan passed (2026-11-04).

**Before Nov 20 (finalists):**

6. **Re-check NM text-to-911** once in a browser on the FCC Text-to-911 registry (it blocks automated fetches). The docs say "still listed as the only US state".
7. **Real-device run on the iPhone 16e**: set `DEVELOPMENT_TEAM` in `app/project.yml`, run `xcodegen generate`, install from Xcode. Test the microphone, SpeechAnalyzer, Face ID, the Action Button and Siri, and the **fake call** end to end (ring after a delay, Lock Screen Answer/Decline, ringtone on silent, the spoken script, ringtone while a Guard session is listening). `presentation/IPHONE_DEMO_SCRIPT.md` has the shot list. When the trial call rings, press a key to get past Twilio's trial message.
8. ~~Deck placeholders~~ Done: slide 2 year/major filled.

**Later / optional:**

- **Mary's Twilio verification** (deferred, as you asked): Twilio Console → Phone Numbers → Verified Caller IDs → add Mary's number (stored as SAFETYSENSE_MARY_PHONE in ~/.config/global.env). Until then, calls to her fail with a Twilio error. Nobody has called or texted her.
- **Sign-up limit while testing:** `register` now allows 5 sign-ups per network per hour. If several simulator re-installs (or your phone on the same Wi-Fi) hit a 429, clear it in the Supabase SQL editor with `delete from public.register_hits;`.
- The Figma prototype is done: public ("Anyone · can view") and verified signed-out on 2026-11-04. Nothing to do.

## System integration: what needs a real device (added 2026-11-05)

Built and covered by unit tests, but the simulator can't prove these. Check them on the iPhone 16e with a TestFlight build:

1. **Lock Screen control:** tap SafetySense Alert on a locked phone. It should run with no unlock, and the Live Activity should appear. If iOS runs it in the widget extension instead of the app, a "Tap to finish your alert" notification appears; that means the design needs another look.
2. **App to widget sharing:** the Release Keychain group was tested in the simulator's app process only. Confirm the Guard control shows Guarding during a session.
3. **First-run speech permission:** Allow on Microphone on a fresh install. The fix follows `SafeWordEnroller`, but the crash was inferred from the SDK, never reproduced.
4. **Always location prompt:** choose Keep While Using. The row should show While Using within a few seconds, and Allow all should carry on.
5. **Audio:** a locked session with the mic on and off, a phone call during a session (expect "Listening paused" and recovery on opening the app), AirPods music during Guard, and the check-in haptic while the mic is on.
6. **Alert from a cold start:** Action Button with the app closed. Expect a location on the live link, and the Alert screen should only say evidence is recording if audio is really arriving.
7. **Also still to do:** a 3+ minute stationary period, a false-positive pass against the under 1 per 10 hours target, a fast End then Start (CLMonitor reuse), a walk that reaches its destination, and a Live Activity on the 16e's Lock Screen (it has no Dynamic Island).

**TestFlight state (2026-11-06):** build 0.1.0 (2) is VALID and in internal testing, in the group "SafetySense Internal" (all builds), with George invited. Build 1 failed Apple's processing with error 90626, because an AppEnum case was named "Siri". `TriggerSourceEntity.siri` is now `.voice`, and `SharedCommand.Source` keeps `.siri`. Keep "Siri" out of AppEnum cases and titles. Internal only: no external groups, public link or review submissions.

### Enable App Group + time-sensitive (Josh, whenever convenient)

Until this is done, check-ins are ordinary notifications that don't break through a Focus, onboarding says "Notifications", and the app and widgets share data through the Keychain group. Nothing is broken in the meantime. Only Josh can do steps 1 to 4.

In Certificates, Identifiers & Profiles (team K89F44WFKH):

- [ ] 1. Under Identifiers > App Groups, create `group.com.georgeteifel.SafetySense`.
- [ ] 2. Open App ID `com.georgeteifel.SafetySense`, turn on App Groups and assign that group.
- [ ] 3. Open App ID `com.georgeteifel.SafetySense.Widgets`, turn on App Groups and assign the same group.
- [ ] 4. On `com.georgeteifel.SafetySense` only, turn on Time Sensitive Notifications.
- [ ] 5. Regenerate both App Store profiles, keeping the names `SafetySense App Store` and `SafetySense Widgets App Store`. Changing an App ID invalidates the old ones. Install the new ones on the build Mac.
- [ ] 6. Restore the full entitlements in Release: add `com.apple.security.application-groups` to `app/SafetySense/TestFlight.entitlements` and `app/SafetySenseWidgets/TestFlight.entitlements`, and add `com.apple.developer.usernotifications.time-sensitive` to the app's file. Keep the `keychain-access-groups` entries: `testflight.sh` requires the shared group, and it holds the data to migrate.
- [ ] 7. Upload a new build with `app/Tools/testflight.sh` (next build number) and confirm the Guard control still shows Guarding. Data moves from the Keychain to the App Group by itself.

**Decisions to confirm:** `ITSAppUsesNonExemptEncryption` stays false because all encryption is Apple's (TLS, Keychain, CryptoKit). Arriving at a destination does not cancel the arrival check, since being at the door isn't the same as being safe. The privacy manifest declares name, phone, contacts, precise location and audio as collected for app functionality; match this if an App Store privacy label is ever filled in.

## App and Figma parity (added 2026-11-05)

The app now matches the prototype's screens and flows: Marked safe (both PINs, countdown and Alert Active), "I need help" going to the countdown, mode-specific Guards, the check-in toast, the fixed Alert dock, the contacts preview, and failure, permission and no-PIN states. 214 tests pass; Release compiles for the simulator.

**Still open, because it lives outside `app/`:**

1. **Live link duress states (frames 20 to 20ed2) and responses (18, 20b/c/d).** `share/get` needs to return `duress`, the duress time and `mode` (additive, no schema change), and `web/a.html` needs the states: confirmed response labels, "Dispatch already requested", and the reason line with mode. It also says "Noonlight has been asked to send help" for sandbox dispatch, which could mislead a real contact on a TestFlight build; only `simulated` gets honest wording today.

**Decisions to confirm:**

- Toast and timeline say "Maya is on the way", not Figma's "on her way", because contacts have no pronouns on file. Her "Her update…" line is "This update…" for the same reason.
- Check-in defaults stay at Night Out 45 min and Date 30 min (SPEC: 30 to 90). The prototype's story uses 20. Changing them is one line in `GuardMode.defaultCheckInInterval`.
- Night Out and Date Guards start with the End Guard button alone, without "Face ID/PIN" on the label; the auth gate is unchanged.
- CNM Title IX (505-224-4000 x51240, Dean of Students) was checked on CNM's own Title IX page on 2026-11-05. It isn't in the SPEC fact-check table yet.

## Duress callback relay (added 2026-11-06)

Function version 11 is deployed, read back and identical to `index.ts`. Versions 6 to 10 were cut-off deploys that took the whole API down from 07:51 to 08:10 UTC on Nov 6. Noonlight now gets a relay number instead of the user's, and the Twilio number's webhooks point at the relay. **It's built and tested with simulated webhooks only. The gap is not closed.** Details and limits: `backend/README.md`, "Relay line and the duress callback gap".

Live link duress states from item 1 above are partly done: `share/get` returns `duress`, the duress time and `mode`, and the page has a "Do not call or text" banner and honest sandbox wording. The frame-by-frame match isn't confirmed.

**George:**

1. **Before tonight's submission:** the Security and Purpose documents are out of date. Security says Noonlight holds the user's phone, and both describe duress as an open item with old wording. Replacement wording is in `docs/COMPETITOR_RESEARCH.md` section 6. Re-render the PDFs if you change them.
2. **Also check** the Technical document, SPEC, deck and Q&A, which say monitoring texts and calls the user. A dispatcher's text no longer reaches her, and a call reaches her only if she presses 1.
3. **Ask Noonlight** the questions in the README. The big one is whether a relay number is allowed at all.

**Decisions to confirm:**

- Silent triggers (`safe_word`, `action_button`) forward like any other alert, so a dispatcher's call could ring in front of an attacker. Treating them like duress is a small server change, but a false alarm then couldn't be sorted out by phone.
- If someone else answers a forwarded call and presses 1, the relay can't tell. The dispatcher talks to that person.

**Other session (`app/`):**

- Commit the bare-duress work. The server now also handles the old behaviour for installed builds.
- A later alert in the same session merges into a duress alert, so a genuine alert closes itself on screen. Help is already going; please check this is acceptable.
- iOS microphone and location indicators stay on for about 30 minutes after a fake cancel, visible to someone holding the phone. Consider disclosing that.

## Release review fixes (added 2026-11-06)

**Not live yet:** the `applyDuress` re-raise of a cancelled alert in `backend/supabase/functions/api/index.ts` is committed but not deployed. The app needs no deploy for its side of that fix. It holds `session/end` until the duress cancel lands.

**Not live yet:** the `session/end` change in `backend/supabase/functions/api/index.ts` is committed but not deployed. Until it is, End Guard in a dead zone can still leave a `heartbeat_lost` alert the phone can't see. TestFlight sessions are `dry_run`, so nobody is contacted in the meantime.

**Still open:** `web/a.html` doesn't have the confirmed response states or "dispatch already requested" (frames 18, 20b to 20d, 20eb to 20ed2). It was outside this work's allowed paths. George needs to allow the change or accept the gap in writing.

**Decisions to confirm:**

- A failed call now reads "Couldn't reach" even when the text got out. It used to show the text's status.
- After "Forgot your PIN?", clips hidden by a duress PIN come back only with the old safety PIN. Someone who really forgot it can't bring them back.
- A duress PIN during a running duress window restarts the 30 minutes.

## Round 6 fixes (added 2026-11-06)

**Not live yet:** retention now clears the last location and battery on session rows after 30 days and deletes sessions the phone never closed, 90 days after their last heartbeat (`backend/supabase/functions/api/index.ts`). It type-checks but hasn't run or been deployed. Until it's deployed, the 30-day location line in Settings and Privacy isn't true for those session rows. A deploy also carries the two earlier "Not live yet" changes. Use the CLI command in `backend/README.md`, since cut-off MCP deploys took the API down on Nov 6, then smoke test.

**Still open:** the live-link states in `web/a.html` (frames 18, 20b to 20d, 20eb to 20ed2). George needs to allow the change or accept the gap in writing.

**Decisions to confirm:**

- Walk now defaults to 30 min and Ride to 35, matching frames 22, 25 and 26. Shortcuts and a fake call's Walk guard use the same defaults.
- The prototype and any deck or PDF copy of "Nothing is saved unless something's wrong" should change to "No audio is saved…", which is what the app now says. Location and sealed details do go to the server during a session. `submission/`, `presentation/` and Figma weren't touched.
- While evidence is hidden, "Delete everything" without the original safety PIN only looks like a wipe, so someone who really forgot that PIN keeps the hidden clips and server data until retention removes the server copy. It reads the same on purpose, which means the dialog's "permanently removes" isn't true in that one case.
- Hidden clips now stay on the iPhone past "Keep data for", so a forced shorter setting can't remove them. They have no end date on the phone until the safety PIN is used.

## What exists and where

| Thing | Where | State |
|---|---|---|
| iOS app (Swift 6, SwiftUI, iOS 26) | `app/` (XcodeGen `app/project.yml`) | Builds with 0 errors and 0 warnings. **136/136 tests pass** in 10 suites (final run 2026-11-04 via `Tools/xcb.sh test`). |
| Backend (Supabase Edge Function `api`, Postgres, pg_cron watchdog) | `backend/` | Live at `https://uvunyysuyuonhoviszmc.supabase.co/functions/v1/api/` (function v3). Cron jobs: watchdog (every minute) and retention (hourly). `account/delete`, SMS delivery receipts and a sign-up rate limit are live. Database holds only the simulator's "Alex" device; no alerts, events or evidence. |
| Contact live-link page and landing page | `web/` (Vercel project `safetysense-live`) | Live at https://safetysense-live.vercel.app/ and `/a/<token>` |
| Submission PDFs 1 to 5 | `submission/01-…` to `05-…` (HTML source next to each PDF) | Built. Pages: 1 / 1 / 4 / 6 / 4. The bio has placeholders. |
| Prototype | Figma file `Mx4ZCAW032658aaX1uD0vp`; link in `submission/06-prototype-link/PROTOTYPE_LINK.md` | 34 screens, 5 overlays and 5 flows, wired (every tappable element has a destination; audit fixes 2026-11-04). **Public** (Anyone · can view), verified signed-out 2026-11-04. |
| Email draft | `submission/EMAIL_DRAFT.md` | Prototype link is filled in. Mary's email and the extra-credit line are still to fill. |
| Architecture diagram | `design/architecture.svg` / `.png` | Embedded in PDF 4 and deck slide 10 |
| App screenshots | `design/screens/` (old integration captures are in `design/screens/archive-integration/`) | Current UI, iPhone 17 Pro and 17e |
| Demo video | `presentation/SafetySense-Demo.mp4` (submission video, 16:9, 2:40; the 3D-and-app hybrid George chose). Older and alternate cuts: `presentation/videos/`. `SafetySense-DemoClip-AppFlow.mp4` (39 s app and live-link cut), `SafetySense-AppLoop.mp4/.gif` | Remotion source is in `video/` |
| Finalist deck | `presentation/SafetySense-Finalist-Deck.pptx` + `.pdf` | 15 slides. The 39 s demo clip is embedded on slide 6, with speaker notes. |
| Q&A prep and iPhone demo script | `presentation/QA_PREP.md`, `presentation/IPHONE_DEMO_SCRIPT.md` | |
| Spec, brief, checklist | `docs/SPEC.md`, `docs/CONTEST_BRIEF.md`, `docs/SUBMISSION_CHECKLIST.md` | |

## Spec coverage (docs/SPEC.md §13)

| Item | Status |
|---|---|
| Onboarding (9 steps), Home, Guard active, Check-in, Alert countdown, Alert active, Support, Vault, Contacts, Settings | Done (screens in `design/screens/`) |
| On-device SoundAnalysis plus safe word / distress phrases (SpeechAnalyzer) | Implemented (`Services/Audio/AudioPipeline.swift`). The simulator uses simulated audio; **not yet tried on a device.** |
| Escalation ladder with PIN and duress PIN | Done and unit-tested; the duress PIN silently escalates on the server |
| Contact call/text with live link | Done. Twilio voice works to verified numbers. US SMS is blocked on the trial (30034). |
| Dispatch against the Noonlight sandbox, never live 911 | Done (Noonlight sandbox, or "simulated" when there's no token or it's a dry run). The sandbox token is set, but all 4 alerts in the database so far are `simulated` (dry runs), so no sandbox alarm has been created yet. |
| Stretch: Live Activity and Dynamic Island | Done (`SafetySenseWidgets/GuardLiveActivity.swift`). Captured on the Lock Screen. |
| Stretch: Foundation Models second opinion | Implemented (`Services/SecondOpinion/FoundationModelsSecondOpinion.swift`), capped at ±25%, never the only reason to escalate. Not tried on a device. |
| Stretch: Date-mode sealed details | Done. Encrypted on the server (`v1:`), shown on the contact page only during an alert. |
| Stretch: server heartbeat monitor | Done (pg_cron watchdog every minute → `heartbeat_lost` alert → auto-escalation) |
| Stretch: Action Button App Intent, Control Center controls, Siri | Implemented (`Intents/`, `SafetySenseWidgets/SOSControlWidget.swift`). Not tried on a device. |
| Fake call (§7.7) | Done (`Features/FakeCall/`): setup sheet, scheduled ring with a time-sensitive notification, unbranded incoming and in-call screens, on-device voice script, optional Walk Home guard on answer, Siri/Shortcuts intent. 17 unit tests; screens `design/screens/39–43`. **Not yet tried on a device.** |
| Account deletion and retention | Done. Settings → Delete everything wipes the phone and calls `account/delete` on the server; an hourly job expires evidence and locations (30 days) and alerts (90 days). Verified live end to end 2026-11-04. |
| Apple Watch, Critical Alerts, Android | After the contest (per spec) |

## How to run things

```sh
# iOS: build and run the tests (iPhone 17 Pro simulator)
cd app && xcodegen generate && Tools/xcb.sh test
# Demo mode (mock backend, real rules engine, scripted Night Out):
#   launch arguments: -ssDemo 1 -ssScenario nightOut   (Safety PIN for QA launches: 2580)
# Live mode sends every alert with dry_run=true unless Settings > Developer > "Allow real calls" is on.

# Backend smoke test (dry run, no calls)
backend/scripts/smoke.sh

# Submission PDFs (re-render after editing HTML)
submission/_assets/render.sh

# Deck (rebuild after changing screenshots or the video)
python3 presentation/build/frame_screens.py
NODE_PATH=$(npm root -g) node presentation/build/build_deck.js
# PDF backup: convert with LibreOffice (pptx skill's soffice.py) into presentation/

# Video
cd video && scripts/render_all.sh
```

## Changes from this audit (2026-11-04)
- The deck now embeds the demo: a 39 s app and live-link cut (`SafetySense-DemoClip-AppFlow.mp4`) with a cover frame. The slide 6 beats, title and speaker notes now match the cut. Slide 10 now uses `design/architecture.png`. The PPTX was validated and the PDF backup re-exported (15 pages).
- App: the drill's TEST alert is now cancelled on the server when you tap Finish or Try again, so the watchdog no longer escalates drills into a simulated dispatch. The drill and Alert-active timelines say "Test call logged, nobody was called" or "Test text logged, nothing was sent" instead of "call placed" on dry runs. Rebuilt; 116/116 tests pass.
- `app/project.yml` now has the publishable key and share base URL set explicitly. Before, they were empty, and Config.swift fell back to the same values.
- Contact live-link page: dry-run timeline rows now read "Test call" / "Test text". The landing page now lists the verified 24/7 numbers for LoboRESPECT (505-277-2911) and the Rape Crisis Center of Central NM (505-266-7711). Both are redeployed to Vercel production.
- Verified by web search on 2026-11-04 (the numbers in the app's Support screen): LoboRESPECT 505-277-2911 (24/7 for students), RCCCNM hotline 505-266-7711, Albuquerque SANE Collaborative 505-884-7263, UNMPD 505-277-2241.
- `submission/EMAIL_DRAFT.md` now has the prototype link filled in.
- The old `design/screens/integration-*.png` captures moved to `design/screens/archive-integration/`.

## Final verification (2026-11-04)
- App: `account/delete` wired into Settings → Delete everything (best effort, before the phone's credentials are dropped); the Alert-active timeline shows "Text to <name> not delivered" when Twilio reports an undelivered text. Settings copy says the server data is erased too. 3 new tests; **136/136 pass**, 0 warnings.
- Simulator (iPhone 17 Pro): Home with the Fake call row, Fake call incoming, and Settings → Delete everything → confirmation → back to onboarding all checked by screenshot.
- Live: landing page 200; a fresh dry-run alert (fictional 555 contact) produced a share page (200) and `share/get`; `account/delete` returned its counts; the old credentials then got 401 and the link "link not found". SQL afterwards: 0 alerts, 0 events, 0 evidence rows, 0 Storage objects, only the "Alex" simulator device.
- Docs: security PDF (data inventory, abuse row, §06), technical PDF (routes table, cron, test count) and purpose PDF (test count) updated and re-rendered at 1/1/4/6/4 pages.
- Secret scan of every tracked and untracked file plus full git history: no Twilio, Noonlight or Supabase tokens, no George or Mary phone numbers. `reference/email/` is gitignored and untracked; `reference/contest-site/` (public site mirror) is tracked on purpose.

## Known limitations (stated openly in the security PDF; fix after the contest)
- Server deletion is best effort from the phone: if the phone is offline when you tap Delete everything, the server copy expires on the retention schedule instead. During a live real alert, deletion waits until the alert ends (48 h at most).
- Sealed date details use a key the server holds. `register` needs only the publishable key (rate-limited per network, no App Attest).
- PINs are 4 digits, stored as salted SHA-256.
- The Noonlight alarm PIN is a fixed placeholder.
- On the fake-call in-call screen, Speaker, Mute and the other buttons only change their look.
- Fact check done 2026-11-04 (table at the end of `docs/SPEC.md`): Möller 2017 figure verified; NM text-to-911 still listed as missing (softened to "still listed as"; re-check before Nov 20); NMSA 30-12-1(C) wording verified (calls only; in-person audio unclear, legal review before launch); competitor table corrected (Noonlight Safety Network and paid crash detection, Apple Check In's offline notice, fall detection on Watch); local numbers verified. The FCC text-to-911 registry blocks automated fetches; George can open it in a browser once.
