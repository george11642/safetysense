import Foundation
import Observation
import UIKit

enum MainTab: String, CaseIterable, Identifiable, Sendable {
    case home, contacts, vault, support, settings
    var id: String { rawValue }

    var title: String {
        switch self {
        case .home: "Home"
        case .contacts: "Contacts"
        case .vault: "Vault"
        case .support: "Support"
        case .settings: "Settings"
        }
    }

    var systemImage: String {
        switch self {
        case .home: "shield.lefthalf.filled"
        case .contacts: "person.2"
        case .vault: "lock.doc"
        case .support: "heart.text.square"
        case .settings: "gearshape"
        }
    }
}

/// A Walk Home destination. `fix` is nil when it couldn't be found on the map.
struct GuardDestination: Sendable, Equatable {
    var name: String
    var fix: LocationFix?
}

/// Whether the on-device speech model for the safe word is installed.
enum SpeechReadiness: Sendable, Equatable { case unknown, downloading, ready, unavailable }

/// Which full-screen experience sits on top of the tabs, derived from session + escalation state.
enum GuardOverlay: Equatable, Sendable {
    case none, guardActive, checkIn, alertCountdown, alertActive, markedSafe
}

/// Single source of truth for UI state. Inject with `.environment(model)`;
/// read with `@Environment(AppModel.self) private var model`.
@Observable
@MainActor
final class AppModel {
    let services: ServiceContainer
    let launch: LaunchOptions
    @ObservationIgnored let store: SettingsStore
    /// Fake call (SPEC 7.7). Silent in unit tests and QA screens.
    let fakeCall: FakeCallScheduler

    var profile: Profile? { didSet { store.profile = profile } }
    var contacts: [TrustedContact] { didSet { store.contacts = contacts } }
    var settings: AppSettings { didSet { store.settings = settings } }
    var hasCompletedOnboarding: Bool { didSet { store.onboardingComplete = hasCompletedOnboarding } }
    var currentSession: GuardSession? { didSet { store.currentSession = currentSession } }
    var currentAlert: AlertRecord? { didSet { store.currentAlert = currentAlert } }
    var lastDrill: AlertRecord?
    var selectedTab: MainTab = .home
    /// Set by `-ssScreen` to pin a screen for QA screenshots.
    var forcedScreen: AppScreen?
    /// User-facing, non-alarming error text (e.g. "Couldn't reach the server; your contacts will still be called").
    var banner: String?
    /// Scripted demo signals (`-ssScenario`, Developer Settings). Observable for a caption overlay.
    var scenarioPlayer: DemoScenarioPlayer?
    /// The microphone's real state during a session (nil when it isn't in use).
    var listening: ListeningState?
    /// The session's destination has been reached: Guard offers to end.
    var hasArrived = false
    /// Whether the on-device speech model is ready for the safe word.
    var speechReadiness: SpeechReadiness = .unknown
    /// Set the moment a PIN stops an alert. Both PINs land here, on the same screen.
    var markedSafe: MarkedSafeSummary?
    /// The one top toast ("Checked in", a contact's response).
    var toast: AppToast?
    /// What iOS allows right now. Refreshed on launch, on return to the app and at Start Guard.
    var permissions = GuardPermissions()
    /// Walk Home: open the heads-up text over the Guard screen.
    var wantsHeadsUp = false
    @ObservationIgnored private var commandObserver: (any NSObjectProtocol)?
    @ObservationIgnored private var didLaunch = false
    @ObservationIgnored private var lastLevel: EscalationLevel = .guarding
    @ObservationIgnored private var responseAlertID: UUID?
    @ObservationIgnored private var seenResponses: Set<String> = []
    @ObservationIgnored private var launchFinished = false
    @ObservationIgnored private var pendingLink: DeepLink?
    /// Keeps Live Activity calls in order, since each one awaits ActivityKit.
    @ObservationIgnored private var activityWork: Task<Void, Never>?

