import Foundation

/// The guard engine's services, already wired to each other.
@MainActor
struct GuardEngineServices {
    let audio: any AudioGuardService
    let motion: any MotionGuardService
    let location: any LocationService
    let risk: RiskEngine
    let secondOpinion: any SecondOpinionProtocol
    let escalation: EscalationController
}

/// Factory for the Guard Engine module. `ServiceContainer` takes these six services as-is:
///
/// ```swift
/// let engine = GuardEngine.makeLive(backend: backend, vault: vault, device: device)
/// ServiceContainer(flavor: .live, audio: engine.audio, motion: engine.motion, location: engine.location,
///                  risk: engine.risk, secondOpinion: engine.secondOpinion, escalation: engine.escalation, ...)
/// ```
///
/// Internal wiring done here (AppModel still connects sensors -> risk -> escalation):
/// - risk engine asks the second opinion and re-feeds the result to the ladder,
/// - "I'm okay" / a cancel discounts what the risk engine has seen,
/// - alerts carry location + battery, and hand audio to the evidence vault.
@MainActor
enum GuardEngine {
    /// Real sensors, real rules, real ladder.
    static func makeLive(backend: any BackendClientProtocol, vault: any EvidenceVaultProtocol,
                         device: any DeviceStatusProviding,
                         clock: any EngineClock = SystemEngineClock()) -> GuardEngineServices {
        let audio = AudioGuard(clock: clock)
        let location = LocationGuard()
        return wire(audio: audio, motion: MotionGuard(), location: location,
                    secondOpinion: FoundationModelsSecondOpinion(),
                    transcript: { [weak audio] in audio?.recentContext() ?? "" },
                    backend: backend, vault: vault, device: device, clock: clock, haptics: SystemEngineHaptics())
    }

    /// Mock sensors (no mic, no GPS) with the real rules engine and ladder. Pair with
    /// `DemoScenarioPlayer` for deterministic simulator recordings.
    static func makeSimulated(backend: any BackendClientProtocol, vault: any EvidenceVaultProtocol,
                              device: any DeviceStatusProviding,
                              clock: any EngineClock = SystemEngineClock(),
                              secondOpinion: (any SecondOpinionProtocol)? = nil) -> GuardEngineServices {
        let audio = MockAudioGuardService()
        return wire(audio: audio, motion: MockMotionGuardService(), location: MockLocationService(),
                    secondOpinion: secondOpinion ?? MockSecondOpinion(),
                    transcript: { [weak audio] in audio?.recentTranscript() ?? "" },
                    backend: backend, vault: vault, device: device, clock: clock, haptics: SystemEngineHaptics())
    }

    static func wire(audio: any AudioGuardService, motion: any MotionGuardService, location: any LocationService,
                     secondOpinion: any SecondOpinionProtocol, transcript: @escaping @MainActor () -> String,
                     backend: any BackendClientProtocol, vault: any EvidenceVaultProtocol,
                     device: any DeviceStatusProviding, clock: any EngineClock,
                     haptics: any EngineHaptics) -> GuardEngineServices {
        let risk = RiskEngine()
        risk.now = { [weak clock] in clock?.now ?? .now }
        risk.secondOpinion = secondOpinion
        risk.transcriptProvider = transcript
        let escalation = EscalationController(
            backend: backend, clock: clock,
            context: SensorAlertContext(location: location, device: device),
            evidence: EvidenceHandoff(audio: audio, vault: vault),
            haptics: haptics)
        risk.onReassessment = { [weak escalation] assessment in escalation?.handle(assessment) }
        escalation.onUserConfirmedOkay = { [weak risk, weak clock] in
            risk?.acknowledge(at: clock?.now ?? .now)
        }
        return GuardEngineServices(audio: audio, motion: motion, location: location, risk: risk,
                                   secondOpinion: secondOpinion, escalation: escalation)
    }
}
