import Foundation

/// In-memory backend that follows the API contract. Dispatch is always labelled "simulated".
actor MockBackendClient: BackendClientProtocol {
    private(set) var calls: [BackendRoute] = []
    private(set) var lastAlertCreate: AlertCreateRequest?
    private var credentials: DeviceCredentials?
    private var contacts: [ContactDTO] = []
    private var alerts: [String: (status: String, level: Int, events: [EventDTO], dispatch: DispatchDTO?)] = [:]
    /// Artificial latency to make demos feel real.
    var latency: Duration = .milliseconds(150)

    init(credentials: DeviceCredentials? = nil) {
        self.credentials = credentials
    }

    var isConfigured: Bool { true }

    func setCredentials(_ credentials: DeviceCredentials?) { self.credentials = credentials }

    private func record(_ route: BackendRoute) async throws {
        calls.append(route)
        try? await Task.sleep(for: latency)
        if route.requiresDeviceAuth, credentials == nil { throw BackendError.notRegistered }
    }

    private func now() -> String { ISO8601DateFormatter().string(from: .now) }

    func register(_ request: RegisterRequest) async throws -> RegisterResponse {
        try await record(.register)
        let creds = DeviceCredentials(deviceId: "mock-\(UUID().uuidString.prefix(8))", deviceSecret: "mock-secret")
        credentials = creds
        return creds
    }

    func setContacts(_ request: ContactsSetRequest) async throws -> OKResponse {
        try await record(.contactsSet)
        contacts = request.contacts
        return OKResponse(ok: true)
    }

    func startSession(_ request: SessionStartRequest) async throws -> SessionStartResponse {
        try await record(.sessionStart)
        return SessionStartResponse(sessionId: "mock-session-\(UUID().uuidString.prefix(8))")
    }

    func heartbeat(_ request: HeartbeatRequest) async throws -> HeartbeatResponse {
        try await record(.sessionHeartbeat)
        return HeartbeatResponse(ok: true, serverTime: now())
    }

    func endSession(_ request: SessionEndRequest) async throws -> OKResponse {
        try await record(.sessionEnd)
        return OKResponse(ok: true)
    }

    func createAlert(_ request: AlertCreateRequest) async throws -> AlertCreateResponse {
        try await record(.alertCreate)
        lastAlertCreate = request
        let id = "mock-alert-\(UUID().uuidString.prefix(8))"
        let notified = (contacts.isEmpty ? [ContactDTO(name: "Maya Chen", phone: "+15055550111")] : contacts).enumerated().map { i, c in
            NotifiedContact(name: c.name, channel: i == 0 ? .call : .sms, status: request.dryRun == true ? "test" : (i == 0 ? "ringing" : "sent"))
        }
        alerts[id] = (status: "active", level: request.level,
                      events: [EventDTO(who: "SafetySense", action: "notified", at: now())], dispatch: nil)
        return AlertCreateResponse(alertId: id, shareUrl: "https://safetysense.example/a/\(id)", notified: notified)
    }

    func escalateAlert(_ request: AlertEscalateRequest) async throws -> AlertEscalateResponse {
        try await record(.alertEscalate)
        let dispatch = DispatchDTO(provider: DispatchProvider.simulated.rawValue, alarmId: "sim-\(request.alertId.suffix(4))",
                                   status: "dispatcher calling you")
        alerts[request.alertId]?.level = 3
        alerts[request.alertId]?.dispatch = dispatch
        return AlertEscalateResponse(dispatch: dispatch)
    }

    func cancelAlert(_ request: AlertCancelRequest) async throws -> AlertCancelResponse {
        try await record(.alertCancel)
        // Duress: say "cancelled" but keep the alert going server side.
        if !request.duress { alerts[request.alertId]?.status = "cancelled" }
        return AlertCancelResponse(ok: true, status: "cancelled")
    }

    func updateAlertLocation(_ request: AlertLocationRequest) async throws -> OKResponse {
        try await record(.alertLocation)
        return OKResponse(ok: true)
    }

    func alertStatus(_ request: AlertStatusRequest) async throws -> AlertStatusResponse {
        try await record(.alertStatus)
        guard let a = alerts[request.alertId] else { throw BackendError.http(status: 404, message: "alert not found") }
        return AlertStatusResponse(status: a.status, level: a.level, dispatch: a.dispatch, events: a.events)
    }

    func uploadEvidence(_ request: EvidenceUploadRequest) async throws -> OKResponse {
        try await record(.evidenceUpload)
        return OKResponse(ok: true)
    }

    func getShare(_ request: ShareGetRequest) async throws -> ShareGetResponse {
        try await record(.shareGet)
        return ShareGetResponse(firstName: "Alex", status: "active", level: 2, reason: "Scream, then no movement",
                                startedAt: now(), location: ShareLocationDTO(lat: 35.0844, lng: -106.6198, accuracy: 12, at: now()),
                                battery: 0.82, events: [], sealedDetails: nil)
    }

    func shareAction(_ request: ShareActionRequest) async throws -> OKResponse {
        try await record(.shareAction)
        return OKResponse(ok: true)
    }
}
