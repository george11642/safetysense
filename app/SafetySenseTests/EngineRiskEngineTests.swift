import Foundation
import Testing
@testable import SafetySense

@Suite("Engine: RiskEngine")
@MainActor
struct EngineRiskEngineTests {
    /// 21:00 local: not "late night", so time-of-day multipliers are 1.
    let evening = Date.albuquerque(hour: 21)

    func engine(_ mode: GuardMode = .nightOut, _ sensitivity: Sensitivity = .balanced) -> RiskEngine {
        let e = RiskEngine(calendar: .albuquerque)
        e.configure(mode: mode, sensitivity: sensitivity)
        return e
    }

    func signal(_ kind: RiskSignalKind, confidence: Double? = nil, at date: Date, weight: Double? = nil) -> RiskSignal {
        RiskSignal(kind: kind, weight: weight ?? RiskWeights.points(for: kind, confidence: confidence),
                   timestamp: date, detail: kind.displayName, confidence: confidence)
    }

    @Test func emptyEngineIsCalm() {
        let e = engine()
        let a = e.evaluate(at: evening)
        #expect(a.level == .calm)
        #expect(a.score == 0)
        #expect(a.explanation == "All quiet")
        #expect(a.contributors.isEmpty)
    }

    @Test func singleScreamAsksForACheckInNotAnAlert() {
        let e = engine()
        let a = e.ingest(signal(.scream, confidence: 0.9, at: evening), at: evening)
        #expect(a.level == .elevated)
        #expect(abs(a.score - 1.17) < 0.001)
        #expect(a.explanation == "Scream")
        #expect(a.contributors.map(\.kind) == [.scream])
    }

    @Test func screamPlusDistressWordsIsHighAndExplainsThePattern() {
        let e = engine()
        e.ingest(signal(.scream, confidence: 0.9, at: evening), at: evening)
        let t = evening.addingTimeInterval(2)
        let a = e.ingest(signal(.distressPhrase, at: t, weight: 0.9), at: t)
        #expect(a.level == .high)
        #expect(e.reasons.contains { $0.title == "Distress words with a struggle" })
        #expect(a.explanation.hasPrefix("Scream"))
        #expect(a.contributors.first?.kind == .scream)
    }

    @Test func pointsFadeWithTheHalfLife() {
        let e = engine()
        e.ingest(signal(.scream, at: evening, weight: 2), at: evening)
        let later = e.evaluate(at: evening.addingTimeInterval(RiskWeights.halfLife(for: .scream)))
        #expect(abs(later.score - 1.0) < 0.001)
        let muchLater = e.evaluate(at: evening.addingTimeInterval(15 * 60))
        #expect(muchLater.level == .calm)
    }

    @Test func sensitivityScalesThresholds() {
        let s = signal(.thud, at: evening, weight: 0.8)
        #expect(engine(.nightOut, .balanced).ingest(s, at: evening).level == .calm)
        #expect(engine(.nightOut, .vigilant).ingest(s, at: evening).level == .elevated)
        let big = signal(.scream, at: evening, weight: 1.2)
        #expect(engine(.nightOut, .balanced).ingest(big, at: evening).level == .elevated)
        #expect(engine(.nightOut, .relaxed).ingest(big, at: evening).level == .calm)
    }

    @Test func modeWeightsChangeTheScore() {
        let off = signal(.routeDeviation, at: evening, weight: 0.8)
        let ride = engine(.ride).ingest(off, at: evening).score
        let night = engine(.nightOut).ingest(off, at: evening).score
        #expect(ride > night)
        #expect(abs(ride - 0.8 * 1.4) < 0.001)
        // Dancing: erratic motion counts less on a night out than on a walk home.
        let dance = signal(.erraticMotion, at: evening, weight: 1)
        #expect(engine(.nightOut).ingest(dance, at: evening).score < engine(.walk).ingest(dance, at: evening).score)
    }

    @Test func lateNightLocationSignsCountMore() {
        let late = Date.albuquerque(hour: 1)
        let a = engine(.walk).ingest(signal(.unexpectedStop, at: late, weight: 1), at: late)
        let b = engine(.walk).ingest(signal(.unexpectedStop, at: evening, weight: 1), at: evening)
        #expect(abs(a.score - 1 * 1.3 * 1.25) < 0.001)
        #expect(abs(b.score - 1 * 1.3) < 0.001)
    }

