# SafetySense: product spec (v0.1 draft)

> Name: **SafetySense** (chosen 2026-11-04). App Store subtitle: "Calls for help when you can't." There's no exact match in a US App Store search on Nov 4; do a trademark check before launch. Previous working name: Ward.
> Draft dated 2026-11-04. Research sources are listed at the end. Factual claims were checked on 2026-11-04 (see **Fact check** at the end); anything still marked **(verify)** must be checked before it ships or appears on a slide.

## 1. The idea in one line

**SafetySense is a safety app that gets help for you when you can't get it yourself.** During a "Guard" session (a night out, a walk home, a first date), SafetySense listens and watches *on your phone only* for signs of danger. If you go quiet, can't respond, or your phone is taken, it brings in your people and then professional dispatch, with no tap from you.

## 2. Why this has to be proactive

Most of the apps below rely on the person pressing a button or running a timer. In a real assault that can fail:
- **Freezing is a normal response.** Many survivors describe being unable to move or speak during an assault. This is called tonic immobility. In a study of 298 women seen at a Stockholm emergency clinic within a month of a sexual assault, 70% reported significant tonic immobility and 48% extreme tonic immobility (Möller, Söndergaard & Helström, *Acta Obstet Gynecol Scand* 2017;96(8):932–938, doi:10.1111/aogs.13174). A panic button does nothing for someone who has frozen.
- **Drugging takes away the ability to act.** Someone who has been drugged may not recognize the danger or be able to unlock their phone.
- **The phone gets taken or thrown.** Most competitors can't tell a dead phone from a quiet night (Apple's Check In is the partial exception: it can notify a contact late if the phone goes offline). SafetySense's server treats a lost heartbeat as a warning sign: after three missed 60 s heartbeats (a 180 s grace, checked by a once-a-minute watchdog), it raises the alert by itself, so contacts hear within about 3-4 minutes.
- **New Mexico still has no text-to-911.** As of Nov 4, 2026, sources still list it as the only US state without it, and we found no announcement of a public launch. The statewide NG911 upgrade (which can support text) began in 2025, starting with Bernalillo County. If you can't speak out loud, the standard silent route to 911 isn't there; third-party relays such as accesSOS cover Albuquerque and Santa Fe. SafetySense's data-only path to dispatch helps cover that local gap. Re-check before Nov 20.

## 3. What changed from the original idea (pushback)

| Original idea | Change | Reason |
|---|---|---|
| AI listens all the time | **Guard sessions**: you turn listening on for a night, a walk, or a date. SafetySense *suggests* turning it on when the context fits (Friday 10 pm near a bar), but you tap to start. | iOS doesn't let an app start the mic from the background. Listening costs about 5–15% battery per hour. App Review rejects round-the-clock recording. And users are far more likely to trust a session with a clear start and end. |
| "Doesn't save convos unless it's dangerous" | **Kept and strengthened.** Audio sits in a 30-second rolling buffer in memory only, never written to storage. Only when the risk level reaches **Alert** are those 30 seconds and the live audio after them encrypted and saved as evidence. | Privacy is worth 25 points, and one judge is a data privacy specialist. |
| AI calls the police | **The AI raises the alert level; it doesn't dial 911 alone.** The steps are: check in with you → alert trusted contacts → professional monitoring → police (through the Noonlight API, which calls you first and then sends police). | iOS can't place a call or send a text without a tap. A false 911 dispatch hurts the user and the police, so professional dispatch is the safe way to automate it. |
| Press the side button | **Action Button, Lock Screen control, Siri phrase, a safe word you say out loud, and an Apple Watch button.** | Apple doesn't let apps use the side or volume buttons. The Action Button (iPhone 15 Pro and later) and Lock Screen controls are the official equivalents. |
| Detect if someone's been drugged | **Detect being unable to respond, not the drug.** SafetySense watches for missed check-ins, unsteady or stopped movement, a sudden fall, and leaving where you said you'd be. It also prompts drink checks during Night Out. | No phone can detect a drug. Promising that would be dishonest and could get someone hurt. |
| Copy every feature of Lobo Guardian and the others | **Include the expected features (SOS, location sharing, check-in timer, fake call, campus resources) but put the effort into what they lack.** SafetySense doesn't rebuild UNM Safe's tip reporting or bus tracking; it links to UNM Safe. | Judges score originality. Doing the basics well and the proactive part better beats copying everything. |

## 4. Who it's for

