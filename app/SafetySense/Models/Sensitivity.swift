import Foundation

/// How readily the risk engine escalates (SPEC 6.2).
enum Sensitivity: String, Codable, Sendable, CaseIterable, Identifiable {
    case relaxed, balanced, vigilant
    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .relaxed: "Relaxed"
        case .balanced: "Balanced"
        case .vigilant: "Vigilant"
        }
    }

    var explanation: String {
        switch self {
        case .relaxed: "Fewer check-ins. Good for loud, familiar places."
        case .balanced: "The default. Checks in when a few signs add up."
        case .vigilant: "Checks in sooner. Good when you're somewhere new."
        }
    }

    /// Multiplier applied to risk-engine thresholds. Lower = escalates sooner.
    var thresholdMultiplier: Double {
        switch self {
        case .relaxed: 1.3
        case .balanced: 1.0
        case .vigilant: 0.75
        }
    }
}
