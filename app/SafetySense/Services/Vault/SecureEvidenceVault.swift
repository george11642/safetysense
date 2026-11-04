import CryptoKit
import Foundation
import LocalAuthentication
import Observation

/// Encrypted evidence vault (SPEC 11).
///
/// - Every chunk is sealed with AES-256-GCM. The key is generated on first use and kept in the
///   Keychain (`AppGroup.KeychainAccounts.evidenceKey`, this-device-only, after first unlock).
/// - The chunk's alert ID and sequence number are bound in as authenticated data, so a chunk
///   can't be swapped between alerts or reordered without failing to open.
/// - SHA-256 of the ciphertext is the tamper-evidence hash shown in the Vault and sent to
///   `evidence/upload`. The server only ever receives ciphertext.
/// - Ciphertext files live in Application Support/Vault with complete-until-first-auth file
///   protection, and the clip index is itself encrypted.
/// - Chunks upload as soon as they're sealed, so evidence survives if the phone is smashed.
///   Uploads that fail (or happen before the server alert ID is known) retry on every new chunk
///   and on `setServerAlertID`.
///
/// Live audio comes from `EvidenceMicrophone` (RAM-only PCM, flushed every `chunkSeconds`)
/// or from `append(_:duration:)` if another component already owns the microphone.
@Observable
@MainActor
final class SecureEvidenceVault: EvidenceVaultProtocol {
    enum VaultError: Error, LocalizedError {
        case tampered, missingFile, locked

        var errorDescription: String? {
            switch self {
            case .tampered: "This clip's hash doesn't match. It may have been altered."
            case .missingFile: "This clip's file is missing."
            case .locked: "Unlock the Vault first."
            }
        }
    }

    private(set) var clips: [EvidenceClip] = []
    private(set) var isCapturing = false
    private(set) var isUnlocked = false
    private(set) var lastUploadError: String?

    /// Seconds of audio per encrypted chunk.
    @ObservationIgnored var chunkSeconds: TimeInterval = 15

    @ObservationIgnored private let backend: any BackendClientProtocol
    @ObservationIgnored private let secrets: SecretStore
    @ObservationIgnored private let directory: URL
    @ObservationIgnored private let microphone: EvidenceMicrophone?
    @ObservationIgnored private var activeAlertID: UUID?
    @ObservationIgnored private var nextSeq = 0
    @ObservationIgnored private var serverIDs: [UUID: String] = [:]
    @ObservationIgnored private var uploading = false

    /// - Parameters:
    ///   - useMicrophone: record live audio with `EvidenceMicrophone` while capturing. Pass `false`
    ///     when another service feeds `append(_:duration:)`, and in tests.
    init(backend: any BackendClientProtocol, secrets: SecretStore = KeychainSecretStore(),
         directory: URL? = nil, useMicrophone: Bool = true) {
        self.backend = backend
        self.secrets = secrets
        self.directory = directory ?? Self.defaultDirectory()
        self.microphone = useMicrophone ? EvidenceMicrophone() : nil
        try? FileManager.default.createDirectory(at: self.directory, withIntermediateDirectories: true,
                                                 attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
        clips = loadIndex()
    }

    // MARK: EvidenceVaultProtocol

    func startCapture(alertID: UUID, serverAlertID: String?, prebuffer: Data?) async throws {
        if let serverAlertID { serverIDs[alertID] = serverAlertID }
        guard !isCapturing else { return }
        activeAlertID = alertID
        nextSeq = (clips.filter { $0.alertID == alertID }.map(\.seq).max() ?? -1) + 1
        isCapturing = true
        if let prebuffer, !prebuffer.isEmpty {
            try seal(prebuffer, duration: 30, startedAt: .now.addingTimeInterval(-30))
        }
        if let microphone {
            microphone.onChunk = { [weak self] data, duration, startedAt in
                guard let self, self.isCapturing else { return }
                try? self.seal(data, duration: duration, startedAt: startedAt)
            }
            try? microphone.start(chunkSeconds: chunkSeconds)
        }
    }

    func stopCapture() {
        microphone?.stop()   // flushes the last partial chunk through onChunk first
        isCapturing = false
        activeAlertID = nil
    }

    /// Server alert IDs often arrive after capture starts (alert/create latency).
    func setServerAlertID(_ serverAlertID: String, for alertID: UUID) {
        serverIDs[alertID] = serverAlertID
        var changed = false
        for i in clips.indices where clips[i].alertID == alertID && clips[i].serverAlertID == nil {
            clips[i].serverAlertID = serverAlertID
            changed = true
        }
        if changed { saveIndex() }
        Task { await uploadPending() }
    }

    /// Feeds a chunk recorded elsewhere (e.g. the audio guard's own engine).
    func append(_ data: Data, duration: TimeInterval, startedAt: Date = .now) throws {
        guard isCapturing else { return }
        try seal(data, duration: duration, startedAt: startedAt)
    }

    func unlock(reason: String) async -> Bool {
        switch await Self.authenticate(reason: reason) {
        case .some(true): isUnlocked = true
        case .some(false): isUnlocked = false
        case .none:
            // No passcode and no biometrics on this device: there's nothing stronger to check.
            isUnlocked = true
        }
        return isUnlocked
    }

    func lock() { isUnlocked = false }

    func decrypt(_ clip: EvidenceClip) async throws -> Data {
        guard isUnlocked else { throw VaultError.locked }
        let url = directory.appending(path: clip.fileName)
        guard let ciphertext = try? Data(contentsOf: url) else { throw VaultError.missingFile }
        return try Self.open(ciphertext, for: clip, key: key())
    }

    /// Verifies the clip's SHA-256, then opens the AES-GCM box bound to its alert and sequence.
    nonisolated static func open(_ ciphertext: Data, for clip: EvidenceClip, key: SymmetricKey) throws -> Data {
        guard sha256Hex(ciphertext) == clip.sha256 else { throw VaultError.tampered }
        let box = try AES.GCM.SealedBox(combined: ciphertext)
        return try AES.GCM.open(box, using: key, authenticating: aad(alertID: clip.alertID, seq: clip.seq))
    }

    func delete(_ clip: EvidenceClip) throws {
        try? FileManager.default.removeItem(at: directory.appending(path: clip.fileName))
        clips.removeAll { $0.id == clip.id }
        saveIndex()
    }

    func deleteAll() throws {
        stopCapture()
        if let files = try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil) {
            for f in files { try? FileManager.default.removeItem(at: f) }
        }
        clips.removeAll()
        secrets.set(nil, for: AppGroup.KeychainAccounts.evidenceKey)
    }

