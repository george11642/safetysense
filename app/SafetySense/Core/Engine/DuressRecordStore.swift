import Foundation

/// A duress alert this phone ran. Hiding has no end date: the person may be held for longer than
/// the alert runs, and the app may be relaunched while she is.
struct DuressRecord: Codable, Sendable, Equatable {
    var alertID: UUID
    /// Clips of this alert that run past this moment stay out of the Vault.
    /// nil once the person has brought them back with their safety PIN.
    var hiddenFrom: Date?
    var enteredAt: Date

    /// A clip that started before the PIN and ended after it holds audio from after the PIN.
    func hides(_ clip: EvidenceClip) -> Bool {
        guard clip.alertID == alertID, let hiddenFrom else { return false }
        return clip.startedAt.addingTimeInterval(clip.duration) > hiddenFrom
    }
}

/// Saved in the Keychain for the same reason as `PendingAlertStore`: nothing on the phone may show
/// that a duress PIN was used.
struct DuressRecordStore: Sendable {
    /// Matches the server's `SHARE_MAX_AGE_S`: how long the alert's live link can still open.
    static let liveLinkLifetime: TimeInterval = 48 * 3600

    private let secrets: any SecretStore

    init(secrets: any SecretStore) { self.secrets = secrets }

    /// Dies with the process. For previews, demos and tests.
    static var memory: DuressRecordStore { DuressRecordStore(secrets: InMemorySecretStore()) }
    static let keychain = DuressRecordStore(secrets: KeychainSecretStore())

    /// Reads the Keychain every time. A launch in the background before the first unlock reads
    /// nothing, and that empty answer must not still be in use once the Vault can be opened.
    func load() -> [DuressRecord] {
        guard let data = secrets.data(for: AppGroup.KeychainAccounts.duressRecords) else { return [] }
        return (try? JSONDecoder().decode([DuressRecord].self, from: data)) ?? []
    }

    @discardableResult
    func save(_ records: [DuressRecord]) -> Bool {
        secrets.set(records.isEmpty ? nil : try? JSONEncoder().encode(records),
                    for: AppGroup.KeychainAccounts.duressRecords)
    }

    /// Adds a duress alert, or updates one a relaunch picked up again. The earliest hiding time
    /// wins, and clips the person already brought back stay back.
    static func merging(_ record: DuressRecord, into records: [DuressRecord]) -> [DuressRecord] {
        guard let index = records.firstIndex(where: { $0.alertID == record.alertID }) else { return records + [record] }
        var merged = records
        if let saved = records[index].hiddenFrom, let new = record.hiddenFrom { merged[index].hiddenFrom = min(saved, new) }
        return merged
    }
}
