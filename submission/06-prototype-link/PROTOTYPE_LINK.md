# SafetySense: prototype link

**Prototype (put this one in the submission email):**
https://www.figma.com/proto/Mx4ZCAW032658aaX1uD0vp/SafetySense-%E2%80%94-Prototype?node-id=2-5&starting-point-node-id=2%3A5&scaling=scale-down&content-scaling=fixed&page-id=2%3A3

**Design file:**
https://www.figma.com/design/Mx4ZCAW032658aaX1uD0vp/SafetySense-%E2%80%94-Prototype

## STATUS: PUBLIC ✅ (verified 2026-11-04)

The sharing setting is "Anyone · can view". gteifel@unm.edu accepted the free Education Full seat, which sharing requires. The prototype link opens on the Start screen in a fresh, signed-out Chrome profile, inside an iPhone 17 Pro frame. Headless Chrome with the default HeadlessChrome user agent shows a login wall instead; that's Figma's bot handling, not a sharing problem.

## What's in the file

- **Cover**: title frame. It's set as the file thumbnail if Figma kept the change; check the file browser.
- **Flow overview**: every screen as a thumbnail, with tap arrows and auto-advance arrows across seven lanes (onboarding, core, date + contact view, Walk Home + Ride, tabs + alert timeline, the three promise cards, and the per-mode check-ins).
- **Prototype**: 43 iPhone screens (402×874) plus 7 overlays. Device: iPhone 17 Pro. Every visible button, chip and tab does something; nothing dead-ends.
  - Flows / starting points: `1 · Full demo (start here)`, `2 · Night Out → Alert (skip onboarding)`, `3 · Date mode`, `4 · Contact live link`, `5 · Walk Home and Ride modes`.
  - Start screen: "Start the prototype" runs the full demo. The flow chips (Onboarding, Night Out, Check-in, Alert, Duress PIN, Date mode, Contact live link, Support, Walk Home, Ride) jump straight to that part.
  - Onboarding: Start → Welcome → Three promises (three cards: Next → Next → Sounds good) → Trusted contacts → Permissions → Two PINs → Practice drill → (Run the drill shows the TEST result) → Home. The steps are labelled 2 to 5 of 5 and the five-segment progress bar matches (it fills across the three promise cards). On Permissions, each Allow flips that row to On; Allow all turns both on and continues. The Safety PIN and Duress PIN boxes open a PIN pad. The back chevron goes back; Skip goes to Home.
  - Home: the Walk Home, Night Out, Date and Ride chips all switch modes instantly (the selected chip, heading and Start Guard label change). Edit or the contacts card opens Trusted contacts. The tab bar opens Contacts, Vault, Support and Settings.
  - Core (Night Out): Home → Start Guard → Guard active → (auto-advances after 4 s) Check-in → "I'm okay" goes to Guard · checked in. "I need help", or no answer for 20 s, goes to Alert countdown → (Send help now, or 15 s) Alert active → I'm safe now → Enter PIN → Safety PIN → Marked safe → Find support → Support → Home. Both Guard screens have a visible End Guard button. Alert active scrolls: below the map are all three contacts (Maya answered the call, Jordan and Sam got texts) and the alert timeline; the dock has I'm safe now and Call 911 (opens the no-call note). On the countdown and on Enter PIN only the number keys count as a PIN; backspace does nothing.
  - Alert context: the alert remembers which Guard you were in and why it started (no answer, or "I need help"), using prototype variables. The countdown's "Why" line, the mode chip on Alert active, the summary on Marked safe ("RIDE · ALERT 2:11–2:31 · 3 CLIPS IN VAULT") and the contact's live link (reason line plus that mode's sealed details: route and ETA, plate and driver, or the date's name) all follow it. Night Out with "no answer" is the default.
  - Walk Home: Home → Walk Home → Start Guard → Walk setup (destination + ETA; Maya follows along, and all three contacts are alerted if you don't arrive) → Start walking → Guard · Walk Home → "I made it · End Guard" goes Home. The pink pill ("Simulate a long stop") or the ring opens Walk Home's own check-in; "I'm okay" returns to the walk with a quiet confirmation and the arrival check still counting down, and "I need help" (or no answer) starts a Walk Home alert.
  - Ride: Home → Ride → Start Guard → Ride setup (service, plate, driver, car) → Start Ride guard → Guard · Ride → "I've arrived · End Guard" goes Home. The pill ("Simulate an unexpected stop") or the ring opens Ride's own check-in; "I'm okay" returns to the ride, and an alert from here shows the plate and driver on the live link.
  - Date mode: Home → Date → Start Guard → Date setup (name and optional photo, sealed) → Start Date guard → Date guard. The sealed card ("Chris"; the photo stays on the phone) previews what contacts would see only if an alert fires; the ring jumps to Date mode's own check-in, and "I'm okay" returns to the Date guard (never to Night Out); End Date guard goes Home. Fields on the three setup sheets open the prototype note.
  - Duress branch: Enter PIN → Duress PIN → Marked safe (looks identical apart from a pink prototype pill) → (6 s, or tap the pill) the contact's live link: "Still active. The cancel on Alex's phone at 2:31 PM used their duress PIN, so help is still coming", with a 2:31 PM timeline entry → Restart demo
  - Contact live link (web): Alert active → Share link (or the Your people card) → scrollable live-link page (Maya's view, with an iOS status bar). Maya hasn't responded yet; "I'm on my way" / "I called 911" switch back to Alex's alert (11b, 11c) showing that response in the people list and timeline; "Back to Alex's phone" returns to Alert active. Dispatch is already requested, so the page says so instead of offering Send help now. Open in Maps, the map zoom buttons and the call-911 link open explanatory overlays.
  - Contacts tab → "What your contacts see" opens an example live link marked "Preview · example" (nothing is happening); its buttons explain that nothing is sent, and the pill goes back to Contacts.
  - Overlays: hotline and 911 buttons open "This prototype never places calls" (no tel: links anywhere); the PIN boxes open a PIN pad; buttons on the contact preview say nothing is sent; other app-only controls open a short prototype note. Close, or tap outside the card.
- **Components**: a Button component set (Pink / Teal / Coral / Ghost, with Label text, Icon swap and Show icon properties) and 11 icon components.

Screen fills are the real app screenshots from `design/screens/`. The live-link pages were rendered from `web/a.html` with
fictional demo data on a consistent timeline (alert 2:11 PM, contacts called and texted 2:11 PM, dispatch 2:12 PM, Maya responds 2:13 PM, cancelled 2:31 PM; the Vault's three clips are 2:11:21, 2:11:51 and 2:12:21 PM). Real Figma layers sit on top:
buttons (instances of the Button component), the "I'm safe now" dock, the PIN picker, filled form fields, small text patches that
keep times and names consistent, toasts, the prototype nav pills, and invisible hotspots. The Start screen and both Marked safe
screens are built entirely from Figma layers.

Exported frame PNGs: `design/figma/`.
