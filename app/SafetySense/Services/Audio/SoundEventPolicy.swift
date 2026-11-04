import Foundation

/// One label from Apple's built-in SoundAnalysis classifier (`SNClassifierIdentifier.version1`).
struct SoundClassification: Sendable, Equatable {
    var identifier: String
    var confidence: Double
}

/// Turns raw classifier output into risk signals (SPEC 6.1.1). Pure and deterministic:
/// per-label confidence thresholds, a per-kind cooldown so one scream is one signal, and a
/// "playful context" rule that halves shouting when laughter or cheering is clearly present.
struct SoundEventPolicy: Sendable {
    struct Rule: Sendable, Equatable {
        var kind: RiskSignalKind
        var threshold: Double
    }

    /// The watched labels and the confidence each needs.
    static let rules: [String: Rule] = [
        "screaming": Rule(kind: .scream, threshold: 0.70),
        "shout": Rule(kind: .shout, threshold: 0.75),
        "yell": Rule(kind: .shout, threshold: 0.75),
        "crying_sobbing": Rule(kind: .crying, threshold: 0.70),
        "gasp": Rule(kind: .gasp, threshold: 0.80),
        "slap_smack": Rule(kind: .slap, threshold: 0.75),
        "thump_thud": Rule(kind: .thud, threshold: 0.80),
        "glass_breaking": Rule(kind: .glassBreaking, threshold: 0.75),
        "door_slam": Rule(kind: .doorSlam, threshold: 0.85),
        "gunshot_gunfire": Rule(kind: .gunshot, threshold: 0.80),
    ]

    /// Background labels kept as context for the second opinion and the playful rule.
    static let ambientLabels: Set<String> = [
        "music", "laughter", "giggle", "cheering", "applause", "crowd", "chatter", "speech", "singing",
    ]
    static let playfulLabels: Set<String> = ["laughter", "giggle", "cheering", "applause"]
    static let playfulConfidence = 0.6

    /// Labels worth forwarding from the classifier (everything else is dropped on the audio thread).
    static var interestingLabels: Set<String> { Set(rules.keys).union(ambientLabels) }

    var cooldown: TimeInterval = 4
    /// Multiplier for shouting / screaming while laughter or cheering is clearly present.
    var playfulDampening: [RiskSignalKind: Double] = [.shout: 0.5, .scream: 0.75]

    private var lastEmitted: [RiskSignalKind: Date] = [:]

    init(cooldown: TimeInterval = 4) {
        self.cooldown = cooldown
    }

    mutating func signals(from classifications: [SoundClassification], at now: Date) -> [RiskSignal] {
        let playful = classifications.contains {
            Self.playfulLabels.contains($0.identifier) && $0.confidence >= Self.playfulConfidence
        }
        // Strongest label per kind.
        var best: [RiskSignalKind: SoundClassification] = [:]
        for c in classifications {
            guard let rule = Self.rules[c.identifier], c.confidence >= rule.threshold else { continue }
            if let current = best[rule.kind], current.confidence >= c.confidence { continue }
            best[rule.kind] = c
        }
        var out: [RiskSignal] = []
        for (kind, c) in best.sorted(by: { $0.key.rawValue < $1.key.rawValue }) {
            if let last = lastEmitted[kind], now.timeIntervalSince(last) < cooldown { continue }
            lastEmitted[kind] = now
            var weight = RiskWeights.points(for: kind, confidence: c.confidence)
            var detail = "\(kind.displayName) (\(String(format: "%.2f", c.confidence)))"
            if playful, let damp = playfulDampening[kind] {
                weight *= damp
                detail += ", with laughter nearby"
            }
            out.append(RiskSignal(kind: kind, weight: weight, timestamp: now, detail: detail, confidence: c.confidence))
        }
        return out
    }

    /// e.g. "music, laughter" from the labels currently above 0.5.
    static func ambientSummary(_ classifications: [SoundClassification]) -> [String] {
        classifications
            .filter { ambientLabels.contains($0.identifier) && $0.confidence >= 0.5 }
            .sorted { $0.confidence > $1.confidence }
            .map { $0.identifier.replacingOccurrences(of: "_", with: " ") }
    }
}
