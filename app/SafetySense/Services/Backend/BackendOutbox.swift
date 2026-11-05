import Foundation

/// Heartbeats and alert locations that couldn't be sent (no signal, server hiccup). They're
/// kept in the app's defaults so a background refresh or the next launch can deliver them.
///
/// - Heartbeats are coalesced: only the newest one per session matters, because delivering it
///   tells the server "this phone is alive, and here's where it last was".
/// - Locations are kept in order, at most `maxLocationsPerAlert` per alert, so contacts' live map
///   can fill in the trail once the phone reconnects.
/// - Anything older than `maxAge` is dropped; stale points aren't useful to anyone.
struct BackendOutbox: Sendable {
    enum Item: Codable, Sendable, Equatable {
        case heartbeat(HeartbeatRequest)
        case location(AlertLocationRequest)
    }

    struct Entry: Codable, Sendable, Equatable {
        var item: Item
        var enqueuedAt: Date
    }

    static let maxLocationsPerAlert = 30
    static let maxAge: TimeInterval = 30 * 60

    private let key: String
    private let suiteName: String?

    init(key: String = AppGroup.Keys.backendOutbox, suiteName: String? = nil) {
        self.key = key
        self.suiteName = suiteName
    }

    private var defaults: UserDefaults {
        suiteName.flatMap(UserDefaults.init(suiteName:)) ?? AppGroup.defaults
    }

    func load(now: Date = .now) -> [Entry] {
        guard let data = defaults.data(forKey: key),
              let entries = try? JSONDecoder().decode([Entry].self, from: data) else { return [] }
        return entries.filter { now.timeIntervalSince($0.enqueuedAt) < Self.maxAge }
    }

    func save(_ entries: [Entry]) {
        if entries.isEmpty {
            defaults.removeObject(forKey: key)
        } else if let data = try? JSONEncoder().encode(entries) {
            defaults.set(data, forKey: key)
        }
    }

    func enqueue(_ item: Item, now: Date = .now) {
        save(Self.merging(item, into: load(now: now), now: now))
    }

    func clear() { save([]) }

    /// Pure merge rule (kept static so it's easy to test).
    static func merging(_ item: Item, into entries: [Entry], now: Date) -> [Entry] {
        var entries = entries
        switch item {
        case .heartbeat(let beat):
            entries.removeAll {
                if case .heartbeat(let old) = $0.item { return old.sessionId == beat.sessionId }
                return false
            }
        case .location(let fix):
            let sameAlert = entries.indices.filter {
                if case .location(let old) = entries[$0].item { return old.alertId == fix.alertId }
                return false
            }
            if sameAlert.count >= maxLocationsPerAlert, let oldest = sameAlert.first {
                entries.remove(at: oldest)
            }
        }
        entries.append(Entry(item: item, enqueuedAt: now))
        return entries
    }
}
