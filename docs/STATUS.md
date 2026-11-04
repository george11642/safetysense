# SafetySense: project status

Last checked 2026-11-04 by an end-to-end audit (build, tests, live backend, PDFs, video, deck).
**Technical submission due Fri Nov 6, 2026, 11:59 pm MT** to itevents@unm.edu. George sends it; no agent sends email.

## George's to-do before Nov 6, 11:59 pm

In order of risk:

1. **Make the Figma prototype public (worth 25 points).** Right now a signed-out browser shows "Prototype not found".
   Open https://www.figma.com/design/Mx4ZCAW032658aaX1uD0vp/SafetySense-%E2%80%94-Prototype → **Share** → on "You're about to get a Full seat", confirm it's free on the Education plan, then **Continue** → set **Anyone with the link: can view** → open the prototype link (in `submission/06-prototype-link/PROTOTYPE_LINK.md`) in an incognito window and check it plays from "Start".
2. **Mary's details and eligibility.** Confirm she's taking at least 3 credit hours at CNM this fall, or is in a Deep Dive cohort. If she isn't on the registration, email itevents@unm.edu **before Nov 6** to add her. Then fill in:
   - `submission/01-team-bio/SafetySense-TeamBio.html`: George's year and major, and Mary's year, major and email (yellow `[FILL IN]`). Check both "why we care" lines and Mary's role. Re-render with `submission/_assets/render.sh` (needs network for Google Fonts), then open the PDF.
   - `submission/EMAIL_DRAFT.md`: Mary's email, plus the extra-credit line (keep it only if one of you went to the Sep 17 kickoff or an Oct 8/20 mentoring session; delete it otherwise).
3. **Send the email** from gteifel@unm.edu using `submission/EMAIL_DRAFT.md`, with the 5 PDFs attached. The subject is `App Contest Technical Submission – SafetySense`. Record the time and message id in `docs/SUBMISSION_CHECKLIST.md`.

Later (not needed for Nov 6):
- **Mary's Twilio verification** (deferred, as you asked): Twilio Console → Phone Numbers → Verified Caller IDs → add Mary's number (stored as SAFETYSENSE_MARY_PHONE in ~/.config/global.env). Until then, calls to her fail with a Twilio error. Nobody has called or texted her.
- **Real-device run on the iPhone 16e**: set `DEVELOPMENT_TEAM` in `app/project.yml`, run `xcodegen generate`, and install from Xcode. Then test the microphone, SpeechAnalyzer, Face ID, the Action Button and Siri. `presentation/IPHONE_DEMO_SCRIPT.md` has the shot list. When the trial call rings, press a key to get past Twilio's trial message.
- **Fill in the deck placeholders** (slide 2 year/major, in amber) before the Nov 16 noon deadline if you're a finalist.
- Optional cleanup in the Supabase dashboard: one 64-byte test object in Storage → `evidence`, and the leftover dry-run test devices and alerts (3 devices, 4 alerts, 2 still open: the "Alex Rivera" video demo alert and one drill). None of them can call or text anyone.

## What exists and where

| Thing | Where | State |
|---|---|---|
| iOS app (Swift 6, SwiftUI, iOS 26) | `app/` (XcodeGen `app/project.yml`) | Builds with 0 errors and 0 warnings. **116/116 tests pass** (re-run 2026-11-04). |
| Backend (Supabase Edge Function `api`, Postgres, pg_cron watchdog) | `backend/` | Live at `https://uvunyysuyuonhoviszmc.supabase.co/functions/v1/api/`. Watchdog cron is active. |
| Contact live-link page and landing page | `web/` (Vercel project `safetysense-live`) | Live at https://safetysense-live.vercel.app/ and `/a/<token>` |
| Submission PDFs 1 to 5 | `submission/01-…` to `05-…` (HTML source next to each PDF) | Built. Pages: 1 / 1 / 4 / 6 / 4. The bio has placeholders. |
| Prototype | Figma file `Mx4ZCAW032658aaX1uD0vp`; link in `submission/06-prototype-link/PROTOTYPE_LINK.md` | 22 frames and 4 flows, wired. **Private.** |
| Email draft | `submission/EMAIL_DRAFT.md` | Prototype link is filled in. Mary's email and the extra-credit line are still to fill. |
| Architecture diagram | `design/architecture.svg` / `.png` | Embedded in PDF 4 and deck slide 10 |
| App screenshots | `design/screens/` (old integration captures are in `design/screens/archive-integration/`) | Current UI, iPhone 17 Pro and 17e |
| Demo video | `presentation/SafetySense-Demo.mp4` (16:9, 101 s), `-vertical.mp4`, `SafetySense-DemoClip-AppFlow.mp4` (39 s app and live-link cut), `SafetySense-AppLoop.mp4/.gif` | Remotion source is in `video/` |
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
| Dispatch against the Noonlight sandbox, never live 911 | Done (Noonlight sandbox, or "simulated" when there's no token or it's a dry run) |
| Stretch: Live Activity and Dynamic Island | Done (`SafetySenseWidgets/GuardLiveActivity.swift`). Captured on the Lock Screen. |
| Stretch: Foundation Models second opinion | Implemented (`Services/SecondOpinion/FoundationModelsSecondOpinion.swift`), capped at ±25%, never the only reason to escalate. Not tried on a device. |
| Stretch: Date-mode sealed details | Done. Encrypted on the server (`v1:`), shown on the contact page only during an alert. |
| Stretch: server heartbeat monitor | Done (pg_cron watchdog every minute → `heartbeat_lost` alert → auto-escalation) |
| Stretch: Action Button App Intent, Control Center controls, Siri | Implemented (`Intents/`, `SafetySenseWidgets/SOSControlWidget.swift`). Not tried on a device. |
| Fake call (§7.7) | **Not built.** It isn't on the must-have list. Don't claim it. |
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

## Known limitations (stated openly in the security PDF; fix after the contest)
- "Delete everything" wipes the phone only. The server has no delete route yet; rows and evidence objects remain until manually removed.
- No automatic expiry for server evidence. Sealed date details use a key the server holds. `register` is open (no App Attest).
- PINs are 4 digits, stored as salted SHA-256.
- The Noonlight alarm PIN is a fixed placeholder.
- Claims still marked "verify" in the docs: NM text-to-911 status, NMSA 30-12-1 one-party consent, the Möller 2017 tonic-immobility figure, and the competitor comparison table.