    init(services: ServiceContainer, store: SettingsStore, launch: LaunchOptions = LaunchOptions()) {
        self.services = services
        self.store = store
        self.launch = launch
        self.profile = store.profile
        self.contacts = store.contacts
        self.settings = store.settings
        self.hasCompletedOnboarding = store.onboardingComplete
        self.currentSession = store.currentSession
        self.currentAlert = store.currentAlert
        let quiet = launch.screen != nil || LaunchOptions.isUnitTestHost
        self.fakeCall = quiet ? FakeCallScheduler()
                              : FakeCallScheduler(effects: FakeCallAudio(), notifier: FakeCallNotifier())
        wireServices()
        if let mode = HomeView.launchMode { settings.lastHomeMode = mode }
    }

    // MARK: Derived state

    var escalationLevel: EscalationLevel { services.escalation.level }
    var isGuarding: Bool { currentSession != nil }

    var overlay: GuardOverlay {
        switch services.escalation.level {
        case .checkIn: return .checkIn
        case .alert: return .alertCountdown
        case .dispatch: return .alertActive
        case .guarding:
            if markedSafe != nil { return .markedSafe }
            return currentSession == nil ? .none : .guardActive
        }
    }

    /// The mode Home shows. It survives a relaunch and follows a Guard started from a Shortcut.
    var homeMode: GuardMode {
        get { settings.lastHomeMode ?? .nightOut }
        set { settings.lastHomeMode = newValue }
    }

    /// Whether a Guard in this mode would use the microphone.
    func listens(in mode: GuardMode) -> Bool {
        mode == .walk ? settings.listenDuringWalk : mode.listensByDefault
    }

    /// Permissions the running session needs that are off.
    var sessionPermissionIssues: [GuardPermissionIssue] {
        permissions.issues(listening: currentSession?.listening == true)
    }

    /// A server problem during an alert. Only shown while an alert is on screen: a hidden duress
    /// alert can fail too, and nothing may hint at that afterward.
    var alertConnectionNote: String? {
        services.escalation.activeAlert == nil ? nil : services.escalation.connectionNote
    }

    // MARK: Onboarding

    func completeOnboarding() {
        hasCompletedOnboarding = true
        Task { await syncRegistration() }
    }

    /// Registers the device (once) and pushes contacts. Safe to call repeatedly.
    func syncRegistration() async {
        guard let profile else { return }
        let backend = services.backend
        do {
            if let creds = store.deviceCredentials {
                await backend.setCredentials(creds)
            } else {
                let creds = try await backend.register(RegisterRequest(name: profile.name, phone: profile.phone,
                                                                       campus: profile.campus.rawValue))
                store.deviceCredentials = creds
                await backend.setCredentials(creds)
            }
            _ = try await backend.setContacts(ContactsSetRequest(contacts: contacts.map { ContactDTO(name: $0.name, phone: $0.phone) }))
            banner = nil
        } catch {
            banner = "Couldn't reach SafetySense's server yet. We'll keep trying."
        }
    }

    // MARK: Guard sessions

