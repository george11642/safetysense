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
        /// Short status line, e.g. "Guarding quietly" or "Maya is on the way."
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

    /// The status at Dispatch until dispatch has answered. The Live Activity's title follows it.
    public static let unconfirmedDispatchStatus = "Reaching dispatch. If you can, call 911."

    /// `GuardMode.rawValue` (API spelling: everyday, walk, night_out, date, ride).
    public var modeRawValue: String
    public var modeDisplayName: String
    public var startedAt: Date
    /// Set when this build contacts nobody. The Live Activity says so at every level.
    public var testNote: String?

    /// Walk and Ride check once at the time you should have arrived.
    public var checkInLabel: String {
        modeRawValue == "walk" || modeRawValue == "ride" ? "Arrival check" : "Next check-in"
    }

    public init(modeRawValue: String, modeDisplayName: String, startedAt: Date, testNote: String? = nil) {
        self.modeRawValue = modeRawValue
        self.modeDisplayName = modeDisplayName
        self.startedAt = startedAt
        self.testNote = testNote
    }
}

#if canImport(ActivityKit)
extension GuardActivityAttributes: ActivityAttributes {}
#endif
