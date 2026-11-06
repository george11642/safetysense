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
    /// Where a Walk Home is headed (Ride keeps its own in `ride`).
    var destinationName: String?
    var destinationLatitude: Double?
    var destinationLongitude: Double?
    /// Walk Home: who was asked to follow along.
    var followerID: UUID?
    var followerName: String?
    /// The heads-up text really went out, so "following along" is true.
    var followerNotified: Bool?

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
        self.nextCheckInAt = self.checkInInterval > 0 ? nextCheckIn(after: startedAt, arrival: nil) : nil
    }

    /// The next check-in after `now`. Walk and Ride keep their arrival time while it's ahead.
    /// A date's expected end is one more check inside the normal rhythm, not a replacement for it.
    func nextCheckIn(after now: Date, arrival: Date?) -> Date {
        if let arrival, arrival > now { return arrival }
        let next = now.addingTimeInterval(checkInInterval)
        if let end = sealedDate?.expectedEnd, end > now, end < next { return end }
        return next
    }

    /// Walk and Ride check at the time you should have arrived, not on a repeating schedule.
    var usesArrivalCheck: Bool { mode == .walk || mode == .ride }

    /// Destination as a fix for route / arrival checks (nil when none was picked).
    var destinationFix: LocationFix? {
        if let lat = destinationLatitude, let lng = destinationLongitude {
            return LocationFix(latitude: lat, longitude: lng, accuracy: 50)
        }
        return ride?.destinationFix
    }

    /// `sealed_details` string for `session/start`.
    var sealedDetailsString: String? {
        sealedDate?.sealedSummary ?? ride?.sealedSummary
    }
}
