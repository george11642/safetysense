import Foundation

/// Session modes (SPEC 5). Raw values are the backend API spelling.
enum GuardMode: String, Codable, CodingKeyRepresentable, Sendable, CaseIterable, Identifiable {
    case everyday
    case walk
    case nightOut = "night_out"
    case date
    case ride

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .everyday: "Everyday"
        case .walk: "Walk Home"
        case .nightOut: "Night Out"
        case .date: "Date"
        case .ride: "Ride"
        }
    }

    /// One-line description shown under the mode chip.
    var tagline: String {
        switch self {
        case .everyday: "SOS ready. No listening."
        case .walk: "Someone watches you get home."
        case .nightOut: "Listens for trouble so you can enjoy the night."
        case .date: "Their details stay sealed unless you need help."
        case .ride: "Logs the car and watches the route."
        }
    }

    var systemImage: String {
        switch self {
        case .everyday: "shield"
        case .walk: "figure.walk"
        case .nightOut: "moon.stars"
        case .date: "heart"
        case .ride: "car"
        }
    }

    /// Whether the on-device audio guard runs by default in this mode.
    var listensByDefault: Bool {
        switch self {
        case .everyday, .walk, .ride: false
        case .nightOut, .date: true
        }
    }

    var usesMotion: Bool { self != .everyday }
    var usesLocation: Bool { true }

    /// Default check-in interval in seconds (SPEC: 30–90 min during Night Out).
    var defaultCheckInInterval: TimeInterval {
        switch self {
        case .everyday: 0
        case .walk: 15 * 60
        case .nightOut: 45 * 60
        case .date: 30 * 60
        case .ride: 10 * 60
        }
    }

    /// Modes that offer a Guard session (Everyday is the passive default).
    static var guardModes: [GuardMode] { [.walk, .nightOut, .date, .ride] }
}
