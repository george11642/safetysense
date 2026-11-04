import Foundation
import UIKit
import UserNotifications

/// A time-sensitive local notification that looks like an incoming call, for when SafetySense
/// is in the background or the phone is locked at ring time. It carries the caller's name only:
/// no app wording, nothing that says "fake".
@MainActor
final class FakeCallNotifier: FakeCallNotifying {
    enum Identifier {
        static let request = "ss.fakecall"
        static let category = "ss.category.fakecall"
        static let answerAction = "ss.action.fakecall.answer"
        static let declineAction = "ss.action.fakecall.decline"
    }

    /// Registered by `NotificationService` with its own categories (`setNotificationCategories`
    /// replaces the whole set, so there's one owner).
    static var category: UNNotificationCategory {
        let answer = UNNotificationAction(identifier: Identifier.answerAction, title: "Answer",
                                          options: [.foreground],
                                          icon: UNNotificationActionIcon(systemImageName: "phone.fill"))
        let decline = UNNotificationAction(identifier: Identifier.declineAction, title: "Decline",
                                           options: [.destructive],
                                           icon: UNNotificationActionIcon(systemImageName: "phone.down.fill"))
        return UNNotificationCategory(identifier: Identifier.category, actions: [answer, decline],
                                      intentIdentifiers: [], options: [])
    }

    /// Notification taps, routed by `NotificationService`'s delegate. `true` = Answer.
    static var onOpened: (@MainActor (_ answer: Bool) -> Void)?
    static var onDeclined: (@MainActor () -> Void)?

    private let center: UNUserNotificationCenter

    init(center: UNUserNotificationCenter = .current()) {
        self.center = center
    }

    func schedule(at date: Date, config: FakeCallConfig) {
        let content = UNMutableNotificationContent()
        content.title = config.displayName
        content.body = "Incoming call"
        content.categoryIdentifier = Identifier.category
        content.interruptionLevel = .timeSensitive
        content.relevanceScore = 1
        if let sound = Ringtone.installNotificationSound() {
            content.sound = UNNotificationSound(named: UNNotificationSoundName(sound))
        } else {
            content.sound = .default
        }
        let delay = max(1, date.timeIntervalSinceNow)
        let request = UNNotificationRequest(identifier: Identifier.request, content: content,
                                            trigger: UNTimeIntervalNotificationTrigger(timeInterval: delay, repeats: false))
        let center = center
        Task {
            // Ask now (not at onboarding) if they haven't decided yet; a "no" still leaves the
            // in-app call working while SafetySense is open.
            let settings = await center.notificationSettings()
            if settings.authorizationStatus == .notDetermined {
                _ = try? await center.requestAuthorization(options: [.alert, .sound, .badge])
            }
            try? await center.add(request)
        }
    }

    func ringingStarted() {
        // On screen: the full-screen call is already up, so drop the banner. Locked or in the
        // background: leave it, it's what rings.
        guard UIApplication.shared.applicationState == .active else { return }
        cancel()
    }

    func cancel() {
        center.removePendingNotificationRequests(withIdentifiers: [Identifier.request])
        center.removeDeliveredNotifications(withIdentifiers: [Identifier.request])
    }
}