- **Primary:** UNM and CNM students aged 18–25 who go out at night: parties, bars, first dates from apps, walking to a car, rideshares.
- **Secondary:** trusted contacts (friends, roommates, family). They don't need the app: they get a text with a live link.
- **Partners (for the "pathway to satisfaction" section):** LoboRESPECT Advocacy Center, the UNM Women's Resource Center, UNMPD, CNM Security, and the Rape Crisis Center of Central NM.

## 5. Modes

| Mode | When | What's on | Default response |
|---|---|---|---|
| **Everyday** (default) | Always | No microphone. SOS triggers, trusted contacts, medical info, resources | Manual SOS only |
| **Walk Home** | Walking to a car, dorm, or bus | Live location to one contact, arrival check, alert if you leave your route or stop for too long. Microphone optional; with the mic on, distress audio or words go up the full escalation ladder | Contacts alerted if you don't arrive; with the mic on, the full escalation ladder (dispatch policy is configurable per mode) |
| **Night Out** | Party, bar, concert | Full Guard: on-device audio AI, motion, check-ins every 30–90 min, drink-check prompts, a buddy | Full escalation ladder |
| **Date** | A first date from an app | Night Out, plus **sealed date details**: their name, photo, profile link and the place, kept encrypted and shown to your contact *only if* an alert fires | Full escalation ladder, plus a scheduled check-in |
| **Ride** | Uber, Lyft, someone else driving | Log the plate and driver. Alert on route deviation or a stop longer than 3 min in an unexpected place | Check-in, then contacts |

## 6. How SafetySense decides it's dangerous

### 6.1 Signals (all processed on the phone)
1. **Audio events.** Apple's SoundAnalysis classifier (built-in model, about 300 labels) listens for `screaming`, `shout`, `yell`, `crying_sobbing`, `gasp`, `slap_smack`, `thump_thud`, `glass_breaking`, `door_slam`, `gunshot_gunfire`.
2. **Words.** On-device speech recognition (iOS 26 `SpeechAnalyzer`) catches your **safe word** (an instant alert) and distress phrases: "stop", "no", "get off me", "help", "let me go", "I don't want to".
3. **Motion.** CoreMotion picks up an impact or fall (a spike followed by stillness), erratic movement followed by long stillness, or the phone dropping.
4. **Location.** You've left where you said you'd be, you're somewhere unknown late at night, or you're moving at vehicle speed off the planned route.
5. **Responsiveness.** Missed check-ins, and ignored "You okay?" prompts.
6. **Heartbeat (server side).** During a session the phone checks in with SafetySense's server every 60 s. If those check-ins stop with no clean "End session" (the phone was powered off, smashed, or put in airplane mode), **the server raises the alert by itself** using the last known location. This is the feature competitors don't have.
7. **Apple Watch (stretch goal).** A heart-rate spike and the Watch SOS button.

### 6.2 Risk engine
- **A rules engine makes the decision.** Each signal adds weighted points that fade over time. The weights depend on mode and time of day, and the rules are deterministic and testable, so the app can always explain why it escalated.
- **The on-device AI is a second opinion.** On iPhone 15 Pro and later with Apple Intelligence, the Foundation Models LLM reads a short transcript snippet and adjusts the score within a limit (for example, telling "no way, stop!" laughing among friends apart from distress). Three rules:
  - It can never be the only reason for an escalation.
  - It can never block an SOS you trigger yourself.
  - On older phones the app runs on rules only.
- **Sensitivity setting:** Relaxed, Balanced (default) or Vigilant.

### 6.3 Escalation ladder

| Level | Trigger | What happens | How to stop it |
|---|---|---|---|
| **0 · Guarding** | Session on | Audio in the 30 s memory buffer, nothing saved. Live Activity on the Lock Screen | End session (PIN or Face ID) |
| **1 · Check-in** | Risk score above threshold 1, or a scheduled check-in | A quiet haptic plus a "You okay?" Live Activity. You have **45 s** to answer | Tap "I'm okay" |
| **2 · Alert** | No answer at level 1, a high risk score, the safe word, the Action Button, or lost heartbeat | Evidence capture starts (encrypted audio and location). Trusted contacts get a time-sensitive text and an automated phone call, with a **live-location link** and an "I'm on it / I called 911" button | Safety PIN |
| **3 · Dispatch** | **90 s** at level 2 with no valid cancel, or a contact taps "Send help", or you hold SOS | Noonlight's professional monitoring calls you and, if you don't answer or say you're unsafe, **sends police to your live location** with your medical and description profile | Safety PIN, plus the dispatcher's verification call |

