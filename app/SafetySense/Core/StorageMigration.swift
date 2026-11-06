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

/// Keychain items outlive the app, so a reinstall would inherit the old device credentials and
/// PIN hashes, and someone who deleted the app to start over wouldn't get to. App data doesn't
/// survive, so a marker file tells a fresh install from an update.
///
/// A file, because its existence can be read before first unlock, when defaults and the Keychain
/// both look empty. That case finds nothing to wipe here, and an update finds a finished
/// onboarding, so only a real fresh install with leftovers clears anything.
enum FreshInstall {
    static var defaultMarker: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? URL(filePath: NSTemporaryDirectory())
        return base.appending(path: "SafetySense.installed")
    }

    static func run(defaults: UserDefaults = AppGroup.defaults, secrets: any SecretStore = KeychainSecretStore(),
                    shared: SharedStore = .shared, marker: URL = defaultMarker) {
        guard !FileManager.default.fileExists(atPath: marker.path) else { return }
        let isUpdate = defaults.bool(forKey: AppGroup.Keys.onboardingComplete) || defaults.data(forKey: AppGroup.Keys.profile) != nil
        if !isUpdate, AppGroup.KeychainAccounts.erasable.contains(where: { secrets.data(for: $0) != nil }) {
            AppGroup.KeychainAccounts.erasable.forEach { secrets.set(nil, for: $0) }
            shared.eraseAll()
        }
        try? FileManager.default.createDirectory(at: marker.deletingLastPathComponent(), withIntermediateDirectories: true)
        FileManager.default.createFile(atPath: marker.path, contents: nil)
    }
}