    /// `arrivalCheckAfter`: Walk and Ride check once at the time you should have arrived, so the
    /// ladder, the notification, the ring and the Live Activity all read the same clock.
    func startGuard(mode: GuardMode, sealedDate: SealedDateDetails? = nil, ride: RideDetails? = nil,
                    destination: GuardDestination? = nil, arrivalCheckAfter: TimeInterval? = nil,
                    follower: TrustedContact? = nil, sendHeadsUp: Bool = false) async {
        var session = GuardSession(mode: mode, checkInInterval: arrivalCheckAfter ?? settings.checkInInterval(for: mode),
                                   listening: mode == .walk ? settings.listenDuringWalk : nil,
                                   sealedDate: sealedDate, ride: ride)
        session.destinationName = destination?.name
        session.destinationLatitude = destination?.fix?.latitude
        session.destinationLongitude = destination?.fix?.longitude
        session.followerID = follower?.id
        session.followerName = follower?.firstName
        hasArrived = false
        markedSafe = nil
        toast = nil
        wantsHeadsUp = sendHeadsUp && follower != nil
        if GuardMode.guardModes.contains(mode) { homeMode = mode }
        currentSession = session
        services.risk.reset()
        services.risk.configure(mode: mode, sensitivity: settings.sensitivity)
        services.escalation.begin(session: session, policies: settings.dispatchPolicies)

        // Guarding is already on (the session and ladder above), so a prompt left unanswered
        // never stands between someone and their check-ins.
        await askForGuardPermissions(listening: session.listening)
        await startListening(session)
        if mode.usesMotion { try? services.motion.start(mode: mode) }
        try? services.location.start(mode: mode, destination: session.destinationFix)
        if let next = session.nextCheckInAt { services.notifications.scheduleCheckIn(at: next, sessionID: session.id) }
        await services.liveActivity.start(session: session)

        do {
            let response = try await services.backend.startSession(SessionStartRequest(
                mode: mode.rawValue, checkInIntervalS: Int(session.checkInInterval),
                graceS: Int(session.graceSeconds), sealedDetails: session.sealedDetailsString))
            session.serverSessionID = response.sessionId
            guard currentSession?.id == session.id else { return }
            currentSession = session
            (services.escalation as? EscalationController)?.updateSession(session)
            services.heartbeat.start(serverSessionID: response.sessionId, interval: 60)
            banner = nil
        } catch {
            banner = "Guarding on your phone. The server link will retry."
        }
    }

    /// Asks for what the session needs and hasn't been asked yet. Prompts only appear while the
    /// app is on screen, so a Guard started from a Shortcut in the background skips this.
    private func askForGuardPermissions(listening: Bool) async {
        await refreshPermissions()
        if services.flavor == .live, UIApplication.shared.applicationState == .active {
            if listening, permissions.microphone == .notAsked { _ = await services.audio.requestPermission() }
            if permissions.location == .notDetermined { _ = await services.location.requestWhenInUse() }
            if permissions.notifications == .notAsked { _ = await services.notifications.requestAuthorization() }
            await refreshPermissions()
        }
    }

    func refreshPermissions() async {
        let notifications = await services.notifications.authorizationState()
        let current = GuardPermissions(microphone: services.audio.microphonePermission,
                                       location: services.location.authorization,
                                       notifications: notifications)
        if current != permissions { permissions = current }
    }

    private func startListening(_ session: GuardSession) async {
        guard session.listening else {
            listening = nil
            return
        }
        do {
            try await services.audio.start(mode: session.mode, safeWord: store.safeWord)
            listening = .listening
        } catch {
            listening = .paused   // Permission or an audio failure: say so instead of showing "on".
        }
    }

    func endGuard() async {
        let serverSessionID = stopSession()
        await closeSessionRemotely(serverSessionID)
    }

    /// Everything that happens on the phone, at once. Returns the server's session id to close.
    private func stopSession() -> String? {
        let serverSessionID = currentSession?.serverSessionID
        currentSession = nil
        wantsHeadsUp = false
        scenarioPlayer?.stop()
        listening = nil
        hasArrived = false
        // After a duress PIN the screen shows "cancelled" but help is still coming: keep the
        // mic (evidence) and location running so the hidden alert keeps updating.
        let duressActive = (services.escalation as? EscalationController)?.duressAlertID != nil
        if !duressActive {
            services.audio.stop()
            services.location.stop()
        }
        services.motion.stop()
        services.heartbeat.stop()
        services.notifications.cancelCheckIns()
        services.escalation.end()
        return serverSessionID
    }

    private func closeSessionRemotely(_ serverSessionID: String?) async {
        await services.liveActivity.end()
        if let serverSessionID {
            _ = try? await services.backend.endSession(SessionEndRequest(sessionId: serverSessionID))
        }
    }

