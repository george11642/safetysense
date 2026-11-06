# SafetySense competitor research

**Date:** Nov 6, 2026 (research run Nov 5, 2026)
**Question:** Does anyone already have this, and is the entry in trouble?
**Scope:** 74 products or product entries (13 in the matrix, 61 in the list), plus SDKs, research prototypes and patents.
**Evidence:** App Store listings, vendor sites, help centers, privacy policies and terms. Nothing was installed or tested by hand, so every competitor mark means "the vendor says so," not "we saw it work."

## 1. Bottom line

**Yes, someone already has almost every piece. No, nobody we found has the whole thing. The entry is not cooked, but several of our sentences have to change before the submission goes out tonight.**

| Question | Verdict | Why |
|---|---|---|
| **Contest rules** | **No trouble** | The rule is "a prototype and demonstration of a novel idea for a currently unpublished application" (rules.md line 15). SafetySense is unpublished. The rules don't define "novel," and nothing we found says an idea is ineligible because similar apps exist. This is our reading of the text, not a ruling from the organizers. |
| **Judges' originality score** (25 of 100 in Stage 2) | **Moderate risk, fixable** | Selling features as new would lose this. A judge who searches the App Store can find Centinela, and UNM judges may remember the duress PIN from Rave Guardian, the platform behind LoboGuardian. Selling the connected system, built around the person who can't respond, still holds up. |
| **Real-world startup** | **Hard, but open** | The market is crowded and the pieces are cheap to copy. Centinela could add a dispatch step through Noonlight's public API. aegis+ says it is working toward automated check-ins. Apple is free and preinstalled. There's a real gap, but it's a thin moat. Distribution, false-alarm proof and campus contracts would decide it, not features. |

The single sentence that survives: **we found no product that documents on-device distress detection, a no-response ladder through contacts to professional dispatch, a session heartbeat watchdog and a duress PIN together.** It is true of what we could read. It is not proof that nothing exists.

