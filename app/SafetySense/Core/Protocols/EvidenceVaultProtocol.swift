import Foundation

/// Encrypted evidence (SPEC 11): AES-GCM with a Keychain key, SHA-256 per clip,
/// uploaded as ciphertext while recording. Face ID gates viewing.
@MainActor
protocol EvidenceVaultProtocol: AnyObject {
    var clips: [EvidenceClip] { get }
    /// An alert is capturing. It says nothing about whether audio is actually arriving.
    var isCapturing: Bool { get }
    /// Audio has really reached the vault recently. What the Alert screen shows.
    var isRecordingEvidence: Bool { get }
    var isUnlocked: Bool { get }
    /// Starts capture for an alert, seeding with the 30 s pre-alert buffer if provided.
    func startCapture(alertID: UUID, serverAlertID: String?, prebuffer: Data?) async throws
    func stopCapture()
    func unlock(reason: String) async -> Bool
    func lock()
    func decrypt(_ clip: EvidenceClip) async throws -> Data
    func delete(_ clip: EvidenceClip) throws
    func deleteAll() throws
    /// The server id for clips sealed before `alert/create` answered.
    func setServerAlertID(_ serverAlertID: String, for alertID: UUID)
    /// Uploads whatever is still only on this phone.
    func uploadPending() async
}

extension EvidenceVaultProtocol {
    func setServerAlertID(_ serverAlertID: String, for alertID: UUID) {}
    func uploadPending() async {}
}
