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
        case .everyday: false
        case .walk, .nightOut, .date, .ride: true
        }
    }

    var usesMotion: Bool { self != .everyday }
    var usesLocation: Bool { true }

    /// Walk and Ride check once at the time you should have arrived, plus stop detection,
    /// instead of on a repeating schedule.
    var usesArrivalCheck: Bool { self == .walk || self == .ride }

    /// Repeating check-in interval in seconds, 0 for modes without one.
    var defaultCheckInInterval: TimeInterval {
        switch self {
        case .nightOut, .date: 20 * 60
        case .everyday, .walk, .ride: 0
        }
    }

    /// The arrival check for a Walk or Ride started without its setup screen (a Shortcut, or
    /// answering a fake call). Same as each setup screen's default, so no Guard runs unchecked.
    var defaultArrivalCheck: TimeInterval? {
        switch self {
        case .walk: 15 * 60
        case .ride: 20 * 60
        case .everyday, .nightOut, .date: nil
        }
    }

    /// Modes that offer a Guard session (Everyday is the passive default).
    static var guardModes: [GuardMode] { [.walk, .nightOut, .date, .ride] }

    /// Modes with a repeating check-in the person can tune in Settings.
    static var repeatingCheckInModes: [GuardMode] { guardModes.filter { $0.defaultCheckInInterval > 0 } }
}