    // MARK: Alerts

    /// Manual SOS from the app, Action Button, Control or Siri.
    func triggerSOS(_ trigger: AlertTrigger = .manualSOS, reason: String = "SOS") {
        services.escalation.triggerManual(trigger, reason: reason)
    }

    func respondToCheckIn(okay: Bool) {
        services.escalation.respondToCheckIn(okay: okay)
    }

    /// Verifies the PIN and cancels. Safety and duress both end at Marked safe with the session
    /// over, from the countdown and from Alert Active. A duress PIN returns `.duress` to the
    /// caller, but the UI must treat it exactly like `.valid`.
    @discardableResult
    func cancelAlert(pin: String) async -> PINVerification {
        let result = store.verifyPIN(pin)
        await stopAlert(with: result)
        return result
    }

    /// Cancels with no PIN. Only for someone who never set one, who'd otherwise have no way to
    /// stop a false alert. Callers confirm it's the owner first.
    func cancelAlertWithoutPIN() async {
        guard !store.hasSafetyPIN else { return }
        await stopAlert(with: .valid)
    }

    private func stopAlert(with result: PINVerification) async {
        // Taken first: the ladder clears the alert, and the overlay has to go straight to
        // Marked safe without passing through the Guard screen.
        if result != .invalid, let alert = services.escalation.activeAlert ?? currentAlert, !alert.isDrill {
            markedSafe = markedSafeSummary(for: alert)
        }
        await services.escalation.cancel(with: result)
        guard markedSafe != nil else { return }
        let serverSessionID = stopSession()
        Task { await closeSessionRemotely(serverSessionID) }
    }

    private func markedSafeSummary(for alert: AlertRecord) -> MarkedSafeSummary {
        MarkedSafeSummary(alertID: alert.id, mode: currentSession?.mode, startedAt: alert.startedAt, endedAt: .now,
                          reachedDispatch: alert.level == .dispatch, contactFirstNames: contacts.map(\.firstName),
                          wasTest: AlertPresentation.isTest(alert), couldntConfirm: alertConnectionNote != nil)
    }

    /// Leaves Marked safe for Support, or for Home on the alert's own mode.
    func leaveMarkedSafe(toSupport: Bool) {
        if let mode = markedSafe?.mode, GuardMode.guardModes.contains(mode) { homeMode = mode }
        selectedTab = toSupport ? .support : .home
        markedSafe = nil
        if forcedScreen == .markedSafe { forcedScreen = nil }
    }

    /// Shows a toast for a contact's new "on my way" or "called 911". What's already on the
    /// alert the first time it's seen stays quiet, so a relaunch doesn't replay old news.
    func noteResponses(alertID: UUID, events: [AlertEvent]) {
        let responses = events.filter { $0.action == "on_my_way" || $0.action == "called_911" }
        func key(_ event: AlertEvent) -> String { "\(event.who)|\(event.action)" }
        guard responseAlertID == alertID else {
            responseAlertID = alertID
            seenResponses = Set(responses.map(key))
            return
        }
        let new = responses.filter { !seenResponses.contains(key($0)) }.sorted { $0.at < $1.at }
        seenResponses.formUnion(new.map(key))
        if let latest = new.last { toast = .response(who: latest.who, action: latest.action) }
    }

    func runDrill() async {
        await services.escalation.startDrill()
        settings.hasCompletedDrill = true
    }

    /// Handles commands queued by intents (Action Button, Control, Live Activity buttons).
    func drainSharedCommands() {
        for command in SharedCommandQueue.drain() where command.isFresh() {
            switch command.kind {
            case .triggerAlert, .checkInOkay, .checkInNeedHelp:
                _ = SystemBridge.handle(command, escalation: services.escalation)
            case .startGuard:
                guard !isGuarding else { continue }
                let mode = command.mode.flatMap(GuardMode.init(rawValue:)) ?? .nightOut
                Task { await startGuard(mode: mode) }
            case .fakeCall:
                scheduleFakeCall(callerName: command.callerName, delay: command.delaySeconds)
            }
        }
    }

