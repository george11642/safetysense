import Foundation

/// A Guard session from Start to End (SPEC 5, 6).
struct GuardSession: Codable, Sendable, Equatable, Identifiable {
    var id: UUID
    /// `session_id` from the backend once `session/start` succeeds.
    var serverSessionID: String?
    var mode: GuardMode
    var startedAt: Date
    var checkInInterval: TimeInterval
    /// Seconds to answer a check-in before it counts as missed (default 45).
    var graceSeconds: TimeInterval
    var nextCheckInAt: Date?
    var listening: Bool
    var sealedDate: SealedDateDetails?
    var ride: RideDetails?

    init(id: UUID = UUID(), serverSessionID: String? = nil, mode: GuardMode, startedAt: Date = .now,
         checkInInterval: TimeInterval? = nil, graceSeconds: TimeInterval = 45, listening: Bool? = nil,
         sealedDate: SealedDateDetails? = nil, ride: RideDetails? = nil) {
        self.id = id
        self.serverSessionID = serverSessionID
        self.mode = mode
        self.startedAt = startedAt
        self.checkInInterval = checkInInterval ?? mode.defaultCheckInInterval
        self.graceSeconds = graceSeconds
        self.listening = listening ?? mode.listensByDefault
        self.sealedDate = sealedDate
        self.ride = ride
        self.nextCheckInAt = self.checkInInterval > 0 ? startedAt.addingTimeInterval(self.checkInInterval) : nil
    }

    /// `sealed_details` string for `session/start`.
    var sealedDetailsString: String? {
        sealedDate?.sealedSummary ?? ride?.sealedSummary
    }
}
