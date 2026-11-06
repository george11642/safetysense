import Foundation

/// User preferences (non-secret). Secrets (PINs, safe word) live in the Keychain via `SettingsStore`.
struct AppSettings: Codable, Sendable, Equatable {
    var sensitivity: Sensitivity = .balanced
    var dispatchPolicies: DispatchPolicySettings = .default
    /// Per-mode check-in interval override in seconds (nil = mode default).
    var checkInIntervalOverrides: [GuardMode: TimeInterval] = [:]
    var listenDuringWalk: Bool = true
    /// Optional so settings saved by older builds still decode. Read `listensDuringRide`.
    var listenDuringRide: Bool?
    var drinkCheckPrompts: Bool = true
    /// Use the Foundation Models second opinion when available.
    var useSecondOpinion: Bool = true
    var discreetIcon: Bool = false
    /// Days to keep location/evidence before auto-delete (SPEC 11: 30 by default).
    var retentionDays: Int = 30
    var hasSetUpActionButton: Bool = false
    var hasAddedControl: Bool = false
    var hasCompletedDrill: Bool = false
    /// The mode Home last showed. Optional so settings saved by older builds still decode.
    var lastHomeMode: GuardMode?

    var listensDuringRide: Bool {
        get { listenDuringRide ?? GuardMode.ride.listensByDefault }
        set { listenDuringRide = newValue }
    }

    /// Whether a Guard in this mode uses the microphone. Walk and Ride leave the choice to the person.
    func listens(in mode: GuardMode) -> Bool {
        switch mode {
        case .walk: listenDuringWalk
        case .ride: listensDuringRide
        case .everyday, .nightOut, .date: mode.listensByDefault
        }
    }

    func checkInInterval(for mode: GuardMode) -> TimeInterval {
        guard mode.defaultCheckInInterval > 0 else { return 0 }
        return checkInIntervalOverrides[mode] ?? mode.defaultCheckInInterval
    }

    /// Overrides for modes that still repeat. One saved for Walk or Ride by an older build is ignored.
    var hasCustomCheckIns: Bool {
        GuardMode.repeatingCheckInModes.contains { checkInIntervalOverrides[$0] != nil }
    }
}
