import Foundation

/// Bucketed risk score. The risk engine maps a decayed score to one of these.
enum RiskLevel: Int, Codable, Sendable, CaseIterable, Comparable {
    case calm = 0
    case elevated = 1   // crosses check-in threshold
    case high = 2       // crosses alert threshold
    case critical = 3   // immediate alert (safe word, heartbeat lost)

    static func < (lhs: RiskLevel, rhs: RiskLevel) -> Bool { lhs.rawValue < rhs.rawValue }

    var displayName: String {
        switch self {
        case .calm: "Calm"
        case .elevated: "Elevated"
        case .high: "High"
        case .critical: "Critical"
        }
    }
}

/// Output of the risk engine: deterministic and explainable.
struct RiskAssessment: Codable, Sendable, Equatable {
    var score: Double
    var level: RiskLevel
    /// Signals that contributed, strongest first.
    var contributors: [RiskSignal]
    /// Plain-language reason, e.g. "Scream, then long stillness".
    var explanation: String
    /// Bounded adjustment from the Foundation Models second opinion, if one ran.
    var secondOpinionAdjustment: Double?
    var evaluatedAt: Date

    static let calm = RiskAssessment(score: 0, level: .calm, contributors: [], explanation: "All quiet",
                                     secondOpinionAdjustment: nil, evaluatedAt: .distantPast)
}
