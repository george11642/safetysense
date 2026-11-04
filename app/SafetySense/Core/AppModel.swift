import Foundation
import Observation

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

/// Which full-screen experience sits on top of the tabs, derived from session + escalation state.
enum GuardOverlay: Equatable, Sendable {
    case none, guardActive, checkIn, alertCountdown, alertActive
}

/// Single source of truth for UI state. Inject with `.environment(model)`;
/// read with `@Environment(AppModel.self) private var model`.
@Observable
@MainActor
final class AppModel {
    let services: ServiceContainer
    let launch: LaunchOptions
    @ObservationIgnored let store: SettingsStore

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
    @ObservationIgnored private var commandObserver: (any NSObjectProtocol)?

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
        wireServices()
    }

    // MARK: Derived state

    var escalationLevel: EscalationLevel { services.escalation.level }
    var isGuarding: Bool { currentSession != nil }

    var overlay: GuardOverlay {
        switch services.escalation.level {
        case .checkIn: return .checkIn
        case .alert: return .alertCountdown
        case .dispatch: return .alertActive
        case .guarding: return currentSession == nil ? .none : .guardActive
        }
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
        } catch {
            banner = "Couldn't reach SafetySense's server yet. We'll keep trying."
        }
    }

    // MARK: Guard sessions

    func startGuard(mode: GuardMode, sealedDate: SealedDateDetails? = nil, ride: RideDetails? = nil) async {
        var session = GuardSession(mode: mode, checkInInterval: settings.checkInInterval(for: mode),
                                   listening: mode == .walk ? settings.listenDuringWalk : nil,
                                   sealedDate: sealedDate, ride: ride)
        currentSession = session
        services.risk.reset()
        services.risk.configure(mode: mode, sensitivity: settings.sensitivity)
        services.escalation.begin(session: session, policies: settings.dispatchPolicies)

        if session.listening { try? await services.audio.start(mode: mode, safeWord: store.safeWord) }
        if mode.usesMotion { try? services.motion.start(mode: mode) }
        try? services.location.start(mode: mode, destination: ride?.destinationFix)
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
        } catch {
            banner = "Guarding on your phone. The server link will retry."
        }
    }

    func endGuard() async {
        scenarioPlayer?.stop()
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
        await services.liveActivity.end()
        if let id = currentSession?.serverSessionID {
            _ = try? await services.backend.endSession(SessionEndRequest(sessionId: id))
        }
        currentSession = nil
    }

    // MARK: Alerts

    /// "I'm safe now" on Alert Active: the PIN was accepted (safety or duress, which must look
    /// the same), so close the session and land on Support.
    func finishAfterAlert() async {
        await endGuard()
        selectedTab = .support
    }

    /// Manual SOS from the app, Action Button, Control or Siri.
    func triggerSOS(_ trigger: AlertTrigger = .manualSOS, reason: String = "SOS") {
        services.escalation.triggerManual(trigger, reason: reason)
    }

    func respondToCheckIn(okay: Bool) {
        services.escalation.respondToCheckIn(okay: okay)
    }

    /// Verifies the PIN and cancels. A duress PIN returns `.duress` to the caller but the UI
    /// must treat it exactly like `.valid`.
    @discardableResult
    func cancelAlert(pin: String) async -> PINVerification {
        let result = store.verifyPIN(pin)
        await services.escalation.cancel(with: result)
        return result
    }

    func runDrill() async {
        await services.escalation.startDrill()
        settings.hasCompletedDrill = true
    }

    /// Handles commands queued by intents (Action Button, Control, Live Activity buttons).
    func drainSharedCommands() {
        for command in SharedCommandQueue.drain() {
            switch command.kind {
            case .triggerAlert:
                triggerSOS(command.source == .actionButton ? .actionButton : .manualSOS,
                           reason: "SOS from \(command.source.rawValue)")
            case .checkInOkay:
                respondToCheckIn(okay: true)
            case .checkInNeedHelp:
                respondToCheckIn(okay: false)
            case .startGuard:
                guard !isGuarding else { continue }
                let mode = command.mode.flatMap(GuardMode.init(rawValue:)) ?? .nightOut
                Task { await startGuard(mode: mode) }
            }
        }
    }

    func eraseEverything() async {
        await endGuard()
        try? services.vault.deleteAll()
        store.eraseAll()
        await services.backend.setCredentials(nil)
        profile = nil
        contacts = []
        settings = AppSettings()
        currentAlert = nil
        hasCompletedOnboarding = false
    }

    // MARK: Launch

    /// Runs once the UI is up: re-links the server, adopts an alert an intent started while the
    /// app wasn't running, applies evidence retention and starts a scripted scenario if asked.
    func onLaunch() async {
        if commandObserver == nil {
            // Siri / Shortcuts commands raised while the app is already open run right away.
            commandObserver = NotificationCenter.default.addObserver(
                forName: SharedCommandQueue.didEnqueueNotification, object: nil, queue: .main) { [weak self] _ in
                MainActor.assumeIsolated { self?.drainSharedCommands() }
            }
        }
        if let vault = services.vault as? SecureEvidenceVault { vault.purge(olderThan: settings.retentionDays) }
        if let external = ExternalAlertRecord.load() {
            ExternalAlertRecord.clear()
            if Date.now.timeIntervalSince(external.createdAt) < 2 * 3600 {
                (services.escalation as? EscalationController)?.adopt(external.record)
            }
        }
        if forcedScreen == nil { await resumeGuardIfNeeded() }
        if hasCompletedOnboarding, forcedScreen == nil { await syncRegistration() }
        drainSharedCommands()
        if let name = launch.scenario, hasCompletedOnboarding, forcedScreen == nil {
            await playScenario(named: name, speed: launch.scenarioSpeed)
        }
    }

    /// A session persisted from before a relaunch (iOS killed the app, or a crash): restart the
    /// ladder and sensors for it instead of showing a Guard screen with nothing behind it.
    private func resumeGuardIfNeeded() async {
        guard var session = currentSession, let escalation = services.escalation as? EscalationController,
              escalation.level == .guarding, escalation.activeAlert == nil else { return }
        if session.checkInInterval > 0 { session.nextCheckInAt = .now.addingTimeInterval(session.checkInInterval) }
        currentSession = session
        services.risk.reset()
        services.risk.configure(mode: session.mode, sensitivity: settings.sensitivity)
        escalation.begin(session: session, policies: settings.dispatchPolicies)
        if session.listening { try? await services.audio.start(mode: session.mode, safeWord: store.safeWord) }
        if session.mode.usesMotion { try? services.motion.start(mode: session.mode) }
        try? services.location.start(mode: session.mode, destination: session.ride?.destinationFix)
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
        services.escalation.onChange = { [weak self] level, alert in
            guard let self else { return }
            if let alert, alert.isDrill { self.lastDrill = alert; return }
            self.currentAlert = alert
            AppGroup.defaults.set(level.rawValue, forKey: AppGroup.Keys.widgetEscalationLevel)
            let deadline = self.services.escalation.stepDeadline
            Task {
                await self.services.liveActivity.update(level: level, statusText: level.statusLine,
                                                        nextCheckInAt: self.currentSession?.nextCheckInAt,
                                                        deadline: deadline)
            }
        }
    }

    // MARK: QA / previews

    /// Seeds sample data and pins a screen (used by `-ssScreen`).
    func applySample(for screen: AppScreen) {
        if profile == nil { profile = SampleData.profile }
        if contacts.isEmpty { contacts = SampleData.contacts }
        if screen != .onboarding { hasCompletedOnboarding = true }
        switch screen {
        case .guardActive, .checkIn:
            currentSession = SampleData.session()
        case .alertCountdown:
            currentSession = SampleData.session()
            currentAlert = SampleData.alert(level: .alert)
        case .alertActive:
            currentSession = SampleData.session()
            currentAlert = SampleData.alert(level: .dispatch, secondsAgo: 140)
        default:
            break
        }
        if let tab = screen.tab { selectedTab = tab; forcedScreen = nil } else { forcedScreen = screen }
    }

    static func preview(screen: AppScreen? = nil) -> AppModel {
        let model = AppModel(services: .demo(), store: .ephemeral())
        model.applySample(for: screen ?? .home)
        return model
    }
}
