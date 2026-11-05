import Foundation
import Observation

/// Working escalation ladder against the mock backend, so the demo runs end to end.
/// The Guard Engine module replaces it with the production controller.
@Observable
@MainActor
final class MockEscalationController: EscalationControllerProtocol {
    private(set) var level: EscalationLevel = .guarding
    private(set) var activeAlert: AlertRecord?
    private(set) var stepDeadline: Date?
    var nextCheckInAt: Date? { level == .guarding ? session?.nextCheckInAt : nil }

    @ObservationIgnored var onChange: (@MainActor (EscalationLevel, AlertRecord?) -> Void)?
    /// Multiplies every timer (0.1 = 10x faster). Useful for demos and tests.
    @ObservationIgnored var timeScale: Double = 1

    @ObservationIgnored private let backend: any BackendClientProtocol
    @ObservationIgnored private var session: GuardSession?
    @ObservationIgnored private var policies = DispatchPolicySettings.default
    @ObservationIgnored private var timer: Task<Void, Never>?

    init(backend: any BackendClientProtocol) {
        self.backend = backend
    }

    func begin(session: GuardSession, policies: DispatchPolicySettings) {
        self.session = session
        self.policies = policies
        transition(to: .guarding, alert: nil)
    }

    func handle(_ assessment: RiskAssessment) {
        switch assessment.level {
        case .critical:
            let trigger: AlertTrigger = assessment.contributors.contains { $0.kind == .safeWord } ? .safeWord
                : assessment.contributors.contains { $0.kind == .heartbeatLost } ? .heartbeatLost : .riskEngine
            if level < .alert { raise(trigger: trigger, reason: assessment.explanation) }
        case .high:
            if level < .alert { raise(trigger: .riskEngine, reason: assessment.explanation) }
        case .elevated:
            if level == .guarding { enterCheckIn() }
        case .calm:
            break
        }
    }

    func scheduledCheckInDue() {
        if level == .guarding { enterCheckIn() }
    }

    func respondToCheckIn(okay: Bool) {
        guard level == .checkIn else { return }
        if okay {
            transition(to: .guarding, alert: nil)
        } else {
            triggerManual(.manualSOS, reason: "Asked for help at a check-in")
        }
    }

    func triggerManual(_ trigger: AlertTrigger, reason: String) {
        guard level < .dispatch else { return }
        let start = policies.startingLevel(for: trigger, in: session?.mode ?? .everyday)
        raise(trigger: trigger, reason: reason, startLevel: start)
    }

    func contactRequestedHelp(name: String) {
        guard var alert = activeAlert, level == .alert else { return }
        alert.events.append(AlertEvent(who: name, action: "send_help", at: .now))
        activeAlert = alert
        escalateToDispatch(reason: "\(name) asked for help to be sent")
    }

    func cancel(with verification: PINVerification) async {
        guard let alert = activeAlert else {
            if level == .checkIn, verification != .invalid { transition(to: .guarding, alert: nil) }
            return
        }
        switch verification {
        case .invalid:
            return
        case .valid, .duress:
            // Duress looks identical to a cancel on screen; the server escalates silently.
            if let id = alert.serverAlertID {
                _ = try? await backend.cancelAlert(AlertCancelRequest(alertId: id, duress: verification == .duress))
            }
            transition(to: .guarding, alert: nil)
        }
    }

    func startDrill() async {
        var record = AlertRecord(sessionID: session?.serverSessionID, level: .alert, trigger: .manualSOS,
                                 reason: "Practice drill", policy: .contactsFirst, isDrill: true)
        if let response = try? await backend.createAlert(AlertCreateRequest(
            sessionId: session?.serverSessionID, level: 2, reason: "TEST: practice drill",
            trigger: AlertTrigger.manualSOS.rawValue, dryRun: true,
            dispatchPolicy: DispatchPolicy.contactsFirst.rawValue)) {
            record.serverAlertID = response.alertId
            record.shareURL = URL(string: response.shareUrl)
            record.notified = response.notified
        }
        record.status = .resolved
        onChange?(level, record)
    }

    func end() {
        timer?.cancel()
        session = nil
        transition(to: .guarding, alert: nil)
    }

    // MARK: - Internals

    private func enterCheckIn() {
        transition(to: .checkIn, alert: activeAlert)
        schedule(after: EscalationLevel.checkIn.autoEscalateAfter ?? 45) { [weak self] in
            guard let self, self.level == .checkIn else { return }
            self.raise(trigger: .missedCheckIn, reason: "No answer to a check-in")
        }
    }

    private func raise(trigger: AlertTrigger, reason: String, startLevel: EscalationLevel = .alert) {
        let mode = session?.mode ?? .everyday
        let policy = policies.policy(for: trigger, in: mode)
        let record = AlertRecord(sessionID: session?.serverSessionID, level: startLevel, trigger: trigger,
                                 reason: reason, policy: policy,
                                 status: startLevel == .dispatch ? .dispatched : .active,
                                 events: [AlertEvent(who: "SafetySense", action: "alert_started", at: .now)])
        transition(to: startLevel, alert: record)
        if startLevel == .alert {
            schedule(after: EscalationLevel.alert.autoEscalateAfter ?? 90) { [weak self] in
                guard let self, self.level == .alert else { return }
                self.escalateToDispatch(reason: "No cancel within 90 seconds")
            }
        }
        Task { await self.sendAlert(record) }
    }

    private func sendAlert(_ record: AlertRecord) async {
        let request = AlertCreateRequest(sessionId: record.sessionID, level: record.level.rawValue, reason: record.reason,
                                         trigger: record.trigger.rawValue, dryRun: nil,
                                         dispatchPolicy: record.policy.rawValue)
        guard let response = try? await backend.createAlert(request), var alert = activeAlert, alert.id == record.id else { return }
        alert.serverAlertID = response.alertId
        alert.shareURL = URL(string: response.shareUrl)
        alert.notified = response.notified
        if alert.level == .dispatch {
            if let d = try? await backend.escalateAlert(AlertEscalateRequest(alertId: response.alertId, reason: alert.reason)) {
                alert.dispatch = d.dispatch.model
            }
        }
        activeAlert = alert
        onChange?(level, alert)
    }

    private func escalateToDispatch(reason: String) {
        guard var alert = activeAlert else { return }
        alert.level = .dispatch
        alert.status = .dispatched
        alert.levelChangedAt = .now
        transition(to: .dispatch, alert: alert)
        guard let id = alert.serverAlertID else { return }
        Task {
            if let d = try? await backend.escalateAlert(AlertEscalateRequest(alertId: id, reason: reason)),
               var current = activeAlert, current.id == alert.id {
                current.dispatch = d.dispatch.model
                activeAlert = current
                onChange?(level, current)
            }
        }
    }

    private func transition(to newLevel: EscalationLevel, alert: AlertRecord?) {
        timer?.cancel()
        level = newLevel
        activeAlert = alert
        stepDeadline = newLevel.autoEscalateAfter.map { Date.now.addingTimeInterval($0 * timeScale) }
        onChange?(newLevel, alert)
    }

    private func schedule(after seconds: TimeInterval, _ action: @escaping @MainActor () -> Void) {
        timer?.cancel()
        let delay = seconds * timeScale
        timer = Task { @MainActor in
            try? await Task.sleep(for: .seconds(delay))
            guard !Task.isCancelled else { return }
            action()
        }
    }
}
