import Foundation

/// An alert the server hasn't confirmed. A real alert must reach contacts however long the phone
/// is offline and even if iOS kills the app, so this outlives the process.
struct PendingAlert: Codable, Sendable, Equatable {
    var record: AlertRecord
    /// A cancel waiting for the server's alert id (value: duress). nil when there's none.
    var cancel: Bool?
    var dispatchReason: String?
    /// A hidden duress alert: restored and sent, never shown.
    var hidden = false
    /// An attempt may have reached the server, so a valid cancel still has to be delivered.
    /// With this false, a valid cancel just drops the entry: nobody was ever told.
    var mayHaveLanded = false
    /// The server no longer knows this session (`alert/create` answered 404): send it without.
    var skipSession = false
}

/// Saved in the Keychain, not defaults: an entry can be a hidden duress alert, and nothing on
/// the phone may show one exists. Only the running alert's record is ever on screen.
struct PendingAlertStore: Sendable {
    private let secrets: any SecretStore

    init(secrets: any SecretStore) { self.secrets = secrets }

    /// Dies with the process. For previews, demos and tests.
    static var memory: PendingAlertStore { PendingAlertStore(secrets: InMemorySecretStore()) }
    static let keychain = PendingAlertStore(secrets: KeychainSecretStore())

    /// After this long a late "may need help" would only frighten someone.
    static let maxAge: TimeInterval = 2 * 3600

    func load(now: Date = .now) -> [PendingAlert] {
        guard let data = secrets.data(for: AppGroup.KeychainAccounts.pendingAlerts),
              let entries = try? JSONDecoder().decode([PendingAlert].self, from: data) else { return [] }
        return entries.filter { now.timeIntervalSince($0.record.startedAt) < Self.maxAge }
    }

    func save(_ entries: [PendingAlert]) {
        secrets.set(entries.isEmpty ? nil : try? JSONEncoder().encode(entries),
                    for: AppGroup.KeychainAccounts.pendingAlerts)
    }
}

extension Optional<BackendError> {
    /// The server has no such device, or doesn't accept its secret.
    var isUnauthorized: Bool {
        if case .http(401, _)? = self { return true }
        return false
    }
}