    @Test func impactThenStillnessAddsPatternPointsAndCorroboration() {
        let e = engine()
        e.ingest(signal(.thud, confidence: 0.86, at: evening), at: evening)
        let t = evening.addingTimeInterval(20)
        let a = e.ingest(signal(.prolongedStillness, at: t), at: t)
        #expect(e.reasons.contains { $0.title == "Impact, then stillness" })
        #expect(e.reasons.contains { $0.title == "Several kinds of signs at once" })
        #expect(a.level == .elevated || a.level == .high)
    }

    @Test func stillnessWithoutAnImpactIsNotThePattern() {
        let e = engine()
        e.ingest(signal(.prolongedStillness, at: evening), at: evening)
        #expect(!e.reasons.contains { $0.title == "Impact, then stillness" })
        #expect(e.current.level == .calm)
    }

    @Test func safeWordIsCriticalUntilAcknowledged() {
        let e = engine()
        let a = e.ingest(signal(.safeWord, at: evening), at: evening)
        #expect(a.level == .critical)
        #expect(a.explanation == "Safe word heard")
        #expect(a.contributors.first?.kind == .safeWord)
        let acked = e.acknowledge(at: evening.addingTimeInterval(5))
        #expect(acked.level == .calm)
        // A new safe word after the acknowledgement is critical again.
        let t = evening.addingTimeInterval(10)
        #expect(e.ingest(signal(.safeWord, at: t), at: t).level == .critical)
    }

    @Test func safeWordStopsBeingCriticalAfterTheWindow() {
        let e = engine()
        e.ingest(signal(.safeWord, at: evening), at: evening)
        #expect(e.evaluate(at: evening.addingTimeInterval(e.immediateWindow + 1)).level == .calm)
    }

    @Test func heartbeatLostIsCritical() {
        let e = engine()
        let a = e.ingest(signal(.heartbeatLost, at: evening), at: evening)
        #expect(a.level == .critical)
        #expect(a.explanation == "Phone went dark")
    }

    @Test func acknowledgingDiscountsEarlierSignals() {
        let e = engine()
        e.ingest(signal(.scream, at: evening, weight: 1.3), at: evening)
        #expect(e.current.level == .elevated)
        let a = e.acknowledge(at: evening)
        #expect(abs(a.score - 1.3 * e.acknowledgeDiscount) < 0.001)
        #expect(a.level == .calm)
    }

    // MARK: Second opinion bounds

    @Test func secondOpinionCannotLiftACalmScore() {
        let e = engine()
        e.ingest(signal(.shout, at: evening, weight: 0.9), at: evening)
        let a = e.applySecondOpinion(SecondOpinion(adjustment: 0.25, rationale: "distress"), at: evening)
        #expect(a.level == .calm)
    }

    @Test func secondOpinionCanCalmACheckIn() {
        let e = engine()
        e.ingest(signal(.shout, at: evening, weight: 1.1), at: evening)
        #expect(e.current.level == .elevated)
        let a = e.applySecondOpinion(SecondOpinion(adjustment: -0.25, rationale: "laughing"), at: evening)
        #expect(a.level == .calm)
        #expect(a.secondOpinionAdjustment == -0.25)
        #expect(abs(a.score - 1.1 * 0.75) < 0.001)
        #expect(e.reasons.last?.origin == .secondOpinion)
    }

    @Test func secondOpinionLiftsOnlyWhenTheRulesAreClose() {
        // 2.1 / 2.4 = 87.5 % of the alert threshold: the AI may lift it.
        let close = engine()
        close.ingest(signal(.scream, at: evening, weight: 2.1), at: evening)
        #expect(close.applySecondOpinion(SecondOpinion(adjustment: 0.2, rationale: ""), at: evening).level == .high)
        // 2.0 / 2.4 = 83 %: the rules alone aren't close enough, so the AI can't make it an alert.
        let far = engine()
        far.ingest(signal(.scream, at: evening, weight: 2.0), at: evening)
        let a = far.applySecondOpinion(SecondOpinion(adjustment: 0.25, rationale: ""), at: evening)
        #expect(a.level == .elevated)
        #expect(a.secondOpinionAdjustment == nil)
    }

