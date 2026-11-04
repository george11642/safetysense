import Foundation

/// Finds the safe word and distress phrases in on-device transcripts (SPEC 6.1.2).
///
/// Live transcribers re-send the same words many times while a sentence is still forming
/// ("volatile" results). The spotter counts matches per utterance and only reports a phrase
/// when its count goes up, then resets on the final result, so one "get off me" is one signal.
struct PhraseSpotter: Sendable {
    struct Phrase: Sendable, Equatable {
        var text: String
        var kind: RiskSignalKind
        var weight: Double
        var tokens: [String]
    }

    struct Match: Sendable, Equatable {
        var phrase: String
        var kind: RiskSignalKind
        var weight: Double

        /// Local-only explanation. Never logged or sent anywhere.
        var detail: String {
            kind == .safeWord ? "Safe word heard" : "Heard \u{201C}\(phrase)\u{201D}"
        }
    }

    /// Distress phrases and their points. "No" alone is common, so it counts for little.
    static let distressPhrases: [(String, Double)] = [
        ("get off me", 1.0),
        ("get away from me", 1.0),
        ("let me go", 0.95),
        ("don't touch me", 0.95),
        ("leave me alone", 0.8),
        ("i don't want to", 0.7),
        ("somebody help", 1.0),
        ("help me", 0.9),
        ("help", 0.75),
        ("stop", 0.5),
        ("no", 0.25),
    ]

    let phrases: [Phrase]
    var cooldown: TimeInterval = 4
    private var emittedInUtterance: [String: Int] = [:]
    private var lastEmitted: [String: Date] = [:]

    init(safeWord: String? = nil, cooldown: TimeInterval = 4) {
        self.cooldown = cooldown
        var list: [Phrase] = []
        if let safeWord {
            let tokens = Self.tokens(safeWord)
            if !tokens.isEmpty {
                list.append(Phrase(text: tokens.joined(separator: " "), kind: .safeWord,
                                   weight: RiskWeights.basePoints(for: .safeWord), tokens: tokens))
            }
        }
        for (text, weight) in Self.distressPhrases {
            list.append(Phrase(text: text, kind: .distressPhrase, weight: weight, tokens: Self.tokens(text)))
        }
        // Longest first so "help me" wins over "help"; the safe word wins ties.
        phrases = list.sorted { lhs, rhs in
            if lhs.tokens.count != rhs.tokens.count { return lhs.tokens.count > rhs.tokens.count }
            return lhs.kind == .safeWord && rhs.kind != .safeWord
        }
    }

    var hasSafeWord: Bool { phrases.contains { $0.kind == .safeWord } }

    /// Lowercased words with punctuation, apostrophes and accents removed.
    static func tokens(_ text: String) -> [String] {
        let folded = text.folding(options: [.caseInsensitive, .diacriticInsensitive, .widthInsensitive], locale: nil)
            .replacingOccurrences(of: "\u{2019}", with: "'")
            .replacingOccurrences(of: "'", with: "")
        return folded.components(separatedBy: CharacterSet.alphanumerics.inverted).filter { !$0.isEmpty }
    }

    /// Non-overlapping matches, longest phrase first at each position.
    func counts(in text: String) -> [String: Int] {
        let words = Self.tokens(text)
        var result: [String: Int] = [:]
        var i = 0
        while i < words.count {
            var matched = false
            for phrase in phrases where i + phrase.tokens.count <= words.count {
                if Array(words[i..<(i + phrase.tokens.count)]) == phrase.tokens {
                    result[phrase.text, default: 0] += 1
                    i += phrase.tokens.count
                    matched = true
                    break
                }
            }
            if !matched { i += 1 }
        }
        return result
    }

    /// Feed every transcript update (volatile and final) for the current utterance.
    mutating func process(_ text: String, isFinal: Bool, at now: Date) -> [Match] {
        var out: [Match] = []
        for (key, count) in counts(in: text).sorted(by: { $0.key < $1.key }) {
            let already = emittedInUtterance[key, default: 0]
            guard count > already else { continue }
            emittedInUtterance[key] = count
            if let last = lastEmitted[key], now.timeIntervalSince(last) < cooldown { continue }
            guard let phrase = phrases.first(where: { $0.text == key }) else { continue }
            lastEmitted[key] = now
            out.append(Match(phrase: key, kind: phrase.kind, weight: phrase.weight))
        }
        if isFinal { emittedInUtterance.removeAll() }
        // Safe word first, then by weight.
        return out.sorted { lhs, rhs in
            if (lhs.kind == .safeWord) != (rhs.kind == .safeWord) { return lhs.kind == .safeWord }
            return lhs.weight > rhs.weight
        }
    }
}

/// RAM-only rolling transcript for the second opinion. Old text falls away after `window`.
struct TranscriptLog: Sendable {
    private var entries: [(at: Date, text: String)] = []
    var window: TimeInterval
    var maxCharacters = 600

    init(window: TimeInterval = 90) {
        self.window = window
    }

    mutating func append(_ text: String, at now: Date) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        entries.append((now, trimmed))
        prune(now)
    }

    mutating func prune(_ now: Date) {
        entries.removeAll { now.timeIntervalSince($0.at) > window }
    }

    func text(at now: Date) -> String {
        let joined = entries.filter { now.timeIntervalSince($0.at) <= window }.map(\.text).joined(separator: " ")
        return String(joined.suffix(maxCharacters))
    }

    mutating func clear() { entries.removeAll() }
}
