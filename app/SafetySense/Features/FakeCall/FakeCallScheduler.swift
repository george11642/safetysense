import Foundation
import Observation

/// Lines up a local notification so the call still rings when SafetySense is in the background.
@MainActor
protocol FakeCallNotifying: AnyObject {
    func schedule(at date: Date, config: FakeCallConfig)
    /// The in-app call is ringing. Remove the notification if the app is on screen; keep it if
    /// the phone is locked so the banner and ringtone still show.
    func ringingStarted()
    /// Scheduled call cancelled, or the call ended: remove anything pending or delivered.
    func cancel()
}

/// Sound, haptics and voice for the call. Kept behind a protocol so tests and QA screenshots
/// stay silent.
@MainActor
protocol FakeCallEffects: AnyObject {
    func startRinging()
    func stopRinging()
    func startCall(script: FakeCallScript)
    func endCall()
}

@MainActor
final class SilentFakeCallEffects: FakeCallEffects {
    func startRinging() {}
    func stopRinging() {}
    func startCall(script: FakeCallScript) {}
    func endCall() {}
}

@MainActor
final class NoopFakeCallNotifier: FakeCallNotifying {
    func schedule(at date: Date, config: FakeCallConfig) {}
    func ringingStarted() {}
    func cancel() {}
}

/// State machine for a fake call: idle → scheduled → ringing → in call → idle.
///
/// - `schedule` with no delay rings at once; otherwise a timer and a time-sensitive
///   notification are both set, whichever the phone can honor first wins.
/// - Ringing stops on its own after `ringTimeout`, like a real missed call.
/// - Coming back to the app after the ring time catches up (`appBecameActive`), unless it's
///   so late that a ringing phone would look strange (`staleAfter`).
@Observable
@MainActor
final class FakeCallScheduler {
    static let ringTimeout: TimeInterval = 30
    static let staleAfter: TimeInterval = 120

    private(set) var phase: FakeCallPhase = .idle
    private(set) var config = FakeCallConfig()

    /// Called when a call is answered (AppModel starts the optional Walk Home guard here).
    @ObservationIgnored var onAnswer: (@MainActor (FakeCallConfig) -> Void)?

    @ObservationIgnored var effects: any FakeCallEffects
    @ObservationIgnored var notifier: any FakeCallNotifying
    @ObservationIgnored let now: @MainActor () -> Date
    @ObservationIgnored private let sleep: @Sendable (TimeInterval) async throws -> Void
    @ObservationIgnored private var fireTask: Task<Void, Never>?
    @ObservationIgnored private var timeoutTask: Task<Void, Never>?

    init(effects: any FakeCallEffects = SilentFakeCallEffects(),
         notifier: any FakeCallNotifying = NoopFakeCallNotifier(),
         now: @escaping @MainActor () -> Date = { .now },
         sleep: @escaping @Sendable (TimeInterval) async throws -> Void = { try await Task.sleep(for: .seconds($0)) }) {
        self.effects = effects
        self.notifier = notifier
        self.now = now
        self.sleep = sleep
    }

    var isScheduled: Bool { phase.fireAt != nil }

    /// Seconds until a scheduled call rings (0 once it's due).
    func secondsRemaining(at date: Date? = nil) -> TimeInterval? {
        guard let fireAt = phase.fireAt else { return nil }
        return max(0, fireAt.timeIntervalSince(date ?? now()))
    }

    // MARK: Scheduling

    /// Replaces any call already scheduled or ringing.
    func schedule(_ config: FakeCallConfig) {
        stopTimers()
        if phase.isPresenting { effects.stopRinging(); effects.endCall() }
        notifier.cancel()
        self.config = config
        let delay = max(0, config.delay)
        guard delay > 0 else { ring(); return }
        let fireAt = now().addingTimeInterval(delay)
        phase = .scheduled(fireAt: fireAt)
        notifier.schedule(at: fireAt, config: config)
        fireTask = Task { [weak self, sleep] in
            try? await sleep(delay)
            guard !Task.isCancelled else { return }
            self?.fireIfDue(tolerance: 0.5)
        }
    }

    /// Cancels a call that hasn't rung yet.
    func cancelScheduled() {
        guard isScheduled else { return }
        stopTimers()
        notifier.cancel()
        phase = .idle
    }

    /// Rings now if the scheduled time has come (timer fired, or a notification was opened).
    func fireIfDue(tolerance: TimeInterval = 0) {
        guard let fireAt = phase.fireAt, now().addingTimeInterval(tolerance) >= fireAt else { return }
        ring()
    }

    /// The person tapped the notification (or its Answer button).
    func openedFromNotification(answer: Bool) {
        if isScheduled { ring() }
        if answer, case .ringing = phase { accept() }
    }

    /// The person swiped "Decline" on the notification.
    func declinedFromNotification() {
        switch phase {
        case .scheduled, .ringing: finish()
        case .idle, .inCall: break
        }
    }

    /// iOS may have suspended the app, so the timer never fired: catch up when it's back.
    func appBecameActive() {
        let current = now()
        switch phase {
        case .scheduled(let fireAt) where current >= fireAt:
            if current.timeIntervalSince(fireAt) <= Self.staleAfter { ring() } else { finish() }
        case .ringing(let since) where current.timeIntervalSince(since) >= Self.ringTimeout:
            finish()
        default:
            break
        }
    }

    // MARK: The call

    func ring() {
        if case .ringing = phase { return }
        if case .inCall = phase { return }
        stopTimers()
        phase = .ringing(since: now())
        notifier.ringingStarted()
        effects.startRinging()
        timeoutTask = Task { [weak self, sleep] in
            try? await sleep(Self.ringTimeout)
            guard !Task.isCancelled else { return }
            self?.missed()
        }
    }

    func accept() {
        guard case .ringing = phase else { return }
        stopTimers()
        effects.stopRinging()
        notifier.cancel()
        phase = .inCall(answeredAt: now())
        effects.startCall(script: config.script)
        onAnswer?(config)
    }

    func decline() {
        guard case .ringing = phase else { return }
        finish()
    }

    func hangUp() {
        guard case .inCall = phase else { return }
        finish()
    }

    /// Rang out with no answer.
    private func missed() {
        guard case .ringing(let since) = phase, now().timeIntervalSince(since) >= Self.ringTimeout - 0.5 else { return }
        finish()
    }

    private func finish() {
        stopTimers()
        effects.stopRinging()
        effects.endCall()
        notifier.cancel()
        phase = .idle
    }

    private func stopTimers() {
        fireTask?.cancel()
        fireTask = nil
        timeoutTask?.cancel()
        timeoutTask = nil
    }

    // MARK: QA / previews

    /// Pins a phase for `-ssScreen fakeCallIncoming` / `fakeCallActive` screenshots (no timers, no sound).
    func pinForPreview(_ phase: FakeCallPhase, config: FakeCallConfig = FakeCallConfig()) {
        stopTimers()
        self.config = config
        self.phase = phase
    }
}
