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
- Info.plist is generated from `project.yml`, so put new keys there. Don't edit `SafetySense/Info.plist` by hand.
- **Known environment quirk (important for agents):** run from a Claude Code shell, `xcodebuild` hangs forever at `ExecuteExternalTool clang -v -E -dM`. The inherited environment makes SWBBuildService stop reading clang's output pipe, and the iOS Simulator MCP `build` tool hangs the same way. **Use `Tools/xcb.sh build|test`**, which runs xcodebuild under `env -i`, or prefix your own call with `env -i HOME=$HOME USER=$USER TMPDIR=$TMPDIR PATH=/usr/bin:/bin:/usr/sbin:/sbin`. In sandboxed shells it also needs the sandbox disabled. To use a different simulator, set `SS_DEST='platform=iOS Simulator,id=<udid>'`.

### Launch arguments (QA, screenshots, demo video)

| Argument | Effect |
|---|---|
| `-ssScreen <name>` | Opens straight to a screen with sample data, using demo services and an isolated in-memory store. Names: `onboarding home guard checkin countdown alert support vault contacts settings date ride walk fakeCall fakeCallIncoming fakeCallActive` (add `-ssFakeCallStyle slide` for the slide-to-answer variant) |
| `-ssDemo 1` | Demo services: no mic, no network, dispatch labelled "simulated" |
| `-ssSkipOnboarding 1` | Marks onboarding done. Seeds the sample profile and contacts if they're empty |
| `-ssReset 1` | Wipes persisted state at launch |

Example: `xcrun simctl launch booted com.georgeteifel.SafetySense -ssScreen checkin`

## Layout

```
app/
  project.yml                 XcodeGen spec (targets: SafetySense, SafetySenseWidgets, SafetySenseTests)
  Tools/generate_icons.swift  CoreGraphics icon generator (AppIcon + AppIconDiscreet)
  Shared/                     Compiled into BOTH app and widget extension
    AppGroup.swift              group id, UserDefaults keys, Keychain account names
    SharedCommand.swift         queue that intents/widgets write and the app drains
    SharedIntents.swift         TriggerAlertIntent, CheckInOkayIntent, CheckInNeedHelpIntent
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
Intents (Action Button / Control / Siri / Live Activity buttons) --> SharedCommandQueue --> AppModel.drainSharedCommands()
```

- **`AppModel`** (`@Observable @MainActor`) is the single UI state object. It holds `profile`, `contacts`, `settings`, `hasCompletedOnboarding`, `currentSession`, `currentAlert`, `selectedTab`, `banner` and `forcedScreen`. Every stored property persists through `SettingsStore` in `didSet`. It is injected with `.environment(model)`, and views read it with `@Environment(AppModel.self) private var model`.
- **`model.overlay`** (`none / guardActive / checkIn / alertCountdown / alertActive`) comes from `services.escalation.level` plus `currentSession`. `RootView` shows it in a single `fullScreenCover` (`OverlayHost`).
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
| `NotificationServiceProtocol` | `requestAuthorization`, `scheduleCheckIn(at:sessionID:)`, `cancelCheckIns`, `notify(title:body:timeSensitive:)` | `NoopNotificationService` |
| `HeartbeatServiceProtocol` | `start(serverSessionID:interval:)` (60 s), `stop`, `lastSentAt` | `NoopHeartbeatService` |

Ladder rules every escalation controller must keep (SPEC 6.3 and 15):
- A check-in gives the user 45 s, then the ladder moves to Alert.
- Alert runs 90 s with no valid cancel, then moves to Dispatch. A contact tapping "Send help" also moves it to Dispatch.
- Manual triggers start at `DispatchPolicySettings.startingLevel(for:in:)`. By default a manual SOS goes straight to Dispatch, and Night Out alerts contacts first.
- A duress PIN looks exactly like a cancel on screen, while the server escalates silently (`alert/cancel {duress:true}`).
- The AI second opinion can never be the only reason to escalate, and it can never block a manual SOS.
- A drill sends `dry_run: true`, contacts see TEST, and a drill never dispatches.

## Backend contract (Core/Backend/BackendDTOs.swift)

All routes are `POST <SSBackendBaseURL>/<route>`, where the base URL is an Info.plist key set in `project.yml`. Each request sends the headers `content-type: application/json` and `apikey: <SSBackendPublishableKey>`. Device routes also send `x-device-id` and `x-device-secret`. Errors come back as `{error}` with a 4xx or 5xx status and map to `BackendError.http`.

Swift DTOs use camelCase. Always encode and decode with `BackendCoding.makeEncoder()` and `makeDecoder()`, which convert to and from snake_case. `BackendContractTests` pins the exact wire keys. Timestamps stay `String`; parse them with `BackendCoding.date(from:)`, which handles Postgres microseconds.

| Route | Request DTO | Response DTO |
|---|---|---|
| `register` | `RegisterRequest` | `RegisterResponse` (= `DeviceCredentials`) |
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
