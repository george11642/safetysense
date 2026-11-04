import Foundation
import Observation

/// One line of the "why" behind a risk score. Shown in the UI and used to build
/// `RiskAssessment.explanation`.
struct RiskReason: Sendable, Equatable, Identifiable {
    enum Origin: Sendable, Equatable {
        case signal(RiskSignalKind)
        case pattern
        case secondOpinion
    }

    var id: String
    var title: String
    /// Live points after mode, time-of-day and decay weighting. Negative only for the AI.
    var points: Double
    var origin: Origin
}

/// Deterministic, explainable rules engine (SPEC 6.2).
///
/// score = sum over live signals of `weight x mode x time-of-day x decay`
///       + fixed pattern points (impact then stillness, distress words with a struggle,
///         two or more sensing families agreeing).
///
/// Levels: calm < check-in threshold <= elevated < alert threshold <= high. A safe word or a
/// lost heartbeat is `critical`. Thresholds scale with `Sensitivity`.
///
/// The on-device AI second opinion multiplies the score by at most 1 +/- 0.25 and is held to
/// three rules: it can never lift a calm score, it can move the level by one step at most,
/// and it can only raise a check-in to an alert when the rules alone are already close
/// (85 %) to the alert threshold. It never touches `critical`.
@Observable
@MainActor
final class RiskEngine: RiskEngineProtocol {
    private(set) var current: RiskAssessment = .calm
    /// Every reason with live points, strongest first.
    private(set) var reasons: [RiskReason] = []
    private(set) var mode: GuardMode = .everyday
    private(set) var sensitivity: Sensitivity = .balanced

    // MARK: Tunables

    @ObservationIgnored var calendar: Calendar = .current
    /// After "I'm okay" or a valid cancel, older signals keep only this share of their points.
    @ObservationIgnored var acknowledgeDiscount = 0.25
    /// A safe word / lost heartbeat stays critical for this long (unless acknowledged).
    @ObservationIgnored var immediateWindow: TimeInterval = 90
    /// A second opinion expires after this long.
    @ObservationIgnored var secondOpinionLifetime: TimeInterval = 120
    /// Share of the next threshold the rules alone must reach before the AI may lift the level.
    @ObservationIgnored var nearThresholdFraction = 0.85
    /// Signals older than this are dropped.
    @ObservationIgnored var retention: TimeInterval = 3600
    /// Points below this are not listed as contributors.
    @ObservationIgnored var contributorFloor = 0.05

    // MARK: Second opinion orchestration

    /// When set and available, the engine asks for a second opinion whenever audio or words
    /// push the level to elevated or high, and reports the result through `onReassessment`.
    @ObservationIgnored var secondOpinion: (any SecondOpinionProtocol)?
    /// Recent RAM-only transcript (from the audio guard) for the second opinion.
    @ObservationIgnored var transcriptProvider: (@MainActor () -> String)?
    /// Reads `AppSettings.useSecondOpinion`.
    @ObservationIgnored var isSecondOpinionEnabled: @MainActor () -> Bool = { true }
    /// Called with a fresh assessment produced asynchronously (after a second opinion).
    @ObservationIgnored var onReassessment: (@MainActor (RiskAssessment) -> Void)?
    @ObservationIgnored var now: @MainActor () -> Date = { .now }
    @ObservationIgnored var secondOpinionCooldown: TimeInterval = 20

    @ObservationIgnored private var signals: [RiskSignal] = []
    @ObservationIgnored private var opinion: (value: SecondOpinion, at: Date)?
    @ObservationIgnored private var acknowledgedAt: Date?
    @ObservationIgnored private var lastOpinionRequest: Date?
    @ObservationIgnored private var pendingOpinion: Task<Void, Never>?
    @ObservationIgnored private var generation = 0

    init(calendar: Calendar = .current) {
        self.calendar = calendar
    }

    // MARK: RiskEngineProtocol

    func configure(mode: GuardMode, sensitivity: Sensitivity) {
        self.mode = mode
        self.sensitivity = sensitivity
    }

