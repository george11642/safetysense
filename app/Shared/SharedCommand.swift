import Foundation

/// A command raised outside the app's UI (Action Button, Control, Siri, Live Activity button).
/// Intents enqueue commands in the App Group; `AppModel.drainSharedCommands()` consumes them.
public struct SharedCommand: Codable, Sendable, Equatable, Identifiable {
    public enum Kind: String, Codable, Sendable {
        case triggerAlert      // manual SOS from Action Button / Control / Siri
        case checkInOkay       // "I'm okay" from the Live Activity
        case checkInNeedHelp   // "Need help" from the Live Activity
        case startGuard        // "Start Guard" shortcut
    }

    public enum Source: String, Codable, Sendable {
        case actionButton, controlCenter, siri, liveActivity, shortcut, app
        /// A button on a SafetySense notification (check-in "I'm okay" / "I need help").
        case notification
    }

    public var id: UUID
    public var kind: Kind
    public var source: Source
    public var createdAt: Date
    /// `GuardMode.rawValue` for `.startGuard` (nil = the app's default mode).
    public var mode: String?

    public init(kind: Kind, source: Source, id: UUID = UUID(), createdAt: Date = .now, mode: String? = nil) {
        self.id = id
        self.kind = kind
        self.source = source
        self.createdAt = createdAt
        self.mode = mode
    }

    /// Calm, human reason recorded on the alert (shown to contacts on the live page).
    public var alertReason: String {
        switch (kind, source) {
        case (.checkInNeedHelp, _): "Asked for help at a check-in"
        case (_, .actionButton): "Pressed the Action Button"
        case (_, .controlCenter): "Tapped the SafetySense control"
        case (_, .liveActivity): "Asked for help from the Lock Screen"
        case (_, .notification): "Asked for help from a notification"
        default: "Started an SOS"
        }
    }
}

public enum SharedCommandQueue {
    /// Posted (in-process) whenever a command is queued, so a running app can drain at once
    /// instead of waiting for the next time it becomes active.
    public static let didEnqueueNotification = Notification.Name("SafetySense.sharedCommandEnqueued")

    public static func enqueue(_ command: SharedCommand) {
        let defaults = AppGroup.defaults
        var queue = peek(defaults: defaults)
        queue.append(command)
        if let data = try? JSONEncoder().encode(queue) {
            defaults.set(data, forKey: AppGroup.Keys.pendingCommands)
        }
    }

    /// Returns and clears all queued commands, oldest first.
    public static func drain() -> [SharedCommand] {
        let defaults = AppGroup.defaults
        let queue = peek(defaults: defaults)
        defaults.removeObject(forKey: AppGroup.Keys.pendingCommands)
        return queue
    }

    static func peek(defaults: UserDefaults) -> [SharedCommand] {
        guard let data = defaults.data(forKey: AppGroup.Keys.pendingCommands),
              let queue = try? JSONDecoder().decode([SharedCommand].self, from: data)
        else { return [] }
        return queue
    }
}

/// Lets an intent hand a command straight to the running escalation ladder when it executes
/// inside the app process (Live Activity buttons, notification actions, background App Intents).
/// The app installs `handler` at launch (`SystemBridge.install`). In the widget extension the
/// handler is nil, so the command goes to `SharedCommandQueue` and the app drains it on open.
@MainActor
public enum SharedCommandBridge {
    /// Returns true when the command was handled in-process.
    public static var handler: (@MainActor (SharedCommand) -> Bool)?

    /// True when a live in-app ladder is listening (the intent is running in the app process).
    public static var isAppProcess: Bool { handler != nil }

    /// Hands the command to the app if it's running here; otherwise queues it.
    /// Returns true when it was handled immediately.
    @discardableResult
    public static func submit(_ command: SharedCommand) -> Bool {
        if let handler, handler(command) { return true }
        SharedCommandQueue.enqueue(command)
        NotificationCenter.default.post(name: SharedCommandQueue.didEnqueueNotification, object: nil)
        return false
    }
}
