import CryptoKit
import Foundation
import Testing
@testable import SafetySense

@MainActor
struct VaultTests {
    @Test func sealUploadDecryptTamper() async throws {
        let dir = FileManager.default.temporaryDirectory.appending(path: "vt-\(UUID().uuidString)")
        let backend = MockBackendClient(credentials: DeviceCredentials(deviceId: "d", deviceSecret: "s"))
        let secrets = InMemorySecretStore()
        let vault = SecureEvidenceVault(backend: backend, secrets: secrets, directory: dir, useMicrophone: false)
        let alert = UUID()
        let pre = Data("prebuffer-audio".utf8)
        try await vault.startCapture(alertID: alert, serverAlertID: nil, prebuffer: pre)
        try vault.append(WAV.encode(samples: [1, 2, 3, -4], sampleRate: 16000), duration: 15)
        #expect(vault.clips.count == 2)
        let wellFormed = vault.clips.filter { $0.sha256.count == 64 && !$0.uploaded }.count
        #expect(wellFormed == 2)
        // Ciphertext on disk is not the plaintext.
        let raw = try Data(contentsOf: dir.appending(path: vault.clips[0].fileName))
        #expect(raw.range(of: pre) == nil)
        vault.setServerAlertID("srv-1", for: alert)
        await vault.uploadPending()
        let pending = vault.clips.filter { !$0.uploaded }.count
        #expect(pending == 0)
        let uploads = await backend.calls.filter { $0 == .evidenceUpload }.count
        #expect(uploads == 2)
        // Locked vault refuses to decrypt.
        await #expect(throws: (any Error).self) { _ = try await vault.decrypt(vault.clips[0]) }
        let key = SymmetricKey(data: secrets.data(for: AppGroup.KeychainAccounts.evidenceKey)!)
        let opened = try SecureEvidenceVault.open(raw, for: vault.clips[0], key: key)
        #expect(opened == pre)
        var tampered = raw; tampered[tampered.count - 1] ^= 0xFF
        #expect(throws: SecureEvidenceVault.VaultError.self) { _ = try SecureEvidenceVault.open(tampered, for: vault.clips[0], key: key) }
        // Swapping a chunk into another sequence slot fails authentication.
        var moved = vault.clips[0]; moved.seq = 7; moved.sha256 = SecureEvidenceVault.sha256Hex(raw)
        #expect(throws: (any Error).self) { _ = try SecureEvidenceVault.open(raw, for: moved, key: key) }
        // Index persists (encrypted) across instances.
        let reopened = SecureEvidenceVault(backend: backend, secrets: secrets, directory: dir, useMicrophone: false)
        #expect(reopened.clips.count == 2)
        try reopened.deleteAll()
        #expect(reopened.clips.isEmpty)
    }

    private func vaultWithTwoClips(_ dir: URL, _ secrets: InMemorySecretStore) async throws -> SecureEvidenceVault {
        let backend = MockBackendClient(credentials: DeviceCredentials(deviceId: "d", deviceSecret: "s"))
        let vault = SecureEvidenceVault(backend: backend, secrets: secrets, directory: dir, useMicrophone: false)
        try await vault.startCapture(alertID: UUID(), serverAlertID: nil, prebuffer: Data("before".utf8))
        try vault.append(Data("during".utf8), duration: 15)
        vault.stopCapture()
        return vault
    }

    private func relaunchedVault(_ dir: URL, _ secrets: InMemorySecretStore) -> SecureEvidenceVault {
        SecureEvidenceVault(backend: MockBackendClient(credentials: DeviceCredentials(deviceId: "d", deviceSecret: "s")),
                            secrets: secrets, directory: dir, useMicrophone: false)
    }

