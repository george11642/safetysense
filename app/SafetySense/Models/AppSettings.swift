import Foundation

/// User preferences (non-secret). Secrets (PINs, safe word) live in the Keychain via `SettingsStore`.
struct AppSettings: Codable, Sendable, Equatable {
    var sensitivity: Sensitivity = .balanced
    var dispatchPolicies: DispatchPolicySettings = .default
    /// Per-mode check-in interval override in seconds (nil = mode default).
    var checkInIntervalOverrides: [GuardMode: TimeInterval] = [:]
    var listenDuringWalk: Bool = false
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

    func checkInInterval(for mode: GuardMode) -> TimeInterval {
        guard mode.defaultCheckInInterval > 0 else { return 0 }
        return checkInIntervalOverrides[mode] ?? mode.defaultCheckInInterval
    }

    /// Overrides for modes that still repeat. One saved for Walk or Ride by an older build is ignored.
    var hasCustomCheckIns: Bool {
        GuardMode.repeatingCheckInModes.contains { checkInIntervalOverrides[$0] != nil }
    }
}
