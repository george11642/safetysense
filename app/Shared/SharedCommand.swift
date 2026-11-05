import Foundation

/// A command raised outside the app's UI (Action Button, Control, Siri, Live Activity button).
/// Intents enqueue commands in the App Group; `AppModel.drainSharedCommands()` consumes them.
public struct SharedCommand: Codable, Sendable, Equatable, Identifiable {
    public enum Kind: String, Codable, Sendable {
        case triggerAlert      // manual SOS from Action Button / Control / Siri
        case checkInOkay       // "I'm okay" from the Live Activity
        case checkInNeedHelp   // "Need help" from the Live Activity
        case startGuard        // "Start Guard" shortcut
        case fakeCall          // "SafetySense fake call" shortcut (SPEC 7.7)

        /// How long a queued command still means what the person meant when they raised it.
        public var maxQueuedAge: TimeInterval {
            switch self {
            case .triggerAlert, .checkInNeedHelp: 30 * 60
            case .checkInOkay: 2 * 60
            case .startGuard, .fakeCall: 5 * 60
            }
        }
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
    /// `.fakeCall`: who's calling (nil = the last name used, or "Mom").
    public var callerName: String?
    /// `.fakeCall`: seconds until it rings (nil = the last delay used).
    public var delaySeconds: Double?

    public init(kind: Kind, source: Source, id: UUID = UUID(), createdAt: Date = .now, mode: String? = nil,
                callerName: String? = nil, delaySeconds: Double? = nil) {
        self.id = id
        self.kind = kind
        self.source = source
        self.createdAt = createdAt
        self.mode = mode
        self.callerName = callerName
        self.delaySeconds = delaySeconds
    }

    /// A command that waited too long in the queue is dropped, so nobody's contacts get an SOS
    /// from hours ago the next time the app happens to open.
    public func isFresh(at now: Date = .now) -> Bool {
        now.timeIntervalSince(createdAt) < kind.maxQueuedAge
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

/// Commands raised outside the app's process. Each command is its own item in `SharedStore`, so
/// an enqueue is a single atomic write and two processes can never overwrite each other's commands.
public enum SharedCommandQueue {
    /// Posted (in-process) whenever a command is queued, so a running app can drain at once
    /// instead of waiting for the next time it becomes active.
    public static let didEnqueueNotification = Notification.Name("SafetySense.sharedCommandEnqueued")

    static let itemPrefix = "ss.cmd."

    /// Sorts by creation time, then keeps every command unique.
    static func itemKey(for command: SharedCommand) -> String {
        let millis = Int64((command.createdAt.timeIntervalSince1970 * 1000).rounded())
        return itemPrefix + String(format: "%014lld", millis) + "." + command.id.uuidString
    }

    public static func enqueue(_ command: SharedCommand, store: SharedStore = .shared) {
        guard let data = try? JSONEncoder().encode(command) else { return }
        store.set(data, forKey: itemKey(for: command))
        SharedCommandSignal.post()
    }

    /// Returns and clears all queued commands, oldest first.
    public static func drain(store: SharedStore = .shared) -> [SharedCommand] {
        store.keys(withPrefix: itemPrefix).sorted().compactMap { key in
            let data = store.data(forKey: key)
            store.set(nil, forKey: key)
            return data.flatMap { try? JSONDecoder().decode(SharedCommand.self, from: $0) }
        }
    }

    /// One-time move of the old array-in-defaults queue.
    public static func migrateLegacyQueue(from defaults: UserDefaults, store: SharedStore = .shared) {
        guard let data = defaults.data(forKey: AppGroup.Keys.pendingCommands) else { return }
        defaults.removeObject(forKey: AppGroup.Keys.pendingCommands)
        let queue = (try? JSONDecoder().decode([SharedCommand].self, from: data)) ?? []
        queue.forEach { enqueue($0, store: store) }
    }
}

/// A Darwin notification, the one signal that crosses from the widget extension into a running
/// app. It carries no data: the app answers by draining `SharedCommandQueue`.
public enum SharedCommandSignal {
    static let name = "com.georgeteifel.SafetySense.commandQueued"
    private static let lock = NSLock()
    nonisolated(unsafe) private static var handler: (@Sendable () -> Void)?

    public static func post() {
        CFNotificationCenterPostNotification(CFNotificationCenterGetDarwinNotifyCenter(),
                                             CFNotificationName(name as CFString), nil, nil, true)
    }

    /// Installs the one handler for this process. It runs on an arbitrary thread.
    public static func observe(_ newHandler: @escaping @Sendable () -> Void) {
        let isFirst = lock.withLock {
            defer { handler = newHandler }
            return handler == nil
        }
        guard isFirst else { return }
        CFNotificationCenterAddObserver(CFNotificationCenterGetDarwinNotifyCenter(), nil,
                                        { _, _, _, _, _ in SharedCommandSignal.fire() },
                                        name as CFString, nil, .deliverImmediately)
    }

    private static func fire() {
        lock.withLock { handler }?()
    }
}

/// Lets an intent hand a command straight to the running escalation ladder when it executes
/// inside the app process (Live Activity buttons, notification actions, background App Intents).
/// The app installs `handler` at launch (`SystemBridge.install`). In the widget extension the
/// handler is nil, so the command goes to `SharedCommandQueue`, the Darwin signal wakes a running
/// app, and otherwise the app drains it when it next opens.
@MainActor
public enum SharedCommandBridge {
    /// Returns true when the command was handled in-process.
    public static var handler: (@MainActor (SharedCommand) -> Bool)?
    /// Keeps the intent alive until the server has the alert. True once it does.
    public static var awaitServerAlert: (@MainActor () async -> Bool)?

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
