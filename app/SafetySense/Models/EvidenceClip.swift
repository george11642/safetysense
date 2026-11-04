import Foundation

/// One encrypted evidence chunk (SPEC 11). Audio is AES-GCM encrypted on device;
/// the server only ever holds ciphertext.
struct EvidenceClip: Codable, Sendable, Equatable, Identifiable {
    enum Kind: String, Codable, Sendable { case audio, location }

    var id: UUID
    var alertID: UUID
    var serverAlertID: String?
    /// Sequence number within the alert (matches `evidence/upload` `seq`).
    var seq: Int
    var kind: Kind
    var startedAt: Date
    var duration: TimeInterval
    /// SHA-256 of the ciphertext, hex encoded (tamper evidence).
    var sha256: String
    /// File name inside the vault directory (ciphertext).
    var fileName: String
    var byteCount: Int
    var uploaded: Bool

    init(id: UUID = UUID(), alertID: UUID, serverAlertID: String? = nil, seq: Int, kind: Kind = .audio,
         startedAt: Date, duration: TimeInterval, sha256: String, fileName: String, byteCount: Int,
         uploaded: Bool = false) {
        self.id = id
        self.alertID = alertID
        self.serverAlertID = serverAlertID
        self.seq = seq
        self.kind = kind
        self.startedAt = startedAt
        self.duration = duration
        self.sha256 = sha256
        self.fileName = fileName
        self.byteCount = byteCount
        self.uploaded = uploaded
    }
}
