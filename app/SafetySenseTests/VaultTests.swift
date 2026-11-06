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
