# SafetySense iOS: architecture

`docs/SPEC.md` is the product spec, and it takes precedence over this file. This file says where code lives, who owns which file, and what the modules agree on.

## Build and run

```sh
cd app
xcodegen generate                       # SafetySense.xcodeproj is gitignored. Rerun after adding files.
xcodebuild -project SafetySense.xcodeproj -scheme SafetySense \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build      # app + widget extension
xcodebuild ... test                                                    # SafetySenseTests (Swift Testing)
swift Tools/generate_icons.swift SafetySense/Resources/Assets.xcassets # regenerate the app icons
```

- iOS 26.0+, Swift 6 language mode, `SWIFT_STRICT_CONCURRENCY=complete`. Builds have zero warnings, and they should stay that way.
- Simulator builds sign ad hoc (`CODE_SIGN_IDENTITY[sdk=iphonesimulator*] = "-"`). For a device build (the iPhone 16e), George sets `DEVELOPMENT_TEAM`.
- Bundle IDs: `com.georgeteifel.SafetySense`, `.Widgets` and `com.georgeteifel.SafetySenseTests`. App Group: `group.com.georgeteifel.SafetySense`.
- **Debug vs Release signing:** Debug uses the entitlements `project.yml` generates (App Group, time-sensitive, keychain groups). Release uses `SafetySense/TestFlight.entitlements` and `SafetySenseWidgets/TestFlight.entitlements`, which `Tools/testflight.sh` patches in after `xcodegen generate`, because only Josh can enable portal capabilities. **A Release entitlement must go in the TestFlight files; adding it to `project.yml` alone does nothing.** Today those files hold only `keychain-access-groups`, which needs no portal change.
- **TestFlight builds** use `Tools/testflight.sh`. The build number defaults to a timestamp, or set `SS_BUILD`; it must increase or the upload is rejected. Never submit for App Review, release, or add external testers.
- **Release builds have no developer surface:** `DeveloperSettingsView`, its Settings row, every `-ss` launch argument and the QA PIN 2580 are Debug-only, and `allowRealCalls` is always false, so every alert and session goes out `dry_run`.
- Info.plist is generated from `project.yml`, so put new keys there. Don't edit `SafetySense/Info.plist` by hand.
- **Known environment quirk (important for agents):** run from a Claude Code shell, `xcodebuild` hangs forever at `ExecuteExternalTool clang -v -E -dM`. The inherited environment makes SWBBuildService stop reading clang's output pipe, and the iOS Simulator MCP `build` tool hangs the same way. **Use `Tools/xcb.sh build|test`**, which runs xcodebuild under `env -i`, or prefix your own call with `env -i HOME=$HOME USER=$USER TMPDIR=$TMPDIR PATH=/usr/bin:/bin:/usr/sbin:/sbin`. In sandboxed shells it also needs the sandbox disabled. To use a different simulator, set `SS_DEST='platform=iOS Simulator,id=<udid>'`.

### Launch arguments (QA, screenshots, demo video; Debug builds only)

| Argument | Effect |
|---|---|
| `-ssScreen <name>` | Opens straight to a screen with sample data, using demo services and an isolated in-memory store. Names: `onboarding home guard checkin countdown alert markedsafe contactpreview support vault contacts settings date ride walk fakeCall fakeCallIncoming fakeCallActive` (add `-ssFakeCallStyle slide` for the slide-to-answer variant) |
| `-ssGuardMode <mode>` | The sample Guard's mode (`night_out walk date ride`) for `guard`, `checkin`, `countdown`, `alert` and `markedsafe` |
| `-ssPreDispatch` | `markedsafe` shows the state for an alert stopped before dispatch |
| `-ssNoPIN` | Alert screens show the no-PIN fallback (Face ID or passcode) |
| `-ssDemo 1` | Demo services: no mic, no network, dispatch labelled "simulated". An alert saves clips to the Vault every 30 s, and with `-ssCleanShots 1` the first contact's call goes on to "Answered" (without it the row reads "Test · not sent") |
| `-ssSkipOnboarding 1` | Marks onboarding done. Seeds the sample profile and contacts if they're empty |
| `-ssReset 1` | Wipes persisted state at launch |
| `-ssCleanShots 1` | Real alert wording and no test banner, for screenshots that have to match the design |

Example: `xcrun simctl launch booted com.georgeteifel.SafetySense -ssScreen checkin`

## Layout

