import AppIntents
import Foundation

// Intents compiled into BOTH the app and the widget extension (Controls and Live Activity
// buttons need them in the extension). Each one goes through `SharedCommandBridge`: inside the
// app process it reaches the escalation ladder at once; anywhere else it is queued for the app.
// App-only intents (Action Button / Siri) live in SafetySense/Intents.

/// Manual SOS from the Lock Screen / Control Center control. It opens SafetySense so the
/// person sees what's happening (and can cancel with their PIN). The starting level follows the
/// manual-SOS dispatch policy (default: straight to dispatch).
public struct TriggerAlertIntent: AppIntent {
    public static let title: LocalizedStringResource = "SafetySense Alert"
    public static let description = IntentDescription("Starts SafetySense's alert so your people, and help, are on the way.")
    public static var openAppWhenRun: Bool { true }

    @Parameter(title: "Source", default: .shortcut)
    public var source: TriggerSourceEntity

    public init() {}

    public init(source: TriggerSourceEntity) {
        self.source = source
    }

    @MainActor
    public func perform() async throws -> some IntentResult {
        SharedCommandBridge.submit(SharedCommand(kind: .triggerAlert, source: source.commandSource))
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
/// process, so this resolves the check-in without opening the app.
public struct CheckInOkayIntent: LiveActivityIntent {
    public static let title: LocalizedStringResource = "I'm okay"
    public static let description = IntentDescription("Answers a SafetySense check-in.")
    public static var isDiscoverable: Bool { false }

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

/// Widget / control kinds, shared so the app can ask WidgetKit to refresh them.
public enum SafetySenseWidgetKind {
    public static let sosControl = "com.georgeteifel.SafetySense.sos-control"
    public static let guardControl = "com.georgeteifel.SafetySense.guard-control"
}
