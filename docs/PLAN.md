# Execution plan (as of Tue Nov 3, 2026)

There are about 3.5 days to the Nov 6, 11:59 pm technical submission. The app's design is coming from George later. This is the default plan and can change.

## Strategy
- **The scored artifact is a hi-fi prototype link plus 4 documents.** Build the real SwiftUI iOS app quickly. It doubles as the prototype source, the screenshot source, and the demo-video source.
- **Prototype link:** a Figma clickable prototype is the safest choice because it's what the rules name and judges can open it in a browser. Generate the screens from the SwiftUI build (screenshots → Figma frames + prototype links) or design them directly in Figma via MCP. **Optional extra:** a TestFlight public link as a "working build" credibility point. External TestFlight needs Beta App Review (often under 24 hours, but not guaranteed), so submit for review by Thu Nov 5 if we want it.
- **Don't publish to the App Store** (the eligibility rule requires an unpublished app).
- **Presentation (if finalist):** slides with embedded screen recordings from the simulator or a device. Pick the tool after Nov 9. Default is Google Slides or PPTX with MP4s plus a PDF backup. Figma Slides is fine if it exports cleanly.
- **Security gets 25 points**, and a privacy-compliance judge is on the panel. For a sexual-assault safety app, a privacy-first design is both the moral baseline and a scoring advantage: on-device by default, minimal data, end-to-end-encrypted evidence, no account required, quick exit, and a duress mode.

## Day-by-day
| Day | Work |
|---|---|
| Tue Nov 3 | Environment ready (done). George describes the app. Confirm Mary's eligibility and info. Lock name, scope, and main user flows. |
| Wed Nov 4 | Build SwiftUI core screens and flows (simulator). Draft the Purpose/Audience doc and team bio. |
| Thu Nov 5 | Finish the main flows. Build the Figma prototype from the app screens. Make the architecture diagram, technical doc, and security doc. Optionally upload to TestFlight. |
| Fri Nov 6 | Take 3 screenshots, export the PDFs, and QA everything against [SUBMISSION_CHECKLIST.md](SUBMISSION_CHECKLIST.md). **George sends the email himself, well before 11:59 pm** (target 6 pm). |
| Nov 9–20 | If we're a finalist: book the practice session, print transcripts, build the deck, record demo videos, rehearse 8:00 + 4:00, email the deck by Nov 16 at noon, and present Nov 20. |

## Toolchain (verified 2026-11-03)
- Xcode 26.6 (17F113), iOS 26.5 simulator runtime, XcodeGen at /opt/homebrew/bin/xcodegen, gh, and pandoc (for doc → PDF/DOCX).
- Signing identities in the keychain: "Apple Development: george@teifel.com", "Apple Development: Created via API", and "Apple Distribution: Josh Jarrett (K89F44WFKH)". **The distribution cert belongs to Josh Jarrett's team.** Confirm which paid Apple Developer team to use for TestFlight before uploading anything.
- The Figma MCP and the Claude Docs/Word tools are available for the prototype and the documents.
