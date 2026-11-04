import Foundation

/// The escalation ladder (SPEC 6.3). Raw values match the API's `level`.
enum EscalationLevel: Int, Codable, Sendable, CaseIterable, Comparable {
    case guarding = 0
    case checkIn = 1
    case alert = 2
    case dispatch = 3

    static func < (lhs: EscalationLevel, rhs: EscalationLevel) -> Bool { lhs.rawValue < rhs.rawValue }

    var displayName: String {
        switch self {
        case .guarding: "Guarding"
        case .checkIn: "Check-in"
        case .alert: "Alert"
        case .dispatch: "Dispatch"
        }
    }

    /// Calm, non-alarming status line for each level.
    var statusLine: String {
        switch self {
        case .guarding: "Nothing is saved unless something seems wrong."
        case .checkIn: "Checking on you."
        case .alert: "Your people are being told."
        case .dispatch: "Help is on the way."
        }
    }

    /// Seconds the user has before this level moves up on its own (nil = no timer).
    var autoEscalateAfter: TimeInterval? {
        switch self {
        case .guarding: nil
        case .checkIn: 45
        case .alert: 90
        case .dispatch: nil
        }
    }
}