    /// Retention (SPEC 11): removes clips older than `days`.
    func purge(olderThan days: Int, now: Date = .now) {
        let cutoff = now.addingTimeInterval(-Double(days) * 86_400)
        for clip in clips where clip.startedAt < cutoff { try? delete(clip) }
    }

    // MARK: Sealing + upload

    private func seal(_ plaintext: Data, duration: TimeInterval, startedAt: Date) throws {
        guard let alertID = activeAlertID else { return }
        let seq = nextSeq
        nextSeq += 1
        let sealed = try AES.GCM.seal(plaintext, using: key(), authenticating: Self.aad(alertID: alertID, seq: seq))
        guard let ciphertext = sealed.combined else { return }
        let fileName = "\(alertID.uuidString.prefix(8))-\(seq).ssenc"
        try ciphertext.write(to: directory.appending(path: fileName),
                             options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        let clip = EvidenceClip(alertID: alertID, serverAlertID: serverIDs[alertID], seq: seq, kind: .audio,
                                startedAt: startedAt, duration: duration, sha256: Self.sha256Hex(ciphertext),
                                fileName: fileName, byteCount: ciphertext.count)
        clips.append(clip)
        saveIndex()
        Task { await uploadPending() }
    }

    func uploadPending() async {
        guard !uploading else { return }
        uploading = true
        defer { uploading = false }
        for clip in clips where !clip.uploaded {
            guard let serverID = clip.serverAlertID ?? serverIDs[clip.alertID],
                  let ciphertext = try? Data(contentsOf: directory.appending(path: clip.fileName)) else { continue }
            let request = EvidenceUploadRequest(alertId: serverID, seq: clip.seq, sha256: clip.sha256,
                                                ciphertextB64: ciphertext.base64EncodedString())
            do {
                _ = try await backend.uploadEvidence(request)
                if let i = clips.firstIndex(where: { $0.id == clip.id }) {
                    clips[i].uploaded = true
                    clips[i].serverAlertID = serverID
                }
                lastUploadError = nil
            } catch {
                lastUploadError = "Upload will retry."
            }
        }
        saveIndex()
    }

    // MARK: Key + index

    private func key() throws -> SymmetricKey {
        if let data = secrets.data(for: AppGroup.KeychainAccounts.evidenceKey), data.count == 32 {
            return SymmetricKey(data: data)
        }
        let key = SymmetricKey(size: .bits256)
        secrets.set(key.withUnsafeBytes { Data($0) }, for: AppGroup.KeychainAccounts.evidenceKey)
        return key
    }

    private var indexURL: URL { directory.appending(path: "index.ssenc") }

    private func saveIndex() {
        guard let json = try? JSONEncoder().encode(clips),
              let sealed = try? AES.GCM.seal(json, using: key(), authenticating: Data("index".utf8)).combined else { return }
        try? sealed.write(to: indexURL, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }

    private func loadIndex() -> [EvidenceClip] {
        guard let data = try? Data(contentsOf: indexURL),
              let keyData = secrets.data(for: AppGroup.KeychainAccounts.evidenceKey), keyData.count == 32,
              let box = try? AES.GCM.SealedBox(combined: data),
              let json = try? AES.GCM.open(box, using: SymmetricKey(data: keyData), authenticating: Data("index".utf8)),
              let clips = try? JSONDecoder().decode([EvidenceClip].self, from: json) else { return [] }
        return clips.sorted { ($0.startedAt, $0.seq) < ($1.startedAt, $1.seq) }
    }

    // MARK: Helpers

    nonisolated static func sha256Hex(_ data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }

    nonisolated static func aad(alertID: UUID, seq: Int) -> Data {
        Data("safetysense.evidence.v1:\(alertID.uuidString):\(seq)".utf8)
    }

    nonisolated static func defaultDirectory() -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        return base.appending(path: "Vault", directoryHint: .isDirectory)
    }

    /// `true` authenticated, `false` refused, `nil` no passcode/biometrics on this device.
    nonisolated private static func authenticate(reason: String) async -> Bool? {
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            return (error as? LAError)?.code == .passcodeNotSet ? nil : false
        }
        return await withCheckedContinuation { continuation in
            context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { ok, _ in
                continuation.resume(returning: ok)
            }
        }
    }
}

// MARK: Guard engine integration

/// The audio guard owns the single AVAudioEngine; during an alert it streams 5 s WAV chunks
/// (16-bit mono, 16 kHz) here instead of the vault opening a second microphone.
extension SecureEvidenceVault: LiveEvidenceAudioSink {
    func appendLiveAudio(_ chunk: Data, alertID: UUID, sequence: Int) {
        guard isCapturing else { return }
        // 44-byte WAV header, 2 bytes per sample at 16 kHz.
        let seconds = max(0.1, Double(max(0, chunk.count - 44)) / 32_000)
        try? append(chunk, duration: seconds, startedAt: .now.addingTimeInterval(-seconds))
    }
}
