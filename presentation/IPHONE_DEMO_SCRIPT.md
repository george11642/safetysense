# Optional: real-device demo on George's iPhone 16e (60 to 90 s)

The main demo video (`presentation/SafetySense-Demo.mp4`) can come entirely from the simulator. This shot list adds what a simulator can't show: **a real Action Button press, a real Lock Screen Live Activity, and a real phone ringing.** Cut the best 20 to 40 seconds of it into the main demo, or use it whole as a backup clip.

We can't use our own phone on stage (Rainforest rule), so this has to be **recorded ahead of time** and embedded in the deck.

---

## 0. Safety rules for every take

- **Trusted contact = George only** (your own number, the only Twilio-verified one). Mary isn't verified on the Twilio trial yet, so calls to her fail. Don't add her until she's verified, and don't add anyone else.
- **"Allow real calls" stays OFF** (Settings > Developer). With it off, every alert is sent as `dry_run`, so contacts see TEST and nobody is called. Turn it on for **one** take only (shot 5), then turn it off again straight away.
- Dispatch is always the **Noonlight sandbox or a labelled "simulated" dispatch**. The app never calls live 911. If any screen ever shows a real 911 call in progress, hang up right away.
- **Don't say the safe word or scream near other people's phones** without warning them. Record somewhere private. A scream recording played from a laptop speaker works for the trigger.
- Answering the real call: the Twilio **trial** plays its own message first ("press any key to continue"). **Press a key**, or the SafetySense message never plays. Edit that preamble out of the video.
- Afterward: end the session, open Settings > Developer, check "Allow real calls" is off, and delete the test alert in the Vault if you don't want it kept.
- On camera, say or caption: *"Demo. Real call to a team member. Dispatch is simulated, never live 911."*

## 1. Install the build on the iPhone (about 15 minutes, once)

TestFlight needs a paid Apple Developer team. That's still an open question (`docs/OPEN_QUESTIONS.md` #4), so **use Xcode direct install** unless George has set up a team.

