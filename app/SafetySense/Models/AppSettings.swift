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

    func checkInInterval(for mode: GuardMode) -> TimeInterval {
        checkInIntervalOverrides[mode] ?? mode.defaultCheckInInterval
    }
}
