import Foundation
import Observation

/// Plays a scripted sequence of guard signals so demo recordings in the simulator are
/// identical every take. It feeds the same `RiskSignalHandler` the real sensors use, so the
/// real risk engine and ladder react exactly as they would to a live mic.
@Observable
@MainActor
final class DemoScenarioPlayer {
    struct Step: Sendable, Identifiable, Equatable {
        enum Action: Sendable, Equatable {
            /// Background context only (shown in the caption, added to the transcript as a note).
            case ambient(String)
            /// Words picked up by speech recognition (go to the transcript for the second opinion).
            case transcript(String)
            /// A sensor signal.
            case signal(RiskSignalKind, weight: Double, confidence: Double?, detail: String)
        }

        var id: Int
        /// Seconds from the start of the scenario.
        var at: TimeInterval
        /// What a narrator would say; shown in the demo overlay.
        var caption: String
        var action: Action
    }

    struct Scenario: Sendable, Equatable {
        var name: String
        var mode: GuardMode
        var steps: [Step]

        var duration: TimeInterval { steps.map(\.at).max() ?? 0 }
    }

    /// Night Out: friends and music (low risk) -> a thud and "get off me" (check-in) ->
    /// the phone goes still (alert).
    static let nightOut = Scenario(name: "Night Out", mode: .nightOut, steps: [
        Step(id: 0, at: 0, caption: "Music and laughter at a party", action: .ambient("music, laughter")),
        Step(id: 1, at: 1, caption: "Friends joking around", action: .transcript("no way, stop it, that's so funny")),
        Step(id: 2, at: 2, caption: "Cheering, with laughter nearby: low risk",
             action: .signal(.shout, weight: RiskWeights.points(for: .shout, confidence: 0.62) * 0.5,
                             confidence: 0.62, detail: "Shouting (0.62), with laughter nearby")),
        Step(id: 3, at: 12, caption: "A heavy thud", action: .signal(.thud, weight: RiskWeights.points(for: .thud, confidence: 0.86),
                                                                       confidence: 0.86, detail: "Thud (0.86)")),
        Step(id: 4, at: 13, caption: "\u{201C}Get off me\u{201D}", action: .transcript("get off me")),
        Step(id: 5, at: 13, caption: "Distress words heard on the phone",
             action: .signal(.distressPhrase, weight: 1.0, confidence: nil, detail: "Heard \u{201C}get off me\u{201D}")),
        Step(id: 6, at: 31, caption: "The phone stays still after the thud",
             action: .signal(.prolongedStillness, weight: RiskWeights.basePoints(for: .prolongedStillness),
                             confidence: nil, detail: "Still for 18 s after the thud")),
    ])

    let scenario: Scenario
    /// 1 = real time; 0.5 = twice as fast.
    var timeScale: Double

    private(set) var isPlaying = false
    private(set) var completedStepIDs: [Int] = []
    private(set) var currentCaption: String?
    /// Words "heard" so far, for the second opinion.
    private(set) var transcript = ""

    @ObservationIgnored var onSignal: RiskSignalHandler?
    @ObservationIgnored var onTranscript: (@MainActor (String) -> Void)?
    @ObservationIgnored var onFinish: (@MainActor () -> Void)?

    @ObservationIgnored private let clock: any EngineClock
    @ObservationIgnored private var timers: [EngineTimer] = []

    init(scenario: Scenario = DemoScenarioPlayer.nightOut, clock: any EngineClock = SystemEngineClock(), timeScale: Double = 1) {
        self.scenario = scenario
        self.clock = clock
        self.timeScale = timeScale
    }

    var progress: Double {
        scenario.steps.isEmpty ? 1 : Double(completedStepIDs.count) / Double(scenario.steps.count)
    }

    func play() {
        stop()
        completedStepIDs = []
        transcript = ""
        currentCaption = nil
        isPlaying = true
        for step in scenario.steps {
            let timer = clock.schedule(after: step.at * timeScale) { [weak self] in self?.run(step) }
            timers.append(timer)
        }
    }

    func stop() {
        timers.forEach { $0.cancel() }
        timers.removeAll()
        isPlaying = false
    }

    private func run(_ step: Step) {
        guard isPlaying else { return }
        currentCaption = step.caption
        switch step.action {
        case .ambient:
            break
        case .transcript(let words):
            transcript = transcript.isEmpty ? words : transcript + " " + words
            onTranscript?(transcript)
        case let .signal(kind, weight, confidence, detail):
            onSignal?(RiskSignal(kind: kind, weight: weight, timestamp: clock.now, detail: detail, confidence: confidence))
        }
        completedStepIDs.append(step.id)
        if completedStepIDs.count == scenario.steps.count {
            isPlaying = false
            onFinish?()
        }
    }
}

extension DemoScenarioPlayer {
    /// Routes the scenario through the container's audio guard callback (the same path a
    /// real scream takes) and mirrors the transcript into the mock audio guard so the
    /// second opinion sees it.
    func attach(to services: ServiceContainer) {
        let audio = services.audio
        onSignal = { [weak audio] signal in audio?.onSignal?(signal) }
        onTranscript = { [weak audio] text in (audio as? MockAudioGuardService)?.transcript = text }
    }
}