    /// Fake call from a shortcut or Siri: the last setup choices, with any overrides.
    func scheduleFakeCall(callerName: String? = nil, delay: TimeInterval? = nil) {
        var config = FakeCallPreferences.load()
        if let callerName, !callerName.trimmingCharacters(in: .whitespaces).isEmpty { config.callerName = callerName }
        if let delay { config.delay = max(0, min(delay, 600)) }
        if isGuarding { config.alsoStartWalkGuard = false }
        fakeCall.schedule(config)
    }

    /// Answering can start a Walk Home guard, so someone is watching while you leave.
    private func fakeCallAnswered(_ config: FakeCallConfig) {
        guard config.alsoStartWalkGuard, !isGuarding else { return }
        Task { await startGuard(mode: .walk) }
    }

    func eraseEverything() async {
        await endGuard()
        // Ask the server to erase this device's data too (contacts, alerts, locations, evidence).
        // Best effort: the phone is wiped either way, and the server's retention job expires the rest.
        _ = try? await services.backend.deleteAccount()
        try? services.vault.deleteAll()
        store.eraseAll()
        await services.backend.setCredentials(nil)
        profile = nil
        contacts = []
        settings = AppSettings()
        currentAlert = nil
        hasCompletedOnboarding = false
        markedSafe = nil
        toast = nil
    }

    // MARK: Launch

    /// Runs once the UI is up: re-links the server, adopts an alert an intent started while the
    /// app wasn't running, applies evidence retention and starts a scripted scenario if asked.
    func onLaunch() async {
        guard !didLaunch else { return }
        didLaunch = true
        if commandObserver == nil {
            // Siri / Shortcuts commands raised while the app is already open run right away.
            commandObserver = NotificationCenter.default.addObserver(
                forName: SharedCommandQueue.didEnqueueNotification, object: nil, queue: .main) { [weak self] _ in
                MainActor.assumeIsolated { self?.drainSharedCommands() }
            }
            // A Control or button that ran in the widget extension.
            SharedCommandSignal.observe { Task { @MainActor [weak self] in self?.drainSharedCommands() } }
        }
        if forcedScreen == nil { WidgetMirror.setGuardActive(currentSession != nil) }
        if let vault = services.vault as? SecureEvidenceVault { vault.purge(olderThan: settings.retentionDays) }
        await refreshPermissions()
        if let external = ExternalAlertRecord.load() {
            ExternalAlertRecord.clear()
            if Date.now.timeIntervalSince(external.createdAt) < 2 * 3600 {
                (services.escalation as? EscalationController)?.adopt(external.record)
            }
        }
        if forcedScreen == nil {
            let persistedAlert = currentAlert
            await resumeGuardIfNeeded()
            adoptPersisted(persistedAlert)
        }
        if hasCompletedOnboarding, forcedScreen == nil { await syncRegistration() }
        drainSharedCommands()
        launchFinished = true
        if let pendingLink {
            self.pendingLink = nil
            open(pendingLink)
        }
        if forcedScreen == nil, services.flavor == .live, hasCompletedOnboarding { Task { await prepareSpeech() } }
        if let name = launch.scenario, hasCompletedOnboarding, forcedScreen == nil {
            await playScenario(named: name, speed: launch.scenarioSpeed)
        }
    }

    /// An alert that was running when iOS killed the app is still live on the server: show it
    /// again and keep its countdown, location and evidence going.
    private func adoptPersisted(_ alert: AlertRecord?) {
        guard let alert, !alert.isDrill, alert.status == .active || alert.status == .dispatched,
              alert.serverAlertID != nil, Date.now.timeIntervalSince(alert.startedAt) < 2 * 3600,
              let escalation = services.escalation as? EscalationController else { return }
        escalation.adopt(alert)
    }

