import Foundation

enum PermissionState: Sendable, Equatable { case granted, notAsked, denied }

/// What iOS allows right now, as far as a Guard session cares.
struct GuardPermissions: Sendable, Equatable {
    var microphone: PermissionState = .granted
    var location: LocationAuthorization = .always
    var notifications: PermissionState = .granted
    /// Check-ins can break through a Focus. Needs the capability signed in and the setting on.
    var timeSensitive = true

    /// Settings' row value.
    var summary: String {
        let off = [microphone == .denied, location == .denied, notifications == .denied].count { $0 }
        if off > 0 { return "\(off) off" }
        let partial = microphone == .notAsked || notifications == .notAsked || location != .always
        return partial ? "Review" : "On"
    }

    /// What reaches you when a check-in is due, for Settings.
    var notificationDetail: String {
        switch notifications {
        case .denied:
            GuardPermissionIssue.notifications.message
        case .notAsked:
            "SafetySense asks when you start a Guard. Check-ins need this to reach you while the app is closed."
        case .granted:
            timeSensitive ? "Time-Sensitive is on, so a \u{201C}You okay?\u{201D} check-in can reach you in a Focus."
                          : "A Focus can hold check-ins back in this build. To be sure they reach you, allow SafetySense in your Focus settings."
        }
    }

    /// Location updates can keep the app running while the phone is locked.
    var allowsBackgroundLocation: Bool { location == .always || location == .whenInUse }

    /// Permissions that are off and that this session needs. Something not asked yet isn't an
    /// issue, because Start Guard asks for it.
    func issues(listening: Bool) -> [GuardPermissionIssue] {
        var found: [GuardPermissionIssue] = []
        if listening, microphone == .denied { found.append(.microphone) }
        if location == .denied { found.append(.location) }
        if notifications == .denied { found.append(.notifications) }
        return found
    }
}

/// A permission that is switched off, with calm copy saying what that changes.
enum GuardPermissionIssue: String, Sendable, Identifiable, CaseIterable {
    case microphone, location, notifications, noBackgroundRun
    var id: String { rawValue }

    var message: String {
        switch self {
        case .microphone: "The microphone is off, so SafetySense can't listen for trouble or your safe word."
        case .location: "Location is off, so your contacts won't see where you are."
        case .notifications: "Notifications are off, so check-ins only show up while SafetySense is open. An unanswered check-in still starts an alert."
        case .noBackgroundRun: "With Location and the microphone both off, SafetySense stops running when your iPhone locks. Keep it open, or turn Location on in iOS Settings."
        }
    }

    var systemImage: String {
        switch self {
        case .microphone: "mic.slash"
        case .location: "location.slash"
        case .notifications: "bell.slash"
        case .noBackgroundRun: "lock.iphone"
        }
    }
}
