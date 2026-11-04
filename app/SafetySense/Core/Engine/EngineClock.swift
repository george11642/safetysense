import Foundation

/// Time source + one-shot timers for the guard engine. Injected so the escalation ladder
/// (45 s check-in, 90 s alert -> dispatch) can be tested without waiting in real time.
@MainActor
protocol EngineClock: AnyObject {
    var now: Date { get }
    /// Runs `action` once on the main actor after `seconds`. Cancel through the returned timer.
    @discardableResult
    func schedule(after seconds: TimeInterval, _ action: @escaping @MainActor () -> Void) -> EngineTimer
}

/// Handle for a scheduled action. Cancelling twice is harmless.
@MainActor
final class EngineTimer {
    private var onCancel: (@MainActor () -> Void)?
    private(set) var isCancelled = false

    init(onCancel: @escaping @MainActor () -> Void) {
        self.onCancel = onCancel
    }

    func cancel() {
        guard !isCancelled else { return }
        isCancelled = true
        onCancel?()
        onCancel = nil
    }
}

/// Wall-clock implementation backed by `Task.sleep`. Keeps running while the app is
/// alive in the background (audio / location background modes keep it alive during a session).
@MainActor
final class SystemEngineClock: EngineClock {
    var now: Date { .now }

    @discardableResult
    func schedule(after seconds: TimeInterval, _ action: @escaping @MainActor () -> Void) -> EngineTimer {
        let delay = max(0, seconds)
        let task = Task { @MainActor in
            try? await Task.sleep(for: .seconds(delay))
            guard !Task.isCancelled else { return }
            action()
        }
        return EngineTimer { task.cancel() }
    }
}

/// Deterministic clock for tests, previews and the scripted demo. Time only moves when
/// `advance(by:)` is called; due actions fire in order, synchronously.
@MainActor
final class ManualEngineClock: EngineClock {
    private struct Pending {
        let id: Int
        let fireAt: Date
        let action: @MainActor () -> Void
    }

    private(set) var now: Date
    private var pending: [Pending] = []
    private var nextID = 0

    init(now: Date = Date(timeIntervalSince1970: 1_793_000_000)) {
        self.now = now
    }

    var pendingCount: Int { pending.count }

    @discardableResult
    func schedule(after seconds: TimeInterval, _ action: @escaping @MainActor () -> Void) -> EngineTimer {
        nextID += 1
        let id = nextID
        pending.append(Pending(id: id, fireAt: now.addingTimeInterval(max(0, seconds)), action: action))
        return EngineTimer { [weak self] in self?.pending.removeAll { $0.id == id } }
    }

    /// Moves time forward, firing every action that falls due (including ones scheduled by
    /// earlier actions inside the same window) in time order.
    func advance(by seconds: TimeInterval) {
        let target = now.addingTimeInterval(seconds)
        while let next = pending.filter({ $0.fireAt <= target })
            .min(by: { ($0.fireAt, $0.id) < ($1.fireAt, $1.id) }) {
            pending.removeAll { $0.id == next.id }
            now = next.fireAt
            next.action()
        }
        now = target
    }

    func set(_ date: Date) {
        now = date
    }
}
