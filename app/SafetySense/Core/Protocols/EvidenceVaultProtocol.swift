import Foundation

/// Encrypted evidence (SPEC 11): AES-GCM with a Keychain key, SHA-256 per clip,
/// uploaded as ciphertext while recording. Face ID gates viewing.
@MainActor
protocol EvidenceVaultProtocol: AnyObject {
    var clips: [EvidenceClip] { get }
    var isCapturing: Bool { get }
    var isUnlocked: Bool { get }
    /// Starts capture for an alert, seeding with the 30 s pre-alert buffer if provided.
    func startCapture(alertID: UUID, serverAlertID: String?, prebuffer: Data?) async throws
    func stopCapture()
    func unlock(reason: String) async -> Bool
    func lock()
    func decrypt(_ clip: EvidenceClip) async throws -> Data
    func delete(_ clip: EvidenceClip) throws
    func deleteAll() throws
}