    @Test func secondOpinionNeverTouchesCritical() {
        let e = engine()
        e.ingest(signal(.safeWord, at: evening), at: evening)
        #expect(e.applySecondOpinion(SecondOpinion(adjustment: -0.25, rationale: "joking"), at: evening).level == .critical)
    }

    @Test func secondOpinionExpires() {
        let e = engine()
        e.ingest(signal(.shout, at: evening, weight: 1.1), at: evening)
        _ = e.applySecondOpinion(SecondOpinion(adjustment: -0.25, rationale: ""), at: evening)
        let later = e.evaluate(at: evening.addingTimeInterval(e.secondOpinionLifetime + 1))
        #expect(later.secondOpinionAdjustment == nil)
    }

    @Test func secondOpinionAdjustmentIsClamped() {
        #expect(SecondOpinion(adjustment: 0.9, rationale: "").adjustment == SecondOpinion.maxAdjustment)
        #expect(SecondOpinion(adjustment: -3, rationale: "").adjustment == -SecondOpinion.maxAdjustment)
    }

    @Test func engineAsksTheSecondOpinionAndReportsBack() async {
        let e = engine()
        let advisor = StubSecondOpinion()
        advisor.result = SecondOpinion(adjustment: -0.25, rationale: "Friends laughing")
        e.secondOpinion = advisor
        e.transcriptProvider = { "haha no way stop" }
        e.now = { Date.albuquerque(hour: 21) }
        var reassessed: [RiskAssessment] = []
        e.onReassessment = { reassessed.append($0) }

        e.ingest(signal(.shout, at: evening, weight: 1.1), at: evening)
        await e.waitForSecondOpinion()
        #expect(advisor.calls == 1)
        #expect(advisor.lastTranscript == "haha no way stop")
        #expect(reassessed.count == 1)
        #expect(reassessed.first?.level == .calm)
    }

    @Test func secondOpinionIsSkippedWhenDisabledOrForNonAudioSigns() async {
        let e = engine()
        let advisor = StubSecondOpinion()
        e.secondOpinion = advisor
        e.isSecondOpinionEnabled = { false }
        e.ingest(signal(.scream, at: evening, weight: 1.3), at: evening)
        await e.waitForSecondOpinion()
        #expect(advisor.calls == 0)

        let motionOnly = engine(.walk)
        motionOnly.secondOpinion = advisor
        motionOnly.ingest(signal(.fall, at: evening, weight: 1.2), at: evening)
        await motionOnly.waitForSecondOpinion()
        #expect(advisor.calls == 0)
    }

    @Test func sameInputsGiveTheSameAnswer() {
        func run() -> RiskAssessment {
            let e = engine()
            e.ingest(signal(.thud, confidence: 0.86, at: evening), at: evening)
            e.ingest(signal(.distressPhrase, at: evening.addingTimeInterval(1), weight: 1), at: evening.addingTimeInterval(1))
            return e.evaluate(at: evening.addingTimeInterval(5))
        }
        let first = run()
        let second = run()
        #expect(first.score == second.score)
        #expect(first.level == second.level)
        #expect(first.explanation == second.explanation)
    }

    @Test func resetClearsEverything() {
        let e = engine()
        e.ingest(signal(.scream, at: evening, weight: 2), at: evening)
        e.reset()
        #expect(e.current == .calm)
        #expect(e.reasons.isEmpty)
        #expect(e.evaluate(at: evening).level == .calm)
    }

    @Test func nightOutDemoRampsFromCalmToCheckInToAlert() {
        let e = engine(.nightOut)
        let start = Date.albuquerque(hour: 23)
        for step in DemoScenarioPlayer.nightOut.steps {
            guard case let .signal(kind, weight, confidence, detail) = step.action else { continue }
            let t = start.addingTimeInterval(step.at)
            let a = e.ingest(RiskSignal(kind: kind, weight: weight, timestamp: t, detail: detail, confidence: confidence), at: t)
            switch step.id {
            case 2: #expect(a.level == .calm)
            case 3: #expect(a.level == .calm)
            case 5: #expect(a.level == .elevated)
            case 6: #expect(a.level == .high)
            default: break
            }
        }
    }
}