- **Duress PIN.** Entering it looks exactly like cancelling, but it silently goes straight to level 3. This helps when someone is forcing you to cancel.
- **Shortcut setting.** You choose whether a manual trigger (Action Button or safe word) starts at level 2 or level 3.

## 7. Ways to trigger it manually
1. **Action Button** (iPhone 15 Pro and later): press and hold to start the alert ladder. An App Intent handles it without opening the app.
2. **Lock Screen and Control Center control:** one tap without unlocking.
3. **Safe word**, spoken during a Guard session.
4. **Siri:** "Hey Siri, SafetySense alert."
5. **Hold-to-release SOS button** in the app, like Noonlight: let go and if you don't enter your PIN, it escalates.
6. **Apple Watch** complication (stretch goal).
7. **Fake call**, to get out of a situation without saying why.

## 8. Onboarding (target under 3 minutes, every step skippable except contacts)

Copy is calm, plain and never blames the user. Each permission is asked only when it's needed, with a reason given.

1. **Welcome.** "SafetySense gets help to you when you can't reach your phone." Small print: *SafetySense is not a replacement for 911.*
2. **Three promises** (cards you swipe through):
   - SafetySense only listens when you turn it on.
   - Nothing is saved unless something's wrong.
   - Help comes even if you can't tap.
3. **Your campus:** UNM / CNM / Other. This loads the campus police number, an advocacy center and a nearby SANE unit.
4. **Trusted contacts** (1–5, from Contacts). Each contact gets a text explaining what SafetySense is and what to do if they're alerted.
5. **Your triggers:**
   - Set up the Action Button (step-by-step with animation).
   - Add the Lock Screen control.
   - Choose and record a safe word 3 times.
6. **Permissions, with a reason for each:** microphone ("only during Guard"), location set to Always ("so help finds you"), Time-Sensitive notifications, Motion.
7. **Safety PIN and duress PIN.** Explained with a 10-second animation.
8. **Responder profile (optional):** photo, description, medical notes, allergies.
9. **Practice drill.** Run a test alert. Your contacts get a message clearly marked **TEST**. Ends with "You're set."

## 9. Screens

| # | Screen | Purpose |
|---|---|---|
| 1 | Onboarding (9 steps) | The flow above |
| 2 | **Home** | A large "Start Guard" button, mode chips, contacts' status, the trigger setup checklist |
| 3 | **Guard active** | Calm status: elapsed time, next check-in, what's on (mic, location, motion), End session button. A matching Live Activity and Dynamic Island |
| 4 | **Check-in prompt** | "You okay?" with a 45 s ring and buttons for I'm okay / Need help |
| 5 | **Alert countdown** | Level 2 to 3 countdown, who's been notified, PIN pad |
| 6 | **Alert active** | Contacts' responses ("Maya is on her way"), dispatch status, "I'm safe now" |
| 7 | **Trusted contact web link** | No app needed: a live map, battery level, status, buttons to call them, "I'm on my way" and "Send help" |
| 8 | **Vault** | Encrypted evidence, locked with Face ID. Each clip is timestamped and hashed. Share with an advocate or police only if you choose |
| 9 | **Support** (after an incident) | Talk to an advocate now (24/7), medical care / SANE exam, reporting options (UNMPD, APD, Title IX / CNM), or "just keep it private." Nothing is required |
| 10 | Contacts | Add, remove, and test contacts |
| 11 | Settings | Sensitivity, check-in interval, safe word, PINs, discreet app icon, how long data is kept, delete everything |

## 10. Feature comparison

