import AppIntents
import Foundation

/// The Action Button / Siri SOS. Runs without opening SafetySense (`openAppWhenRun = false`),
/// works while the phone is locked, and starts the alert at the level the person chose for a
/// manual SOS (default: contacts and dispatch together, SPEC 15.2).
///
/// Inside the app process it hands the command to the live escalation ladder and waits until
/// the server has the alert (so calls start even if iOS suspends the app right after). If the
/// ladder isn't running, it creates the alert on the server directly. As a `LiveActivityIntent`
/// it may start the Live Activity from the background.
///
/// Dialogs can be spoken aloud, so they never say who is being told.
struct StartAlertIntent: LiveActivityIntent {
    static let title: LocalizedStringResource = "SafetySense Alert"
    static let description = IntentDescription(
        "Starts SafetySense's alert without opening the app. SafetySense adds to 911; it doesn't replace it.")
    static var openAppWhenRun: Bool { false }
    static var authenticationPolicy: IntentAuthenticationPolicy { .alwaysAllowed }

    @Parameter(title: "Source", default: .shortcut)
    var source: TriggerSourceEntity

    init() {}

    init(source: TriggerSourceEntity) {
        self.source = source
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let command = SharedCommand(kind: .triggerAlert, source: source.commandSource)

        if let escalation = SystemBridge.escalation, SystemBridge.handle(command, escalation: escalation) {
            let reached = await SystemBridge.waitForServerAlert()
            return .result(dialog: reached ? startedDialog : "SafetySense will keep trying. If you can, call 911.")
        }

        do {
            try await DirectAlertSender.send(command)
            return .result(dialog: startedDialog)
        } catch {
            // Leave it for the app to pick up the moment it opens.
            SharedCommandQueue.enqueue(command)
            return .result(dialog: "SafetySense couldn't reach its server. If you can, call 911.")
        }
    }
}

private extension StartAlertIntent {
    /// A build that contacts nobody must not sound like help is coming.
    var startedDialog: IntentDialog {
        AlertDelivery.current(flavor: .live).isReal ? "SafetySense is on it."
            : "This is a test build, so nobody was contacted. If you need help, call 911."
    }
}

/// Alert created straight from an intent when no in-app ladder was running. The app shows it
/// on next launch (`AppGroup.Keys.externalAlert`).
struct ExternalAlertRecord: Codable, Sendable, Equatable {
    var serverAlertID: String
    var shareURL: String
    var level: Int
    var trigger: String
    var reason: String
    var policy: String
    var createdAt: Date
    var dispatch: DispatchInfo?

    static func load() -> ExternalAlertRecord? {
        AppGroup.defaults.data(forKey: AppGroup.Keys.externalAlert)
            .flatMap { try? JSONDecoder().decode(ExternalAlertRecord.self, from: $0) }
    }

    func save() {
        if let data = try? JSONEncoder().encode(self) {
            AppGroup.defaults.set(data, forKey: AppGroup.Keys.externalAlert)
        }
    }

    static func clear() { AppGroup.defaults.removeObject(forKey: AppGroup.Keys.externalAlert) }

    /// As an `AlertRecord`, for the app to adopt.
    var record: AlertRecord {
        let lvl = EscalationLevel(rawValue: level) ?? .alert
        return AlertRecord(serverAlertID: serverAlertID, shareURL: URL(string: shareURL), level: lvl,
                           trigger: AlertTrigger(rawValue: trigger) ?? .manualSOS, reason: reason,
                           policy: DispatchPolicy(rawValue: policy) ?? .dispatchImmediately,
                           status: lvl == .dispatch ? .dispatched : .active, startedAt: createdAt,
                           levelChangedAt: createdAt, dispatch: dispatch)
    }
}

/// Creates an alert on the server without the in-app ladder (last-resort path).
@MainActor
enum DirectAlertSender {
    static func send(_ command: SharedCommand) async throws {
        let store = SettingsStore()
        let backend = HTTPBackendClient.shared
        if let creds = store.deviceCredentials { await backend.setCredentials(creds) }

        let session = store.currentSession
        let mode = session?.mode ?? .everyday
        let trigger: AlertTrigger = command.source == .actionButton ? .actionButton : .manualSOS
        let policies = store.settings.dispatchPolicies
        let policy = policies.policy(for: trigger, in: mode)
        let level = policies.startingLevel(for: trigger, in: mode)

        let response = try await backend.createAlert(AlertCreateRequest(
            sessionId: session?.serverSessionID, level: level.rawValue, reason: command.alertReason,
            trigger: trigger.rawValue, battery: DeviceBatteryStatus().batteryLevel,
            dryRun: nil, dispatchPolicy: policy.rawValue))

        var external = ExternalAlertRecord(serverAlertID: response.alertId, shareURL: response.shareUrl,
                                           level: level.rawValue, trigger: trigger.rawValue,
                                           reason: command.alertReason, policy: policy.rawValue,
                                           createdAt: .now, dispatch: nil)
        if level == .dispatch,
           let escalated = try? await backend.escalateAlert(AlertEscalateRequest(alertId: response.alertId,
                                                                                 reason: command.alertReason)) {
            external.dispatch = escalated.dispatch.model
        }
        external.save()
    }
}
