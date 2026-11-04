import AppIntents
import SwiftUI
import WidgetKit

// OWNER: System Integration module. Lock Screen / Control Center controls.

/// "SafetySense Alert": one tap from the Lock Screen or Control Center, no unlock needed.
/// It opens SafetySense on the alert screen so the person can see who's being told and cancel
/// with their Safety PIN.
struct SOSControlWidget: ControlWidget {
    static let kind = SafetySenseWidgetKind.sosControl

    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: Self.kind) {
            ControlWidgetButton(action: TriggerAlertIntent(source: .controlCenter)) {
                Label("SafetySense Alert", systemImage: "shield.lefthalf.filled")
            }
            .tint(BrandPalette.sandiaPink)
        }
        .displayName("SafetySense Alert")
        .description("Starts SafetySense's alert in one tap, even when your iPhone is locked.")
    }
}

/// "Guard": shows whether a Guard session is running. Turning it on starts one; turning it off
/// opens SafetySense to end it there, so protection can't be switched off from a locked phone.
struct GuardControlWidget: ControlWidget {
    static let kind = SafetySenseWidgetKind.guardControl

    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: Self.kind, provider: GuardStatusProvider()) { isGuarding in
            ControlWidgetToggle("Guard", isOn: isGuarding, action: SetGuardIntent()) { on in
                Label(on ? "Guarding" : "Off", systemImage: on ? "shield.lefthalf.filled" : "shield")
            }
            .tint(BrandPalette.calmTeal)
        }
        .displayName("SafetySense Guard")
        .description("Starts a Guard session. To end one, SafetySense opens so you can confirm.")
    }
}

/// Reads the "guarding" mirror that the app's Live Activity controller keeps in the App Group.
struct GuardStatusProvider: ControlValueProvider {
    var previewValue: Bool { false }

    func currentValue() async throws -> Bool {
        AppGroup.defaults.bool(forKey: AppGroup.Keys.widgetGuardActive)
    }
}
