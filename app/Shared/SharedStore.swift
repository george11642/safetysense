import Foundation
import Security

/// A small key-value store the app and the widget extension both really see.
///
/// Uses the App Group's defaults when the container is available. The App Group can only be enabled
/// in the developer portal, so until then it uses Keychain items in the access group
/// `<team>.com.georgeteifel.SafetySense.shared`, which needs no portal change. Items are kept
/// readable after first unlock so Lock Screen controls work.
///
/// Only small, non-personal values belong here: widget mirrors and queued commands. Profile,
/// contacts and secrets stay in the app (`AppGroup.defaults`, `KeychainSecretStore`).
public struct SharedStore: Sendable {
    public let backend: any SharedStoreBackend

    public init(backend: any SharedStoreBackend) {
        self.backend = backend
    }

    /// This process's store, picked once.
    public static let shared = SharedStore(backend: makeBackend())

    private static func makeBackend() -> any SharedStoreBackend {
        if AppGroup.isContainerAvailable, let suite = UserDefaults(suiteName: AppGroup.identifier) {
            return DefaultsSharedBackend(defaults: suite)
        }
        let keychain = KeychainSharedBackend()
        // A build with neither (an unsigned test host) still works within one process.
        return keychain.isUsable ? keychain : DefaultsSharedBackend(defaults: .standard)
    }

    public func data(forKey key: String) -> Data? { backend.data(forKey: key) }
    public func set(_ data: Data?, forKey key: String) { backend.set(data, forKey: key) }
    public func keys(withPrefix prefix: String) -> [String] { backend.keys(withPrefix: prefix) }

    public func bool(forKey key: String) -> Bool { data(forKey: key)?.first == 1 }
    public func set(_ value: Bool, forKey key: String) { set(Data([value ? 1 : 0]), forKey: key) }

    public func int(forKey key: String) -> Int? {
        data(forKey: key).flatMap { String(data: $0, encoding: .utf8) }.flatMap(Int.init)
    }

    public func set(_ value: Int, forKey key: String) { set(Data(String(value).utf8), forKey: key) }

    /// Moves everything out of an older backend (Keychain items, once the App Group is enabled).
    public func adopt(from older: any SharedStoreBackend, keys: [String], prefixes: [String]) {
        for key in keys + prefixes.flatMap(older.keys(withPrefix:)) {
            guard let value = older.data(forKey: key) else { continue }
            if data(forKey: key) == nil { set(value, forKey: key) }
            older.set(nil, forKey: key)
        }
    }

    /// "Delete everything" (SPEC 11).
    public func eraseAll() {
        set(nil, forKey: AppGroup.Keys.widgetEscalationLevel)
        set(nil, forKey: AppGroup.Keys.widgetGuardActive)
        keys(withPrefix: SharedCommandQueue.itemPrefix).forEach { set(nil, forKey: $0) }
    }
}

/// Each `set` must be atomic for that one key across processes.
public protocol SharedStoreBackend: Sendable {
    func data(forKey key: String) -> Data?
    func set(_ data: Data?, forKey key: String)
    func keys(withPrefix prefix: String) -> [String]
}

public struct DefaultsSharedBackend: SharedStoreBackend, @unchecked Sendable {
    private let defaults: UserDefaults

    public init(defaults: UserDefaults) {
        self.defaults = defaults
    }

    public func data(forKey key: String) -> Data? { defaults.data(forKey: key) }

    public func set(_ data: Data?, forKey key: String) {
        if let data { defaults.set(data, forKey: key) } else { defaults.removeObject(forKey: key) }
    }

    public func keys(withPrefix prefix: String) -> [String] {
        defaults.dictionaryRepresentation().keys.filter { $0.hasPrefix(prefix) }
    }
}

public struct KeychainSharedBackend: SharedStoreBackend {
    /// `$(AppIdentifierPrefix)` from Info.plist, for example `K89F44WFKH.`.
    static var appIdentifierPrefix: String {
        let value = Bundle.main.object(forInfoDictionaryKey: "SSAppIdentifierPrefix") as? String
        guard let value, !value.isEmpty, !value.hasPrefix("$(") else { return "K89F44WFKH." }
        return value
    }

    public static var defaultAccessGroup: String {
        appIdentifierPrefix + AppGroup.KeychainAccounts.sharedService
    }

    public var accessGroup: String
    public var service: String

    public init(accessGroup: String = Self.defaultAccessGroup,
                service: String = AppGroup.KeychainAccounts.sharedService) {
        self.accessGroup = accessGroup
        self.service = service
    }

    /// False when this process isn't entitled to the access group.
    public var isUsable: Bool {
        var query = base
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        return SecItemCopyMatching(query as CFDictionary, nil) != errSecMissingEntitlement
    }

    private var base: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: service,
         kSecAttrAccessGroup as String: accessGroup,
         kSecUseDataProtectionKeychain as String: true]
    }

    private func item(_ key: String) -> [String: Any] {
        var query = base
        query[kSecAttrAccount as String] = key
        return query
    }

    public func data(forKey key: String) -> Data? {
        var query = item(key)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess else { return nil }
        return result as? Data
    }

    public func set(_ data: Data?, forKey key: String) {
        guard let data else {
            SecItemDelete(item(key) as CFDictionary)
            return
        }
        let update = [kSecValueData as String: data]
        if SecItemUpdate(item(key) as CFDictionary, update as CFDictionary) == errSecItemNotFound {
            var add = item(key)
            add[kSecValueData as String] = data
            add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            SecItemAdd(add as CFDictionary, nil)
        }
    }

    public func keys(withPrefix prefix: String) -> [String] {
        var query = base
        query[kSecReturnAttributes as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitAll
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let items = result as? [[String: Any]] else { return [] }
        return items.compactMap { $0[kSecAttrAccount as String] as? String }.filter { $0.hasPrefix(prefix) }
    }
}

/// For tests and previews.
public final class InMemorySharedBackend: SharedStoreBackend, @unchecked Sendable {
    private let lock = NSLock()
    private var items: [String: Data] = [:]

    public init() {}

    public func data(forKey key: String) -> Data? { lock.withLock { items[key] } }
    public func set(_ data: Data?, forKey key: String) { lock.withLock { items[key] = data } }

    public func keys(withPrefix prefix: String) -> [String] {
        lock.withLock { items.keys.filter { $0.hasPrefix(prefix) } }
    }
}
