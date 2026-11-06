import Foundation

enum PermissionState: Sendable, Equatable { case granted, notAsked, denied }

/// What iOS allows right now, as far as a Guard session cares.
struct GuardPermissions: Sendable, Equatable {
    var microphone: PermissionState = .granted
    var location: LocationAuthorization = .always
    var notifications: PermissionState = .granted

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
    case microphone, location, notifications
    var id: String { rawValue }

    var message: String {
        switch self {
        case .microphone: "The microphone is off, so SafetySense can't listen for trouble or your safe word."
        case .location: "Location is off, so your contacts won't see where you are."
        case .notifications: "Notifications are off, so check-ins only show up while SafetySense is open."
        }
    }

    var systemImage: String {
        switch self {
        case .microphone: "mic.slash"
        case .location: "location.slash"
        case .notifications: "bell.slash"
        }
    }
}