    @discardableResult
    func ingest(_ signal: RiskSignal, at now: Date) -> RiskAssessment {
        signals.append(signal)
        let assessment = evaluate(at: now)
        requestSecondOpinionIfUseful(for: assessment)
        return assessment
    }

    func evaluate(at now: Date) -> RiskAssessment {
        signals.removeAll { now.timeIntervalSince($0.timestamp) > retention }
        let result = score(at: now)
        reasons = result.reasons
        current = result.assessment
        return result.assessment
    }

    func applySecondOpinion(_ opinion: SecondOpinion, at now: Date) -> RiskAssessment {
        self.opinion = (opinion, now)
        return evaluate(at: now)
    }

    func reset() {
        signals.removeAll()
        opinion = nil
        acknowledgedAt = nil
        lastOpinionRequest = nil
        cancelPendingOpinion()
        reasons = []
        current = .calm
    }

    // MARK: Extras

    /// The user said "I'm okay" (or cancelled with a valid PIN): what happened so far counts
    /// for much less, a pending safe word stops being critical, and any AI opinion is dropped.
    @discardableResult
    func acknowledge(at now: Date) -> RiskAssessment {
        acknowledgedAt = now
        opinion = nil
        cancelPendingOpinion()
        return evaluate(at: now)
    }

    /// Thresholds after sensitivity scaling.
    var thresholds: (checkIn: Double, alert: Double) {
        let m = sensitivity.thresholdMultiplier
        return (RiskWeights.checkInThreshold * m, RiskWeights.alertThreshold * m)
    }

    var liveSignals: [RiskSignal] { signals }

    /// Awaits an in-flight second opinion (tests and the demo player use this).
    func waitForSecondOpinion() async {
        await pendingOpinion?.value
    }

    // MARK: Scoring

    private struct Scored {
        var assessment: RiskAssessment
        var reasons: [RiskReason]
    }

    private func ackFactor(_ signal: RiskSignal) -> Double {
        if let ack = acknowledgedAt, signal.timestamp <= ack { return acknowledgeDiscount }
        return 1
    }

    /// Live points for one signal at `now`.
    func points(for signal: RiskSignal, at now: Date) -> Double {
        guard signal.kind != .secondOpinion, !signal.kind.isImmediateAlert else { return 0 }
        let hour = calendar.component(.hour, from: signal.timestamp)
        let age = now.timeIntervalSince(signal.timestamp)
        return max(0, signal.weight)
            * RiskWeights.modeMultiplier(for: signal.kind, in: mode)
            * RiskWeights.timeMultiplier(for: signal.kind, hour: hour)
            * RiskWeights.decay(for: signal.kind, age: age)
            * ackFactor(signal)
    }

