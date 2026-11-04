import Foundation
import Testing
@testable import SafetySense

@MainActor
private final class SpyNotifier: FakeCallNotifying {
    var scheduled: [(Date, FakeCallConfig)] = []
    var ringingStartedCount = 0
    var cancelCount = 0
    func schedule(at date: Date, config: FakeCallConfig) { scheduled.append((date, config)) }
    func ringingStarted() { ringingStartedCount += 1 }
    func cancel() { cancelCount += 1 }
}

@MainActor
private final class SpyEffects: FakeCallEffects {
    var log: [String] = []
    func startRinging() { log.append("ring") }
    func stopRinging() { log.append("stopRing") }
    func startCall(script: FakeCallScript) { log.append("call:\(script.rawValue)") }
    func endCall() { log.append("end") }
}

/// A clock the test moves by hand.
@MainActor
private final class TestClock {
    var now = Date(timeIntervalSinceReferenceDate: 800_000_000)
    func advance(_ s: TimeInterval) { now = now.addingTimeInterval(s) }
}

/// A sleep that never returns on its own, so only the test's clock decides when things fire.
private let neverSleep: @Sendable (TimeInterval) async throws -> Void = { _ in
    try await Task.sleep(for: .seconds(86_400))
}

@Suite("Fake call scheduler")
@MainActor
struct FakeCallSchedulerTests {
    private func make(sleep: @escaping @Sendable (TimeInterval) async throws -> Void = neverSleep)
        -> (FakeCallScheduler, SpyEffects, SpyNotifier, TestClock) {
        let effects = SpyEffects(), notifier = SpyNotifier(), clock = TestClock()
        let s = FakeCallScheduler(effects: effects, notifier: notifier, now: { clock.now }, sleep: sleep)
        return (s, effects, notifier, clock)
    }

    @Test func noDelayRingsImmediatelyWithoutNotification() {
        let (s, effects, notifier, clock) = make()
        s.schedule(FakeCallConfig(callerName: "Dad", delay: 0))
        #expect(s.phase == .ringing(since: clock.now))
        #expect(s.phase.isPresenting)
        #expect(notifier.scheduled.isEmpty)
        #expect(notifier.ringingStartedCount == 1)
        #expect(effects.log == ["ring"])
        #expect(s.config.displayName == "Dad")
    }

    @Test func delayedCallSchedulesNotificationAtFireTime() {
        let (s, effects, notifier, clock) = make()
        let start = clock.now
        s.schedule(FakeCallConfig(delay: FakeCallDelay.thirtySeconds.seconds))
        #expect(s.phase == .scheduled(fireAt: start.addingTimeInterval(30)))
        #expect(notifier.scheduled.count == 1)
        #expect(notifier.scheduled.first?.0 == start.addingTimeInterval(30))
        #expect(effects.log.isEmpty)
        clock.advance(12)
        #expect(s.secondsRemaining() == 18)
        s.fireIfDue()
        #expect(s.isScheduled)   // not yet
        clock.advance(18)
        s.fireIfDue()
        #expect(s.phase == .ringing(since: clock.now))
        #expect(effects.log == ["ring"])
    }

    @Test func realTimerFiresOnItsOwn() async throws {
        let effects = SpyEffects()
        let s = FakeCallScheduler(effects: effects, notifier: SpyNotifier(),
                                  sleep: { try await Task.sleep(for: .seconds($0 > 1 ? 86_400 : 0.05)) })
        s.schedule(FakeCallConfig(delay: 0.05))
        #expect(s.isScheduled)
        for _ in 0..<40 where !s.phase.isPresenting { try await Task.sleep(for: .milliseconds(25)) }
        guard case .ringing = s.phase else { Issue.record("expected ringing, got \(s.phase)"); return }
        #expect(effects.log == ["ring"])
    }

    @Test func cancelBeforeRingClearsNotificationAndNeverRings() {
        let (s, effects, notifier, clock) = make()
        s.schedule(FakeCallConfig(delay: 10))
        let cancelsBefore = notifier.cancelCount
        s.cancelScheduled()
        #expect(s.phase == .idle)
        #expect(notifier.cancelCount == cancelsBefore + 1)
        clock.advance(20)
        s.fireIfDue()
        s.appBecameActive()
        #expect(s.phase == .idle)
        #expect(effects.log.isEmpty)
    }

    @Test func acceptStartsScriptAndCallsOnAnswer() {
        let (s, effects, notifier, clock) = make()
        var answered: FakeCallConfig?
        s.onAnswer = { answered = $0 }
        s.schedule(FakeCallConfig(delay: 0, script: .lockedOut, alsoStartWalkGuard: true))
        clock.advance(4)
        s.accept()
        #expect(s.phase == .inCall(answeredAt: clock.now))
        #expect(effects.log == ["ring", "stopRing", "call:lockedOut"])
        #expect(answered?.alsoStartWalkGuard == true)
        #expect(notifier.cancelCount >= 1)
        s.hangUp()
        #expect(s.phase == .idle)
        #expect(effects.log.last == "end")
    }

    @Test func declineEndsTheCall() {
        let (s, effects, _, _) = make()
        s.schedule(FakeCallConfig(delay: 0))
        s.decline()
        #expect(s.phase == .idle)
        #expect(effects.log == ["ring", "stopRing", "end"])
        s.accept()          // nothing to accept any more
        #expect(s.phase == .idle)
    }

