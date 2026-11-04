import Foundation

@MainActor
final class MockEvidenceVault: EvidenceVaultProtocol {
    private(set) var clips: [EvidenceClip]
    private(set) var isCapturing = false
    private(set) var isUnlocked = false

    init(clips: [EvidenceClip] = []) { self.clips = clips }

    func startCapture(alertID: UUID, serverAlertID: String?, prebuffer: Data?) async throws { isCapturing = true }
    func stopCapture() { isCapturing = false }
    func unlock(reason: String) async -> Bool { isUnlocked = true; return true }
    func lock() { isUnlocked = false }
    func decrypt(_ clip: EvidenceClip) async throws -> Data { Data() }
    func delete(_ clip: EvidenceClip) throws { clips.removeAll { $0.id == clip.id } }
    func deleteAll() throws { clips.removeAll() }
}

@MainActor
final class NoopLiveActivityController: LiveActivityControllerProtocol {
    private(set) var isActive = false
    private(set) var lastLevel: EscalationLevel?
    func start(session: GuardSession) async { isActive = true }
    func update(level: EscalationLevel, statusText: String, nextCheckInAt: Date?, deadline: Date?) async { lastLevel = level }
    func end() async { isActive = false }
}

@MainActor
final class NoopNotificationService: NotificationServiceProtocol {
    private(set) var scheduled: [Date] = []
    func requestAuthorization() async -> Bool { true }
    func scheduleCheckIn(at date: Date, sessionID: UUID) { scheduled.append(date) }
    func cancelCheckIns() { scheduled.removeAll() }
    func notify(title: String, body: String, timeSensitive: Bool) {}
}

@MainActor
final class NoopHeartbeatService: HeartbeatServiceProtocol {
    private(set) var isRunning = false
    private(set) var lastSentAt: Date?
    func start(serverSessionID: String, interval: TimeInterval) { isRunning = true; lastSentAt = .now }
    func stop() { isRunning = false }
}
