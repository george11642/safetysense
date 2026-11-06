import Foundation

/// Heartbeats and alert locations that couldn't be sent (no signal, server hiccup). They're
/// kept in the app's defaults so a background refresh or the next launch can deliver them.
///
/// - Heartbeats are coalesced: only the newest one per session matters, because delivering it
///   tells the server "this phone is alive, and here's where it last was".
/// - Locations are kept in order, at most `maxLocationsPerAlert` per alert, so contacts' live map
///   can fill in the trail once the phone reconnects.
/// - Anything older than `maxAge` is dropped; stale points aren't useful to anyone.
/// - A session end or an alert cancel is different: until it lands, the server's watchdog will
///   act on a session or alert the person already closed. Those stay for `durableMaxAge`, and the
///   client keeps retrying them on its own. An alert create needs its answer on the phone, so
///   `EscalationController` retries that one itself (`PendingAlertStore`).
struct BackendOutbox: Sendable {
    enum Item: Codable, Sendable, Equatable {
        case heartbeat(HeartbeatRequest)
        case location(AlertLocationRequest)
        case sessionEnd(SessionEndRequest)
        case alertCancel(AlertCancelRequest)

        /// Retried until it lands instead of aging out with the telemetry.
        var isDurable: Bool {
            switch self {
            case .sessionEnd, .alertCancel: true
            case .heartbeat, .location: false
            }
        }
    }

    struct Entry: Codable, Sendable, Equatable {
        var item: Item
        var enqueuedAt: Date
    }

    static let maxLocationsPerAlert = 30
    static let maxAge: TimeInterval = 30 * 60
    /// The server stops acting on a session or alert well before this.
    static let durableMaxAge: TimeInterval = 48 * 3600

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
        return entries.filter { now.timeIntervalSince($0.enqueuedAt) < ($0.item.isDurable ? Self.durableMaxAge : Self.maxAge) }
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
        case .sessionEnd(let end):
            // Nothing for this session may arrive after its end.
            entries.removeAll {
                switch $0.item {
                case .heartbeat(let beat): beat.sessionId == end.sessionId
                case .sessionEnd(let old): old.sessionId == end.sessionId
                default: false
                }
            }
        case .alertCancel(let cancel):
            // A duress cancel keeps its location trail: help is still being sent.
            entries.removeAll {
                switch $0.item {
                case .alertCancel(let old): old.alertId == cancel.alertId
                case .location(let fix): !cancel.duress && fix.alertId == cancel.alertId
                default: false
                }
            }
        }
        entries.append(Entry(item: item, enqueuedAt: now))
        return entries
    }
}
