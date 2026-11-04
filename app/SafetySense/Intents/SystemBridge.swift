import Foundation
import Observation

/// Connects the system surfaces (App Intents, Live Activity buttons, notification actions,
/// heartbeats) to the running services. `ServiceContainer` calls `install` once it's built.
///
/// Commands raised inside the app process go straight to the escalation ladder, exactly as
/// `AppModel.drainSharedCommands()` would handle them, so an "I'm okay" from the Lock Screen
/// resolves the check-in at once even while the app is in the background.
@MainActor
enum SystemBridge {
    private(set) static weak var escalation: (any EscalationControllerProtocol)?
    private static var levelObserver: LevelObserver?

    static func install(_ services: ServiceContainer) {
        let escalation = services.escalation
        self.escalation = escalation

        SharedCommandBridge.handler = { [weak escalation] command in
            guard let escalation else { return false }
            return handle(command, escalation: escalation)
        }

        let notifications = services.notifications as? NotificationService
        notifications?.onCheckInDue = { [weak escalation] in escalation?.scheduledCheckInDue() }

        let heartbeat = services.heartbeat as? HeartbeatScheduler
        heartbeat?.attach(location: services.location, device: services.device, escalation: escalation)

        levelObserver = LevelObserver(escalation: escalation) { [weak notifications, weak heartbeat] old, new in
            switch (old, new) {
            case (.checkIn, .guarding):
                // Answered (in the app, on the Lock Screen or by notification): clear the nudge
                // and line up the next one.
                notifications?.checkInAnswered()
                notifications?.scheduleNextCheckIn()
            case (_, .alert), (_, .dispatch):
                notifications?.alertStarted()
                heartbeat?.beatNow()
            case (.alert, .guarding), (.dispatch, .guarding):
                notifications?.scheduleNextCheckIn()
            default:
                break
            }
        }

        if services.flavor == .live {
            HeartbeatScheduler.registerBackgroundTasks()
        }
    }

    /// Same mapping as `AppModel.drainSharedCommands()`. Returns false for commands that need
    /// the full app (starting a Guard session), which then wait in the shared queue.
    static func handle(_ command: SharedCommand, escalation: any EscalationControllerProtocol) -> Bool {
        switch command.kind {
        case .triggerAlert:
            escalation.triggerManual(command.source == .actionButton ? .actionButton : .manualSOS,
                                     reason: command.alertReason)
            return true
        case .checkInOkay:
            escalation.respondToCheckIn(okay: true)
            return true
        case .checkInNeedHelp:
            if escalation.level == .checkIn {
                escalation.respondToCheckIn(okay: false)
            } else if escalation.level < .alert {
                escalation.triggerManual(.manualSOS, reason: command.alertReason)
            }
            return true
        case .startGuard, .fakeCall:
            return false   // needs AppModel: waits in the queue, drained as soon as the app is up
        }
    }

    /// Server id of the live (non-drill) alert, once `alert/create` has answered.
    static var liveServerAlertID: String? {
        guard let alert = escalation?.activeAlert, !alert.isDrill else { return nil }
        return alert.serverAlertID
    }
}

/// Watches `escalation.level` with Observation (the controller's `onChange` belongs to AppModel).
@MainActor
private final class LevelObserver {
    private weak var escalation: (any EscalationControllerProtocol)?
    private var last: EscalationLevel
    private let onChange: @MainActor (EscalationLevel, EscalationLevel) -> Void

    init(escalation: any EscalationControllerProtocol,
         onChange: @escaping @MainActor (EscalationLevel, EscalationLevel) -> Void) {
        self.escalation = escalation
        self.last = escalation.level
        self.onChange = onChange
        track()
    }

    private func track() {
        guard let escalation else { return }
        withObservationTracking {
            _ = escalation.level
        } onChange: { [weak self] in
            Task { @MainActor in self?.fire() }
        }
    }

    private func fire() {
        guard let escalation else { return }
        let now = escalation.level
        if now != last {
            let old = last
            last = now
            onChange(old, now)
        }
        track()
    }
}