    /// The app came to the foreground: catch up on everything that can't run in the background.
    func appBecameActive() {
        drainSharedCommands()
        fakeCall.appBecameActive()
        Task { await refreshPermissions() }   // They may be back from iOS Settings.
        guard forcedScreen == nil else { return }
        services.audio.resumeIfNeeded()
        enqueueActivity { [services] in await services.liveActivity.refresh() }
        if let escalation = services.escalation as? EscalationController, escalation.activeAlert != nil {
            Task { await escalation.resumeEvidence() }
        }
    }

    /// Downloads the speech model the safe word needs, ahead of the first session.
    func prepareSpeech() async {
        guard speechReadiness != .ready, speechReadiness != .downloading else { return }
        speechReadiness = .downloading
        speechReadiness = await AudioGuard.prepareSpeechAssets() ? .ready : .unavailable
    }

    // MARK: Deep links

    /// Links only navigate. Any app can open one, so none of them can start a ladder early.
    func open(_ link: DeepLink) {
        guard launchFinished else {
            pendingLink = link
            return
        }
        switch link {
        case .home:
            selectedTab = .home
        case .support:
            selectedTab = .support
        case .vault:
            selectedTab = .vault
        case .alert:
            break   // An active alert already fills the screen.
        case .checkIn:
            // After a relaunch the check-in may be overdue while the ladder is only guarding.
            if escalationLevel == .guarding, let next = currentSession?.nextCheckInAt, next <= .now {
                services.escalation.scheduledCheckInDue()
            }
        }
    }

    /// A session persisted from before a relaunch (iOS killed the app, or a crash): restart the
    /// ladder and sensors for it instead of showing a Guard screen with nothing behind it.
    private func resumeGuardIfNeeded() async {
        guard var session = currentSession, let escalation = services.escalation as? EscalationController,
              escalation.level == .guarding, escalation.activeAlert == nil else { return }
        if session.checkInInterval > 0, (session.nextCheckInAt ?? .distantPast) <= .now {
            session.nextCheckInAt = .now.addingTimeInterval(session.checkInInterval)
        }
        currentSession = session
        services.risk.reset()
        services.risk.configure(mode: session.mode, sensitivity: settings.sensitivity)
        escalation.begin(session: session, policies: settings.dispatchPolicies)
        await startListening(session)
        if session.mode.usesMotion { try? services.motion.start(mode: session.mode) }
        try? services.location.start(mode: session.mode, destination: session.destinationFix)
        if let next = session.nextCheckInAt { services.notifications.scheduleCheckIn(at: next, sessionID: session.id) }
        if !services.liveActivity.isActive { await services.liveActivity.start(session: session) }
        if let id = session.serverSessionID { services.heartbeat.start(serverSessionID: id, interval: 60) }
    }

    /// Starts a guard session in the scenario's mode and plays the scripted signals through the
    /// audio guard's callback, the same path a real scream takes.
    func playScenario(named name: String = "nightOut", speed: Double = 1) async {
        let scenario = DemoScenarioPlayer.nightOut   // the only scripted scenario today
        _ = name
        if !isGuarding { await startGuard(mode: scenario.mode) }
        let player = DemoScenarioPlayer(scenario: scenario, timeScale: speed)
        player.attach(to: services)
        scenarioPlayer = player
        player.play()
    }

    // MARK: Wiring