    /// A launch before the first unlock can't read the key, and the first save mustn't wipe the list.
    @Test func anIndexThatCantBeReadIsNeverSavedOver() async throws {
        let dir = FileManager.default.temporaryDirectory.appending(path: "vt-\(UUID().uuidString)")
        let secrets = InMemorySecretStore()
        _ = try await vaultWithTwoClips(dir, secrets)
        let indexURL = dir.appending(path: "index.ssenc")
        let onDisk = try Data(contentsOf: indexURL)
        let key = secrets.data(for: AppGroup.KeychainAccounts.evidenceKey)

        secrets.set(nil, for: AppGroup.KeychainAccounts.evidenceKey)
        let beforeUnlock = relaunchedVault(dir, secrets)
        #expect(beforeUnlock.clips.isEmpty)
        await beforeUnlock.uploadPending()   // This ends in a save.
        #expect(try Data(contentsOf: indexURL) == onDisk)
        // No new key either: it would strand every clip already saved.
        #expect(secrets.data(for: AppGroup.KeychainAccounts.evidenceKey) == nil)
        try await beforeUnlock.startCapture(alertID: UUID(), serverAlertID: nil, prebuffer: nil)
        #expect(throws: SecureEvidenceVault.VaultError.self) { try beforeUnlock.append(Data("x".utf8), duration: 1) }
        beforeUnlock.stopCapture()

        secrets.set(key, for: AppGroup.KeychainAccounts.evidenceKey)
        beforeUnlock.reloadIndexAfterUnlock()
        #expect(beforeUnlock.clips.count == 2)
    }

    /// Protected files can be unreadable with the key in hand. Clips saved meanwhile join the rest.
    @Test func clipsSavedWhileTheIndexWasUnreadableJoinTheOlderOnes() async throws {
        let dir = FileManager.default.temporaryDirectory.appending(path: "vt-\(UUID().uuidString)")
        let secrets = InMemorySecretStore()
        _ = try await vaultWithTwoClips(dir, secrets)
        let indexPath = dir.appending(path: "index.ssenc").path
        try FileManager.default.setAttributes([.posixPermissions: 0], ofItemAtPath: indexPath)

        let vault = relaunchedVault(dir, secrets)
        #expect(vault.clips.isEmpty)
        try await vault.startCapture(alertID: UUID(), serverAlertID: nil, prebuffer: Data("new".utf8))
        vault.stopCapture()
        #expect(vault.clips.count == 1)

        try FileManager.default.setAttributes([.posixPermissions: 0o644], ofItemAtPath: indexPath)
        vault.reloadIndexAfterUnlock()
        #expect(vault.clips.count == 3)
        #expect(relaunchedVault(dir, secrets).clips.count == 3)
    }

    /// Unlocked and still no key, as after moving to a new iPhone. Evidence must keep working.
    @Test func anIndexWhoseKeyIsGoneMovesAsideAndNewEvidenceStillSaves() async throws {
        let dir = FileManager.default.temporaryDirectory.appending(path: "vt-\(UUID().uuidString)")
        let secrets = InMemorySecretStore()
        _ = try await vaultWithTwoClips(dir, secrets)
        secrets.set(nil, for: AppGroup.KeychainAccounts.evidenceKey)

        let vault = relaunchedVault(dir, secrets)
        vault.reloadIndexAfterUnlock()
        try await vault.startCapture(alertID: UUID(), serverAlertID: nil, prebuffer: Data("new".utf8))
        vault.stopCapture()

        #expect(vault.clips.count == 1)
        #expect(relaunchedVault(dir, secrets).clips.count == 1)
        let files = try FileManager.default.contentsOfDirectory(atPath: dir.path)
        #expect(files.contains { $0.hasPrefix("index-unreadable-") })
    }

    @Test func retentionKeepsWhatItIsToldToKeep() async throws {
        let dir = FileManager.default.temporaryDirectory.appending(path: "vt-\(UUID().uuidString)")
        let vault = try await vaultWithTwoClips(dir, InMemorySecretStore())
        let hidden = vault.clips[0]
        vault.purge(olderThan: 1, now: .now.addingTimeInterval(3 * 86_400)) { $0.id == hidden.id }
        #expect(vault.clips == [hidden])
    }

    @Test func wavHeader() {
        let d = WAV.encode(samples: [0, 1], sampleRate: 16000)
        #expect(d.count == 48)
        #expect(d.prefix(4) == Data("RIFF".utf8))
    }

    @Test func phoneLinksAndNames() {
        #expect(PhoneLink.url("1-800-656-4673")?.absoluteString == "tel:18006564673")
        #expect(NameList.join(["Maya", "Jordan", "Sam"]) == "Maya, Jordan and Sam")
        #expect(SupportDirectory.quickDial(for: .cnm).first?.phone == "505-224-3001")
    }
}