```
app/
  project.yml                 XcodeGen spec (targets: SafetySense, SafetySenseWidgets, SafetySenseTests)
  Tools/generate_icons.swift  CoreGraphics icon generator (AppIcon + AppIconDiscreet)
  Shared/                     Compiled into BOTH app and widget extension
    AppGroup.swift              group id, `AppGroup.defaults` (the app's own store), keys, Keychain account names
    SharedStore.swift           what the app and widget really share: App Group or Keychain group
    SharedCommand.swift         one-item-per-command queue, Darwin signal, in-process bridge
    SharedIntents.swift         TriggerAlertIntent, CheckInOkayIntent, CheckInNeedHelpIntent, SetGuardIntent
    DeepLink.swift              safetysense:// routes (home, checkin, alert, support, vault)
    GuardActivityAttributes.swift  Live Activity payload
    BrandPalette.swift          raw brand colors + Color(hex:)
  SafetySense/
    App/          SafetySenseApp (@main), RootView/OverlayHost, MainTabView, LaunchOptions, ScreenRouter
    DesignSystem/ Colors (SSColor), Typography (SSFont), Spacing (SSSpacing/SSRadius), Components/
    Models/       Codable + Sendable value types (+ SampleData)
    Core/         AppModel, ServiceContainer, SettingsStore, KeychainStore, Protocols/, Backend/BackendDTOs
    Services/     Real service implementations (empty now) + Mocks/
    Features/     Onboarding, Home, Guard, Alert, Support, Vault, Contacts, Settings, Modes, FakeCall
    Intents/      AppShortcutsProvider (Siri / Action Button phrases)
    Resources/    Assets.xcassets (AppIcon, AppIconDiscreet, AccentColor, LaunchBackground)
  SafetySenseWidgets/  WidgetBundle, GuardLiveActivity, SOSControlWidget
  SafetySenseTests/    Swift Testing suites
```

XcodeGen picks up sources by glob, so a new file only needs to be in the right folder. Rerun `xcodegen generate` after adding one.

## Runtime shape

```
Sensors (audio / motion / location) --onSignal--> RiskEngine.ingest --RiskAssessment--> EscalationController.handle
       ^ started/stopped by AppModel.startGuard/endGuard                                   | onChange(level, alert)
                                                                                          v
                                 AppModel.currentAlert  ->  RootView overlay  +  LiveActivity.update  +  widget mirror
EscalationController --> BackendClient (alert/create, escalate, cancel) --> Twilio calls/SMS, Noonlight sandbox or "simulated"
Intents (Action Button / Control / Siri / Live Activity buttons) --> SystemBridge in the app process, or SharedCommandQueue + Darwin signal --> AppModel.drainSharedCommands()
```

### Storage and sharing

- **`AppGroup.defaults`** is the app's own store: profile, contacts, settings, session, alert. It is the group suite when `containerURL(forSecurityApplicationGroupIdentifier:)` is non-nil, otherwise `.standard`. Never use `UserDefaults(suiteName:)` as an availability check: it succeeds without the entitlement and gives each process a private plist.
- **`SharedStore`** is for what the widget extension must see, and only that: queued commands and the widget mirrors (`WidgetMirror`). No contact details or secrets. It uses group defaults when the container exists, otherwise Keychain items in `<team>.com.georgeteifel.SafetySense.shared`.
- **`SharedCommandQueue`** writes each command as its own item, so enqueue is one atomic write and processes can't overwrite each other. Commands expire (`Kind.maxQueuedAge`), so an old SOS never fires when the app next opens.
- **Keychain order matters.** The first `keychain-access-groups` entry is the default for every `SecItemAdd`. The app's private group stays first, so PIN hashes, safe word, device secret and evidence key never land in the shared group. `SharedStoreTests` pins this in all four entitlement files.
- **`StorageMigration.run()`** runs first at launch, on every launch. It moves the old private-suite plist into the current store, and `.standard` into the group the day the App Group is enabled, so nobody returns to onboarding. A key moves only if the destination lacks it.

### Background launches

An intent or a BGTask can launch the app with no scene, so `AppModel.onLaunch()` runs from `SafetySenseApp.init`, not a view's `.task`. It restores the session and adopts any alert that was running. Every alert starts `LocationGuard.startAlertTracking()`, classic updates that can start in the background under Always and keep the process alive for the alert's loops. A `LiveActivityIntent` (`StartAlertIntent`, `TriggerAlertIntent`) may start a Live Activity from the background; anything else retries in `AppModel.appBecameActive()`, which also resumes the mic and evidence stream.