    @Test func invalidTransitionsAreIgnored() {
        let (s, effects, _, _) = make()
        s.accept(); s.decline(); s.hangUp()
        #expect(s.phase == .idle)
        s.schedule(FakeCallConfig(delay: 10))
        s.accept(); s.hangUp()
        #expect(s.isScheduled)
        #expect(effects.log.isEmpty)
    }

    @Test func comingBackAfterRingTimeCatchesUp() {
        let (s, _, _, clock) = make()
        s.schedule(FakeCallConfig(delay: 60))
        clock.advance(75)   // the app was suspended through the ring time
        s.appBecameActive()
        #expect(s.phase == .ringing(since: clock.now))
    }

    @Test func comingBackMuchLaterDropsTheStaleCall() {
        let (s, effects, _, clock) = make()
        s.schedule(FakeCallConfig(delay: 10))
        clock.advance(10 + FakeCallScheduler.staleAfter + 1)
        s.appBecameActive()
        #expect(s.phase == .idle)
        #expect(!effects.log.contains("ring"))
    }

    @Test func ringingTimesOutLikeAMissedCall() {
        let (s, effects, _, clock) = make()
        s.schedule(FakeCallConfig(delay: 0))
        clock.advance(FakeCallScheduler.ringTimeout + 1)
        s.appBecameActive()
        #expect(s.phase == .idle)
        #expect(effects.log.last == "end")
    }

    @Test func notificationTapRingsAndAnswerGoesStraightToCall() {
        let (s, _, _, clock) = make()
        s.schedule(FakeCallConfig(delay: 30))
        clock.advance(30)
        s.openedFromNotification(answer: true)
        #expect(s.phase == .inCall(answeredAt: clock.now))

        s.hangUp()
        s.schedule(FakeCallConfig(delay: 30))
        s.declinedFromNotification()
        #expect(s.phase == .idle)
    }

    @Test func reschedulingReplacesThePreviousCall() {
        let (s, _, notifier, clock) = make()
        s.schedule(FakeCallConfig(callerName: "Sam", delay: 60))
        s.schedule(FakeCallConfig(callerName: "Mom", delay: 10))
        #expect(s.phase == .scheduled(fireAt: clock.now.addingTimeInterval(10)))
        #expect(s.config.displayName == "Mom")
        #expect(notifier.scheduled.count == 2)
    }

    @Test func configNameFallbacksAndInitials() {
        #expect(FakeCallConfig(callerName: "   ").displayName == "Mom")
        #expect(FakeCallConfig(callerName: "Aunt Rosa").initials == "AR")
        #expect(FakeCallConfig(callerName: String(repeating: "x", count: 60)).displayName.count == 28)
        #expect(FakeCallDelay.nearest(to: 25) == .thirtySeconds)
        #expect(FakeCallDelay.nearest(to: 0) == .now)
        #expect(FakeCallScript.silent.lines.isEmpty)
        #expect(FakeCallScript.comeHome.lines.contains { $0.text.contains("come home now") })
    }

    @Test func ringtoneIsAValidWav() {
        let data = Ringtone.wav(loops: 2)
        #expect(String(decoding: data.prefix(4), as: UTF8.self) == "RIFF")
        let expected = 44 + Int(Ringtone.loopSeconds * Double(Ringtone.sampleRate)) * 2 * 2
        #expect(data.count == expected)
    }

    @Test func answeringWithWalkToggleStartsWalkGuard() async throws {
        let model = AppModel(services: .demo(), store: .ephemeral())
        model.fakeCall.schedule(FakeCallConfig(delay: 0, alsoStartWalkGuard: true))
        model.fakeCall.accept()
        for _ in 0..<40 where model.currentSession == nil { try await Task.sleep(for: .milliseconds(25)) }
        #expect(model.currentSession?.mode == .walk)
        model.fakeCall.hangUp()
        await model.endGuard()
    }

    @Test func sharedCommandSchedulesAFakeCall() {
        let model = AppModel(services: .demo(), store: .ephemeral())
        SharedCommandQueue.enqueue(SharedCommand(kind: .fakeCall, source: .shortcut, callerName: "Roommate", delaySeconds: 30))
        model.drainSharedCommands()
        #expect(model.fakeCall.isScheduled)
        #expect(model.fakeCall.config.displayName == "Roommate")
        #expect(model.fakeCall.config.delay == 30)
        model.fakeCall.cancelScheduled()

        let old = SharedCommand(kind: .fakeCall, source: .shortcut, createdAt: .now.addingTimeInterval(-900))
        SharedCommandQueue.enqueue(old)
        model.drainSharedCommands()
        #expect(!model.fakeCall.isScheduled)
    }

    @Test func screenArgumentsResolve() {
        #expect(AppScreen(argument: "fakeCall") == .fakeCallSetup)
        #expect(AppScreen(argument: "fakeCallIncoming") == .fakeCallIncoming)
        #expect(AppScreen(argument: "fakeCallActive") == .fakeCallActive)
        let model = AppModel.preview(screen: .fakeCallIncoming)
        #expect(model.fakeCall.phase.isPresenting)
        #expect(model.forcedScreen == .fakeCallIncoming)
    }
}
