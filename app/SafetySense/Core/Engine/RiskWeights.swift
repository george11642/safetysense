import Foundation

/// The rule book for the risk engine (SPEC 6.2). Every number lives here so it is easy to
/// review, test and explain. Points are "risk points": 1.0 = enough for a check-in on Balanced.
enum RiskWeights {
    // MARK: Thresholds (Balanced; multiplied by `Sensitivity.thresholdMultiplier`)

    static let checkInThreshold = 1.0
    static let alertThreshold = 2.4

    // MARK: Base points per signal at full confidence

    /// Points a sensor should give a signal at confidence 1.0. Sensors scale by confidence.
    static func basePoints(for kind: RiskSignalKind) -> Double {
        switch kind {
        case .scream: 1.3
        case .shout: 0.6
        case .crying: 0.5
        case .gasp: 0.4
        case .slap: 0.9
        case .thud: 0.6
        case .glassBreaking: 0.7
        case .doorSlam: 0.3
        case .gunshot: 2.8
        case .safeWord: 10
        case .distressPhrase: 1.0
        case .impact: 0.6
        case .fall: 1.2
        case .erraticMotion: 0.3
        case .prolongedStillness: 0.8
        case .phoneDropped: 0.4
        case .leftPlannedArea: 0.6
        case .routeDeviation: 0.8
        case .unexpectedStop: 0.7
        case .unknownPlaceLateNight: 0.5
        case .vehicleSpeedOffRoute: 1.4
        case .missedCheckIn: 1.5
        case .ignoredPrompt: 0.8
        case .heartbeatLost: 10
        case .secondOpinion: 0
        }
    }

    /// Convenience for sensors: base points scaled by classifier confidence (0...1).
    static func points(for kind: RiskSignalKind, confidence: Double?) -> Double {
        let c = min(max(confidence ?? 1, 0), 1)
        return basePoints(for: kind) * c
    }

    // MARK: Decay

    /// Seconds for a signal's points to halve. Sounds fade fast; location and missed
    /// check-ins stay relevant for longer.
    static func halfLife(for kind: RiskSignalKind) -> TimeInterval {
        switch kind.source {
        case .audio: 90
        case .speech: 120
        case .motion: kind == .prolongedStillness ? 180 : 150
        case .location: 600
        case .responsiveness: 900
        case .server: 600
        case .ai: 120
        }
    }

    /// Decay factor for a signal `age` seconds old: 0.5^(age / halfLife).
    static func decay(for kind: RiskSignalKind, age: TimeInterval) -> Double {
        pow(0.5, max(0, age) / halfLife(for: kind))
    }

    // MARK: Mode weights

    /// How much a signal matters in a mode. Night Out discounts erratic movement (dancing)
    /// and door slams (bars); Ride trusts the route; Date leans on words.
    static func modeMultiplier(for kind: RiskSignalKind, in mode: GuardMode) -> Double {
        switch mode {
        case .everyday:
            return 0.7
        case .walk:
            switch kind.source {
            case .location: return 1.3
            case .motion: return 1.1
            case .audio: return 0.9
            default: return 1.0
            }
        case .nightOut:
            switch kind {
            case .erraticMotion: return 0.6
            case .doorSlam: return 0.6
            default: break
            }
            switch kind.source {
            case .speech: return 1.0
            case .location: return 0.8
            default: return 1.0
            }
        case .date:
            switch kind.source {
            case .speech: return 1.2
            default: return 1.0
            }
        case .ride:
            switch kind {
            case .impact: return 1.2
            default: break
            }
            switch kind.source {
            case .location: return 1.4
            default: return 1.0
            }
        }
    }

    // MARK: Time of day

    /// Late night (22:00 to 04:59) location and motion signs count a little more.
    static func timeMultiplier(for kind: RiskSignalKind, hour: Int) -> Double {
        guard isLateNight(hour: hour) else { return 1.0 }
        switch kind.source {
        case .location: return 1.25
        case .motion: return 1.1
        default: return 1.0
        }
    }

    static func isLateNight(hour: Int) -> Bool { hour >= 22 || hour < 5 }

    // MARK: Pattern rules (each adds fixed, explainable points)

    /// Hits that can start the "impact, then stillness" pattern.
    static let impactKinds: Set<RiskSignalKind> = [.impact, .fall, .thud, .slap, .phoneDropped]
    /// Sounds that make distress words more believable.
    static let struggleKinds: Set<RiskSignalKind> = [.scream, .slap, .thud, .impact, .crying, .gasp]

    /// An impact-type signal followed by long stillness within this window.
    static let impactThenStillWindow: TimeInterval = 180
    static let impactThenStillPoints = 0.8
    /// Distress words and a struggle sound within this many seconds of each other.
    static let wordsWithStruggleWindow: TimeInterval = 30
    static let wordsWithStrugglePoints = 0.4
    /// Two or more sensing families (hearing, motion, location, responsiveness) agreeing.
    static let corroborationPoints = 0.3
    /// Minimum live points a family needs to count toward corroboration.
    static let corroborationFloor = 0.25

    /// Sensing family used for corroboration. Sounds and words both come from the mic, so
    /// they count as one family.
    enum Family: String, Sendable { case hearing, motion, location, responsiveness, server, ai }

    static func family(of kind: RiskSignalKind) -> Family {
        switch kind.source {
        case .audio, .speech: .hearing
        case .motion: .motion
        case .location: .location
        case .responsiveness: .responsiveness
        case .server: .server
        case .ai: .ai
        }
    }
}