Alert intents run in the app's process with no unlock. "I'm okay" asks for authentication on every surface (Live Activity, notification, Siri), so someone else holding the phone can't answer for you. "Need help" is never gated. Deep links only navigate, because any app can open one.

### Reaching the server

Nothing that matters may be lost to a dead zone or a killed process.

- **`alert/create`:** `EscalationController` owns it, because the answer drives the screen. Each alert goes in `PendingAlertStore` (Keychain, since an entry can be a hidden duress alert) and retries every `serverRetryInterval`, on network return and at launch, for two hours. `clientAlertId` is the local alert id, so the server can return the same alert instead of calling everyone again. A valid cancel just drops an alert that can't have landed. For one that may have, `alert/create` never goes again: the phone sends `alert/cancel` with its own id (a 404 means it never landed), then repeats `session/end`, because a create that landed after the end leaves the session open to the watchdog. A 400 sends the alert again without location and battery, so a bad value can't lose it. `AlertContext.forServer` cleans those values first. The one gap: if the server folded the create into a live alert on the session, that alert has a different id, so the cancel gets a 404 and leaves it running.
- **`alert/cancel`, `session/end`:** `HTTPBackendClient` queues them in `BackendOutbox` (48 h) and retries on a timer, on network return and from the BG refresh. A lost one would let the watchdog act on something the person already closed. Until a cancel lands, or if the alert had no server id when the PIN went in, Marked safe says contacts may not know. A build that contacts nobody says that instead.
- **`session/start`:** `AppModel.retrySessionLink` until it lands or the session ends. An answer that arrives after the end is closed on the server.
- **`register` / `contacts/set`:** `AppModel.syncRegistration` retries with backoff and re-registers on a 401. A nameless profile registers as `Profile.unnamed`, and a phone the server refuses is dropped rather than blocking registration. Home asks for a missing phone.
- **Relaunch:** `onLaunch` adopts the persisted alert, restores pending ones, then polls `alert/status`. An adopted countdown keeps its real deadline (at least 3 s, so the poll can reconcile first).
- **Watchdog alerts:** `session/heartbeat` returns the session's live alert, never a duress one, and `adoptServerAlert` puts it on screen. `closedServerAlertIDs` stops a closed alert or drill coming back, and a server id that matches a local alert id is never adopted, so a hidden alert can't surface.
- **Hidden duress alerts:** a duress PIN with nothing to cancel (End Guard, or a check-in) calls `EscalationController.startHiddenDuressAlert`. If one is already running it only renews the window: help is already going and a second alert would take the recording's mic stream. Otherwise it goes through `PendingAlertStore` like any alert. It's created at level 2 with `contacts_first`, then `alert/cancel {duress:true}` sets the server flag and escalates, because dispatch only hears about coercion on a new alarm. If that cancel never lands, the server's countdown still reaches dispatch. While one runs, `AppModel.showsRecording` is false, and Marked safe uses a clip count taken once, so the Vault can't expose the duress PIN.
- **Duress records:** `DuressRecordStore` keeps each duress alert in the Keychain, so it outlives a relaunch and has no end date. `vaultClips` leaves out any clip of that alert that runs past the PIN, for good, until the person taps "Check for more clips" in the Vault and enters the safety PIN. The duress PIN there reads the same and brings nothing back. "Delete all evidence" stops at what's listed, because `deleteAll` also drops the key. "Delete everything" clears the records. `AlertActiveView` doesn't offer "Share link" for 48 hours after a duress PIN, because the server folds a later alert into the duress one and its link is the same page. The link the phone gets carries a `-p` mark, and the server answers it like a normal cancel once duress is set (`backend/README.md`).
- **One capture at a time:** `EvidenceHandoff` never moves the stream off a live capture, and ending an alert ends only its own stream. An alert that starts during a duress capture shares it, then commits its own when the window ends. When the window ends, `AppModel.duressWindowEnded` stops only what no alert or session still needs.
- **PIN reset:** "Forgot your PIN?" needs only Face ID or a passcode, so while clips are hidden `AppModel.clearForgottenPINs` parks the old safety PIN. A PIN set afterward brings nothing back.
- **Duress across a relaunch:** `restorePendingAlerts` also resumes location and evidence for a `DuressRecord` still inside `duressTrackingDuration`, on its original deadline, with nothing on screen. `appBecameActive` reopens the mic for it.
- **Forced "Delete everything":** the duress PIN there calls `AppModel.eraseUnderDuress`. The app returns to onboarding as usual, but a hidden alert goes out, nothing is erased on the server, and the evidence, its key and the device credentials stay. Every earlier clip leaves the Vault (`DuressRecord.hidesClipsBefore`). The old safety PIN is parked in the Keychain and is the only PIN that brings them back.
- **Listening:** `appBecameActive` starts the mic again for a listening session whose mic isn't running, since `resumeIfNeeded` only restarts one that was.
- **Evidence after a cancel:** only the ladder starts capture: `createOnServer` commits only while the alert is live or under duress, and `EvidenceHandoff` remembers stopped alerts and rechecks after each await. `ensureEvidenceCapture` only reopens the mic, except on the demo ladder. Any alert opens the mic, even with listening off; `AppModel.alertStateChanged` closes it again when the session wasn't listening.
- **No Guard over an alert:** `startGuard` and `begin` refuse while `activeAlert` is set, which covers Shortcuts, the Control and a fake call's Walk guard.
- **Evidence:** `uploadPending` drains until nothing can go, and retries on a backing-off timer, at launch, on network return and from the BG refresh. The key is on this iPhone only, so a server copy proves what was recorded but can't be played without it. The Vault says so.
- **Staying alive:** `LocationGuard` runs coarse classic updates with pausing off for the whole session. Live updates pause when you stand still, and with no mic the heartbeat would then stop. With location off and the mic not running, nothing keeps the app awake behind a locked screen, so `session/start` asks for the longest `grace_s` (3600) and the Guard screen says so (`GuardPermissionIssue.noBackgroundRun`). `grace_s` is fixed at `session/start`, so a mic that dies later in a location-off session still has the short one.
- **Call progress:** `alert/create` only says a call was placed. `pollStatus` runs each `call_status` event through `CallProgress`, which moves the call row (ringing, answered, call ended, couldn't reach). A contact's response stays on top, and a late callback never moves a call backward.
- **Ending a session in a dead zone:** `session/end` closes a live non-duress `heartbeat_lost` alert on that session, because the phone stopped sending heartbeats and could never see it.
- **Secrets at rest:** `SettingsStore` keeps `GuardSession.SensitiveDetails` in the Keychain and the rest of the session in defaults. `FreshInstall` clears Keychain leftovers on a reinstall. An erase that can't reach the server keeps its credentials only to finish `account/delete`.
- **`BGTaskScheduler.submit` raises an uncatchable exception for an unregistered identifier,** so `scheduleAppRefresh` does nothing unless the live flavor registered it.

Contacts see `AlertRecord.contactReason` (`AlertReasonText`, e.g. `Missed check-in during Night Out`), and the person sees `reason`. SMS and the voice call read it aloud, so keep it plain. The first contact gets a call and everyone gets a text. The contact list order is the call order, primary first.

### Saying what's really happening

**`AlertDelivery`** (`model.alertDelivery`) says whether an alert from this build reaches anyone: `.real`, `.test` (live server, `dry_run`, always in Release) or `.demo` (mocks). Any words that promise help come from it: the countdown, Alert active, VoiceOver, the Live Activity (`GuardActivityAttributes.testNote`), `StartAlertIntent`'s dialog, everything that describes the duress PIN, and the Settings footers about who hears first. `.testModeBanner()` pins the banner on Home, Guard, the countdown and Alert active. Don't hard-code "help is on the way" anywhere else. "Help is on the way" itself needs proof: until `AlertPresentation.dispatchConfirmed` (server id, a dispatch answer, no connection note), Alert active, the Live Activity, VoiceOver and the PIN prompts use the `confirmed: false` wording, which points to 911. `PINEntrySheet` has no default `forgotMessage`, so each caller says what's true there. `ImOkayIntent.reply` only sounds settled at a check-in.

### Notifications

**`NotificationUrgency`** (Shared) is the only place that picks an interruption level: `.timeSensitive` only when iOS reports `.enabled`, otherwise `.active`. Copy that promises a Focus breakthrough checks `NotificationUrgency.isSupported` or `GuardPermissions.timeSensitive`. A status notification (contact responded, server unreachable) goes out only when the app isn't active, since the app shows the same thing on screen. Night Out's hourly drink check is a quiet reminder that never touches the ladder.

**Check-ins:** Night Out and Date repeat every 20 minutes, changeable in Settings. Walk and Ride have no repeating check-in, only the arrival check and stop detection. A Walk or Ride started without its setup screen uses `GuardMode.defaultArrivalCheck`. `session/start` accepts 15 to 3600 s, so send `GuardSession.serverCheckInInterval`, never the raw interval.

- **`AppModel`** (`@Observable @MainActor`) is the single UI state object. It holds `profile`, `contacts`, `settings`, `hasCompletedOnboarding`, `currentSession`, `currentAlert`, `selectedTab`, `banner` and `forcedScreen`. Every stored property persists through `SettingsStore` in `didSet`. It is injected with `.environment(model)`, and views read it with `@Environment(AppModel.self) private var model`.
- **`model.overlay`** (`none / guardActive / checkIn / alertCountdown / alertActive / markedSafe`) comes from `services.escalation.level`, `currentSession` and `markedSafe`. `RootView` shows it in a single `fullScreenCover` (`OverlayHost`).
- **`ServiceContainer`** handles dependency injection. `.demo()` returns all mocks. `.live()` is the production wiring: each module swaps in its real class at the marked slot, and every slot falls back to a mock until then. Use `services.flavor == .demo` to show demo-only controls, such as "simulate scream".
- **Fake call (SPEC 7.7)** lives in `Features/FakeCall/`. `AppModel.fakeCall` (`FakeCallScheduler`) runs idle → scheduled → ringing → in call. A timer and a time-sensitive local notification (`FakeCallNotifier`, synthesized ringtone in `Library/Sounds`) are both set, and `appBecameActive()` catches up if iOS suspended the app. `FakeCallPresenter` shows the call in its own `UIWindow` above every cover and sheet. `FakeCallAudio` plays the ring and vibration, and speaks the script with `AVSpeechSynthesizer`; it leaves a Guard `.playAndRecord` session alone so the mic keeps running. Answering can start a Walk Home guard. `FakeCallIntent` ("SafetySense fake call") queues a `.fakeCall` shared command. It never contacts anyone or touches the ladder.
- **`SettingsStore`** writes JSON to App Group `UserDefaults` for non-secret data. Secrets go through the `SecretStore` protocol: the Keychain in the app and `InMemorySecretStore` in tests and QA. PINs are stored only as salted SHA-256 hashes. `verifyPIN` checks the duress PIN first and returns `.valid`, `.duress` or `.invalid`.

## Protocols (Core/Protocols)

Every service except the backend is `@MainActor`, an `AnyObject`, and reports through callbacks (`onSignal`, `onFix`, `onChange`). The backend is a `Sendable` protocol with `async throws` methods; its real implementation should be an `actor`.

| Protocol | Contract highlights | Mock |
|---|---|---|
| `AudioGuardService` | `start(mode:safeWord:)`, `stop()`, `onSignal`, `snapshotRecentAudio()` (30 s RAM buffer), `recentTranscript()` | `MockAudioGuardService.simulate(_:)` |
| `MotionGuardService` | `start(mode:)`, `stop()`, `onSignal` | `MockMotionGuardService` |
| `LocationService` | `authorization`, `lastFix`, `onFix`, `onSignal`, `start(mode:destination:)`, `currentFix()` | `MockLocationService` (UNM campus) |
| `DeviceStatusProviding` | `batteryLevel` | `MockDeviceStatus` |
| `RiskEngineProtocol` | `configure(mode:sensitivity:)`, `ingest(_:at:)`, `evaluate(at:)`, `applySecondOpinion`, `reset()`, deterministic and explainable | `MockRiskEngine` (decaying sum) |
| `SecondOpinionProtocol` | `isAvailable`, `evaluate(transcript:signals:mode:) -> SecondOpinion?`, adjustment clamped to ±0.25 | `MockSecondOpinion` (unavailable) |
| `EscalationControllerProtocol` | **Must be `@Observable`.** `level`, `activeAlert`, `stepDeadline`, `onChange`, `begin`, `handle(assessment)`, `scheduledCheckInDue`, `respondToCheckIn`, `triggerManual`, `contactRequestedHelp`, `cancel(with: PINVerification)`, `startDrill`, `end` | `MockEscalationController`, which runs the full ladder with real timers (`timeScale` speeds it up) |
| `BackendClientProtocol` | 1:1 with the API (below) plus `setCredentials` and `isConfigured` | `MockBackendClient` (actor, records `calls`) |
| `EvidenceVaultProtocol` | `startCapture(alertID:serverAlertID:prebuffer:)`, `stopCapture`, `unlock(reason:)` (Face ID), `decrypt`, `delete`, `deleteAll` | `MockEvidenceVault` |
| `LiveActivityControllerProtocol` | `start(session:)`, `update(level:statusText:nextCheckInAt:deadline:)`, `end()` | `NoopLiveActivityController` |
| `NotificationServiceProtocol` | `requestAuthorization`, `scheduleCheckIn(at:sessionID:)`, `cancelCheckIns`, `notify(title:body:timeSensitive:)`, `scheduleDrinkChecks`, `cancelDrinkChecks` | `NoopNotificationService` |
| `HeartbeatServiceProtocol` | `start(serverSessionID:interval:)` (60 s), `stop`, `lastSentAt` | `NoopHeartbeatService` |

Ladder rules every escalation controller must keep (SPEC 6.3 and 15):
- A check-in gives the user 45 s, then the ladder moves to Alert.
- Alert runs 90 s with no valid cancel, then moves to Dispatch. A contact tapping "Send help" also moves it to Dispatch.
- Manual triggers start at `DispatchPolicySettings.startingLevel(for:in:)`. By default a manual SOS goes straight to Dispatch, and Night Out alerts contacts first.
- "I need help" at a check-in starts where a missed check-in would (the mode's policy), so the countdown, "Send help now" and the PIN all stay available. Hold-to-SOS keeps its dispatch-first default.
- A cancel only moves the ladder back to Guarding. `AppModel.cancelAlert` then ends the session and shows Marked safe, from the countdown and from Alert Active alike, using a `MarkedSafeSummary` taken before the ladder clears the alert. Everything on that screen must read the same for both PINs.
- On a Walk or Ride, an `unexpectedStop` signal raises a check-in whatever the score and sensitivity, because those modes have no repeating check-in. It leaves the arrival check where it was.
- A duress PIN looks exactly like a cancel on screen, while the server escalates silently (`alert/cancel {duress:true}`).
- The AI second opinion can never be the only reason to escalate, and it can never block a manual SOS.
- A drill sends `dry_run: true`: the server records a TEST alert, nobody is called or texted, and a drill never dispatches.

## Backend contract (Core/Backend/BackendDTOs.swift)

All routes are `POST <SSBackendBaseURL>/<route>`, where the base URL is an Info.plist key set in `project.yml`. Each request sends the headers `content-type: application/json` and `apikey: <SSBackendPublishableKey>`. Device routes also send `x-device-id` and `x-device-secret`. Errors come back as `{error}` with a 4xx or 5xx status and map to `BackendError.http`.

Swift DTOs use camelCase. Always encode and decode with `BackendCoding.makeEncoder()` and `makeDecoder()`, which convert to and from snake_case. `BackendContractTests` pins the exact wire keys. Timestamps stay `String`; parse them with `BackendCoding.date(from:)`, which handles Postgres microseconds.

| Route | Request DTO | Response DTO |
|---|---|---|
| `register` | `RegisterRequest` | `RegisterResponse` (= `DeviceCredentials`) |
| `profile/update` | `ProfileUpdateRequest` | `OKResponse` (404 until the function is redeployed, and ignored) |
| `contacts/set` | `ContactsSetRequest` | `OKResponse` |
| `session/start` | `SessionStartRequest` | `SessionStartResponse` |
| `session/heartbeat` | `HeartbeatRequest` | `HeartbeatResponse` |
| `session/end` | `SessionEndRequest` | `OKResponse` |
| `alert/create` | `AlertCreateRequest` | `AlertCreateResponse` |
| `alert/escalate` | `AlertEscalateRequest` | `AlertEscalateResponse` (`DispatchDTO.model`) |
| `alert/cancel` | `AlertCancelRequest` | `AlertCancelResponse` |
| `alert/location` | `AlertLocationRequest` | `OKResponse` |
| `alert/status` | `AlertStatusRequest` | `AlertStatusResponse` |
| `evidence/upload` | `EvidenceUploadRequest` | `OKResponse` |
| `account/delete` | `EmptyRequest` | `AccountDeleteResponse` (called by `AppModel.eraseEverything()`) |
| `share/get` (public) | `ShareGetRequest` | `ShareGetResponse` |
| `share/action` (public) | `ShareActionRequest` | `OKResponse` |

Enum raw values match the API spelling: `GuardMode` (`night_out`), `AlertTrigger` (`manual_sos`), `DispatchPolicy` (`contacts_first`), `ShareAction`, `NotifyChannel` and `DispatchProvider` (`noonlight_sandbox` / `simulated`). When the provider is `simulated`, the UI must say so (`DispatchInfo.displayStatus`).

## File ownership for the next phase

The modules below run in parallel, and each one edits only the files it owns. To change a **shared contract file** (`Core/Protocols/*`, `Core/Backend/BackendDTOs.swift`, `Models/*`, `Core/AppModel.swift`, `Core/ServiceContainer.swift`, `Shared/*`), make additive changes only: add new members and give them default implementations in a protocol extension, so the other modules still compile. Never rename an existing member. Every module may edit its own slot line in `ServiceContainer.live()`.

| Module | Owns (create or replace) |
|---|---|
| **A. Onboarding + Contacts + Settings** | `Features/Onboarding/**`, `Features/Contacts/**`, `Features/Settings/**`. It may add `Services/ContactsPicker*.swift` and `Services/IconSwitcher.swift` (alternate icon `AppIconDiscreet`). It uses `SettingsStore` PIN and safe-word APIs and `AppModel.completeOnboarding/syncRegistration`. |
| **B. Guard engine** | `Services/Audio/**` (SoundAnalysis + SpeechAnalyzer + 30 s ring buffer), `Services/Motion/**`, `Services/Location/**`, `Services/Risk/**` (RiskEngine + EscalationController), `Services/SecondOpinion/**` (FoundationModels), `Services/Evidence/**` (CryptoKit vault). It wires the slots in `ServiceContainer.live()` and adds tests under `SafetySenseTests/Engine*`. |
| **C. Screens** | `Features/Home/**`, `Features/Guard/**` (GuardActiveView, CheckInView), `Features/Alert/**` (AlertCountdownView, AlertActiveView), `Features/Support/**`, `Features/Vault/**`, `Features/Modes/**` (DateModeSetupView, RideModeSetupView), plus new components under `DesignSystem/Components/` (additive). It keeps the file and type names, because `ScreenRouter`, `RootView` and `MainTabView` reference them. |
| **D. System integration** | `Services/Backend/**` (HTTPBackendClient actor), `Services/System/**` (LiveActivityController, NotificationService, HeartbeatService, DeviceStatus/battery, BGTasks), `Intents/**`, `SafetySenseWidgets/**`, `Shared/SharedIntents.swift`, and the `SSBackendPublishableKey` / `SSShareBaseURL` values in `project.yml`. |

The coordinator owns `project.yml` structure, `App/**` and this file. A module that needs a new Info.plist key, entitlement or framework asks the coordinator in its summary.

## Conventions

- **Concurrency:** UI and services are `@MainActor`. Models are `Sendable` value types. Use `Task {}` from the main actor and don't use `DispatchQueue.main`. Mark an `@Observable` class's non-UI fields `@ObservationIgnored`.
- **Design:** use `SSColor`, `SSFont`, `SSSpacing` and `SSRadius` instead of literal colors or fonts, and use the components (`PrimaryButton`, `Card`, `Chip`, `RingTimer`, `PINPad`, `StatusPill`, `SectionHeader`). The app is dark-only. Tap targets are at least 44 pt (primary buttons are 56 pt). Use `.ssScreen()` for screen gutters and background, and `.ssEyebrow()` for mono uppercase labels.
- **Copy:** trauma-informed, calm, plain and never blaming. SafetySense **supplements 911 and never replaces it**. Don't promise to detect drugging. Add a hotline number only after it is verified (see `docs/OPEN_QUESTIONS.md`).
- **Privacy:** audio stays in RAM until Alert. Evidence is AES-GCM ciphertext only. Don't add analytics or ad SDKs. Never log secrets, PINs, transcripts or exact locations.
- **Real-world side effects:** tests and `-ssDemo` never call the network. Real Twilio calls go only to Twilio-verified numbers, and only when a task explicitly allows them. Dispatch uses the Noonlight sandbox or "simulated", never live 911.
- **Previews:** every view has a `#Preview` that uses `AppModel.preview(screen:)`.
- **Tests:** use Swift Testing (`import Testing`, `@Test`, `#expect`), with `SettingsStore.ephemeral()` and `ServiceContainer.demo()`.
