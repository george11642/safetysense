import Foundation

/// Mirrors the backend API contract 1:1 (see ARCHITECTURE.md). Every method is one POST.
/// Implementations: `MockBackendClient` (demo/tests) and the real HTTP client
/// (System Integration module). Device routes throw `BackendError.notRegistered` until
/// `setCredentials` has been called.
protocol BackendClientProtocol: Sendable {
    var isConfigured: Bool { get async }
    func setCredentials(_ credentials: DeviceCredentials?) async

    func register(_ request: RegisterRequest) async throws -> RegisterResponse
    func setContacts(_ request: ContactsSetRequest) async throws -> OKResponse
    func startSession(_ request: SessionStartRequest) async throws -> SessionStartResponse
    func heartbeat(_ request: HeartbeatRequest) async throws -> HeartbeatResponse
    func endSession(_ request: SessionEndRequest) async throws -> OKResponse
    func createAlert(_ request: AlertCreateRequest) async throws -> AlertCreateResponse
    func escalateAlert(_ request: AlertEscalateRequest) async throws -> AlertEscalateResponse
    func cancelAlert(_ request: AlertCancelRequest) async throws -> AlertCancelResponse
    func updateAlertLocation(_ request: AlertLocationRequest) async throws -> OKResponse
    func alertStatus(_ request: AlertStatusRequest) async throws -> AlertStatusResponse
    func uploadEvidence(_ request: EvidenceUploadRequest) async throws -> OKResponse
    func getShare(_ request: ShareGetRequest) async throws -> ShareGetResponse
    func shareAction(_ request: ShareActionRequest) async throws -> OKResponse
}
