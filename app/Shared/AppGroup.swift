import Foundation

/// Where SafetySense keeps non-secret data.
///
/// - `AppGroup.defaults` is the **app's own** store (profile, contacts, settings, session). It is
///   the group suite when this process is really entitled, and `.standard` otherwise.
/// - Anything the widget extension must also see goes through `SharedStore`, never `defaults`.
///   `UserDefaults(suiteName:)` succeeds even without the entitlement and quietly gives each
///   process its own private plist, which is why availability is decided by the container URL.
public enum AppGroup {
    public static let identifier = "group.com.georgeteifel.SafetySense"

    /// True only when this process really has the group container (the entitlement is signed in).
    public static let isContainerAvailable =
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: identifier) != nil

    /// The app's own defaults. See the type comment.
    public static var defaults: UserDefaults {
        isContainerAvailable ? (UserDefaults(suiteName: identifier) ?? .standard) : .standard
    }

    public enum Keys {
        public static let profile = "ss.profile"
        public static let contacts = "ss.contacts"
        public static let settings = "ss.settings"
        public static let onboardingComplete = "ss.onboardingComplete"
        public static let currentSession = "ss.currentSession"
        public static let currentAlert = "ss.currentAlert"
        public static let alertHistory = "ss.alertHistory"
        public static let evidenceIndex = "ss.evidenceIndex"
        /// Pre-`SharedStore` queue (JSON array of `SharedCommand`). Only read to migrate it.
        public static let pendingCommands = "ss.pendingCommands"
        /// `SharedStore`: mirror of the escalation level for widgets (`EscalationLevel.rawValue`).
        public static let widgetEscalationLevel = "ss.widget.escalationLevel"
        /// `SharedStore`: mirror for the Guard control toggle. Written by `WidgetMirror`.
        public static let widgetGuardActive = "ss.widget.guardActive"
        /// Safety switch for the backend (Bool, default false). While false, every alert and
        /// session is sent with `dry_run: true`, so the server records it but calls and texts no one.
        /// The Settings screen flips it ("Allow real calls"); `-ssAllowRealCalls 1` sets it for a launch.
        public static let allowRealCalls = "ss.dev.allowRealCalls"   // same key as DeveloperSettings.allowRealCallsKey
        /// Server session id of the running Guard session (String), for background heartbeats.
        public static let heartbeatSessionID = "ss.heartbeat.sessionID"
        /// Last time a heartbeat reached the server (Double, seconds since 1970).
        public static let heartbeatLastSentAt = "ss.heartbeat.lastSentAt"
        /// JSON outbox of heartbeats / alert locations waiting for the network.
        public static let backendOutbox = "ss.backend.outbox"
        /// JSON of the alert an intent created directly on the server while the in-app ladder
        /// wasn't running (`ExternalAlertRecord`). The app adopts it on next launch.
        public static let externalAlert = "ss.externalAlert"
        /// Every key `AppGroup.defaults` owns, for `StorageMigration` and "delete everything".
        public static let appLocal = [
            profile, contacts, settings, onboardingComplete, currentSession, currentAlert, alertHistory,
            evidenceIndex, heartbeatSessionID, heartbeatLastSentAt, backendOutbox, externalAlert,
        ]
    }

    /// Keychain service + account names for secrets (PIN hashes, safe word, device secret).
    public enum KeychainAccounts {
        public static let service = "com.georgeteifel.SafetySense"
        public static let safetyPINHash = "safetyPINHash"
        public static let duressPINHash = "duressPINHash"
        public static let safeWord = "safeWord"
        public static let deviceCredentials = "deviceCredentials"
        public static let evidenceKey = "evidenceKey"
        /// Date and Ride details plus the Walk destination for the running session.
        public static let sessionDetails = "sessionDetails"
        /// Alerts the server hasn't confirmed yet (`PendingAlertStore`).
        public static let pendingAlerts = "pendingAlerts"
        /// Duress alerts this phone ran, which keep their clips out of the Vault (`DuressRecordStore`).
        public static let duressRecords = "duressRecords"
        /// Device credentials waiting to finish `account/delete` after an offline erase.
        public static let pendingAccountDeletion = "pendingAccountDeletion"
        /// Every item "delete everything" clears, and the ones a reinstall mustn't inherit.
        /// The safety PIN from before a forced "Delete everything", so it alone can bring clips back.
        public static let parkedSafetyPINHash = "parkedSafetyPINHash"
        public static let erasable = [
            safetyPINHash, duressPINHash, safeWord, deviceCredentials, evidenceKey, sessionDetails, pendingAlerts,
            duressRecords, parkedSafetyPINHash,
        ]
        /// Separate service for the widget-readable items in `SharedStore`, so a secret lookup
        /// by account can never match one.
        public static let sharedService = "com.georgeteifel.SafetySense.shared"
    }
}