| Feature | UNM Safe | Noonlight | bSafe | Apple built-in | **SafetySense** |
|---|---|---|---|---|---|
| Manual SOS | ✓ Mobile BlueLight | ✓ (hold) | ✓ | ✓ side button | ✓ Action Button, Lock Screen, Siri |
| Live location to a friend | ✓ Friend Walk | ✓ Safety Network | ✓ Follow Me | ✓ Check In | ✓ |
| Check-in timer | (LoboGuardian's Safety Timer only) | ✓ Timer | ✓ | ✓ | ✓ adaptive |
| Professional dispatch | call to UNMPD | ✓ | – | 911 call | ✓ (Noonlight API) |
| Voice trigger | – | via Alexa (paid) | ✓ 20+ preset phrases | Siri | ✓ safe word, offline |
| **Detects distress automatically** | – | crash only (paid) | – | crash; fall on Apple Watch | **✓ on-device audio, motion, context** |
| **Alerts when the phone goes dark** | – | – | – | Check In (may be delayed) | **✓ server heartbeat** |
| **Duress PIN** | – | – | – | – | **✓** |
| **Date details revealed only if needed** | – | Tinder notes | – | – | **✓** |
| Evidence capture | – | – | ✓ audio/video sent to guardians | – | ✓ encrypted, starts at level 2 only |
| Campus and NM resources | ✓ UNM | – | – | – | ✓ UNM and CNM |

## 11. Privacy and security (submission doc #5)

- **On-device first.** Audio, transcripts and AI reasoning never leave the phone during normal guarding. The 30 s buffer is RAM only and overwritten continuously.
- **Evidence only at Alert level.** Saved clips are encrypted with AES-GCM (CryptoKit) using a key kept in the Keychain. Encrypted copies upload *while recording*, so evidence survives if the phone is smashed. The server holds only ciphertext. Each clip gets a SHA-256 hash and timestamp so tampering can be detected.
- **Minimal server data.** Supabase (Sign in with Apple, row-level security) stores your account, contacts and session heartbeats. Location is stored only during an active session or alert, and auto-deleted after 30 days (you can change this). "Delete everything" really deletes everything.
- **No ad or analytics SDKs.** No third-party trackers.
- **Abuse resistance:** App Attest on dispatch endpoints, rate limits, PIN-verified cancels, and a verification call from Noonlight before dispatch.
- **Physical-access threats:** the duress PIN, Face ID on the Vault, a discreet alternate app icon, and contact live links that expire.
- **Recording law:** NMSA 1978 § 30-12-1(C) bars intercepting telegraph or telephone communications "without the consent of a sender or intended recipient", so New Mexico is one-party consent for calls (a 2013 all-party bill, SB 127, did not pass). The statute doesn't clearly address in-person audio captured by a phone; the user is a party to the conversation. Legal review is needed before launch.

## 12. Technical architecture (submission doc #4)

- **iOS app:** Swift 6, SwiftUI, project generated with XcodeGen. Minimum iOS 26 (needed for SpeechAnalyzer and Foundation Models), falling back to rules only on phones without Apple Intelligence.
- **Apple frameworks:**

  | Framework | Used for |
  |---|---|
  | AVAudioEngine / AVAudioSession | Background audio |
  | SoundAnalysis | Audio event classifier |
  | Speech (`SpeechAnalyzer`) | Safe word and distress phrases |
  | FoundationModels | Second-opinion AI |
  | CoreMotion | Falls, impacts, movement |
  | CoreLocation (`CLServiceSession`, `CLMonitor`) | Location and geofences |
  | ActivityKit | Live Activity |
  | AppIntents + WidgetKit | Action Button, Controls, Siri |
  | UserNotifications | Time-Sensitive alerts |
  | CryptoKit + Keychain | Encryption |
  | LocalAuthentication | Face ID |
  | ContactsUI | Picking contacts |
  | MapKit | Maps |

- **Backend:** Supabase (Postgres with row-level security, Edge Functions, Storage for encrypted evidence) plus a scheduled function that watches heartbeats.
  - **Twilio** sends texts and voice calls to contacts.
  - **Noonlight Dispatch API** (sandbox for the demo) handles professional monitoring and 911 dispatch.
  - The contact live link is a small web page reading a token-scoped, expiring location feed.
- **Diagram:** see the visual explainer (`docs/safetysense-spec.html`). The final diagram goes into `design/`.

## 13. Scope for the deadline

| Must work for the demo and Figma prototype (Nov 4–6) | Stretch | After the contest |
|---|---|---|
| Onboarding (all steps), Home, Guard active, Check-in, Alert countdown, Alert active, Support | Live Activity and Dynamic Island | Apple Watch app |
| Real on-device SoundAnalysis detection of a scream or shout, plus the safe word | Foundation Models second opinion | Critical Alerts entitlement |
| Escalation ladder with PIN and duress PIN | Date-mode sealed details | Partnership with UNMPD and LoboRESPECT |
| Contact text with live link (Twilio trial) or a convincing simulation | Server heartbeat monitor | Android |
| Dispatch step against the Noonlight **sandbox**, never live 911 | Action Button App Intent | Field testing with students |

**Prototype plan:** build the real SwiftUI screens, then use the Figma MCP to turn them into a clickable Figma prototype (the required link). Record the demo videos from the simulator.

## 14. Pathway to satisfaction (submission doc #3)

- **Targets:**
  - Fewer than 1 false Alert per 10 hours of Night Out guarding.
  - Under 60 s from a scream to contacts being notified.
  - Under 8% battery per hour while guarding.
  - At least 80% of users finish onboarding.
- **Validation:** test with UNM and CNM students (survey plus a usability test of the drill), review copy with LoboRESPECT advocates, and test detection against recorded scenarios.
- **Rollout:** a TestFlight pilot with a student organization, then a campus partnership (orientation, the Women's Resource Center).

## 15. Decisions (2026-11-04)
1. Name: **SafetySense**.
2. Who gets alerted first is **configurable**. By default, Night Out alerts contacts first (dispatch happens if a contact taps "Send help" or after a 90 s timeout), and a manual SOS goes straight to dispatch. Both can be changed in Settings.
3. Twilio trial and Noonlight sandbox: **approved**. George creates the accounts; the agent doesn't sign up for anything.
4. Demo device: **George's iPhone 16e**, which has the Action Button and Apple Intelligence, so the Action Button trigger and the Foundation Models second opinion can both be shown live.

## Sources
- iOS feasibility (Apple docs): background audio interruptions, SoundAnalysis `knownClassifications`, `SpeechAnalyzer`, Foundation Models availability and background rate limits, `ControlWidget`, `CLServiceSession`, `CMFallDetectionManager`, App Review 2.5.4 / 2.5.14 / 5.1.
- Noonlight Dispatch API: docs.noonlight.com/reference/post_alarms
- UNM Safe (which replaced LoboGuardian, retired Jul 31, 2026): unmsafe.unm.edu. CNM Security: cnm.edu/depts/security
- New Mexico text-to-911 gap: KFOX14; Source NM (Apr 11, 2025); GovTech (Aug 11, 2025); Textdrip state guide (Jun 18, 2026). The FCC registry (fcc.gov/files/text-911-master-psap-registry) blocks automated fetches, so George should open it in a browser once.
- Local numbers: checked 2026-11-04 (see **Fact check**).

## Fact check (2026-11-04)

| Claim | Verdict | Source |
|---|---|---|
| 70% significant / 48% extreme tonic immobility, 298 women | **Correct** | Möller et al. 2017, doi:10.1111/aogs.13174 (Crossref metadata; ScienceDaily, Jun 7, 2017) |
| NM is the only US state without text-to-911 | **Correct as far as we can find**, softened to "still listed as" | Textdrip (Jun 2026), KFOX14, Source NM, GovTech. No 2026 launch announcement found |
| "No silent way to reach 911 in NM" | **Too strong**, softened | accesSOS relay covers Albuquerque and Santa Fe; Noonlight's own app lets users text its dispatchers |
| NMSA 30-12-1(C) one-party consent wording | **Correct for telephone/telegraph**; in-person audio unclear | Statute text (Justia, FindLaw); 2013 SB 127 (not enacted) |
| NM breach law NMSA 57-12C, 45 days | **Correct** | 57-12C-1 to -12, eff. Jun 16, 2017 |
| Every competitor treats a silent phone as "all clear" | **Wrong**, softened | Apple Check In notifies late or early if the phone goes offline |
| Noonlight: no live location to friends, no auto-detection | **Wrong**, fixed | noonlight.com/noonlight-app: Safety Network, Crash Response (paid), Alexa (paid) |
| bSafe: voice trigger, timer, evidence, fake call, no dispatch | **Correct** | getbsafe.com/help |
| Apple: fall detection | **Watch only** on iPhone; iPhone has Crash Detection | Apple iPhone User Guide |
| UNM Safe: Mobile BlueLight, Friend Walk, tips, bus tracking; LoboGuardian retired Jul 31, 2026 | **Correct** | unmsafe.unm.edu |
| Noonlight flow: dispatcher texts and calls, then notifies 911 | **Correct** (it notifies the PSAP, which sends police) | Noonlight help center; CBS Philadelphia test |
| Noonlight sandbox `api-sandbox.noonlight.com/dispatch/v1` | **Correct**; docs don't say what sandbox alarms do; every demo alert so far was a dry run (`simulated`) | docs.noonlight.com; Supabase `alerts` table |
| LoboRESPECT 505-277-2911, RCCCNM 505-266-7711, ABQ SANE 505-884-7263, UNMPD 505-277-2241, CEEO/Title IX 505-277-5251, CNM Security 505-224-3001 / 3002, APD 505-242-2677, RAINN 1-800-656-4673, 988 | **Correct** | unm.edu, cnm.edu, nmcsap.org, abqsane.org, cabq.gov |
| Life360 | Not used in any submitted doc | |
