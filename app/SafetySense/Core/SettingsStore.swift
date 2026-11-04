import CryptoKit
import Foundation

/// Persistence for profile, contacts, settings and onboarding state (App Group UserDefaults)
/// plus secrets (Keychain): PIN hashes, safe word, device credentials.
@MainActor
final class SettingsStore {
    private let defaults: UserDefaults
    private let secrets: SecretStore
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init(defaults: UserDefaults = AppGroup.defaults, secrets: SecretStore = KeychainSecretStore()) {
        self.defaults = defaults
        self.secrets = secrets
    }

    /// Fresh, isolated store for tests / demo launches.
    static func ephemeral(name: String = "ss.ephemeral.\(UUID().uuidString)") -> SettingsStore {
        let d = UserDefaults(suiteName: name) ?? .standard
        d.removePersistentDomain(forName: name)
        return SettingsStore(defaults: d, secrets: InMemorySecretStore())
    }

    // MARK: Codable values

    func load<T: Decodable>(_ type: T.Type, key: String) -> T? {
        guard let data = defaults.data(forKey: key) else { return nil }
        return try? decoder.decode(T.self, from: data)
    }

    func save<T: Encodable>(_ value: T?, key: String) {
        guard let value, let data = try? encoder.encode(value) else {
            defaults.removeObject(forKey: key)
            return
        }
        defaults.set(data, forKey: key)
    }

    var profile: Profile? {
        get { load(Profile.self, key: AppGroup.Keys.profile) }
        set { save(newValue, key: AppGroup.Keys.profile) }
    }

    var contacts: [TrustedContact] {
        get { load([TrustedContact].self, key: AppGroup.Keys.contacts) ?? [] }
        set { save(newValue, key: AppGroup.Keys.contacts) }
    }

    var settings: AppSettings {
        get { load(AppSettings.self, key: AppGroup.Keys.settings) ?? AppSettings() }
        set { save(newValue, key: AppGroup.Keys.settings) }
    }

    var onboardingComplete: Bool {
        get { defaults.bool(forKey: AppGroup.Keys.onboardingComplete) }
        set { defaults.set(newValue, forKey: AppGroup.Keys.onboardingComplete) }
    }

    var currentSession: GuardSession? {
        get { load(GuardSession.self, key: AppGroup.Keys.currentSession) }
        set { save(newValue, key: AppGroup.Keys.currentSession) }
    }

    var currentAlert: AlertRecord? {
        get { load(AlertRecord.self, key: AppGroup.Keys.currentAlert) }
        set { save(newValue, key: AppGroup.Keys.currentAlert) }
    }

    // MARK: Secrets

    var hasSafetyPIN: Bool { secrets.data(for: AppGroup.KeychainAccounts.safetyPINHash) != nil }
    var hasDuressPIN: Bool { secrets.data(for: AppGroup.KeychainAccounts.duressPINHash) != nil }

    func setSafetyPIN(_ pin: String?) {
        secrets.set(pin.map(Self.hash), for: AppGroup.KeychainAccounts.safetyPINHash)
    }

    func setDuressPIN(_ pin: String?) {
        secrets.set(pin.map(Self.hash), for: AppGroup.KeychainAccounts.duressPINHash)
    }

    /// Duress is checked first so a duress PIN can never also count as valid.
    func verifyPIN(_ pin: String) -> PINVerification {
        let h = Self.hash(pin)
        if let duress = secrets.data(for: AppGroup.KeychainAccounts.duressPINHash), duress == h { return .duress }
        if let safety = secrets.data(for: AppGroup.KeychainAccounts.safetyPINHash), safety == h { return .valid }
        return .invalid
    }

    var safeWord: String? {
        get { secrets.data(for: AppGroup.KeychainAccounts.safeWord).flatMap { String(data: $0, encoding: .utf8) } }
        set { secrets.set(newValue.map { Data($0.utf8) }, for: AppGroup.KeychainAccounts.safeWord) }
    }

    var deviceCredentials: DeviceCredentials? {
        get {
            secrets.data(for: AppGroup.KeychainAccounts.deviceCredentials)
                .flatMap { try? decoder.decode(DeviceCredentials.self, from: $0) }
        }
        set {
            secrets.set(newValue.flatMap { try? encoder.encode($0) }, for: AppGroup.KeychainAccounts.deviceCredentials)
        }
    }

    /// "Delete everything" (SPEC 11): wipes local state and secrets.
    func eraseAll() {
        for key in [AppGroup.Keys.profile, AppGroup.Keys.contacts, AppGroup.Keys.settings,
                    AppGroup.Keys.onboardingComplete, AppGroup.Keys.currentSession,
                    AppGroup.Keys.currentAlert, AppGroup.Keys.alertHistory, AppGroup.Keys.evidenceIndex,
                    AppGroup.Keys.pendingCommands, AppGroup.Keys.widgetEscalationLevel,
                    AppGroup.Keys.widgetGuardActive, AppGroup.Keys.heartbeatSessionID,
                    AppGroup.Keys.heartbeatLastSentAt, AppGroup.Keys.backendOutbox,
                    AppGroup.Keys.externalAlert] {
            defaults.removeObject(forKey: key)
        }
        for account in [AppGroup.KeychainAccounts.safetyPINHash, AppGroup.KeychainAccounts.duressPINHash,
                        AppGroup.KeychainAccounts.safeWord, AppGroup.KeychainAccounts.deviceCredentials,
                        AppGroup.KeychainAccounts.evidenceKey] {
            secrets.set(nil, for: account)
        }
    }

    nonisolated static func hash(_ pin: String) -> Data {
        // Salted so identical PINs across apps don't collide; this is device-local only.
        Data(SHA256.hash(data: Data("safetysense.pin.v1:\(pin)".utf8)))
    }
}
