import Foundation
import WidgetKit

/// What the widget extension can't ask the app directly: is a session on, and at what level.
@MainActor
enum WidgetMirror {
    static func setGuardActive(_ on: Bool, store: SharedStore = .shared) {
        store.set(on, forKey: AppGroup.Keys.widgetGuardActive)
        ControlCenter.shared.reloadControls(ofKind: SafetySenseWidgetKind.guardControl)
    }

    static func setEscalationLevel(_ level: EscalationLevel, store: SharedStore = .shared) {
        store.set(level.rawValue, forKey: AppGroup.Keys.widgetEscalationLevel)
    }
}
