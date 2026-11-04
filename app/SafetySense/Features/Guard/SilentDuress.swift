import Foundation

/// A duress PIN entered to END a session (someone may be forcing the person to stop SafetySense).
/// The screen behaves exactly like a normal end, while the backend gets a level-3 alert that
/// dispatches immediately. The escalation ladder's own duress path covers cancelling an alert;
/// this covers the one place the ladder isn't running yet.
@MainActor
enum SilentDuress {
    static func fire(model: AppModel, reason: String = "Duress PIN entered to end a session") {
        let backend = model.services.backend
        let fix = model.services.location.lastFix
        let battery = model.services.device.batteryLevel
        let request = AlertCreateRequest(
            sessionId: model.currentSession?.serverSessionID, level: EscalationLevel.dispatch.rawValue,
            reason: reason, trigger: AlertTrigger.manualSOS.rawValue,
            lat: fix?.latitude, lng: fix?.longitude, accuracy: fix?.accuracy, battery: battery,
            dryRun: nil, dispatchPolicy: DispatchPolicy.dispatchImmediately.rawValue)
        Task.detached {
            guard let created = try? await backend.createAlert(request) else { return }
            _ = try? await backend.escalateAlert(AlertEscalateRequest(alertId: created.alertId, reason: reason))
        }
    }
}
