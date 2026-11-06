import Foundation

@MainActor
final class MockEvidenceVault: EvidenceVaultProtocol {
    var clips: [EvidenceClip]
    private(set) var isCapturing = false
    private(set) var isUnlocked = false
    var isRecordingEvidence: Bool { isCapturing }

    /// `-ssDemo`: an alert leaves clips in the Vault, one every `clipLength`, as the real vault does.
    private let simulatesRecording: Bool
    private let clipLength: TimeInterval
    private var recording: Task<Void, Never>?

    init(clips: [EvidenceClip] = [], simulatesRecording: Bool = false, clipLength: TimeInterval = 30) {
        self.clips = clips
        self.simulatesRecording = simulatesRecording
        self.clipLength = clipLength
    }

    func startCapture(alertID: UUID, serverAlertID: String?, prebuffer: Data?) async throws {
        isCapturing = true
        guard simulatesRecording else { return }
        recording?.cancel()
        addClip(alertID: alertID, serverAlertID: serverAlertID)   // The 30 s from before the alert.
        recording = Task { [weak self, clipLength] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(clipLength))
                guard !Task.isCancelled else { return }
                self?.addClip(alertID: alertID, serverAlertID: serverAlertID)
            }
        }
    }

    private func addClip(alertID: UUID, serverAlertID: String?) {
        let seq = clips.count { $0.alertID == alertID }
        clips.append(EvidenceClip(alertID: alertID, serverAlertID: serverAlertID, seq: seq,
                                  startedAt: .now.addingTimeInterval(-clipLength), duration: clipLength,
                                  sha256: "demo", fileName: "demo-\(seq)", byteCount: 480_000, uploaded: true))
    }

    func stopCapture() {
        isCapturing = false
        recording?.cancel()
        recording = nil
    }
    func unlock(reason: String) async -> Bool { isUnlocked = true; return true }
    func lock() { isUnlocked = false }
    /// `-ssDemo`: silence as long as the clip, so the Vault's player has something to play.
    func decrypt(_ clip: EvidenceClip) async throws -> Data {
        guard simulatesRecording else { return Data() }
        return WAV.encode(samples: [Int16](repeating: 0, count: Int(clip.duration) * 16_000), sampleRate: 16_000)
    }
    func delete(_ clip: EvidenceClip) throws { clips.removeAll { $0.id == clip.id } }
    func deleteAll() throws { clips.removeAll() }
}

@MainActor
final class NoopLiveActivityController: LiveActivityControllerProtocol {
    private(set) var isActive = false
    private(set) var lastLevel: EscalationLevel?
    private(set) var lastStatus: String?
    private(set) var lastNextCheckIn: Date?
    private(set) var alertStarts = 0
    private(set) var refreshes = 0
    func start(session: GuardSession) async { isActive = true }
    func update(level: EscalationLevel, statusText: String, nextCheckInAt: Date?, deadline: Date?) async {
        lastLevel = level
        lastStatus = statusText
        lastNextCheckIn = nextCheckInAt
    }
    func end() async { isActive = false }
    func startForAlert() async {
        alertStarts += 1
        isActive = true
    }
    func refresh() async { refreshes += 1 }
}

@MainActor
final class NoopNotificationService: NotificationServiceProtocol {
    private(set) var scheduled: [Date] = []
    var authorization: PermissionState = .granted
    func requestAuthorization() async -> Bool { true }
    func authorizationState() async -> PermissionState { authorization }
    func scheduleCheckIn(at date: Date, sessionID: UUID) { scheduled.append(date) }
    func cancelCheckIns() { scheduled.removeAll() }
    private(set) var notes: [String] = []
    func notify(title: String, body: String, timeSensitive: Bool) { notes.append(title) }
    private(set) var drinkChecksOn = false
    func scheduleDrinkChecks() { drinkChecksOn = true }
    func cancelDrinkChecks() { drinkChecksOn = false }
}

@MainActor
final class NoopHeartbeatService: HeartbeatServiceProtocol {
    private(set) var isRunning = false
    private(set) var lastSentAt: Date?
    var isFailing = false
    func start(serverSessionID: String, interval: TimeInterval) { isRunning = true; lastSentAt = .now }
    func stop() { isRunning = false }
}
