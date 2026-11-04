import UIKit

/// Battery level from `UIDevice` (0...1, nil when unknown, e.g. in the simulator).
/// Contacts see it on the live page, so they know how long the phone may last.
@MainActor
final class DeviceBatteryStatus: DeviceStatusProviding {
    init() {
        UIDevice.current.isBatteryMonitoringEnabled = true
    }

    var batteryLevel: Double? {
        let level = UIDevice.current.batteryLevel
        return level < 0 ? nil : Double(level)
    }
}
