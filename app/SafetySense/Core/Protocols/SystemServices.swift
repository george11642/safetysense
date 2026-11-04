import Foundation

/// Lock Screen / Dynamic Island Live Activity for a Guard session (ActivityKit).
@MainActor
protocol LiveActivityControllerProtocol: AnyObject {
    var isActive: Bool { get }
    func start(session: GuardSession) async
    func update(level: EscalationLevel, statusText: String, nextCheckInAt: Date?, deadline: Date?) async
    func end() async
}

/// Local notifications (Time-Sensitive) for check-ins and alert status.
@MainActor
protocol NotificationServiceProtocol: AnyObject {
    func requestAuthorization() async -> Bool
    func scheduleCheckIn(at date: Date, sessionID: UUID)
    func cancelCheckIns()
    func notify(title: String, body: String, timeSensitive: Bool)
}

/// 60 s server heartbeat during a session (SPEC 6.1.6). If heartbeats stop without
/// `session/end`, the server raises the alert itself.
@MainActor
protocol HeartbeatServiceProtocol: AnyObject {
    var isRunning: Bool { get }
    var lastSentAt: Date? { get }
    func start(serverSessionID: String, interval: TimeInterval)
    func stop()
}