    private func score(at now: Date) -> Scored {
        // Signals stamped slightly after `now` (sensor clock vs caller clock) count as fresh.
        let live = signals
        var reasons: [RiskReason] = []

        // 1. Individual signals.
        var pointsByKind: [RiskSignalKind: Double] = [:]
        var scoredSignals: [(RiskSignal, Double)] = []
        for signal in live {
            let p = points(for: signal, at: now)
            scoredSignals.append((signal, p))
            pointsByKind[signal.kind, default: 0] += p
        }
        for (kind, p) in pointsByKind where p >= contributorFloor {
            reasons.append(RiskReason(id: "signal.\(kind.rawValue)", title: Self.title(for: kind), points: p,
                                      origin: .signal(kind)))
        }

        // 2. Patterns.
        let impactThenStill = patternImpactThenStill(live, now: now)
        if impactThenStill >= contributorFloor {
            reasons.append(RiskReason(id: "pattern.impactThenStill", title: "Impact, then stillness",
                                      points: impactThenStill, origin: .pattern))
        }
        let wordsWithStruggle = patternWordsWithStruggle(live, now: now)
        if wordsWithStruggle >= contributorFloor {
            reasons.append(RiskReason(id: "pattern.wordsWithStruggle", title: "Distress words with a struggle",
                                      points: wordsWithStruggle, origin: .pattern))
        }
        var families: [RiskWeights.Family: Double] = [:]
        for (signal, p) in scoredSignals { families[RiskWeights.family(of: signal.kind), default: 0] += p }
        let agreeing = families.filter { $0.key != .ai && $0.key != .server && $0.value >= RiskWeights.corroborationFloor }
        if agreeing.count >= 2 {
            reasons.append(RiskReason(id: "pattern.corroboration", title: "Several kinds of signs at once",
                                      points: RiskWeights.corroborationPoints, origin: .pattern))
        }

        let base = reasons.reduce(0) { $0 + $1.points }
        let t = thresholds
        let baseLevel = Self.level(for: base, thresholds: t)

        // 3. Immediate signals.
        let immediate = live.filter { s in
            s.kind.isImmediateAlert
                && ackFactor(s) == 1
                && max(0, now.timeIntervalSince(s.timestamp)) <= immediateWindow
        }

        var level = baseLevel
        var score = base
        var adjustmentApplied: Double?

        if !immediate.isEmpty {
            level = .critical
            for kind in Set(immediate.map(\.kind)) {
                reasons.append(RiskReason(id: "signal.\(kind.rawValue)", title: Self.title(for: kind),
                                          points: RiskWeights.basePoints(for: kind), origin: .signal(kind)))
            }
        } else if let opinion, now.timeIntervalSince(opinion.at) <= secondOpinionLifetime, base > 0 {
            // 4. Bounded second opinion.
            let adj = opinion.value.adjustment
            let adjusted = max(0, base * (1 + adj))
            let aiLevel = Self.level(for: adjusted, thresholds: t)
            var allowed = baseLevel
            if aiLevel > baseLevel {
                let next = RiskLevel(rawValue: baseLevel.rawValue + 1) ?? baseLevel
                let nextThreshold = next == .high ? t.alert : t.checkIn
                if baseLevel != .calm, aiLevel == next, base >= nearThresholdFraction * nextThreshold {
                    allowed = next
                }
            } else if aiLevel < baseLevel {
                allowed = max(aiLevel, RiskLevel(rawValue: baseLevel.rawValue - 1) ?? .calm)
            }
            if allowed != baseLevel || aiLevel == baseLevel {
                score = adjusted
                level = allowed
                adjustmentApplied = adj
                reasons.append(RiskReason(id: "secondOpinion", title: Self.aiTitle(opinion.value),
                                          points: adjusted - base, origin: .secondOpinion))
            }
        }

        reasons.sort { lhs, rhs in
            if (lhs.origin == .secondOpinion) != (rhs.origin == .secondOpinion) { return rhs.origin == .secondOpinion }
            return lhs.points == rhs.points ? lhs.id < rhs.id : lhs.points > rhs.points
        }

        let contributors = scoredSignals
            .filter { $0.0.kind.isImmediateAlert ? immediate.contains($0.0) : $0.1 >= contributorFloor }
            .sorted { lhs, rhs in
                let l = lhs.0.kind.isImmediateAlert ? Double.infinity : lhs.1
                let r = rhs.0.kind.isImmediateAlert ? Double.infinity : rhs.1
                return l == r ? lhs.0.timestamp > rhs.0.timestamp : l > r
            }
            .map(\.0)

        let explanation = Self.explanation(level: level, reasons: reasons)
        let assessment = RiskAssessment(score: (score * 1000).rounded() / 1000, level: level, contributors: contributors,
                                        explanation: explanation, secondOpinionAdjustment: adjustmentApplied,
                                        evaluatedAt: now)
        return Scored(assessment: assessment, reasons: reasons)
    }

