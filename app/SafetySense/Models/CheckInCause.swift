import Foundation

/// Why a check-in appeared, so the prompt can say so in the words of the Guard you're in.
enum CheckInCause: Sendable, Equatable {
    /// The scheduled rhythm, or the arrival time on a Walk or Ride.
    case scheduled
    /// Stopped somewhere that isn't the destination.
    case unexpectedStop
    /// The risk engine's plain-language explanation.
    case noticed(String)

    func line(mode: GuardMode?) -> String {
        switch self {
        case .scheduled:
            return mode == .walk || mode == .ride ? "You should be there by now." : "Just checking on you."
        case .unexpectedStop:
            switch mode {
            case .walk: return "You've been stopped for a while."
            case .ride: return "Your ride stopped somewhere unexpected."
            default: return "You've been stopped for a while."
            }
        case .noticed(let reason):
            guard !reason.isEmpty, reason != "All quiet" else { return "Just checking on you." }
            return "SafetySense noticed: \(reason.lowercased())"
        }
    }
}
