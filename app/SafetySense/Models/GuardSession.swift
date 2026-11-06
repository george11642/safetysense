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
        self.checkInInterval = checkInInterval ?? mode.defaultArrivalCheck ?? mode.defaultCheckInInterval
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
    var usesArrivalCheck: Bool { mode.usesArrivalCheck }

    /// The interval sent to `session/start`. The server only accepts 15 s to 1 hour, and it uses
    /// this for bookkeeping: the phone's own clock runs check-ins of any length.
    var serverCheckInInterval: Int { Int(min(max(checkInInterval, 15), 3600)) }

    /// Destination as a fix for route / arrival checks (nil when none was picked).
    var destinationFix: LocationFix? {
        if let lat = destinationLatitude, let lng = destinationLongitude {
            return LocationFix(latitude: lat, longitude: lng, accuracy: 50)
        }
        return ride?.destinationFix
    }

    /// `sealed_details` string for `session/start`.
    var sealedDetailsString: String? {
        sealedDate?.sealedSummary ?? ride?.sealedSummary ?? walkSummary
    }

    /// A Walk Home's route for the live link: where to and by when. Nil with nothing to share.
    var walkSummary: String? {
        guard mode == .walk else { return nil }
        var lines: [String] = []
        if let destinationName, !destinationName.isEmpty { lines.append("Walking to: \(destinationName)") }
        if let nextCheckInAt { lines.append("Expected by: \(nextCheckInAt.formatted(date: .omitted, time: .shortened))") }
        if let followerName, !followerName.isEmpty { lines.append("Following along: \(followerName)") }
        return lines.isEmpty ? nil : lines.joined(separator: "\n")
    }

    /// When the check-in was missed while the app wasn't running, the next one to arm. An arrival
    /// check that passed unanswered still needs an answer, so it comes up shortly, not an interval
    /// from now. Repeating check-ins just pick the rhythm back up.
    func resumedCheckIn(now: Date, arrivalGrace: TimeInterval = 60) -> Date? {
        guard checkInInterval > 0 else { return nextCheckInAt }
        if let next = nextCheckInAt, next > now { return next }
        return now.addingTimeInterval(usesArrivalCheck ? arrivalGrace : checkInInterval)
    }

    /// The fields that identify someone or where they're going. `SettingsStore` keeps these in the
    /// Keychain, never in the defaults plist.
    struct SensitiveDetails: Codable, Sendable, Equatable {
        var sealedDate: SealedDateDetails?
        var ride: RideDetails?
        var destinationName: String?
        var destinationLatitude: Double?
        var destinationLongitude: Double?
        var followerName: String?

        var isEmpty: Bool { self == SensitiveDetails() }
    }

    var sensitiveDetails: SensitiveDetails {
        get {
            SensitiveDetails(sealedDate: sealedDate, ride: ride, destinationName: destinationName,
                             destinationLatitude: destinationLatitude, destinationLongitude: destinationLongitude,
                             followerName: followerName)
        }
        set {
            sealedDate = newValue.sealedDate
            ride = newValue.ride
            destinationName = newValue.destinationName
            destinationLatitude = newValue.destinationLatitude
            destinationLongitude = newValue.destinationLongitude
            followerName = newValue.followerName
        }
    }
}
