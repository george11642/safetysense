import Foundation

/// Moves app data to wherever `AppGroup.defaults` lives in this build, so nobody is sent back to
/// onboarding when storage changes.
///
/// Earlier builds wrote to `UserDefaults(suiteName:)` without the entitlement, which is a private
/// plist in the app's own container. This build stores in `.standard` until the App Group is
/// enabled, then in the group. Each key moves only if the destination doesn't have it, and the
/// source is removed once it has moved, so this is safe to run on every launch.
enum StorageMigration {
    static var legacySuiteURL: URL {
        URL(filePath: NSHomeDirectory()).appending(path: "Library/Preferences/\(AppGroup.identifier).plist")
    }

    static func run() {
        migrate(keys: AppGroup.Keys.appLocal + [DeveloperSettings.demoModeKey, DeveloperSettings.allowRealCallsKey,
                                                DeveloperSettings.demoTimeScaleKey, AppGroup.Keys.pendingCommands],
                legacySuite: legacySuiteURL,
                standard: AppGroup.isContainerAvailable ? .standard : nil,
                into: AppGroup.defaults)
        SharedCommandQueue.migrateLegacyQueue(from: AppGroup.defaults)
        // The first entitled launch: pick up whatever the Keychain store was holding.
        if AppGroup.isContainerAvailable {
            let keychain = KeychainSharedBackend()
            if keychain.isUsable {
                SharedStore.shared.adopt(from: keychain,
                                         keys: [AppGroup.Keys.widgetEscalationLevel, AppGroup.Keys.widgetGuardActive],
                                         prefixes: [SharedCommandQueue.itemPrefix])
            }
        }
    }

    static func migrate(keys: [String], legacySuite: URL, standard: UserDefaults?, into destination: UserDefaults) {
        if let data = try? Data(contentsOf: legacySuite),
           let legacy = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: Any] {
            for key in keys where destination.object(forKey: key) == nil {
                if let value = legacy[key] { destination.set(value, forKey: key) }
            }
            try? FileManager.default.removeItem(at: legacySuite)
        }
        guard let standard, standard !== destination else { return }
        for key in keys {
            guard let value = standard.object(forKey: key) else { continue }
            if destination.object(forKey: key) == nil { destination.set(value, forKey: key) }
            standard.removeObject(forKey: key)
        }
    }
}
