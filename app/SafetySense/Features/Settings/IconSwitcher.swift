import UIKit

/// Switches between the SafetySense icon and the discreet "Daylight" icon (`AppIconDiscreet`).
@MainActor
enum IconSwitcher {
    static let discreetIconName = "AppIconDiscreet"

    static var isSupported: Bool { UIApplication.shared.supportsAlternateIcons }
    static var isDiscreet: Bool { UIApplication.shared.alternateIconName == discreetIconName }

    /// Returns false if iOS refused the change (the caller should revert its toggle).
    @discardableResult
    static func apply(discreet: Bool) async -> Bool {
        guard isSupported else { return false }
        let target = discreet ? discreetIconName : nil
        guard UIApplication.shared.alternateIconName != target else { return true }
        do {
            try await UIApplication.shared.setAlternateIconName(target)
            return true
        } catch {
            return false
        }
    }
}
