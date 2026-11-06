import Foundation

// SPEC 7.7 Fake call: a believable incoming call that gives you a reason to leave without
// saying why. Nothing here touches the network, contacts or the escalation ladder.

/// When the call rings. The presets match the setup screen and the App Intent.
enum FakeCallDelay: Double, CaseIterable, Identifiable, Codable, Sendable {
    case now = 0
    case tenSeconds = 10
    case thirtySeconds = 30
    case oneMinute = 60

    var id: Double { rawValue }
    var seconds: TimeInterval { rawValue }

    var label: String {
        switch self {
        case .now: "Now"
        case .tenSeconds: "10 s"
        case .thirtySeconds: "30 s"
        case .oneMinute: "1 min"
        }
    }

    var spokenLabel: String {
        switch self {
        case .now: "right away"
        case .tenSeconds: "in 10 seconds"
        case .thirtySeconds: "in 30 seconds"
        case .oneMinute: "in 1 minute"
        }
    }

    /// The closest preset to an arbitrary number of seconds (App Intent / shared command input).
    static func nearest(to seconds: TimeInterval) -> FakeCallDelay {
        allCases.min { abs($0.seconds - seconds) < abs($1.seconds - seconds) } ?? .tenSeconds
    }
}

/// What the "caller" says once you answer. Spoken on the phone with AVSpeechSynthesizer, with
/// pauses so your side of the conversation sounds natural to anyone nearby.
enum FakeCallScript: String, CaseIterable, Identifiable, Codable, Sendable {
    case comeHome
    case outsideNow
    case lockedOut
    case silent

    var id: String { rawValue }

    var title: String {
        switch self {
        case .comeHome: "I need you home"
        case .outsideNow: "I'm outside"
        case .lockedOut: "Locked out"
        case .silent: "No voice"
        }
    }

    var summary: String {
        switch self {
        case .comeHome: "\"Hey, I need you to come home now.\""
        case .outsideNow: "\"I'm parked out front, come out now.\""
        case .lockedOut: "\"I'm locked out, can you come let me in?\""
        case .silent: "The call stays quiet. You do the talking."
        }
    }

    /// Lines spoken one after another. The pause after each leaves room for you to "answer".
    var lines: [(text: String, pauseAfter: TimeInterval)] {
        switch self {
        case .comeHome:
            [("Hey, it's me. Where are you right now?", 3.5),
             ("Okay. I need you to come home now. Something came up and I need your help.", 4),
             ("No, it can't wait. Can you leave now?", 4),
             ("Okay, good. I'll stay on the phone with you until you're on your way.", 6)]
        case .outsideNow:
            [("Hey! I'm outside. Are you ready?", 3.5),
             ("I'm parked right out front. Come out now, I can't stay here long.", 4),
             ("Yeah, the same car. Just come out, I'll wait.", 4),
             ("Okay, I can see the door. I'll stay on till you're in the car.", 6)]
        case .lockedOut:
            [("Hi, sorry. Are you busy?", 3.5),
             ("I'm locked out and my phone's about to die. Can you come let me in? Like, right now?", 4),
             ("I know, I'm sorry. I'm just standing outside.", 4),
             ("Thank you. I'll stay on the line until you get here.", 6)]
        case .silent:
            []
        }
    }
}

/// How the incoming screen asks you to answer. Phones show buttons when unlocked and a slider
/// when locked, so both are offered.
enum FakeCallAnswerStyle: String, CaseIterable, Identifiable, Codable, Sendable {
    case buttons
    case slide

    var id: String { rawValue }
    var title: String { self == .buttons ? "Buttons" : "Slide to answer" }
}

struct FakeCallConfig: Codable, Sendable, Equatable {
    static let defaultCallerName = "Mom"

    var callerName: String = FakeCallConfig.defaultCallerName
    var delay: TimeInterval = FakeCallDelay.tenSeconds.seconds
    var script: FakeCallScript = .comeHome
    var answerStyle: FakeCallAnswerStyle = .buttons
    /// Start a Walk Home guard when you answer, so someone's watching while you leave.
    var alsoStartWalkGuard = false

    /// A blank name falls back to "Mom"; very long names are trimmed to what fits on screen.
    var displayName: String {
        let trimmed = callerName.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? Self.defaultCallerName : String(trimmed.prefix(28))
    }

    var initials: String {
        let parts = displayName.split(separator: " ").prefix(2)
        let letters = parts.compactMap(\.first).map(String.init).joined()
        return letters.isEmpty ? "?" : letters.uppercased()
    }
}

enum FakeCallPhase: Equatable, Sendable {
    case idle
    case scheduled(fireAt: Date)
    case ringing(since: Date)
    case inCall(answeredAt: Date)

    /// True while the full-screen call UI should be on screen.
    var isPresenting: Bool {
        switch self {
        case .ringing, .inCall: true
        case .idle, .scheduled: false
        }
    }

    var fireAt: Date? {
        if case .scheduled(let date) = self { return date }
        return nil
    }
}

/// The last choices on the setup screen, so a repeat call is one tap.
enum FakeCallPreferences {
    static let key = "ss.fakeCall.lastConfig"

    static func load(from defaults: UserDefaults = .standard) -> FakeCallConfig {
        guard let data = defaults.data(forKey: key),
              let config = try? JSONDecoder().decode(FakeCallConfig.self, from: data) else { return FakeCallConfig() }
        return config
    }

    static func save(_ config: FakeCallConfig, to defaults: UserDefaults = .standard) {
        if let data = try? JSONEncoder().encode(config) { defaults.set(data, forKey: key) }
    }

    static func clear(from defaults: UserDefaults = .standard) {
        defaults.removeObject(forKey: key)
    }
}
