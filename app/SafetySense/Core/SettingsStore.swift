import CryptoKit
import Foundation

/// Persistence for profile, contacts, settings and onboarding state (`AppGroup.defaults`)
/// plus secrets (Keychain): PIN hashes, safe word, device credentials.
@MainActor
final class SettingsStore {
    private let defaults: UserDefaults
    private let secrets: SecretStore
    private let shared: SharedStore
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    /// This updates on every check-in, so the Keychain is only touched when the details change.
    private var savedSessionDetails: GuardSession.SensitiveDetails?

    init(defaults: UserDefaults = AppGroup.defaults, secrets: SecretStore = KeychainSecretStore(),
         shared: SharedStore = .shared) {
        self.defaults = defaults
        self.secrets = secrets
        self.shared = shared
    }

    /// Fresh, isolated store for tests / demo launches.
    static func ephemeral(name: String = "ss.ephemeral.\(UUID().uuidString)") -> SettingsStore {
        let d = UserDefaults(suiteName: name) ?? .standard
        d.removePersistentDomain(forName: name)
        return SettingsStore(defaults: d, secrets: InMemorySecretStore(),
                             shared: SharedStore(backend: InMemorySharedBackend()))
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

    /// The session, split in two: its bookkeeping in defaults, and everything that identifies
    /// someone or where they're going (`GuardSession.SensitiveDetails`) in the Keychain.
    var currentSession: GuardSession? {
        get {
            guard var session = load(GuardSession.self, key: AppGroup.Keys.currentSession) else { return nil }
            if !session.sensitiveDetails.isEmpty {
                saveSession(session)   // From a build that kept these in the plist: move them now.
            } else if let data = secrets.data(for: AppGroup.KeychainAccounts.sessionDetails),
                      let details = try? decoder.decode(GuardSession.SensitiveDetails.self, from: data) {
                session.sensitiveDetails = details
            }
            return session
        }
        set {
            guard let newValue else {
                save(GuardSession?.none, key: AppGroup.Keys.currentSession)
                secrets.set(nil, for: AppGroup.KeychainAccounts.sessionDetails)
                savedSessionDetails = nil
                return
            }
            saveSession(newValue)
        }
    }

    private func saveSession(_ session: GuardSession) {
        var session = session
        let details = session.sensitiveDetails
        if details != savedSessionDetails {
            secrets.set(details.isEmpty ? nil : try? encoder.encode(details), for: AppGroup.KeychainAccounts.sessionDetails)
            savedSessionDetails = details
        }
        session.sensitiveDetails = GuardSession.SensitiveDetails()
        save(session, key: AppGroup.Keys.currentSession)
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

    /// Credentials kept only to finish `account/delete` once the network is back.
    var pendingAccountDeletion: DeviceCredentials? {
        get {
            secrets.data(for: AppGroup.KeychainAccounts.pendingAccountDeletion)
                .flatMap { try? decoder.decode(DeviceCredentials.self, from: $0) }
        }
        set {
            secrets.set(newValue.flatMap { try? encoder.encode($0) },
                        for: AppGroup.KeychainAccounts.pendingAccountDeletion)
        }
    }

    /// "Delete everything" (SPEC 11): wipes local state and secrets.
    func eraseAll() {
        AppGroup.Keys.appLocal.forEach { defaults.removeObject(forKey: $0) }
        shared.eraseAll()
        for account in AppGroup.KeychainAccounts.erasable { secrets.set(nil, for: account) }
        savedSessionDetails = nil
    }

    /// What a forced "Delete everything" removes. It keeps the evidence, its key, this device's
    /// server link, and any alert or cancel still on its way. The safety PIN moves aside: onboarding
    /// has to read as a new start, but whoever sets up a PIN next mustn't unlock those clips.
    func eraseKeepingEvidence() {
        let kept = [AppGroup.Keys.evidenceIndex, AppGroup.Keys.backendOutbox]
        AppGroup.Keys.appLocal.filter { !kept.contains($0) }.forEach { defaults.removeObject(forKey: $0) }
        shared.eraseAll()
        let safety = secrets.data(for: AppGroup.KeychainAccounts.safetyPINHash)
        for account in [AppGroup.KeychainAccounts.safetyPINHash, AppGroup.KeychainAccounts.duressPINHash,
                        AppGroup.KeychainAccounts.safeWord, AppGroup.KeychainAccounts.sessionDetails] {
            secrets.set(nil, for: account)
        }
        secrets.set(safety, for: AppGroup.KeychainAccounts.parkedSafetyPINHash)
        savedSessionDetails = nil
    }

    var hasParkedSafetyPIN: Bool { secrets.data(for: AppGroup.KeychainAccounts.parkedSafetyPINHash) != nil }

    func isParkedSafetyPIN(_ pin: String) -> Bool {
        secrets.data(for: AppGroup.KeychainAccounts.parkedSafetyPINHash) == Self.hash(pin)
    }

    func clearParkedSafetyPIN() { secrets.set(nil, for: AppGroup.KeychainAccounts.parkedSafetyPINHash) }

    nonisolated static func hash(_ pin: String) -> Data {
        // Salted so identical PINs across apps don't collide; this is device-local only.
        Data(SHA256.hash(data: Data("safetysense.pin.v1:\(pin)".utf8)))
    }
}