    private func wireServices() {
        fakeCall.onAnswer = { [weak self] config in self?.fakeCallAnswered(config) }
        if !LaunchOptions.isUnitTestHost, launch.screen == nil {
            FakeCallNotifier.onOpened = { [weak self] answer in self?.fakeCall.openedFromNotification(answer: answer) }
            FakeCallNotifier.onDeclined = { [weak self] in self?.fakeCall.declinedFromNotification() }
        }
        if let escalation = services.escalation as? EscalationController {
            escalation.serverSessionIDProvider = { [weak self] in self?.currentSession?.serverSessionID }
        }
        if let risk = services.risk as? RiskEngine {
            risk.isSecondOpinionEnabled = { [weak self] in self?.settings.useSecondOpinion ?? false }
        }

        let ingest: RiskSignalHandler = { [weak self] signal in
            guard let self else { return }
            let now = (self.services.risk as? RiskEngine)?.now() ?? .now
            let assessment = self.services.risk.ingest(signal, at: now)
            self.services.escalation.handle(assessment)
        }
        services.audio.onSignal = ingest
        services.motion.onSignal = ingest
        services.location.onSignal = ingest
        services.audio.onListeningChange = { [weak self] state in self?.listeningChanged(state) }
        services.location.onArrival = { [weak self] in self?.reachedDestination() }
        if let escalation = services.escalation as? EscalationController {
            escalation.onDuressTracking = { [weak self] on in
                if on {
                    self?.services.location.startAlertTracking()
                } else if self?.currentSession == nil {
                    self?.services.location.stopAlertTracking()
                }
            }
        }
        if let notifications = services.notifications as? NotificationService {
            notifications.onOpenLink = { [weak self] link in self?.open(link) }
        }
        services.escalation.onChange = { [weak self] level, alert in
            guard let self else { return }
            if let alert, alert.isDrill { self.lastDrill = alert; return }
            let hadAlert = self.currentAlert != nil
            self.currentAlert = alert
            if level == .guarding, let next = self.services.escalation.nextCheckInAt,
               self.currentSession != nil, self.currentSession?.nextCheckInAt != next {
                self.currentSession?.nextCheckInAt = next
            }
            // Fires whichever surface answered: the app, the Lock Screen or a notification.
            // The toast's timer only starts while the app is open, so it's still there to read.
            if self.lastLevel == .checkIn, level == .guarding, let session = self.currentSession {
                self.toast = .checkedIn(mode: session.mode, next: self.services.escalation.nextCheckInAt)
            }
            self.lastLevel = level
            if let alert { self.noteResponses(alertID: alert.id, events: alert.events) }
            WidgetMirror.setEscalationLevel(level)
            self.alertStateChanged(hasAlert: alert != nil, hadAlert: hadAlert)
            self.pushLiveActivity(level: level, alert: alert)
        }
    }

    /// An alert needs a fix and a process that stays alive whether or not a session is running.
    private func alertStateChanged(hasAlert: Bool, hadAlert: Bool) {
        if hasAlert {
            services.location.startAlertTracking()   // Safe to repeat; covers an adopted alert too.
        } else if hadAlert {
            let duress = (services.escalation as? EscalationController)?.duressAlertID != nil
            if !duress { services.location.stopAlertTracking() }
            if !isGuarding { enqueueActivity { [services] in await services.liveActivity.end() } }
        }
    }

    private func pushLiveActivity(level: EscalationLevel, alert: AlertRecord?) {
        let ladder = (services.escalation as? EscalationController)?.statusText ?? level.statusLine
        let status = LiveStatusLine.text(level: level, alert: alert, ladderStatus: ladder, listening: listening)
        let next = services.escalation.nextCheckInAt
        let deadline = services.escalation.stepDeadline
        enqueueActivity { [services] in
            if level >= .alert, !services.liveActivity.isActive { await services.liveActivity.startForAlert() }
            await services.liveActivity.update(level: level, statusText: status, nextCheckInAt: next, deadline: deadline)
        }
    }

    private func enqueueActivity(_ work: @escaping @MainActor () async -> Void) {
        let previous = activityWork
        activityWork = Task {
            await previous?.value
            await work()
        }
    }

