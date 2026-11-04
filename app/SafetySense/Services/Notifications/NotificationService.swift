import Foundation
import UIKit
import UserNotifications
import os

/// Time-Sensitive local notifications for check-ins and alert status.
///
/// A check-in notification carries two actions that work from the Lock Screen without opening
/// the app: "I'm okay" (asks for Face ID / passcode first, so someone else holding the phone
/// can't answer for you) and "I need help" (never gated: asking for help should be one tap).
/// Both reach the running escalation ladder through `SharedCommandBridge`.
@MainActor
final class NotificationService: NSObject, NotificationServiceProtocol {
    enum Identifier {
        static let checkInCategory = "ss.category.checkin"
        static let statusCategory = "ss.category.status"
        static let okayAction = "ss.action.okay"
        static let needHelpAction = "ss.action.needHelp"
        static let checkInPrefix = "ss.checkin."
        static let sessionKey = "sessionID"
        static let intervalKey = "interval"
    }

    /// Seconds after the check-in before a gentle second nudge (the in-app ladder gives 45 s).
    static let followUpDelay: TimeInterval = 25

    /// Called when a check-in notification arrives while the app is open, so the in-app
    /// "You okay?" screen appears at the same moment. Set by `SystemBridge`.
    var onCheckInDue: (@MainActor () -> Void)?

    /// The session's check-in rhythm, so the next one can be lined up after each answer.
    private(set) var rhythm: (sessionID: UUID, interval: TimeInterval)?
    private var dueTimer: Task<Void, Never>?

    private let center: UNUserNotificationCenter
    private let log = Logger(subsystem: "com.georgeteifel.SafetySense", category: "notifications")

    init(center: UNUserNotificationCenter = .current()) {
        self.center = center
        super.init()
        center.delegate = self
        center.setNotificationCategories(Self.categories)
    }

    static var categories: Set<UNNotificationCategory> {
        let okay = UNNotificationAction(identifier: Identifier.okayAction, title: "I'm okay",
                                        options: [.authenticationRequired],
                                        icon: UNNotificationActionIcon(systemImageName: "checkmark.circle"))
        let help = UNNotificationAction(identifier: Identifier.needHelpAction, title: "I need help",
                                        options: [],
                                        icon: UNNotificationActionIcon(systemImageName: "exclamationmark.shield"))
        let checkIn = UNNotificationCategory(identifier: Identifier.checkInCategory, actions: [okay, help],
                                             intentIdentifiers: [],
                                             hiddenPreviewsBodyPlaceholder: "SafetySense check-in",
                                             options: [.hiddenPreviewsShowTitle])
        let status = UNNotificationCategory(identifier: Identifier.statusCategory, actions: [],
                                            intentIdentifiers: [],
                                            hiddenPreviewsBodyPlaceholder: "SafetySense",
                                            options: [])
        return [checkIn, status]
    }

    // MARK: NotificationServiceProtocol

    func requestAuthorization() async -> Bool {
        do {
            return try await center.requestAuthorization(options: [.alert, .sound, .badge])
        } catch {
            log.error("Notification authorization failed")
            return false
        }
    }

    func scheduleCheckIn(at date: Date, sessionID: UUID) {
        let interval: TimeInterval
        if let rhythm, rhythm.sessionID == sessionID {
            interval = rhythm.interval
        } else {
            interval = max(date.timeIntervalSinceNow, 15)
        }
        schedule(checkInAt: date, sessionID: sessionID, repeatInterval: interval)
    }

    func cancelCheckIns() {
        dueTimer?.cancel()
        dueTimer = nil
        rhythm = nil
        Task { await removeCheckIns() }
    }

    /// Lines up the next check-in one interval from now (after any answer).
    func scheduleNextCheckIn() {
        guard let rhythm else { return }
        schedule(checkInAt: .now.addingTimeInterval(rhythm.interval), sessionID: rhythm.sessionID,
                 repeatInterval: rhythm.interval)
    }

    /// Removes the "still checking" nudge once a check-in has been answered anywhere.
    func checkInAnswered() {
        dueTimer?.cancel()
        Task { await removeFollowUps() }
    }

    /// The alert has started: check-in prompts are no longer the right message.
    func alertStarted() {
        dueTimer?.cancel()
        Task { await removeCheckIns() }
    }

