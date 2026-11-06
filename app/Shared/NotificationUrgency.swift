import UserNotifications

/// The one place that picks a notification's interruption level. `.timeSensitive` only when iOS
/// reports it enabled: that needs the capability signed in and the person's setting on. Anything
/// else is an ordinary notification, which a Focus can hold back.
@MainActor
enum NotificationUrgency {
    static var current: UNNotificationSetting = .enabled

    static func level() -> UNNotificationInterruptionLevel { level(for: current) }

    nonisolated static func level(for setting: UNNotificationSetting) -> UNNotificationInterruptionLevel {
        setting == .enabled ? .timeSensitive : .active
    }

    /// False when check-ins can't break through a Focus, so the app shouldn't promise that.
    static var isSupported: Bool { current == .enabled }
}
