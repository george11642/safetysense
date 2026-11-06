import AppIntents
import Foundation
import UserNotifications

// Intents compiled into BOTH the app and the widget extension (Controls and Live Activity
// buttons need them in the extension). `LiveActivityIntent`s run in the app's process, which lets
// them reach the escalation ladder at once and start a Live Activity from the background. Each one
// goes through `SharedCommandBridge`, and if it ever runs in the extension it is queued for the app.
// App-only intents (Action Button / Siri) live in SafetySense/Intents.

/// Manual SOS from the Lock Screen / Control Center control. One tap, no unlock, and the app stays
/// closed: asking for help should never wait on Face ID. The person sees the Live Activity and
/// can cancel in the app with their PIN. The starting level follows the manual-SOS dispatch
/// policy (default: straight to dispatch).
public struct TriggerAlertIntent: LiveActivityIntent {
    public static let title: LocalizedStringResource = "SafetySense Alert"
    public static let description = IntentDescription("Starts SafetySense's alert. SafetySense adds to 911; it doesn't replace it.")
    public static var openAppWhenRun: Bool { false }
    public static var isDiscoverable: Bool { false }
    public static var authenticationPolicy: IntentAuthenticationPolicy { .alwaysAllowed }

    @Parameter(title: "Source", default: .shortcut)
    public var source: TriggerSourceEntity

    public init() {}

    public init(source: TriggerSourceEntity) {
        self.source = source
    }

    @MainActor
    public func perform() async throws -> some IntentResult {
        let handled = SharedCommandBridge.submit(SharedCommand(kind: .triggerAlert, source: source.commandSource))
        if handled {
            _ = await SharedCommandBridge.awaitServerAlert?()
        } else {
            await SharedCommandFallback.nudge()
        }
        return .result()
    }
}

/// Which surface fired the intent (lets the app log "Action Button" vs "Control").
public enum TriggerSourceEntity: String, AppEnum, Sendable {
    case actionButton, controlCenter, siri, shortcut

    public static let typeDisplayRepresentation: TypeDisplayRepresentation = "Trigger source"
    public static let caseDisplayRepresentations: [TriggerSourceEntity: DisplayRepresentation] = [
        .actionButton: "Action Button",
        .controlCenter: "Control",
        .siri: "Siri",
        .shortcut: "Shortcut",
    ]

    public var commandSource: SharedCommand.Source {
        switch self {
        case .actionButton: .actionButton
        case .controlCenter: .controlCenter
        case .siri: .siri
        case .shortcut: .shortcut
        }
    }
}

/// "I'm okay" button on the check-in Live Activity. Live Activity intents run in the app's
/// process, so this resolves the check-in without opening the app. It asks for Face ID or the
/// passcode first, like the same button on the notification and in Siri: someone else holding
/// the phone can't answer for you. "Need help" is never gated.
public struct CheckInOkayIntent: LiveActivityIntent {
    public static let title: LocalizedStringResource = "I'm okay"
    public static let description = IntentDescription("Answers a SafetySense check-in.")
    public static var isDiscoverable: Bool { false }
    public static var authenticationPolicy: IntentAuthenticationPolicy { .requiresAuthentication }

    public init() {}

    @MainActor
    public func perform() async throws -> some IntentResult {
        SharedCommandBridge.submit(SharedCommand(kind: .checkInOkay, source: .liveActivity))
        return .result()
    }
}

/// "Need help" button on the check-in Live Activity. Starts the alert at once.
public struct CheckInNeedHelpIntent: LiveActivityIntent {
    public static let title: LocalizedStringResource = "I need help"
    public static let description = IntentDescription("Starts the SafetySense alert from a check-in.")
    public static var isDiscoverable: Bool { false }
    public static var authenticationPolicy: IntentAuthenticationPolicy { .alwaysAllowed }

    public init() {}

    @MainActor
    public func perform() async throws -> some IntentResult {
        SharedCommandBridge.submit(SharedCommand(kind: .checkInNeedHelp, source: .liveActivity))
        return .result()
    }
}

/// Backs the "Guard" Control Center / Lock Screen toggle. Turning it on starts a Guard session;
/// turning it off only opens SafetySense, because ending a session should take the person's
/// own unlock (someone else holding the phone shouldn't be able to switch protection off).
public struct SetGuardIntent: SetValueIntent {
    public static let title: LocalizedStringResource = "Guard"
    public static let description = IntentDescription("Starts a SafetySense Guard session.")
    public static var openAppWhenRun: Bool { true }
    public static var isDiscoverable: Bool { false }

    @Parameter(title: "Guarding")
    public var value: Bool

    public init() {}

    @MainActor
    public func perform() async throws -> some IntentResult {
        if value {
            SharedCommandBridge.submit(SharedCommand(kind: .startGuard, source: .controlCenter))
        }
        return .result()
    }
}

/// If an alert intent ever runs where the ladder isn't (the extension), the command is safe in
/// the queue but nothing has happened yet, so say so instead of staying quiet.
enum SharedCommandFallback {
    static func nudge() async {
        let content = UNMutableNotificationContent()
        content.title = "Tap to finish your alert"
        content.body = "Open SafetySense to finish starting your alert. If you can, call 911."
        content.sound = .default
        content.interruptionLevel = NotificationUrgency.level(
            for: await UNUserNotificationCenter.current().notificationSettings().timeSensitiveSetting)
        try? await UNUserNotificationCenter.current().add(
            UNNotificationRequest(identifier: "ss.status.pending-alert", content: content, trigger: nil))
    }
}

/// Widget / control kinds, shared so the app can ask WidgetKit to refresh them.
public enum SafetySenseWidgetKind {
    public static let sosControl = "com.georgeteifel.SafetySense.sos-control"
    public static let guardControl = "com.georgeteifel.SafetySense.guard-control"
}