    func notify(title: String, body: String, timeSensitive: Bool) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        content.categoryIdentifier = Identifier.statusCategory
        content.threadIdentifier = "ss.status"
        content.interruptionLevel = timeSensitive ? .timeSensitive : .active
        content.relevanceScore = timeSensitive ? 0.9 : 0.4
        add(UNNotificationRequest(identifier: "ss.status.\(UUID().uuidString)", content: content, trigger: nil))
    }

    // MARK: Check-ins

    /// Schedules the check-in and its follow-up nudge. Identifiers are per session, so
    /// scheduling again replaces the previous pair instead of stacking them.
    private func schedule(checkInAt date: Date, sessionID: UUID, repeatInterval: TimeInterval) {
        let delay = max(date.timeIntervalSinceNow, 1)
        rhythm = (sessionID, repeatInterval)
        // While the app is alive (Guard keeps it running), start the in-app 45 s ladder on time
        // too, not only when someone opens the notification.
        dueTimer?.cancel()
        dueTimer = Task { [weak self] in
            try? await Task.sleep(for: .seconds(delay))
            guard !Task.isCancelled else { return }
            self?.onCheckInDue?()
        }
        let info: [String: Any] = [Identifier.sessionKey: sessionID.uuidString, Identifier.intervalKey: repeatInterval]

        let first = UNMutableNotificationContent()
        first.title = "Quick check-in"
        first.body = "Are you okay? If we don't hear from you, SafetySense will let your people know."
        first.sound = .default
        first.categoryIdentifier = Identifier.checkInCategory
        first.threadIdentifier = Identifier.checkInPrefix + sessionID.uuidString
        first.interruptionLevel = .timeSensitive
        first.relevanceScore = 1
        first.userInfo = info

        let followUp = UNMutableNotificationContent()
        followUp.title = "Still checking on you"
        followUp.body = "Tap I'm okay so we know you're safe. Hold this notification for more options."
        followUp.sound = .default
        followUp.categoryIdentifier = Identifier.checkInCategory
        followUp.threadIdentifier = first.threadIdentifier
        followUp.interruptionLevel = .timeSensitive
        followUp.relevanceScore = 1
        followUp.userInfo = info

        let base = Identifier.checkInPrefix + sessionID.uuidString
        add(UNNotificationRequest(identifier: base, content: first,
                                  trigger: UNTimeIntervalNotificationTrigger(timeInterval: delay, repeats: false)))
        add(UNNotificationRequest(identifier: base + ".followup", content: followUp,
                                  trigger: UNTimeIntervalNotificationTrigger(timeInterval: delay + Self.followUpDelay, repeats: false)))
    }

    private func removeCheckIns(sessionID: String? = nil) async {
        let prefix = Identifier.checkInPrefix + (sessionID ?? "")
        let pending = await center.pendingNotificationRequests().map(\.identifier).filter { $0.hasPrefix(prefix) }
        let delivered = await center.deliveredNotifications().map(\.request.identifier).filter { $0.hasPrefix(prefix) }
        center.removePendingNotificationRequests(withIdentifiers: pending)
        center.removeDeliveredNotifications(withIdentifiers: delivered)
    }

    /// Drops the pending nudge and clears answered prompts from Notification Center,
    /// but keeps the next scheduled check-in.
    private func removeFollowUps() async {
        let pending = await center.pendingNotificationRequests().map(\.identifier)
            .filter { $0.hasPrefix(Identifier.checkInPrefix) && $0.hasSuffix(".followup") }
        let delivered = await center.deliveredNotifications().map(\.request.identifier)
            .filter { $0.hasPrefix(Identifier.checkInPrefix) }
        center.removePendingNotificationRequests(withIdentifiers: pending)
        center.removeDeliveredNotifications(withIdentifiers: delivered)
    }

    private func add(_ request: UNNotificationRequest) {
        center.add(request) { [log] error in
            if error != nil { log.error("Couldn't schedule a notification") }
        }
    }

    // MARK: Responses (called by the delegate on the main actor)

    fileprivate func handleAction(_ action: String, sessionID: String?, interval: TimeInterval?) async {
        switch action {
        case Identifier.okayAction:
            SharedCommandBridge.submit(SharedCommand(kind: .checkInOkay, source: .notification))
            await removeCheckIns(sessionID: sessionID)
            // Line up the next check-in at the same rhythm.
            if let sessionID, let uuid = UUID(uuidString: sessionID), let interval, interval > 0 {
                schedule(checkInAt: .now.addingTimeInterval(interval), sessionID: uuid, repeatInterval: interval)
            }
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        case Identifier.needHelpAction:
            SharedCommandBridge.submit(SharedCommand(kind: .checkInNeedHelp, source: .notification))
            await removeCheckIns(sessionID: sessionID)
        default:
            break   // Tapped the notification itself: the app opens on the check-in screen.
        }
    }

    fileprivate func handleForegroundCheckIn() {
        onCheckInDue?()
        UINotificationFeedbackGenerator().notificationOccurred(.warning)
    }
}

extension NotificationService: UNUserNotificationCenterDelegate {
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter,
                                            didReceive response: UNNotificationResponse) async {
        let action = response.actionIdentifier
        let info = response.notification.request.content.userInfo
        let sessionID = info[Identifier.sessionKey] as? String
        let interval = info[Identifier.intervalKey] as? TimeInterval
        await handleAction(action, sessionID: sessionID, interval: interval)
    }

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter,
                                            willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        let category = notification.request.content.categoryIdentifier
        guard category == Identifier.checkInCategory else { return [.banner, .list, .sound] }
        // The app is open: the full-screen check-in takes over, so skip the banner.
        await handleForegroundCheckIn()
        return [.list]
    }
}
