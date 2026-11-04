import Foundation

/// App Group shared by the app and the widget extension.
/// Anything both processes need to read (Live Activity state, queued intent commands)
/// goes through `AppGroup.defaults` with a key from `AppGroup.Keys`.
public enum AppGroup {
    public static let identifier = "group.com.georgeteifel.SafetySense"

    /// Shared defaults. Falls back to `.standard` when the group container is unavailable
    /// (for example an unsigned simulator build), so callers never crash.
    public static var defaults: UserDefaults {
        UserDefaults(suiteName: identifier) ?? .standard
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
        /// JSON array of `SharedCommand` written by intents/widgets, drained by the app.
        public static let pendingCommands = "ss.pendingCommands"
        /// Mirror of the escalation level for widgets (Int, `EscalationLevel.rawValue`).
        public static let widgetEscalationLevel = "ss.widget.escalationLevel"
        /// Mirror for the Guard control toggle (Bool). Written by `LiveActivityController`.
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
    }

    /// Keychain service + account names for secrets (PIN hashes, safe word, device secret).
    public enum KeychainAccounts {
        public static let service = "com.georgeteifel.SafetySense"
        public static let safetyPINHash = "safetyPINHash"
        public static let duressPINHash = "duressPINHash"
        public static let safeWord = "safeWord"
        public static let deviceCredentials = "deviceCredentials"
        public static let evidenceKey = "evidenceKey"
    }
}
