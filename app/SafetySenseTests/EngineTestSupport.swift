import Foundation
@testable import SafetySense

/// Zero-latency backend that records every call. Never touches the network.
actor EngineFakeBackend: BackendClientProtocol {
    private(set) var creates: [AlertCreateRequest] = []
    private(set) var escalations: [AlertEscalateRequest] = []
    private(set) var cancels: [AlertCancelRequest] = []
    private(set) var locations: [AlertLocationRequest] = []
    private(set) var statusRequests: [AlertStatusRequest] = []
    var failCreates = false
    var failEscalations = false
    var statusResponse: AlertStatusResponse?
    private var holdCreates = false
    private var gates: [CheckedContinuation<Void, Never>] = []
    private var counter = 0

    var isConfigured: Bool { true }
    func setCredentials(_ credentials: DeviceCredentials?) {}

    func setFailCreates(_ value: Bool) { failCreates = value }
    func setFailEscalations(_ value: Bool) { failEscalations = value }
    func setStatus(_ response: AlertStatusResponse?) { statusResponse = response }
    func setHoldCreates(_ value: Bool) { holdCreates = value }
    var heldCount: Int { gates.count }
    func releaseCreates() {
        holdCreates = false
        let waiting = gates
        gates.removeAll()
        waiting.forEach { $0.resume() }
    }

    func register(_ request: RegisterRequest) async throws -> RegisterResponse {
        DeviceCredentials(deviceId: "test-device", deviceSecret: "test-secret")
    }
    func setContacts(_ request: ContactsSetRequest) async throws -> OKResponse { OKResponse(ok: true) }
    private(set) var sessionStarts: [SessionStartRequest] = []
    func startSession(_ request: SessionStartRequest) async throws -> SessionStartResponse {
        sessionStarts.append(request)
        return SessionStartResponse(sessionId: "session-1")
    }
    func heartbeat(_ request: HeartbeatRequest) async throws -> HeartbeatResponse {
        HeartbeatResponse(ok: true, serverTime: "2026-11-04T23:00:00Z")
    }
    func endSession(_ request: SessionEndRequest) async throws -> OKResponse { OKResponse(ok: true) }

    func createAlert(_ request: AlertCreateRequest) async throws -> AlertCreateResponse {
        creates.append(request)
        if holdCreates { await withCheckedContinuation { gates.append($0) } }
        if failCreates { throw BackendError.transport("offline") }
        counter += 1
        return AlertCreateResponse(alertId: "alert-\(counter)", shareUrl: "https://safetysense-live.vercel.app/a/token\(counter)",
                                   notified: [NotifiedContact(name: "Maya Chen", channel: .call, status: "queued")])
    }

    func escalateAlert(_ request: AlertEscalateRequest) async throws -> AlertEscalateResponse {
        escalations.append(request)
        if failEscalations { throw BackendError.transport("offline") }
        return AlertEscalateResponse(dispatch: DispatchDTO(provider: "simulated", alarmId: "sim-1", status: "requested"))
    }

    func cancelAlert(_ request: AlertCancelRequest) async throws -> AlertCancelResponse {
        cancels.append(request)
        return AlertCancelResponse(ok: true, status: "cancelled")
    }

    func updateAlertLocation(_ request: AlertLocationRequest) async throws -> OKResponse {
        locations.append(request)
        return OKResponse(ok: true)
    }

    func alertStatus(_ request: AlertStatusRequest) async throws -> AlertStatusResponse {
        statusRequests.append(request)
        return statusResponse ?? AlertStatusResponse(status: "active", level: 2, dispatch: nil, events: [])
    }

    func uploadEvidence(_ request: EvidenceUploadRequest) async throws -> OKResponse { OKResponse(ok: true) }
    func getShare(_ request: ShareGetRequest) async throws -> ShareGetResponse { throw BackendError.notConfigured }
    func shareAction(_ request: ShareActionRequest) async throws -> OKResponse { OKResponse(ok: true) }
}

@MainActor
final class RecordingEvidence: EvidenceHandling {
    private(set) var prepared: [UUID] = []
    private(set) var committed: [(UUID, String?)] = []
    private(set) var stopped: [UUID] = []

    var isCapturing: Bool { !committed.isEmpty && committed.count > stopped.count }

    func prepare(alertID: UUID) { prepared.append(alertID) }
    func commit(alertID: UUID, serverAlertID: String?, mode: GuardMode) async { committed.append((alertID, serverAlertID)) }
    func stop(alertID: UUID) { stopped.append(alertID) }
}

@MainActor
final class FixedContext: AlertContextProviding {
    var context = AlertContext(latitude: 35.0844, longitude: -106.6198, accuracy: 12, battery: 0.8)
    func alertContext() async -> AlertContext { context }
}

@MainActor
final class CountingHaptics: EngineHaptics {
    private(set) var checkIns = 0
    private(set) var cancels = 0
    func checkIn() { checkIns += 1 }
    func cancelled() { cancels += 1 }
}

@MainActor
final class StubSecondOpinion: SecondOpinionProtocol {
    var isAvailable = true
    var result: SecondOpinion?
    private(set) var calls = 0
    private(set) var lastTranscript = ""
    func evaluate(transcript: String, signals: [RiskSignal], mode: GuardMode) async -> SecondOpinion? {
        calls += 1
        lastTranscript = transcript
        return result
    }
}

/// Everything a ladder test needs, on a manual clock.
@MainActor
struct LadderHarness {
    let clock = ManualEngineClock()
    let backend = EngineFakeBackend()
    let evidence = RecordingEvidence()
    let context = FixedContext()
    let haptics = CountingHaptics()
    let controller: EscalationController
    var changes: [(EscalationLevel, AlertRecord?)] { recorder.changes }
    private let recorder = ChangeRecorder()

    init(mode: GuardMode = .nightOut, checkInInterval: TimeInterval = 0,
         policies: DispatchPolicySettings = .default) {
        controller = EscalationController(backend: backend, clock: clock, context: context, evidence: evidence,
                                          haptics: haptics, timing: .immediate)
        let recorder = self.recorder
        controller.onChange = { level, alert in recorder.changes.append((level, alert)) }
        let session = GuardSession(serverSessionID: "session-1", mode: mode, startedAt: clock.now,
                                   checkInInterval: checkInInterval)
        controller.begin(session: session, policies: policies)
    }

    /// Advance the clock and let every backend call it started finish.
    func advance(_ seconds: TimeInterval) async {
        clock.advance(by: seconds)
        await controller.settle()
    }

    func assessment(_ level: RiskLevel, kinds: [RiskSignalKind] = [.scream], explanation: String = "Scream") -> RiskAssessment {
        RiskAssessment(score: level == .high ? 3 : 1.2, level: level,
                       contributors: kinds.map { RiskSignal(kind: $0, weight: 1, timestamp: clock.now) },
                       explanation: explanation, secondOpinionAdjustment: nil, evaluatedAt: clock.now)
    }
}

@MainActor
final class ChangeRecorder {
    var changes: [(EscalationLevel, AlertRecord?)] = []
}

extension Calendar {
    /// Gregorian calendar fixed to Albuquerque so hour-of-day rules are deterministic.
    static var albuquerque: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "America/Denver")!
        return c
    }
}

extension Date {
    /// A fixed date at the given local Albuquerque hour.
    static func albuquerque(hour: Int, minute: Int = 0) -> Date {
        var components = DateComponents()
        components.year = 2026
        components.month = 11
        components.day = 6
        components.hour = hour
        components.minute = minute
        return Calendar.albuquerque.date(from: components)!
    }
}
