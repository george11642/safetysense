import Foundation

/// Everything the guard sensors can report (SPEC 6.1).
enum RiskSignalKind: String, Codable, Sendable, CaseIterable {
    // Audio (SoundAnalysis)
    case scream, shout, crying, gasp, slap, thud, glassBreaking, doorSlam, gunshot
    // Words (SpeechAnalyzer)
    case safeWord, distressPhrase
    // Motion (CoreMotion)
    case impact, fall, erraticMotion, prolongedStillness, phoneDropped
    // Location (CoreLocation)
    case leftPlannedArea, routeDeviation, unexpectedStop, unknownPlaceLateNight, vehicleSpeedOffRoute
    // Responsiveness
    case missedCheckIn, ignoredPrompt
    // Server
    case heartbeatLost
    // AI second opinion (never the sole reason to escalate)
    case secondOpinion

    var displayName: String {
        switch self {
        case .scream: "Scream"
        case .shout: "Shouting"
        case .crying: "Crying"
        case .gasp: "Gasp"
        case .slap: "Slap"
        case .thud: "Thud"
        case .glassBreaking: "Glass breaking"
        case .doorSlam: "Door slam"
        case .gunshot: "Gunshot"
        case .safeWord: "Safe word"
        case .distressPhrase: "Distress phrase"
        case .impact: "Impact"
        case .fall: "Fall"
        case .erraticMotion: "Erratic movement"
        case .prolongedStillness: "Long stillness"
        case .phoneDropped: "Phone dropped"
        case .leftPlannedArea: "Left planned area"
        case .routeDeviation: "Off route"
        case .unexpectedStop: "Unexpected stop"
        case .unknownPlaceLateNight: "Unfamiliar place, late"
        case .vehicleSpeedOffRoute: "Moving fast, off route"
        case .missedCheckIn: "Missed check-in"
        case .ignoredPrompt: "No response"
        case .heartbeatLost: "Phone went dark"
        case .secondOpinion: "On-device AI"
        }
    }

    enum Source: String, Codable, Sendable { case audio, speech, motion, location, responsiveness, server, ai }

    var source: Source {
        switch self {
        case .scream, .shout, .crying, .gasp, .slap, .thud, .glassBreaking, .doorSlam, .gunshot: .audio
        case .safeWord, .distressPhrase: .speech
        case .impact, .fall, .erraticMotion, .prolongedStillness, .phoneDropped: .motion
        case .leftPlannedArea, .routeDeviation, .unexpectedStop, .unknownPlaceLateNight, .vehicleSpeedOffRoute: .location
        case .missedCheckIn, .ignoredPrompt: .responsiveness
        case .heartbeatLost: .server
        case .secondOpinion: .ai
        }
    }

    /// Signals that skip scoring and go straight to Alert.
    var isImmediateAlert: Bool { self == .safeWord || self == .heartbeatLost }
}

/// One observation from a sensor. `weight` is the points it adds before time decay.
struct RiskSignal: Codable, Sendable, Equatable, Identifiable {
    var id: UUID
    var kind: RiskSignalKind
    var weight: Double
    var timestamp: Date
    /// Human-readable explanation, e.g. "screaming (0.91 confidence)".
    var detail: String
    /// Classifier confidence 0...1 when relevant.
    var confidence: Double?

    init(id: UUID = UUID(), kind: RiskSignalKind, weight: Double, timestamp: Date = .now,
         detail: String = "", confidence: Double? = nil) {
        self.id = id
        self.kind = kind
        self.weight = weight
        self.timestamp = timestamp
        self.detail = detail
        self.confidence = confidence
    }
}
