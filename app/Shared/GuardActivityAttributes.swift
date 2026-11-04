import Foundation
#if canImport(ActivityKit)
import ActivityKit
#endif

/// Live Activity payload for an active Guard session. Shared by the app (which starts and
/// updates it) and the widget extension (which renders it on the Lock Screen / Dynamic Island).
public struct GuardActivityAttributes: Sendable {
    public struct ContentState: Codable, Hashable, Sendable {
        /// `EscalationLevel.rawValue`: 0 guarding, 1 check-in, 2 alert, 3 dispatch.
        public var level: Int
        /// Short status line, e.g. "Guarding quietly" or "Maya is on her way".
        public var statusText: String
        /// Next scheduled check-in, if any (drives the countdown text).
        public var nextCheckInAt: Date?
        /// When the current level started (for elapsed / countdown timers).
        public var levelStartedAt: Date
        /// Deadline for the current step (check-in answer window or alert->dispatch timer).
        public var deadline: Date?

        public init(level: Int, statusText: String, nextCheckInAt: Date? = nil,
                    levelStartedAt: Date = .now, deadline: Date? = nil) {
            self.level = level
            self.statusText = statusText
            self.nextCheckInAt = nextCheckInAt
            self.levelStartedAt = levelStartedAt
            self.deadline = deadline
        }
    }

    /// `GuardMode.rawValue` (API spelling: everyday, walk, night_out, date, ride).
    public var modeRawValue: String
    public var modeDisplayName: String
    public var startedAt: Date

    public init(modeRawValue: String, modeDisplayName: String, startedAt: Date) {
        self.modeRawValue = modeRawValue
        self.modeDisplayName = modeDisplayName
        self.startedAt = startedAt
    }
}

#if canImport(ActivityKit)
extension GuardActivityAttributes: ActivityAttributes {}
#endif