    private func patternImpactThenStill(_ live: [RiskSignal], now: Date) -> Double {
        var best = 0.0
        for still in live where still.kind == .prolongedStillness {
            let hasImpact = live.contains { hit in
                RiskWeights.impactKinds.contains(hit.kind)
                    && hit.timestamp <= still.timestamp
                    && still.timestamp.timeIntervalSince(hit.timestamp) <= RiskWeights.impactThenStillWindow
            }
            guard hasImpact else { continue }
            let p = RiskWeights.impactThenStillPoints
                * RiskWeights.decay(for: .prolongedStillness, age: now.timeIntervalSince(still.timestamp))
                * ackFactor(still)
            best = max(best, p)
        }
        return best
    }

    private func patternWordsWithStruggle(_ live: [RiskSignal], now: Date) -> Double {
        var best = 0.0
        for words in live where words.kind == .distressPhrase {
            for sound in live where RiskWeights.struggleKinds.contains(sound.kind) {
                guard abs(words.timestamp.timeIntervalSince(sound.timestamp)) <= RiskWeights.wordsWithStruggleWindow
                else { continue }
                let later = max(words.timestamp, sound.timestamp)
                let p = RiskWeights.wordsWithStrugglePoints
                    * RiskWeights.decay(for: .distressPhrase, age: now.timeIntervalSince(later))
                    * min(ackFactor(words), ackFactor(sound))
                best = max(best, p)
            }
        }
        return best
    }

    static func level(for score: Double, thresholds: (checkIn: Double, alert: Double)) -> RiskLevel {
        if score >= thresholds.alert { return .high }
        if score >= thresholds.checkIn { return .elevated }
        return .calm
    }

    static func title(for kind: RiskSignalKind) -> String {
        switch kind {
        case .distressPhrase: "Distress words"
        case .safeWord: "Safe word heard"
        case .prolongedStillness: "Long stillness"
        default: kind.displayName
        }
    }

    static func aiTitle(_ opinion: SecondOpinion) -> String {
        if opinion.adjustment > 0.01 { return "On-device AI: sounds like real distress" }
        if opinion.adjustment < -0.01 { return "On-device AI: sounds playful" }
        return "On-device AI: unclear"
    }

    /// Plain-language reason, strongest first, e.g. "Distress words, Thud, Impact, then stillness".
    static func explanation(level: RiskLevel, reasons: [RiskReason]) -> String {
        let ruleReasons = reasons.filter { $0.origin != .secondOpinion && $0.points > 0 }
        guard !ruleReasons.isEmpty else { return "All quiet" }
        if level == .critical {
            if ruleReasons.contains(where: { $0.origin == .signal(.safeWord) }) { return "Safe word heard" }
            if ruleReasons.contains(where: { $0.origin == .signal(.heartbeatLost) }) { return "Phone went dark" }
        }
        return ruleReasons.prefix(3).map(\.title).joined(separator: ", ")
    }

    // MARK: Second opinion

    private func cancelPendingOpinion() {
        generation += 1
        pendingOpinion?.cancel()
        pendingOpinion = nil
    }

    private func requestSecondOpinionIfUseful(for assessment: RiskAssessment) {
        guard let advisor = secondOpinion, advisor.isAvailable, isSecondOpinionEnabled(),
              assessment.level == .elevated || assessment.level == .high,
              pendingOpinion == nil,
              assessment.contributors.contains(where: { $0.kind.source == .audio || $0.kind.source == .speech })
        else { return }
        if let last = lastOpinionRequest, assessment.evaluatedAt.timeIntervalSince(last) < secondOpinionCooldown { return }
        lastOpinionRequest = assessment.evaluatedAt

        let token = generation
        let transcript = transcriptProvider?() ?? ""
        let evidence = assessment.contributors
        let mode = self.mode
        pendingOpinion = Task { [weak self] in
            let result = await advisor.evaluate(transcript: transcript, signals: evidence, mode: mode)
            guard let self, token == self.generation else { return }
            self.pendingOpinion = nil
            guard let result, !Task.isCancelled else { return }
            let updated = self.applySecondOpinion(result, at: self.now())
            self.onReassessment?(updated)
        }
    }
}
