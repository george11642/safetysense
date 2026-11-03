# UNM/CNM 2026 App Contest: safety app (George + Mary Teifel)

Read these before any work. They are the canonical contest facts:
- [docs/CONTEST_BRIEF.md](docs/CONTEST_BRIEF.md): rules, deadlines, scoring, judges, and gotchas
- [docs/SUBMISSION_CHECKLIST.md](docs/SUBMISSION_CHECKLIST.md): what gets emailed, and the finalist steps
- [docs/PLAN.md](docs/PLAN.md): strategy, day-by-day plan, toolchain
- [docs/OPEN_QUESTIONS.md](docs/OPEN_QUESTIONS.md): unresolved items and domain notes
- `reference/`: original sources (emails + the appcontest.unm.edu mirror). Treat as read-only.

## Hard deadlines (America/Denver)
- **Fri Nov 6, 2026, 11:59 pm:** technical submission emailed to itevents@unm.edu (4 PDF/Word docs + 3 screenshots + bio + prototype link)
- Mon Nov 9: finalists notified · Nov 10–13: mandatory practice (paper transcripts)
- **Mon Nov 16, 12:00 pm:** final deck emailed · **Fri Nov 20, 1–5 pm:** Presentation Day at UNM Rainforest

## Rules that constrain the build
- The judged artifact is a **hi-fi prototype link** (Figma recommended, viewable by anyone with the link). A coded app alone is not accepted, but it can back the prototype.
- **Do not publish to the App Store** before the contest ends (entries must be unpublished). TestFlight is OK.
- You can't use your own device on Presentation Day, so the demo is slides plus embedded video.
- Every doc is a PDF/Word attachment, never a link.

## Project rules
- iOS app: SwiftUI, generated with XcodeGen (`app/project.yml`), and simulator-first. Do not scaffold the app until George describes the design.
- Domain: sexual-assault prevention and personal safety. Use trauma-informed copy, present the app as a supplement to 911 (never a replacement), apply privacy-first defaults, and verify every hotline or resource before shipping it.
- Never send email to itevents@unm.edu or anyone else for George. Draft it, and George sends it.
- Prefix shell commands with `rtk`.
