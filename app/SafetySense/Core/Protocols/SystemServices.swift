import Foundation

/// Lock Screen / Dynamic Island Live Activity for a Guard session (ActivityKit).
@MainActor
protocol LiveActivityControllerProtocol: AnyObject {
    var isActive: Bool { get }
    func start(session: GuardSession) async
    /// `nextCheckInAt == nil` clears the countdown.
    func update(level: EscalationLevel, statusText: String, nextCheckInAt: Date?, deadline: Date?) async
    func end() async
    /// An alert with no Guard session running. Harmless if an activity already exists.
    func startForAlert() async
    /// Requests the activity again if it should be running and isn't: the system ended it (about
    /// 8 hours), or Live Activities were off when the session started.
    func refresh() async
}

/// Local notifications (Time-Sensitive) for check-ins and alert status.
@MainActor
protocol NotificationServiceProtocol: AnyObject {
    func requestAuthorization() async -> Bool
    /// What iOS allows right now. Never shows a prompt.
    func authorizationState() async -> PermissionState
    func scheduleCheckIn(at date: Date, sessionID: UUID)
    func cancelCheckIns()
    func notify(title: String, body: String, timeSensitive: Bool)
    /// Night Out's quiet drink reminders. Repeats until cancelled.
    func scheduleDrinkChecks()
    func cancelDrinkChecks()
}

/// 60 s server heartbeat during a session (SPEC 6.1.6). If heartbeats stop without
/// `session/end`, the server raises the alert itself.
@MainActor
protocol HeartbeatServiceProtocol: AnyObject {
    var isRunning: Bool { get }
    var lastSentAt: Date? { get }
    /// The last beat didn't reach the server. Shown on the Guard screen.
    var isFailing: Bool { get }
    func start(serverSessionID: String, interval: TimeInterval)
    func stop()
}
