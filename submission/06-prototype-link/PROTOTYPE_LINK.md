# SafetySense: prototype link

**Prototype (put this one in the submission email):**
https://www.figma.com/proto/Mx4ZCAW032658aaX1uD0vp/SafetySense-%E2%80%94-Prototype?node-id=2-5&starting-point-node-id=2%3A5&scaling=scale-down&content-scaling=fixed&page-id=2%3A3

**Design file:**
https://www.figma.com/design/Mx4ZCAW032658aaX1uD0vp/SafetySense-%E2%80%94-Prototype

## STATUS: PUBLIC ✅ (verified 2026-11-04)

The sharing setting is "Anyone · can view". gteifel@unm.edu accepted the free Education Full seat, which sharing requires. The prototype link opens on the Start screen in a fresh, signed-out Chrome profile, inside an iPhone 17 Pro frame. Headless Chrome with the default HeadlessChrome user agent shows a login wall instead; that's Figma's bot handling, not a sharing problem.

## What's in the file

- **Cover**: title frame. It's set as the file thumbnail if Figma kept the change; check the file browser.
- **Flow overview**: every screen as a thumbnail, with tap arrows and auto-advance arrows across three lanes.
- **Prototype**: 22 iPhone frames (402×874). Device: iPhone 17 Pro.
  - Flows / starting points: `1 · Full demo (start here)`, `2 · Night Out → Alert (skip onboarding)`, `3 · Date mode`, `4 · Contact live link`.
  - Onboarding: Start → Welcome → Three promises → Trusted contacts → Permissions → Two PINs → Practice drill → Home
  - Core: Home → Start Guard → Guard active → (auto-advances after 4 s) Check-in → "I'm okay" goes to Guard · checked in. "I need help", or no answer for 8 s, goes to Alert countdown → (Send help now, or 8 s) Alert active → I'm safe now → Enter PIN → Safety PIN → Marked safe → Find support → Support → Home
  - Duress branch: Enter PIN → Duress PIN → Marked safe (looks identical) → (6 s) the contact's live link showing "Help requested" → Restart demo
  - Date mode: Home → Date tab → Start Guard → Date setup (sealed details) → Start Date guard → Date guard → sealed card → contact live link
  - Contact live link (web): Alert active → Share link → scrollable live-link page. "I'm on my way" / "I called 911" go back to Alert active.
- **Components**: a Button component set (Pink / Teal / Coral / Ghost, with Label text, Icon swap and Show icon properties) and 11 icon components.

Screen fills are the real app screenshots from `design/screens/`. The live-link page was rendered from `web/a.html` with
fictional demo data. Real Figma layers sit on top: buttons (instances of the Button component), the "I'm safe now" dock, the PIN
picker, the filled Date name field, the toast, the prototype nav pills, and invisible hotspots. The Start screen and both
Marked safe screens are built entirely from Figma layers.

Exported frame PNGs: `design/figma/`.
