import Foundation
import Security

/// Minimal secret storage abstraction so tests can swap in memory.
protocol SecretStore: Sendable {
    func data(for account: String) -> Data?
    @discardableResult func set(_ data: Data?, for account: String) -> Bool
}

/// Generic-password Keychain storage, device-only, available after first unlock
/// (so alerts work while the phone is locked).
struct KeychainSecretStore: SecretStore {
    var service: String = AppGroup.KeychainAccounts.service

    func data(for account: String) -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess else { return nil }
        return result as? Data
    }

    @discardableResult
    func set(_ data: Data?, for account: String) -> Bool {
        let base: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(base as CFDictionary)
        guard let data else { return true }
        var add = base
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        return SecItemAdd(add as CFDictionary, nil) == errSecSuccess
    }
}

/// In-memory secrets for tests, previews and `-ssDemo` runs.
final class InMemorySecretStore: SecretStore, @unchecked Sendable {
    private let lock = NSLock()
    private var storage: [String: Data] = [:]

    init() {}

    func data(for account: String) -> Data? {
        lock.withLock { storage[account] }
    }

    @discardableResult
    func set(_ data: Data?, for account: String) -> Bool {
        lock.withLock { storage[account] = data }
        return true
    }
}
