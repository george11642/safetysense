# SafetySense: judge Q&A prep

Presentation Day gives 4 minutes of judge questions after the 8-minute talk. Judges have **not** seen our technical submission, so assume they know nothing beyond the talk.

**How to answer:** lead with the one-sentence answer and stop. Offer more detail only if they ask. If you don't know, say so: "We haven't measured that yet. Here's how we would." Never overclaim. SafetySense supplements 911 and never replaces it.

Who answers: **George** takes technical, security and App Store questions. **Mary** takes user, design, campus and partnership questions. (Adjust once Mary's role is settled.)

Appendix slides A1 to A3 in the deck carry the short versions of the first 12 answers below.

Judges to have in mind: Mark Orgeron (UNM Information Security and Privacy Office) will probably push on privacy and consent. Nick Bennett (CNM, Android) may ask about Android. Josie LaHaye (UNM IT App Dev) and Sai Krishna Eranti (Crunchyroll) may ask about architecture and scale. Heidi Byrd (CNM Deep Dive) and Erin Ruiz (Explora) may ask about users and impact.

---

## 1. Trust and tech

### What about false alarms?
**Short:** The first step is always a quiet "You okay?" that one tap clears, and the monitoring center calls you to confirm before police are ever sent.
**More:**
- The risk engine is rule-based. Each signal adds weighted points that fade over time, so one shout at a party doesn't escalate on its own. A scream followed by long stillness does.
- The ladder has three exits before police: the check-in (45 s), the Safety PIN during Alert (90 s), and the dispatcher's verification call.
- Sensitivity can be set to Relaxed, Balanced or Vigilant.
- On newer iPhones, Apple's on-device language model reads a short transcript snippet as a second opinion. It can lower the score for something like friends laughing "no way, stop!" It can never be the only reason to escalate, and it can never block an SOS you trigger yourself.
- Target: under 1 false Alert per 10 hours of Night Out guarding. **We haven't field-tested this yet.** Validating it is the first thing the student pilot measures.

### Won't listening kill the battery?
**Short:** It only listens during a Guard session you start, never all day, and our target is under 8% per hour.
**More:** Sensing uses Apple's on-device frameworks (SoundAnalysis, SpeechAnalyzer, CoreMotion). The server heartbeat is one small request a minute. Location stays coarse until an alert. The spec estimates 5 to 15% per hour for continuous listening, which is why we use sessions. **Measure on the iPhone 16e before Nov 20 and replace the target with a real number if you have one.**

### Is it recording my conversations?
**Short:** No. Audio lives in a 30-second memory buffer that overwrites itself and is never written to storage unless an alert fires.
**More:** Transcription, sound classification and the AI second opinion all run on the phone. At Alert level, the buffer plus live audio is encrypted with AES-GCM (CryptoKit, key in the Keychain) and uploaded while recording. The server stores ciphertext only. Each clip is SHA-256 hashed and timestamped. The user opens the Vault with Face ID and decides whether anyone else ever hears it.

### Will Apple approve it?
**Short:** We designed around the App Review rules instead of fighting them.
**More:**
- Background audio runs only during a session the user starts, with a visible Live Activity and the system microphone indicator (Guideline 2.5.4).
- We never auto-dial 911 or auto-text. iOS doesn't allow it, so dispatch goes through Noonlight, a professional monitoring service many apps already use.
- Each permission is asked when it's needed, with a reason. There are no ad or analytics SDKs (Guideline 5.1).
- The app isn't published yet (contest rule). It runs on a simulator and through Xcode on George's iPhone.

### How does the Action Button trigger work without opening the app?
An App Intent ("SafetySense Alert") that you pick under Settings > Action Button > Shortcut. It writes to a shared queue the app drains, and it starts the alert at the level you set: by default a manual SOS goes straight to dispatch.

### What happens when the phone is smashed or switched off?
During a session the phone sends a heartbeat every 60 seconds. If heartbeats stop without a clean End session, the server raises the alert with the last known location, designed to reach contacts in about 3 to 4 minutes. Others have versions of this: Apple's Check In and timer apps like SafePulse alert from a server, and Centinela's server holds a running SOS countdown. Ours covers the whole session and feeds the same ladder that ends at dispatch.

---

## 2. Cost, law and business

### What does it cost to run?
**Short:** Pennies per alert, plus a small hosting bill.
**More:** Twilio voice calls and texts cost on the order of a cent or two each, and only during alerts (check current Twilio pricing before quoting exact numbers). Supabase is free at pilot scale and about $25 a month on the Pro plan. Professional dispatch is priced per alarm through Noonlight's partner program, which we'd confirm before launch. **We don't have a Noonlight quote. Say so if asked.**

### Why not Apple Check In, or UNM Safe?
**Short:** They're good tools and we link to UNM Safe, but both need you to act. We cover the moments you can't.
**More:** Check In notices when you don't arrive or a timer runs out. It doesn't listen for distress, doesn't involve professional dispatch, and has no duress PIN. UNM Safe (which replaced LoboGuardian) is built around manual actions: calling campus police, Friend Walk, tip reporting. Noonlight is a hold-to-release button with paid crash detection. Check In can alert a contact if your phone goes offline, on timing Apple doesn't publish, and it stops there. None of these three has a fake cancel. Other apps do, such as aegis+ and Centinela.

### Is recording people legal?
**Short:** We only keep audio during an alert, the user is a party to the conversation, and we'd get a legal review before launch.
**More:** NMSA 30-12-1(C) bars intercepting telephone or telegraph messages "without the consent of a sender or intended recipient", so New Mexico is one-party consent for calls. The statute doesn't clearly cover in-person audio picked up by a phone. **We haven't checked this with a lawyer, so say "generally read as one-party consent" and not "it's legal".** The clips belong to the user, are encrypted, and are shared only if she chooses. A launch in other states would need a per-state review, because some require all-party consent.

### What's the business model?
**Short:** Free for students, paid for by campus licences.
**More:** Universities already spend on safety apps and Clery and Title IX compliance. A campus licence would cover students for free, and a paid plan would cover non-students. **These are proposals. We have no agreements.** Partners we'd like to work with: LoboRESPECT Advocacy Center, the UNM Women's Resource Center, UNMPD, CNM Security and the Rape Crisis Center of Central NM.

### Have you talked to any of these partners?
Answer truthfully. As of Nov 4 we haven't. Say: "Not yet. Advocate review of our copy is the first step after the contest."

---

## 3. Edge cases and abuse

### What if nobody answers, or there's no signal?
If no contact responds within 90 seconds, dispatch takes over automatically. If the phone loses signal or dies, the server's heartbeat watchdog alerts contacts with the last known location.

### Could an abuser use this to track someone?
Location is shared only during a Guard session or an alert, and only the phone's owner can start one. Contacts can't pull location on demand. Live links are designed to expire after the alert. The Vault needs Face ID, and the discreet icon helps if someone controls the phone.

### What if someone forces her to cancel?
That's what the duress PIN is for. It looks exactly like a normal cancel on screen, and the server silently escalates to dispatch. If they ask whether the dispatcher calls the phone: yes, today it could, and that's the first thing to fix before production.

### What about false 911 calls? Isn't that a burden on police?
SafetySense never calls 911 directly. A professional monitoring center calls the user first and dispatches only if she doesn't answer or says she's unsafe. Drills are marked TEST and never dispatch.

### What about older iPhones?
The Action Button needs an iPhone 15 Pro or newer (or the 16e or 17 series). Every phone also gets the Lock Screen control, Siri, the spoken safe word and the hold-to-release SOS. Without Apple Intelligence, the app runs on rules only. It needs iOS 26.

### Android? Other campuses?
We started on iOS to use Apple's on-device AI. The backend is platform-neutral, and the contacts' live link already works in any browser. Android and other campuses come after the student pilot.

### Can it detect being drugged?
No, and we won't claim it can. No phone can detect a drug. SafetySense detects the effect that matters: you stop responding, stop moving, or end up somewhere you didn't plan to be. Night Out also prompts drink checks.

### Is the demo real?
Yes. It's a native SwiftUI app talking to a live Supabase backend. Calls are real Twilio calls to a verified number. Dispatch in the demo is the Noonlight sandbox or a labelled simulation, never live 911. The Twilio trial blocks US SMS, so texts are sent but don't arrive yet. Calls work.

### How is the contacts' data protected?
Contacts' names and numbers are stored server-side under row-level security and used only to reach them during an alert. The spec has contacts get a text explaining SafetySense when they're added. That text is blocked on the Twilio trial for now.

### What are you most worried about?
Be honest. Good answers: false-alarm rates in real noisy bars, which we haven't field-tested, and making sure the copy is right for survivors, which is why advocate review comes first.

---

## Facts to have ready (verified Nov 4, 2026)

| Claim | Source | Status |
|---|---|---|
| 70% of 298 women reported significant tonic immobility (48% extreme) during sexual assault | Möller, Söndergaard and Helström, *Acta Obstetricia et Gynecologica Scandinavica* 96(8):932–938, 2017, DOI 10.1111/aogs.13174 | **Verified** (Crossref metadata plus ScienceDaily's summary of the paper). Women seen at a Stockholm emergency clinic within a month of the assault; 189 followed up at 6 months |
| New Mexico is still listed as the only US state without text-to-911. The statewide NG911 upgrade (which can support text) began in 2025 | Textdrip state guide (Jun 18, 2026); Source NM (Apr 2025); GovTech (Aug 2025); KFOX | **Verified Nov 4, 2026**: no public launch found. Third-party relay accesSOS works in Albuquerque and Santa Fe, so don't say "no way at all". Re-check before Nov 20 |
| NM is one-party consent for calls (NMSA 30-12-1(C): "a sender or intended recipient") | Statute text; 2013 SB 127 (all-party bill, not enacted) | **Wording verified**; in-person audio unclear; not legal advice. Use "generally read as" |
| Competitor table (slide 7) | unmsafe.unm.edu, noonlight.com, getbsafe.com/help, Apple iPhone User Guide | **Re-checked Nov 5, 2026.** Noonlight's Alexa link was discontinued; see docs/COMPETITOR_RESEARCH.md. Noonlight has Safety Network location sharing and paid crash detection; Apple's fall detection is on the Watch; Check In can warn late if the phone dies |
| Twilio and Noonlight pricing | Not checked | Say "about a cent or two", no exact figures |
| Local phone numbers in the Support screen | unm.edu, cnm.edu, nmcsap.org | **Verified Nov 4, 2026**: LoboRESPECT 505-277-2911, RCCCNM 505-266-7711, ABQ SANE 505-884-7263, UNMPD 505-277-2241, CEEO/Title IX 505-277-5251, CNM Security 505-224-3001/3002 |

## Things not to say

- "No one else does this," "first," "only," or "novel" about any single feature.
- "We tested the competitors." We read their documentation.
- That Citizen sends your audio to the cloud. We don't know that.
- "It detects drugging." It doesn't.
- "It calls 911." It goes through professional monitoring, and the demo uses a sandbox.
- "Replaces 911", "guarantees safety", or anything that blames a user for not using it.
- Partnerships or user numbers we don't have.