Three things to act on:
1. **Tonight:** fix the Purpose document before sending ([section 7](#7-statements-that-are-wrong-or-risky-and-replacement-wording), items 1 to 5). George confirmed the email had not been sent when these fixes were made.
2. **Safety bug:** the duress PIN may trigger a dispatcher call to the phone while an attacker is holding it ([section 6](#6-a-gap-this-research-exposed-in-our-own-duress-flow)).
3. **Noonlight's Alexa trigger is gone.** Our comparison tables still list it.

## 2. The closest products vs F1 to F13

**Key:** Y yes · P partial · N docs reasonably show it's absent · ? unknown (not documented, which isn't the same as absent)

| Product | F1 audio | F2 safe word | F3 distress phrase | F4 fall + still | F5 auto ladder | F6 dead-phone watchdog | F7 duress PIN | F8 pro dispatch | F9 modes | F10 on-device audio | F11 no-app link | F12 fake call | F13 encrypted evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **SafetySense** (prototype, spec) | Y | Y | Y | Y | Y | Y | Y | Y sandbox | Y | Y | Y | Y | Y |
| **Centinela** | P | Y | ? | ? | P | P | Y | N | P | Y | ? | ? | P |
| **aegis+** | N | N | ? | ? | P | N | Y | Y | ? | N | P | ? | P |
| **Citizen Protect** | P | P | ? | ? | P | ? | ? | Y | P | ? | ? | ? | ? |
| **Walk With Me AI** | N | Y | P | Y | P | ? | P | N | P | P | P | Y | N |
| **Apple built-ins** | P | P | N | P | P | Y | N | P | P | P | N | ? | P |
| **Raxha** | P | P | P | P | P | P | ? | N | N | P | N | ? | ? |
| **SOS GPS Rescue** | P | ? | ? | P | P | N | P | N | P | Y | N | N | N |
| **Guardme** (UK only) | P | ? | ? | ? | P | ? | ? | N | N | P | Y | ? | Y |
| **Noonlight** | N | N | N | P | P | ? | N | Y | P | N | P | ? | N |
| **UrSafe** | N | Y | P | P | P | ? | ? | P | P | ? | P | Y | P |
| **StaySafe** (employer) | N | N | N | Y | Y | ? | Y | P | N | N | ? | ? | ? |
| **Rave Guardian** (campus) | N | N | N | N | P | ? | Y | P | P | N | ? | ? | ? |
| **UNM Safe** (local) | N | N | N | N | N | N | N | P | P | N | Y | N | N |

**Our own column needs an honest footnote.** Competitors' marks describe shipped products. Ours describes a prototype: dispatch is Noonlight sandbox only, false-alarm rates are unmeasured, and the app runs only through Xcode.

### Why each row is marked that way

**Centinela: the one to know cold.** Live on the US App Store (v3.4.2, Oct 19; first release Aug 4, app ID suggests 2026). Free tier with community map; Premium $6.99/mo; circle plans $14.95 to $29.99/mo. No ratings yet, so probably little traction, though that's an inference. Developer: Changing Lifes LLC.
- Listing, re-read Nov 5: "A phrase only you know, or a scream, raises the alarm." "TWO PINS One stops a false alarm. The other looks exactly like cancelling." "Centinela is not an emergency service and does not contact the police or an ambulance for you."
- F6 is partial: "On iPhone, the countdown is also held by our server with your location, so the SOS can go out even if your phone cannot send it." That's a server failsafe for a running countdown, not a heartbeat for the whole session. Whether a missed check-in timer also fires from the server is undocumented.
- F5 is partial but strong: a missed timer opens a live location and audio stream to the circle, and "Rescue" lets a circle member open your location and mic with prior consent. No dispatch rung.
- F10 is yes before an emergency, but emergency audio stays on their server for a year and the safety team can access it (logged). We encrypt on the device and the server holds ciphertext only.
- It is more ambitious than us on reach: it markets always-on listening with no session, though on iPhone the app must be open or running in the background.
- Sources: [App Store](https://apps.apple.com/us/app/centinela-personal-safety/id6791587849), [site and FAQ](https://getcentinela.app/), [privacy](https://getcentinela.app/privacy.html), [terms](https://getcentinela.app/terms.html), [data safety](https://getcentinela.app/data-safety.html)

**aegis+: the biggest threat to F7.** Live, US only. v2.0.2, Sep 17. Free with Atlas at $5.99/mo or $64.99/yr, though no source says which features need Atlas. 5.0 from 12 ratings. Small team, Chicago.
- Listing, re-read Nov 5: "Entering it looks exactly like cancelling: your screen returns to normal... The alarm stays live, your location keeps going out, and dispatch is told not to call or text you back." This is our mechanic, shipped, with dispatch.
- Dispatch runs on Noonlight per its terms, the same vendor as ours.
- No audio or automatic detection in the listing. The site's "you-impact" page mentions crash detection and Product Hunt mentions fall detection, neither corroborated. Its [Athena AI](https://www.aegisapp.io/technology) is announced, not shipped, and would "trigger automated check-ins" from behavior anomalies.
- Its founder story is about someone who couldn't speak or use her phone, so the "can't press" argument isn't ours alone.
- Sources: [App Store](https://apps.apple.com/us/app/aegis/id6714480370), [site](https://www.aegisapp.io/), [about](https://www.aegisapp.io/about), [you-impact](https://www.aegisapp.io/you-impact), [Product Hunt](https://www.producthunt.com/products/aegis-14)

**Citizen Protect: first to the core loop.** Citizen is live and large (4.7 from 525K US ratings). In 2021 it launched opt-in AI audio monitoring: a detected scream, a prompt, then auto-connect to a human agent after about 10 seconds of silence, then 911 at the agent's judgment. Its current Terms (updated Sept 26, 2024) still describe "Safe Mode," or "Watch My Back," auto-connecting on certain sounds, including "yelling a predetermined safe phrase." The App Store listing and Premium page don't mention it, so **whether it ships today is unconfirmed**. F8 is yes, with the caveat that agents keep "sole and absolute discretion" and Citizen says it isn't an emergency service. No contact ladder, duress PIN or watchdog was found.
Sources: [Newsweek 2021](https://www.newsweek.com/citizen-app-launch-24-7-private-protect-agents-1617528), [TechCrunch 2021](https://techcrunch.com/2021/08/03/controversial-crime-app-citizen-launches-20-month-protect-service/), [Terms](https://citizen.com/privacy/tos), [privacy](https://citizen.com/privacy/policy), [App Store](https://apps.apple.com/us/app/citizen-safety-live-video/id1039889567), [business](https://business.citizen.com/solutions)

**Walk With Me AI: the closest concept for one scenario.** Live on the US store, free, 1 rating, one developer, last update Jul 23, 2026. It claims tiers with "no button press required": check-in within 60 seconds, then SMS, then call. It has a spoken innocent-sounding codeword that escalates quietly, fall alerts, Uber mode and a fake call. No sound-event detection, no dispatch. Several marketing claims conflict with its own policy: speech distress triggers aren't in the tier inputs, and conversation context goes to Moonshot AI and ElevenLabs despite "stays on your device." So F3 and F10 are partial. F12 is on the site only.
Sources: [site](https://www.walkwithmeai.com/), [privacy](https://www.walkwithmeai.com/privacy), [terms](https://www.walkwithmeai.com/terms), [App Store](https://apps.apple.com/us/app/walk-with-me-ai-safety-guard/id6760707311)

**Apple built-ins: the real default.** Free, preinstalled.
- **F6 is yes on mechanism.** Check In sends heartbeats to iMessage servers, and if the device "is turned off or loses connectivity," the servers release the key at expiry. Apple's guide says the recipient may get a "delayed or early notification." Exact timing is unpublished. Heartbeats are described for destination travel, not clearly for timer mode. This beats our SPEC line 53.
- F8 is partial: Emergency SOS, crash and fall detection auto-dial 911 directly. There's no monitoring center and no dispatch from a safety session.
- F1 is partial: Sound Recognition listens on device but only notifies the owner, and Apple says not to rely on it "in high-risk or emergency situations." Third-party guides list Shouting and Glass Breaking; we couldn't confirm that on Apple's pages.
- F2 is partial: [Vocal Shortcuts](https://support.apple.com/guide/iphone/use-vocal-shortcuts-iph7f242ea2c/ios) lets you run an action with a spoken word, processed on device. Reaching 911 from it wasn't verified.
- F11 is no: both sides need iOS 17+.
- Sources: [Check In](https://support.apple.com/guide/personal-safety/use-check-in-for-messages-ips56b5bc469/web), [Check In security](https://support.apple.com/en-my/guide/security/secea59d7b70/web), [Sound Recognition](https://support.apple.com/guide/iphone/use-sound-recognition-iphf2dc33312/ios), [Crash Detection](https://support.apple.com/en-us/104959), [Fall Detection](https://support.apple.com/en-us/108896), [Emergency SOS](https://support.apple.com/en-us/104992)

**Raxha: the same slogan.** Live on the US store, free, updated very often, no ratings shown. Its homepage says "safety that acts when you can't" and "No button to press," almost our tagline. But it's a family-circle Apple Watch app. Audio is Watch-only and the mic turns on only "when vitals suggest something may be wrong." It says it "does not call emergency services." F6 is partial: family can be notified when the watch has "gone quiet," timing undocumented. A 24/7 response layer, "Raxha Reach," is announced and not available, so say "no dispatch today," not "never."
Sources: [site](https://raxha.app), [App Store](https://apps.apple.com/us/app/raxha/id6760548265), [privacy](https://raxha.app/privacy-policy), [terms](https://raxha.app/terms), [support](https://raxha.app/support)

**SOS GPS Rescue: looks scary, isn't.** Live, free with AdMob ads, 1 rating, v2.0 rewrite Aug 11, 2026. Its listing claims on-device danger-sound recognition, a second PIN with an innocuous screen and a dead-man switch. But "you confirm the send": it opens Messages and you tap send. So detection doesn't deliver if you can't tap, and duress can't finish silently. No server, so F6 is no. Which sounds it detects is undocumented.
Sources: [App Store](https://apps.apple.com/us/app/sos-gps-rescue/id1464778654), [iTunes record](https://itunes.apple.com/lookup?id=1464778654&country=us), [support](https://www.andreapiani.com/sos-rescue-support.html), [privacy](https://www.andreapiani.com/sos-rescue-privacy.html)

**Guardme: same privacy pitch, different product.** Live but "available in the United Kingdom only"; not in the US store. Free with a trial, then £3.99/mo or £29.99/yr. 500+ Play downloads. One tap starts recording; on-device AI judges audio and video and alerts up to 3 contacts. Don't dismiss it because it needs a tap, since we need one to start too. The real gaps are no check-in ladder, no dispatch, no modes and no documented pocket use. F13 is yes: encrypted on device before upload, plus a 5-day deletion lock. F11 is yes in a thin form: a no-app location link expiring in an hour.
Sources: [App Store GB](https://apps.apple.com/gb/app/guardme-ai-panic-detector/id6797272764), [site](https://guardme.safeimai.com/), [privacy](https://guardme.safeimai.com/privacy), [terms](https://guardme.safeimai.com/terms)

**Noonlight: partner, not rival.** Live, US, v2.20.1 (Jul 20). 4.7 from 16.6K US ratings; site claims 3M+ to 4M+ people. App purchases $4.99 and $9.99. Certified dispatchers 24/7. Alexa and Google Home links were discontinued in v2.17.3. Crash response only. Its Dispatch API is open to any developer, so dispatch isn't a moat. Sources disagree on a phone timer mode: the listing says Wear OS has one, help pages show none on phone.
Sources: [App Store](https://apps.apple.com/us/app/noonlight-feel-protected-24-7/id716262008), [app page](https://www.noonlight.com/noonlight-app), [Dispatch API](https://www.noonlight.com/products/dispatch-api)

**UrSafe.** Live (v1.6.12), free with purchases, 4.2 from 48 US ratings. Personal safe words since 2019, tiered by severity, with E911 location and a fake call. 911 officials raised false-trigger concerns in 2019, which supports our human-in-the-loop choice. It still needs a conscious word.
Sources: [App Store](https://apps.apple.com/us/app/the-ursafe-app/id1481482887), [WMBF 2019](https://www.wmbfnews.com/2019/12/18/new-personal-safety-app-automatically-calls-through-safeword-officials-raise-questions/)

**StaySafe (EcoOnline).** Employer product, quote only. Duress PIN that makes the app look cancelled and closed while the alert continues, plus fall-then-stillness detection and missed check-in escalation.
Sources: [duress help](https://intercom.help/staysafe-loneworker/en/articles/5807395), [comparison](https://www.ecoonline.com/en-us/blog/best-lone-worker-app/), [App Store](https://apps.apple.com/us/app/staysafe-lone-worker/id1472343500)

**Rave Guardian: the local embarrassment risk.** Live, v4.8.0, 4.6 from about 3K ratings, institution-paid. Campus docs describe a false deactivation code, one digit above your PIN, that looks like a normal shutoff while alerting Public Safety. LoboGuardian was built on Rave per [2015 sources](https://prnewswire.com/news-releases/rave-guardian-campus-safety-app-selected-by-university-of-new-mexico-to-protect-flagship-campus-300041951.html). **We did not confirm LoboGuardian exposed it.** The current App Store text no longer mentions it.
Sources: [Boise State](https://www.boisestate.edu/publicsafety-security/home/rave-guardian/), [App Store](https://apps.apple.com/us/app/rave-guardian/id691246562)

**UNM Safe.** Live, 5.0 from 1 rating, runs on the AppArmor platform, replaced LoboGuardian on Jul 31, 2026. Manual Mobile BlueLight, Friend Walk ("your friend doesn't need the app"), tips and maps. No duress or automatic features on its public pages. AppArmor sells a Work Alone check-in UNM's listing doesn't show.
Sources: [App Store](https://apps.apple.com/us/app/unm-safe/id6756939706), [unmsafe.unm.edu](https://unmsafe.unm.edu/), [AppArmor Work Alone](https://blog.apparmor.com/post/new-feature-alert-workalone)

## 3. Every other product

"Overlap" names the features that matter. Prices and ratings are as read on Nov 5, 2026.

### Consumer apps, live or listed
| Product | Status | Price | Scale | Overlap |
|---|---|---|---|---|
| [Safe-Word](https://apps.apple.com/us/app/safe-word-voice-sos-safety/id6759470615) | Live, Oct 26 | $4.99/mo, $29.99/yr | 1 rating | F2, F10, F12. One developer shipped background on-device listening |
| [Safe SOS](https://apps.apple.com/app/id6740741308) | Live, Sep 29 | $3.99/mo | No ratings | F7 at app open, F4, F12 |
| [Chaperone](https://apps.apple.com/gb/app/chaperone-safety-app/id6771490775) | Live, Jun 2026 | Free | 1 rating | Silent panic code, first-date plans |
| [Covert Alert](https://apps.apple.com/us/app/covert-alert/id980534294) | Last update Jan 2025 | $2.99 to $19.99 | 4.8 from 232 | F2 on a locked phone |
| [eBodyGuard](https://apps.apple.com/us/app/ebodyguard/id1459697825) | Live | $5.99, $59.99 | 4.5 from 19 | Voice to 911 |
| [Protect - Video Safety](https://apps.apple.com/us/app/protect-video-safety/id1660846953) | Live, US 911 relay | $3.99/mo | 4.4 from 7 | Siri phrase, video to 911 center |
| [bSafe](https://apps.apple.com/us/app/bsafe/id459709106) | Stale, Jan 2025 | $4.99/mo | 3.4 from 208 | 20+ preset voice phrases, F12, recording |
| [Life360](https://apps.apple.com/us/app/life360-family-safety-gps/id384830320) | Live | $9.99 to $24.99 | 4.8 from 3.16M | F8 on paid tiers, family and driving focus |
| [My SOS Family](https://apps.apple.com/us/app/-/id1057086897) | Live, Oct 12 | About $3.49/mo | 4.4 from 292 | Check-ins to contacts, no call center |
| [SafePulse](https://checkinonme.app/) | Live | $2.99/mo iOS | Unknown | Server-side dead-phone deadline, F11 |
| [Beacon Safe](https://apps.apple.com/app/id6760266770) | Live, Oct 8 | Free, Plus $19.99/mo | 4.4 from 7 | "Alerts fire from our servers," hours to days |
| [RUOK Safety](https://apps.apple.com/app/id6765987939) | Live, Oct 17 | About $5 to $9/mo | 5.0 from 3 | Timer to SMS, first-date pitch |
| [SafeDate](https://apps.apple.com/us/app/safedate/id1375528130) | Abandoned, Apr 2021 | Free | 2.5 from 4 | Sealed date details, since 2018 |
| [Spairally](https://www.spairally.com/) | Live | $5.99/mo | Unknown | Gunshot and explosion sounds only |
| [Zonetick](https://marlvel.ai/api/llm/apps/lifestyle/zonetick-family-safety-app) | Appears live, aggregator source only | Unknown | 0 reviews | Scream detection reported, low confidence |
| [Roger](https://solvertouch.com/roger) | Private beta | Unknown | Pre-launch | Voice assistant with SOS |
| [BuddyAI](https://buddyai.org/) | Live signups, no app | Free tier | Unknown | AI phone companion; Halo is similar |
| [Epowar](https://apps.apple.com/gb/app/epowar-personal-safety-app/id6448475321) | Live, UK and Ireland only | £4.99/mo | 4.6 from 64 | Same "alarms need activating" argument, Apple Watch detection. Reads conflict on whether mic feeds detection. Patents claimed |
| [Hollie Guard](https://apps.apple.com/gb/app/hollie-guard-personal-safety/id1033851499) | Live, UK | Extra £7.99/mo | 2.1 from 38; 500K+ users claimed | Man-down, response center |
| [WalkSafe+](https://apps.apple.com/gb/app/walksafe/id1600039378) | Live, UK | Free | 4.7 from 687 | Journey sharing |
| [Aurora Security](https://aurora-security-website.pages.dev/) | Unclear. Site live; one read found Android, another found no store listing | Free claimed | Unknown | On-device sound thresholds, disclaims dispatch and monitoring |
| [SOS Detect](https://appgoblin.info/apps/com.sosdetect.app) | Android, Aug 2025 | Free | About 31K installs est. | Mic distress sounds to SMS |
| [Chilla](https://apprecs.com/android/comm.Kishlay.screamDetector/chilla-personal-safety-app-with-scream-detection) | Android, status unclear | Unknown | 10K+ installs reported | Scream detection, since 2016 |

### Campus
| Product | Status | Price | Scale | Overlap |
|---|---|---|---|---|
| [AppArmor](https://www.motorolasolutions.com/en_us/blog/what-is-apparmor-custom-branded-safety-apps) | Live | Institution quote | Claims 50+ features | Platform under UNM Safe; Work Alone escalation |
| [LiveSafe](https://apps.apple.com/us/app/livesafe/id653666211) | Live | Institution | 2.8 from 336 | SafeWalk "Are you OK?" then friends |
| [CampusShield](https://apps.apple.com/us/app/campusshield/id1019136154) | Live | Institution | 4.4 from 105 | Friend Watch timer with PIN |
| [SafeZone](https://apps.apple.com/hu/app/safezone/id533054756) | Live | Institution | Unknown | Fall during check-in, campus only |

### Lone-worker and enterprise (mature prior art)
| Product | Status | Price | Scale | Overlap |
|---|---|---|---|---|
| [Everbridge 360](https://supportcenter.everbridge.com/hc/en-us/articles/31604484257435-360-Mobile-How-to-Use-Safety-Buttons-in-Everbridge-360-App) | Live | Quote | Unknown | Safe Corridor with duress code |
| [GetHomeSafe](https://gethomesafe.com/solutions/working-alone) | Live | Free personal; business NZD 8 per user/mo | 5.0 from 2 | Server-sent overdue alerts; duress on Android per summary |
| [VigieApp](https://www.neovigie.com/en-us/safety-app) | Live | Quote | Unknown | Automatic loss-of-connection alarm, the nearest F6 heartbeat |
| [Blackline G7/G8](https://support.blacklinesafety.com/g7-glossary) | Live, wearable | Quote | 138K devices | Full fall, confirm, escalate ladder |
| [Peoplesafe Pro](https://peoplesafe.co.uk/products/lone-worker-app/) | Live, UK | Quote | 350K claimed, secondary | Pro response, duress PIN per summary |
| [SoloProtect](https://www.soloprotect.com/devices/lone-worker-app) | Live, US and UK | Quote | Unknown | Operator listens after a press |
| [Ok Alone](https://apps.apple.com/app/id777464303) | Live | About $10 per user/mo | 4.5 from 4 | Man down, Siri, alert loop |
| [SafetyLine](https://safetylineloneworker.com/benefits/lifesaving-motion-features) | Live | Unknown | Unknown | Fall, unconfirmed emergency; snippets only |
| [CALIMA](https://en.calima.io/lp/totmannmelder-totmannschalter) | Live | Quote | Unknown | Server keeps alarm running if the phone is destroyed |

### Hardware and bundled dispatch
| Product | Status | Price | Scale | Overlap |
|---|---|---|---|---|
| [ADT My Safety](https://www.adt.com/my-safety) | Live for ADT+ subscribers | From $24.99/mo | ADT base | Hands-free phrase to agents, timer. Standalone SoSecure was retired Mar 2026 |
| [invisaWear](https://www.invisawear.com/) (absorbed Flare) | Live | From about $49 plus $12 to $20/mo, sources conflict | 200K+ buyers claimed | Secret phrase, ADT agents; maker advises about 1 hour on for battery |
| [Birdie+](https://apps.apple.com/us/app/birdie/id1568954780) | Live | About $31 to $39 plus yearly fee | 3M+ customers claimed; app 2.4 from 39 | Noonlight-backed agent, fake call |
| [Silent Beacon](https://apps.apple.com/us/app/safety-app-for-silent-beacon/id933730960) | Live | Hardware about $100 | 3.7 from 69 | Monitoring center on Pro |
| [Ripple](https://ripplesafety.com) | Unclear | $14.95/mo, reported | Unknown | Click, check-in, then contacts |
| [eNO badge](https://www.enobadge.com/) | Pre-order, days old. Raised $2.7M | About £99 plus £7.90/mo, earlier guidance | Pre-launch | Passive audio, video, motion to a human operator; cloud. Site failed to load, lower confidence |
| [Uber RideCheck](https://www.uber.com/newsroom/always-looking-out/), [Lyft Audio Recording](https://www.lyft.com/safety/audiorecording) | Live, inside ride apps | Free | Very large | Route and stop prompts, encrypted recordings, within their own rides |
| WiSP, Elora Armor ([drink testing](https://www.foxnews.com/health/drink-spiking-defense-new-bracelet-aims-expose-drugs-drop-cocktail.print)) | Pre-market | Not announced | Pilots | Complementary; needs an active test |

### Platforms and dating
| Product | Status | Overlap |
|---|---|---|
| [Google Personal Safety](https://support.google.com/pixelphone/answer/7055029) | Live, Android and Pixel | Safety Check shares last location if the phone dies or loses signal. Unreleased hands-free "Help" seen in an [Oct 2026 teardown](https://androidauthority.com/android-voice-activated-emergency-sos-personal-safety-3717858) |
| [Samsung SOS](https://www.samsung.com/us/support/answer/ANS10001579/) | Live, Galaxy | Five-press SOS, watch falls |
| [Tinder + Noonlight](https://policies.tinder.com/web/safety-center/tools/noonlight/us/en/) | Appears live | Timeline holds date details, reaches dispatch only on an alarm |
| [Bumble Share Date](https://support.bumble.com/hc/en-us/articles/32668227103645-Sharing-your-date-plans) | Reported unavailable, snippet only | Date card to a friend, not sealed |
| [Match Date Check-In](https://www.engadget.com/2020-02-18-match-date-check-in-sos.html) | 2020, status unknown | Requires an active YES reply |

### Dead, dormant or cautionary. Don't cite these as live.
| Product | Status | Why it matters |
|---|---|---|
| [One Scream](https://soundstudiesblog.com/2021/06/21/one-scream/) | Probably dead, unconfirmed. onescream.com is 404; store reads conflict | Scream detection since 2016. Tried and dropped police contact. Misses voices altered by alcohol or drugs |
| [Kitestring](https://www.foxnews.com/tech/innovative-ways-your-phone-can-help-you-get-home-safely) | Domain now redirects elsewhere. Do not link it | Server-side SMS check-ins and duress codes, 2014 |
| [Companion](https://hypebeast.com/2015/9/companion-app) | Likely defunct | U. Michigan, 2015: deviation and dropped phone, 15-second prompt |
| [Circle of 6](https://yth.org/projects/circle-of-6/) | Likely dormant | Manual campus sexual-assault app, 2012 |
| [SoSecure by ADT](https://www.adt.com/sosecure) | Shut down Mar 2026 | Even a security brand retired its standalone app |
| [Wearsafe](https://apps.apple.com/au/app/wearsafe-personal-safety/id962104565) | Probably dead | Failed entrant |
| [Sekura](https://startupim.com/company/sekura) | Ceased Oct 2020 | Fake call |
| [Bugle](https://outdoorhub.com/?p=310462) | Likely defunct | Cloud-held check-in |
| [Watch Over Me](https://www.digitalnewsasia.com/sizzle-fizzle-slow-burn/somebody-to-watch-over-me) | Likely defunct | Early check-in app |
| [Safe & The City](https://techcrunch.com/2019/03/08/on-iwd2019-safe-the-city-launches-their-new-app-for-womens-safety) | Listing gone | Route-safety map |
| [Aspire News](https://techcrunch.com/2020/06/25/aspire-app-dr-phil) | Status unconfirmed | 4,000+ recordings exposed. Our best privacy case study |
| [Tea](https://www.macrumors.com/2025/10/22/apple-removes-tea-dating-apps/) | Pulled from App Store Oct 2025 | Women's safety app breach |

### Technology and paper prior art, not counted as products
- [Sonaid](https://www.sonaid.ai/solutions/personal-safety): on-device SDK for panic scream, call for help and verbal aggression, with no streaming. No named customers. Don't claim the classifier is unique; claim the product.
- [Always Alert](https://arxiv.org/abs/2608.04176), [iProtect](https://researchconnect.buffalo.edu/en/publications/iprotect-detecting-physical-assault-using-smartphone/), and hackathon project [Patrona](https://k-in-tech.vercel.app/patrona.html): research prototypes of scream detection or escalation from silence.
- Patents: Apple [US8929853B2](https://patents.google.com/patent/US20140066000) describes an attack mode, a failsafe timer and a wrong code that enters silent alarm mode, listed Active to 2032, not shipped as far as we found. [IBM US9881486B2](https://patents.google.com/patent/US9881486B2) and [Saferway US10468049B2](https://patents.google.com/patent/US10468049B2/en) are listed expired. This doesn't affect contest eligibility. A commercial launch needs a real freedom-to-operate review. Not legal advice; the search wasn't exhaustive.

**Not located:** Chirpey, b-ready, and "Circle" as a safety app. That means not found, not that they never existed. Unassessed leads: Zeer, Arlo Safe, vivigo Guard, Safe the Date, Guardian Safety, PanicGuard.

## 4. Unique, matched, behind

### Still looks unclaimed (none found, not proof of absence)
- **The whole loop in one consumer product:** distress detection, then check-in, then contacts, then professional dispatch, with a watchdog and duress PIN on the same ladder. Citizen has sound to agent with no contact rung. Centinela has detection and duress with no dispatch. aegis+ has duress and dispatch with no detection.
- **A session-long heartbeat, designed for about 3 to 4 minutes, that feeds a consumer ladder ending at dispatch.** Apple has a heartbeat with unpublished timing and no dispatch. VigieApp and Blackline do this for employers. Timer apps wait for a deadline.
- **Duress on top of detection and dispatch together.**
- **Date mode built on Night Out detection, with details encrypted and released only by an alert.** Sealing alone isn't new.
- **A rules engine with a bounded on-device AI second opinion.** Few rivals describe their logic, so this is weak evidence either way.
- **UNM and CNM localization:** New Mexico's text-to-911 gap, a data path to dispatch, and both campuses' resources.

### Matched. Do not call these new.
| Feature | Who has it |
|---|---|
| F1 on-device audio | Centinela, Citizen (documented), One Scream since 2016, Raxha, Guardme, Aurora, Sonaid |
| F2 safe word | Centinela, UrSafe, Safe-Word, Covert Alert, bSafe, ADT My Safety, invisaWear, Walk With Me |
| F3 distress phrases | Partly Raxha, Walk With Me, Sonaid. Our specific list is the least matched of these |
| F4 fall and stillness | StaySafe, Blackline, VigieApp, Peoplesafe, Walk With Me |
| F5 auto escalation | Walk With Me, Citizen, Raxha, every lone-worker product |
| F6 dead-phone alert | Apple, Google, Centinela (running countdown), SafePulse, Beacon Safe, GetHomeSafe, VigieApp, CALIMA |
| F7 duress PIN | aegis+, Centinela, Rave Guardian, StaySafe, Everbridge, Safe SOS, Chaperone |
| F8 dispatch | Noonlight and anyone on its API, Citizen, Life360, ADT, invisaWear, Birdie |
| F9 modes | Fragments: SafeDate (sealed details), Walk With Me (route, Uber), Noonlight Timeline. No full set found |
| F10 on-device, unsaved audio | Centinela, Safe-Word, Raxha, Guardme. Treat it as expected, not special |
| F11 no-app link | UNM Safe Friend Walk, SafePulse, Guardme, Google. Also expected |
| F12 fake call | Very common |
| F13 encrypted evidence | Guardme is close to ours |

### Where we're behind
- **We aren't live.** That's a contest requirement, but rivals have real App Store and dispatch paths. Ours is sandbox only.
- **We have no field data.** False alarms and battery are targets, not measurements.
- **aegis+ tells dispatch not to call back.** We don't ([section 6](#6-a-gap-this-research-exposed-in-our-own-duress-flow)).
- **aegis+ sends a medical profile with the alarm.** The spec says we do, but the current Noonlight payload carries only name, phone, a placeholder PIN and location.
- **Citizen has human agents** who can judge a situation and stay with you.
- **Centinela has always-on reach**, live audio to contacts, Rescue, neighbor alerts, 30 languages and claimed Android support.
- **Raxha and Epowar use heart rate on a shipped Watch app.** Ours is a stretch goal.
- **Apple is free and has satellite SOS, Text 911 and a key design Apple itself can't read.**
- **Our reach is narrow:** iOS 26 or later, versus iOS 15 or 16 for several rivals.
- **We can't promise detection works when the voice is altered.** One Scream documented that failure, and drugging is one of our core scenarios. Our answer is to rely on non-response, not on hearing a scream.

### Where we're stronger than the closest rivals
- Reaches dispatch, unlike Centinela, Walk With Me, Raxha, Guardme and SOS GPS Rescue.
- Doesn't need a Watch, unlike Raxha and Epowar.
- Encrypts evidence on the device so the server can't read it, unlike Centinela's staff-accessible one-year storage.
- Live link works with no app and no iPhone, unlike Apple.
- Has no ad or analytics SDKs, unlike SOS GPS Rescue (AdMob) and Centinela (tracking labels on identifiers and usage data).

## 5. Market facts

**We have no sourced market-size figure, and we won't invent one.** The search budget ran out before an analyst figure could be found. Don't quote a dollar figure on a slide unless someone checks the source.

What is sourced, mostly self-reported:
- Life360: 4.8 from 3.16M US ratings; paid tiers $9.99 to $24.99 ([App Store](https://apps.apple.com/us/app/life360-family-safety-gps/id384830320)).
- Citizen: 4.7 from 525K US ratings; claims 20M+ downloads ([about](https://citizen.com/about)).
- Noonlight: 16.6K US ratings; claims 3M+ to 4M+ people and 90+ partners ([site](https://www.noonlight.com/noonlight-app)).
- Birdie: claims over 3M customers ([campus page](https://shesbirdie.com/pages/campus-lp)).
- Consumer dispatch-grade pricing sits around $5 to $10/mo (Noonlight, aegis+). Citizen Protect is listed at $19.99.
- ADT retired standalone SoSecure in March 2026 and moved the feature into a $24.99+ home plan, per the [ADT My Safety post](https://news.adt.com/safety-trends/my-safety-trusted-protection-in-your-pocket) and an adt.com snippet.
- Many new entrants since 2025 have almost no ratings: Centinela, Raxha, Guardme, Walk With Me, Chaperone. Building this is now easy. Getting users is not.

Read: big apps aren't chasing passive detection. Small ones are, but haven't won users. Campus channels are held by Motorola/Rave products, and UNM chose UNM Safe in 2026.

## 6. A gap this research exposed in our own duress flow

**This matters more than the originality wording.** aegis+ says dispatch "is told not to call or text you back." In SafetySense:
- `alert/cancel` with `duress: true` calls the same `escalate()` as any alert (`backend/supabase/functions/api/index.ts`, about line 668).
- The Noonlight payload (about lines 317 to 325) has no duress signal.
- SPEC 6.3 and the Purpose document's Level 3 row say monitoring texts and calls the user.
- So in a coerced moment, the phone may ring right after the fake cancel, in front of the attacker. Everything the app hides on screen could be undone by that call.
- If dispatch already happened, `escalate()` returns early, so nothing tells Noonlight that this alarm is now duress.

We read the code. We did not run it against Noonlight or confirm what the sandbox does. We don't know whether Noonlight's API offers call suppression. aegis+ names Noonlight as its dispatcher, so it's worth asking them, though aegis+'s terms predate its 2.0 duress feature.

Next steps for George:
1. Ask Noonlight how to flag a duress alarm and suppress callbacks.
2. Until then, describe it honestly (items 3, 5 and 16 below). Another session owns the backend, so this report changed no code.

## 7. Statements that are wrong or risky, and replacement wording

The PDFs are rendered from the HTML, so re-run `submission/_assets/render.sh` after editing. The deck PDF and PPTX need a rebuild from `build_deck.js`. Stage 2 judges see only the deck and Q&A; the Stage 1 technical team sees the PDFs.

### Fix tonight: Purpose document

**1. Section heading, "What no other app combines." Risky.** The table covers four tools, but the heading covers every app.
Replace with: **How SafetySense compares with tools students already have**

Add under the table:
> This table covers four tools our students are likely to have. Other apps have individual pieces. Centinela has scream and safe-word detection and a duress PIN, but no dispatch. aegis+ has a duress PIN and professional dispatch, but no distress detection. Citizen documents sound-triggered calls to its agents. We reviewed more than 70 products and found none that documents all of these together: on-device distress detection, a no-response ladder through contacts to professional dispatch, a session heartbeat watchdog and a duress PIN. This comes from public documentation, not hands-on testing.

Add to Sources: "Competitor review, checked Nov 5, 2026: App Store listings, vendor sites, privacy policies and terms."

Change the Apple cell in "Alerts when the phone goes dark" from `Check In (may be delayed)` to `Check In (timing varies)`.

**2. "Phones get taken" card, "Most apps can't tell a dead phone from a quiet night." Unmeasured and risky.** Replace with:
> A timer-based app may not react until the timer runs out. If SafetySense's heartbeat stops mid-session, its server raises the alert itself, designed to reach contacts in about 3 to 4 minutes.

**3. Duress line, "silently goes to Level 3." Conflicts with Level 3, where monitoring calls the user.** Replace with:
> Duress PIN: it looks exactly like cancelling, but the alert stays live and moves to dispatch, for when someone forces the user to cancel. The screen shows nothing unusual. Open item: a production version must tell the monitoring center not to call the phone back.

**4. Purpose intro, "puts its effort into what's missing."** Replace with: "puts its effort into the moments those tools don't cover: proactive, on-device detection and a calm, trauma-informed escalation ladder that gets the right help without a tap."

### Fix tonight: Security document

**5. "someone looking over the user's shoulder sees nothing unusual."** True of the screen, not of a phone call. Add:
> Open item: the prototype doesn't yet tell the monitoring center that an alarm is a duress alarm, so a verification call could still reach the phone. Production needs a no-callback path.

### Fix before Nov 16: deck (`presentation/build/build_deck.js`)

| # | Line | Now | Replace with |
|---|---|---|---|
| 6 | 324 | "We built the basics. Then we built what's missing." | "We built the basics. Then we connected the parts that work when you can't." |
| 7 | 332 | Noonlight "Alexa (paid)" | "–" (discontinued in v2.17.3) |
| 8 | 328 | Apple "Check In, may be late" | "Check In, timing varies" |
| 9 | 352 | "The top four rows are the reason SafetySense exists..." | "Others have pieces: Centinela detects but doesn't dispatch; aegis+ dispatches but doesn't detect. We found no product that documents the full chain." |
| 10 | 359 | "No app we compared combines them, and they're exactly where a button fails." | "Other apps have pieces of this, and we'll name them. Centinela listens for a scream and has a duress PIN, but stops at your friends. aegis+ has dispatch, but you have to press the button. We found no product that connects all of it, and that chain is the point." |
| 11 | 193 | "Most safety apps we tested" | "Most safety apps we reviewed" (nothing was tested by hand) |
| 12 | 180, 195 | "Most apps can't tell a dead phone from a quiet night" | "A timer can't tell a dead phone from a quiet night until it runs out." |
| 13 | 273 note | "looks exactly like cancelling, but help still comes" | Fine as written. Don't add "silently" or "nobody will know." |

### Fix: Q&A and internal docs

**14. `presentation/QA_PREP.md` line 46, "No competitor we found does this." False.** Replace with:
> During a session the phone sends a heartbeat every 60 seconds. If heartbeats stop without a clean End session, the server raises the alert with the last known location, designed to reach contacts in about 3 to 4 minutes. Others have versions of this: Apple's Check In and timer apps like SafePulse alert from a server, and Centinela's server holds a running SOS countdown. Ours covers the whole session and feeds the same ladder that ends at dispatch.

**15. QA_PREP line 58. Three problems:** Noonlight's Alexa trigger is gone. "none of them raise a full alert within a minute of the phone going dark" implies we do, and our design takes about 3 to 4 minutes. "none of them have a fake cancel" is fine only for those named tools. Replace the end with:
> Noonlight is a hold-to-release button with paid crash detection. Check In can alert a contact if your phone goes offline, on timing Apple doesn't publish, and it stops there. None of these three has a fake cancel. Other apps do, such as aegis+ and Centinela.

**16. QA_PREP line 82.** Add: "If they ask whether the dispatcher calls the phone: yes, today it could, and that's the first thing to fix before production."

**17. QA_PREP line 114.** Replace the status with: "Re-checked Nov 5, 2026. Noonlight's Alexa link was discontinued; see docs/COMPETITOR_RESEARCH.md."

**18. QA_PREP "Things not to say."** Add:
- "No one else does this," "first," "only," or "novel" about any single feature.
- "We tested the competitors." We read their documentation.
- That Citizen sends your audio to the cloud. We don't know that.

**19. `docs/SPEC.md`.**
- Line 53, "This is the feature competitors don't have." Replace with: "Apple's Check In and some timer and lone-worker apps also alert from outside the phone. Ours is a continuous session heartbeat, designed for about 3 to 4 minutes, feeding the full ladder."
- Line 15, "Most competitors can't tell a dead phone from a quiet night (Apple's Check In is the partial exception...)." Replace with: "Timer-based apps can't tell a dead phone from a quiet night until the timer ends. Apple's Check In, Google's Safety Check, Centinela's server-held countdown and several lone-worker products have server-side versions of this."
- Line 127: Noonlight "✓ Timer" is unverified on phone. Mark it "Wear OS per listing."
- Line 129 and line 219: remove Alexa. Note the discontinuation.
- Line 133: add that SafeDate (2018) and Noonlight Timeline are precedents.

**20. `README.md` line 17 and `docs/safetysense-spec.html` line 213.** Use the wording in item 2.

**Still true, keep:** "Most safety apps rely on you pressing a button or running a timer" (most of the list above fits). "Neither listens for distress or has a duress PIN" about Check In and UNM Safe, as long as you mean the *current* UNM Safe. "Calls for help when you can't." It's close to Raxha's line, which is awkward but not wrong.

## 8. Answering "Doesn't X already do this?"

**The general answer, memorize this:**
> Yes, pieces of it exist, and we looked. Centinela detects a scream but stops at your friends. aegis+ reaches dispatch but you have to press the button. Apple notices a dead phone but tells one contact. We didn't invent any single feature. What we didn't find is one app that connects them, so a person who has frozen still gets a check-in, then her people, then a professional, without touching anything.

Say it calmly and name them first. Naming a rival before a judge does is the strongest thing you can do here.

| If they say | Answer |
|---|---|
| **Centinela** | "It's the closest app we found, and it's good. It has scream and phrase detection and a duress PIN. It says plainly it doesn't contact police. We add a professional step, and we keep evidence encrypted so our server can't read it." |
| **aegis+** | "Same duress idea, with real dispatch. It's started by a press, though. Ours starts from detection or silence. They also tell dispatch not to call back, which we need to match." |
| **Citizen** | "Citizen did audio-to-agent in 2021 and its Terms still describe it. We couldn't confirm it ships today. Our difference is your own people first, a fake cancel, and a dead-phone watchdog, none of which we found documented there." |
| **Apple Check In** | "Use it, it's great. It's free and already there. It tells one iPhone contact and stops. It doesn't listen for distress or reach a dispatcher, and it has no fake cancel." |
| **Noonlight** | "We use them. They're the dispatcher. They wait for you to press; we decide when to call them." |
| **UNM Safe** | "We link to it. It's for campus and needs you to act. We cover off-campus nights when you can't." |
| **LoboGuardian had a duress PIN** | "Yes, Rave had that, and lone-worker apps do too. It's proven practice. We're bringing it to a student's night out, wired to detection." |
| **Raxha or Epowar** | "Both are automatic and worth respecting, but need an Apple Watch. We work with just an iPhone." |
| **One Scream** | "It's the precedent, and we learned from it. A scream alone misses people, and it reported trouble with altered voices. That's why we also watch for non-response and don't rely on one signal." |
| **Isn't this not novel, then?** | "The novelty isn't a sensor. It's the design decision that the person in danger may do nothing, and the system still works: each step hands off to the next, and a false alarm stops at a quiet check-in." |
| **Why won't Apple or Centinela just add this?** | "They could. For the contest, we're showing the idea works end to end. As a business, our edge would be campus partnerships and advocate-reviewed design, not a feature lock. We don't have those partners yet." |
| **Does it work when someone's drugged?** | "We can't detect a drug, and voice detection may be weaker there. We rely on her stopping responding, which doesn't need her voice. We haven't field-tested this." |

## 9. Limits

- **Nothing was tested hands-on.** Marketing claims are treated as claims.
- **The search budget ran out** during verification, so late checks used direct fetches only. No market-size search ran. Coverage of iOS 27 is thin. A follow-up session can continue the search.
- **App Store dates often show no year.** Years marked 2026 are inferred from version history, app IDs or trackers.
- **Quotes passed through a page-summarizing fetch.** Check a quote against the live page before putting it in a submission. Centinela and aegis+ listing quotes were re-read on Nov 5.
- **Search rankings and storefronts vary.** A brand-new app could be missing, and more tiny entrants likely exist.
- **Sources disagreed** on Epowar audio, Aurora's store status, One Scream's status, Noonlight's timer, invisaWear pricing and Walk With Me pricing. Those are flagged above.

**Fastest way to close the biggest unknowns:** spend 30 minutes on an iPhone with Centinela, aegis+ and Citizen. Check whether Citizen still has the sound-triggered mode, whether Centinela's check-in timer fires with the phone in airplane mode, and whether aegis+ really dispatches at zero without opening an agent step. Re-check all three before Nov 20.