    /// The Live Activity and the Guard screen say so, and a notification goes out once, because
    /// someone relying on the mic won't otherwise know it stopped.
    private func listeningChanged(_ state: ListeningState) {
        let wasPaused = listening == .paused
        guard currentSession?.listening == true else {
            listening = nil
            return
        }
        listening = state
        if state == .paused, !wasPaused {
            services.notifications.notify(title: "Listening paused",
                                          body: "Open SafetySense to turn the microphone back on. Check-ins and your location are still on.",
                                          timeSensitive: true)
        }
        pushLiveActivity(level: escalationLevel, alert: currentAlert)
    }

    /// Arriving doesn't end anything by itself: being at the door isn't the same as being safe,
    /// so the arrival check stays armed until the person ends the session.
    private func reachedDestination() {
        guard isGuarding, !hasArrived else { return }
        hasArrived = true
        services.notifications.notify(title: "Looks like you're there",
                                      body: "Open SafetySense to end your Guard when you're ready.",
                                      timeSensitive: false)
    }

    // MARK: QA / previews

    /// Seeds sample data and pins a screen (used by `-ssScreen`).
    func applySample(for screen: AppScreen) {
        if profile == nil { profile = SampleData.profile }
        if contacts.isEmpty { contacts = SampleData.contacts }
        if screen != .onboarding { hasCompletedOnboarding = true }
        if screen == .home { seedQASafetyPIN() }
        switch screen {
        case .guardActive, .checkIn:
            currentSession = SampleData.session(mode: Self.launchGuardMode)
            seedQASafetyPIN()
        case .alertCountdown:
            currentSession = SampleData.session(mode: Self.launchGuardMode)
            currentAlert = SampleData.alert(level: .alert)
            seedQASafetyPIN()
        case .alertActive:
            currentSession = SampleData.session(mode: Self.launchGuardMode)
            currentAlert = SampleData.alert(level: .dispatch, secondsAgo: 140)
            seedQASafetyPIN()
        case .markedSafe:
            let args = LaunchOptions.qaArguments
            markedSafe = SampleData.markedSafe(reachedDispatch: !args.contains("-ssPreDispatch"), mode: Self.launchGuardMode)
        case .fakeCallIncoming:
            // QA: `-ssFakeCallStyle slide` shows the lock-screen slider instead of buttons.
            var config = FakeCallConfig(callerName: "Mom")
            let args = LaunchOptions.qaArguments
            if let i = args.firstIndex(of: "-ssFakeCallStyle"), i + 1 < args.count,
               let style = FakeCallAnswerStyle(rawValue: args[i + 1].lowercased()) { config.answerStyle = style }
            fakeCall.pinForPreview(.ringing(since: .now), config: config)
        case .fakeCallActive:
            fakeCall.pinForPreview(.inCall(answeredAt: .now.addingTimeInterval(-42)), config: FakeCallConfig(callerName: "Mom"))
        default:
            break
        }
        if let tab = screen.tab { selectedTab = tab; forcedScreen = nil } else { forcedScreen = screen }
    }

    /// QA: `-ssGuardMode walk|night_out|date|ride` picks the sample Guard's mode.
    private static var launchGuardMode: GuardMode {
        let args = LaunchOptions.qaArguments
        if let i = args.firstIndex(of: "-ssGuardMode"), i + 1 < args.count,
           let mode = GuardMode(rawValue: args[i + 1].lowercased()) { return mode }
        return .nightOut
    }

    /// QA: alert screens show the PIN pad unless `-ssNoPIN` asks for the no-PIN fallback.
    private func seedQASafetyPIN() {
        guard !BuildFlags.isRelease, !LaunchOptions.qaArguments.contains("-ssNoPIN"), !store.hasSafetyPIN else { return }
        store.setSafetyPIN("2580")
    }

    static func preview(screen: AppScreen? = nil) -> AppModel {
        let model = AppModel(services: .demo(), store: .ephemeral())
        model.applySample(for: screen ?? .home)
        return model
    }
}
