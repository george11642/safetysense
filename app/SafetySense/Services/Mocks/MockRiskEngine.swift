import Foundation

/// Simple decaying-sum engine so the app runs end to end with mocks.
/// The Guard Engine module replaces it with the real weighted rules engine.
@MainActor
final class MockRiskEngine: RiskEngineProtocol {
    private(set) var current: RiskAssessment = .calm
    private var signals: [RiskSignal] = []
    private var sensitivity: Sensitivity = .balanced
    private var mode: GuardMode = .everyday
    private var adjustment: Double = 0

    /// Seconds for a signal's weight to halve.
    let halfLife: TimeInterval = 120
    let checkInThreshold = 1.0
    let alertThreshold = 2.0

    func configure(mode: GuardMode, sensitivity: Sensitivity) {
        self.mode = mode
        self.sensitivity = sensitivity
    }

    @discardableResult
    func ingest(_ signal: RiskSignal, at now: Date = .now) -> RiskAssessment {
        signals.append(signal)
        return evaluate(at: now)
    }

    func evaluate(at now: Date = .now) -> RiskAssessment {
        let decayed = signals.map { s -> (RiskSignal, Double) in
            let age = max(0, now.timeIntervalSince(s.timestamp))
            return (s, s.weight * pow(0.5, age / halfLife))
        }
        let base = decayed.reduce(0) { $0 + $1.1 }
        // Second opinion only nudges an existing score; it can't create one.
        let score = base > 0 ? max(0, base * (1 + adjustment)) : 0
        let m = sensitivity.thresholdMultiplier
        let level: RiskLevel
        if signals.contains(where: { $0.kind.isImmediateAlert }) { level = .critical }
        else if score >= alertThreshold * m { level = .high }
        else if score >= checkInThreshold * m { level = .elevated }
        else { level = .calm }
        let contributors = decayed.filter { $0.1 > 0.05 }.sorted { $0.1 > $1.1 }.map(\.0)
        let explanation = contributors.isEmpty ? "All quiet" : contributors.prefix(3).map(\.kind.displayName).joined(separator: ", ")
        current = RiskAssessment(score: score, level: level, contributors: contributors, explanation: explanation,
                                 secondOpinionAdjustment: adjustment == 0 ? nil : adjustment, evaluatedAt: now)
        return current
    }

    func applySecondOpinion(_ opinion: SecondOpinion, at now: Date = .now) -> RiskAssessment {
        adjustment = opinion.adjustment
        return evaluate(at: now)
    }

    func reset() {
        signals.removeAll()
        adjustment = 0
        current = .calm
    }
}

@MainActor
final class MockSecondOpinion: SecondOpinionProtocol {
    var isAvailable = false
    func evaluate(transcript: String, signals: [RiskSignal], mode: GuardMode) async -> SecondOpinion? { nil }
}
