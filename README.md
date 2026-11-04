# SafetySense

**Calls for help when you can't.**

SafetySense is an iOS personal-safety app focused on sexual-assault prevention. It does more than wait for a panic button. During a *Guard* session (a night out, a walk home, a first date, a rideshare), it listens and watches **on the phone only** for signs that something is wrong. If you stop responding, can't reach your phone, or your phone goes dark, it alerts your trusted contacts, and then professional dispatch, without you tapping anything.

> SafetySense supplements 911. It never replaces it.

This is the entry by George Teifel (UNM) and Mary Teifel (CNM) for the **15th Annual UNM & CNM App Contest (2026)**.

## Why proactive

Most safety apps rely on you pressing a button or running a timer. In a real assault that can fail:

- **Freezing is a common, involuntary response.** In one clinical study, 70% of 298 women seen after a sexual assault reported significant tonic immobility (Möller et al., 2017). A person who has frozen can't press a panic button.
- **Drugging removes the ability to act.** Someone who has been drugged may not recognize the danger in time.
- **Phones get taken or smashed.** Most apps can't tell a dead phone from a quiet night. SafetySense's server treats a lost heartbeat as a warning sign.
- **New Mexico has no text-to-911.** It is still listed as the only US state without it (checked Nov 2026), so a person who can't speak out loud can't simply text 911 here. SafetySense's dispatch path runs over data, not voice.

## How it works

1. **Arm.** Start a Guard session from the app, the Action Button, a Lock Screen control, or Siri.
2. **Watch.** The app checks sound events (Apple SoundAnalysis), a safe word and distress phrases (on-device SpeechAnalyzer), motion, location, and whether you answer check-ins. Audio is held in a 30-second buffer in memory and is never written to disk unless an alert fires.
3. **Decide.** A deterministic, explainable risk engine combines these signals. On supported iPhones, an on-device Foundation Models check gives a second opinion. It can adjust the score but can never trigger an alert alone or block an SOS.
4. **Respond.** Alerts climb a ladder:
   1. A quiet "You okay?" check-in (45 s).
   2. Your trusted contacts get an automated call and text with a live-location link.
   3. Professional monitoring (Noonlight Dispatch API) sends police to your live location.

   A **duress PIN** looks like it cancels the alert but escalates it silently. A **server heartbeat watchdog** raises an alert if your phone stops checking in mid-session.

The full product spec is in [docs/SPEC.md](docs/SPEC.md), and a visual walkthrough is in [docs/safetysense-spec.html](docs/safetysense-spec.html).

## Features

| | |
|---|---|
| Modes | Everyday · Walk Home · Night Out · Date (details sealed until an alert) · Ride (plate, driver, route deviation) |
| Triggers | Action Button App Intent · Lock Screen / Control Center control · Siri App Shortcuts · spoken safe word · hold-to-alert SOS |
| Fake call | A scheduled incoming call to help you leave a situation without explaining why |
| System | Live Activity + Dynamic Island with "I'm okay" · time-sensitive notifications · configurable dispatch policy per mode |
| Evidence | AES-GCM encrypted clips (CryptoKit, key in Keychain), SHA-256 hashed, uploaded while recording, Face ID–locked Vault |
| Aftercare | Trauma-informed Support screen: advocates (24/7), confidential SANE care, reporting options only if and when you choose |
| Contacts | No app needed: a live map page with status, battery level, a timeline, and "I'm on my way" / "I called 911" / "Send help now" buttons |

## Repository layout

```
app/            iOS app (SwiftUI, Swift 6, iOS 26), XcodeGen project.yml, widget extension, unit tests
backend/        Supabase: Postgres schema + RLS + Vault + pg_cron watchdog, one edge function "api"
web/            Contact live-link page + landing page (Vercel)
docs/           Product spec, contest brief, plan, checklist, status
design/         App screenshots, architecture diagram, Figma exports
submission/     Contest technical-submission PDFs (team bio, screenshots, purpose, technical, security)
presentation/   Demo video, pitch deck, iPhone demo script, Q&A prep
video/          Remotion source for the demo video
reference/      Public contest-site mirror (appcontest.unm.edu)
```

## Architecture

```
iPhone (on-device)                                   Cloud
──────────────────                                   ─────
AVAudioEngine ─▶ SoundAnalysis ┐
SpeechAnalyzer (safe word) ────┤
CoreMotion / CoreLocation ─────┼─▶ Risk engine ─▶ Escalation ──HTTPS──▶ Supabase edge function "api"
Foundation Models (2nd opinion)┘        │                                 │  Postgres (RLS) + Vault
Live Activity · App Intents · Controls ◀┘                                 │  pg_cron heartbeat watchdog
                                                                          ├─▶ Twilio voice + SMS ─▶ trusted contacts
                                                                          ├─▶ Noonlight Dispatch API ─▶ police
                                                                          └─▶ live-link page (Vercel) ◀─ contacts
```

See [app/ARCHITECTURE.md](app/ARCHITECTURE.md) and [backend/README.md](backend/README.md) for details.

## Run it

**iOS app** (Xcode 26+, iOS 26 simulator):

```bash
brew install xcodegen
cd app && xcodegen generate && open SafetySense.xcodeproj
```

Launch arguments for demos and QA:

| Argument | Effect |
|---|---|
| `-ssDemo 1` | Demo services and the scripted Night Out scenario |
| `-ssSkipOnboarding 1` | Skip onboarding |
| `-ssScreen <name>` | Open any screen directly with sample data |

Real calls are off by default: alerts run as dry runs unless you turn on Settings → Developer → "Allow real calls".

**Backend**: see [backend/README.md](backend/README.md). The secrets (Twilio, Noonlight) live in Supabase Vault and are never committed.

## Privacy

- Audio, transcripts, and AI reasoning stay on the device while guarding.
- Nothing is saved unless an alert fires.
- The server stores only what an alert needs. An hourly job deletes evidence and location history after 30 days and alerts after 90, and evidence is encrypted before upload.
- Settings → Delete everything erases the phone and this device's data on the server (`account/delete`).
- No ad or analytics SDKs.

The security write-up is in [submission/05-security](submission/05-security).

## Status

This is a contest prototype, not a released app. Dispatch runs against the Noonlight **sandbox**, and no real police are dispatched. The app is not on the App Store; contest rules require entries to be unpublished. See [docs/STATUS.md](docs/STATUS.md).

## Team

- **George Teifel**, University of New Mexico: lead developer (iOS + backend)
- **Mary Teifel**, Central New Mexico Community College: research, UX and content

If you or someone you know needs support:
- RAINN: 1-800-656-4673
- Rape Crisis Center of Central NM (24/7): 505-266-7711
- 988 Suicide & Crisis Lifeline: call or text 988
- In an emergency, call **911**.