1. On the iPhone: Settings > Privacy & Security > **Developer Mode** > On. Restart when asked.
2. Plug the iPhone into the Mac and tap **Trust**.
3. In `app/project.yml`, set `DEVELOPMENT_TEAM` to George's team ID (Xcode > Settings > Accounts shows it). A free personal team works for a 7-day install, but App Groups and Live Activities may need a paid team. If signing fails on the App Group, that's the reason.
4. Check that `SSBackendPublishableKey` and `SSShareBaseURL` in `project.yml` are filled in (the live values are in the backend notes). If they're empty, the app falls back to demo services.
5. `cd app && xcodegen generate`, then open `SafetySense.xcodeproj` **in the Xcode app** (a Claude Code shell's xcodebuild hangs; see `app/ARCHITECTURE.md`).
6. Choose scheme **SafetySense**, destination **George's iPhone**, and Run (Cmd-R). The first launch may need Settings > General > VPN & Device Management > trust the developer.
7. **TestFlight alternative** (paid team only): Product > Archive > Distribute App > TestFlight & App Store > Upload. Add George as an internal tester. **Don't submit for App Review**; the contest requires the app to be unpublished.

## 2. Set up the app (about 5 minutes)

1. Fresh install, go through onboarding:
   - Campus: **UNM**.
   - Trusted contacts: **George only.** Pick him from Contacts, or type his number.
   - Triggers: follow the Action Button step.
   - Permissions: allow microphone, location (**Always**), notifications (**Time-Sensitive**), motion.
   - Set a Safety PIN and a duress PIN you'll remember on camera. Don't show the duress PIN being typed.
   - Run the practice drill. It's marked TEST and nobody is called.
2. **Action Button:** iPhone Settings > Action Button > swipe to **Shortcut** > choose **SafetySense Alert**.
3. **Lock Screen:** long-press the Lock Screen > Customize > Lock Screen > add the SafetySense SOS control (optional shot).
4. **Demo mode vs live:** for shots 1 to 4, Settings > Developer > **Demo mode on next launch: Off** (live backend), **Allow real calls: Off**. The "10x faster" **Timers** picker (Developer > Demo scenarios) only appears in demo mode. On the live backend, the real 45 s and 90 s timers run, so cut the waiting in the edit.
5. **Settings > Developer > Allow real calls** stays off until shot 5.

## 3. Phone and recording settings

- **Focus:** turn on Do Not Disturb, but allow Time-Sensitive notifications and SafetySense (Settings > Focus > Do Not Disturb > Apps > add SafetySense). Turn off other apps' banners.
- Battery above 80%, Wi-Fi on, Low Power Mode off, brightness at max, **Dark mode** (the app is dark-only).
- Clear the Lock Screen of personal notifications. Use a neutral wallpaper.
- **Screen recording:** Control Center > long-press **Screen Recording** > **Microphone On** (so the app's sounds and your narration are captured). The red status bar pill appears; that's fine.
- The Action Button press and the phone ringing **can't be seen in a screen recording.** Film those with a **second phone** on a tripod, overhead, 4K 30 fps, against a plain dark surface, hand in frame.
- Second phone to answer the call: George's own number *is* the trusted contact, so the call comes **to this same iPhone 16e** while it's alerting. Practical options:
  - (a) Easiest: film shot 5 with the camera phone and show the incoming call on the 16e. The 16e is both the user and the contact in this take, and the caption says so.
  - (b) Better story: make George's other device the trusted contact. It only works if that number is also verified on Twilio.

## 4. Shot list (about 75 s finished)

| # | Shot | Camera | What to do | On-screen caption | Length |
|---|---|---|---|---|---|
| 1 | Start Night Out | Screen recording | Home > **Night Out** chip > **Start Guard**. Hold on Guard Active for 2 s. | "One tap before a night out" | 8 s |
| 2 | Live Activity | Screen recording | Press the side button to lock. Wake the screen: show the **Guarding** Live Activity. Long-press it to expand. | "Lives on your Lock Screen. Nothing saved unless something's wrong." | 8 s |
| 3 | Check-in | Screen recording | Wait for the scheduled check-in, or trigger *Missed check-in* from Developer > Demo scenarios. The "You okay?" ring appears. Tap **I'm okay**. | "A quiet check-in. One tap clears it." | 10 s |
| 4 | **Action Button hold** | **Camera phone** (overhead, hand in frame) + screen recording | With the 16e **locked in your hand**, press and hold the Action Button. Cut to the screen: Alert countdown, "Your people are being told". | "Hold the Action Button. No unlocking, no looking." | 12 s |
| 5 | **Real call** (the one take with **Allow real calls ON**) | Camera phone | Turn Allow real calls **on**. Start Night Out, then hold the Action Button. The phone rings: answer, **press a key** after Twilio's trial message, and let the SafetySense message play. Then turn Allow real calls **off**. | "Your trusted contact gets a real call, with a live map link" | 15 s |
| 6 | Live link | Screen recording, or a laptop browser capture | Open the share link from the alert (Alert active > **Share link**). Tap **On my way**. Back in the app, show "on the way" in the timeline. | "No app needed. They tap 'On my way'." | 12 s |
| 7 | Cancel with PIN | Screen recording | On Alert active, tap **I'm safe now** and enter the Safety PIN. | "Only your PIN ends it. A duress PIN looks the same, and help still comes." | 8 s |
| 8 | End card | Edit | Logo plus "SafetySense: Calls for help when you can't." | "Demo. Dispatch is simulated, never live 911." | 3 s |

**Total about 76 s.** If you have only one shot, do **shot 4**. It's the one thing only a real device can show.

### Exact steps for shot 5 (the one live call)
1. Settings > Developer > **Allow real calls** > on > confirm **Allow**.
2. Home > Night Out > Start Guard.
3. Start the camera phone recording. Lock the 16e.
4. Hold the Action Button until the haptic. The alert starts at your Manual SOS setting (dispatch by default, which in the demo is simulated or sandbox).
5. The call arrives from **+1 505-405-4813** (the Twilio number). Answer. Twilio's trial message plays: **press any key.** The SafetySense message plays.
6. Hang up. Unlock, tap **I'm safe now**, and enter your Safety PIN.
7. Settings > Developer > **Allow real calls** > **off**. Check it says "Alerts are sent as TEST."

## 5. Editing notes

- Trim the Twilio trial preamble. Trim any waiting.
- Blur George's phone number wherever it shows (Contacts, the call screen).
- Captions in white, with the pink accent `#EF7B9B` for key words. Keep each caption on screen for at least 2 s.
- Export H.264 MP4, 1080p, under 100 MB. Name it `presentation/SafetySense-Demo-iPhone.mp4`, or cut it into `SafetySense-Demo.mp4`. Then rerun `NODE_PATH=$(npm root -g) node presentation/build/build_deck.js` to embed the main demo in the deck.
- Keep audio low under the narration. The talk is narrated live over the video.
