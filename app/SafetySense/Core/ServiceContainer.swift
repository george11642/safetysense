import Foundation

/// Dependency injection for every service protocol. Views reach services through
/// `AppModel.services`. Swap implementations here, nowhere else.
@MainActor
final class ServiceContainer {
    enum Flavor: String, Sendable { case live, demo }

    let flavor: Flavor
    let audio: any AudioGuardService
    let motion: any MotionGuardService
    let location: any LocationService
    let risk: any RiskEngineProtocol
    let secondOpinion: any SecondOpinionProtocol
    let escalation: any EscalationControllerProtocol
    let backend: any BackendClientProtocol
    let vault: any EvidenceVaultProtocol
    let liveActivity: any LiveActivityControllerProtocol
    let notifications: any NotificationServiceProtocol
    let heartbeat: any HeartbeatServiceProtocol
    let device: any DeviceStatusProviding

    init(flavor: Flavor,
         audio: any AudioGuardService,
         motion: any MotionGuardService,
         location: any LocationService,
         risk: any RiskEngineProtocol,
         secondOpinion: any SecondOpinionProtocol,
         escalation: any EscalationControllerProtocol,
         backend: any BackendClientProtocol,
         vault: any EvidenceVaultProtocol,
         liveActivity: any LiveActivityControllerProtocol,
         notifications: any NotificationServiceProtocol,
         heartbeat: any HeartbeatServiceProtocol,
         device: any DeviceStatusProviding) {
        self.flavor = flavor
        self.audio = audio
        self.motion = motion
        self.location = location
        self.risk = risk
        self.secondOpinion = secondOpinion
        self.escalation = escalation
        self.backend = backend
        self.vault = vault
        self.liveActivity = liveActivity
        self.notifications = notifications
        self.heartbeat = heartbeat
        self.device = device
    }

    /// Everything mocked: no mic, no network, simulated dispatch. Used by `-ssDemo 1`, previews and tests.
    static func demo(sampleEvidence: Bool = true) -> ServiceContainer {
        let backend = MockBackendClient(credentials: DeviceCredentials(deviceId: "demo-device", deviceSecret: "demo"))
        let container = ServiceContainer(
            flavor: .demo,
            audio: MockAudioGuardService(),
            motion: MockMotionGuardService(),
            location: MockLocationService(),
            risk: MockRiskEngine(),
            secondOpinion: MockSecondOpinion(),
            escalation: MockEscalationController(backend: backend),
            backend: backend,
            vault: MockEvidenceVault(clips: sampleEvidence ? SampleData.evidence : []),
            liveActivity: NoopLiveActivityController(),
            notifications: NoopNotificationService(),
            heartbeat: NoopHeartbeatService(),
            device: MockDeviceStatus()
        )
        SystemBridge.install(container)                   // System Integration: Action Button / Live Activity commands reach the demo ladder
        return container
    }

    /// Real rules engine and escalation ladder with simulated sensors and the mock backend.
    /// Used by `-ssDemo 1` (and Developer Settings > "Demo mode on next launch") so a demo
    /// shows the real ladder timing without touching the network. Pair with `DemoScenarioPlayer`.
    static func demoEngine() -> ServiceContainer {
        let backend = MockBackendClient(credentials: DeviceCredentials(deviceId: "demo-device", deviceSecret: "demo"))
        let vault = MockEvidenceVault(clips: SampleData.evidence, simulatesRecording: true)
        let device = MockDeviceStatus()
        let engine = GuardEngine.makeSimulated(backend: backend, vault: vault, device: device)
        // No HeartbeatScheduler here: its background refresh talks to the live backend client
        // and its BGTask is only registered for the live flavor.
        return assemble(flavor: .demo, engine: engine, backend: backend, vault: vault, device: device,
                        liveActivity: LiveActivityController(), notifications: NotificationService(flavor: .demo),
                        heartbeat: NoopHeartbeatService())
    }

    /// Production wiring: the HTTP backend (dry-run unless "Allow real calls" is on), the
    /// encrypted evidence vault and the real guard engine.
    ///
    /// On the simulator the microphone and CoreMotion aren't usable (AVAudioEngine's input
    /// node deadlocks inside AURemoteIO), so the simulator build keeps real location, rules,
    /// ladder and backend but uses simulated audio and motion. `-ssScenario nightOut` then
    /// drives the risk engine exactly as a live mic would.
    static func live() -> ServiceContainer {
        let backend = HTTPBackendClient.shared
        // The audio guard owns the mic and streams evidence through `LiveEvidenceAudioSink`.
        let vault = SecureEvidenceVault(backend: backend, useMicrophone: false)
        let device = DeviceBatteryStatus()
        #if targetEnvironment(simulator)
        let audio = MockAudioGuardService()
        let engine = GuardEngine.wire(audio: audio, motion: MockMotionGuardService(), location: LocationGuard(),
                                      secondOpinion: FoundationModelsSecondOpinion(),
                                      transcript: { [weak audio] in audio?.recentTranscript() ?? "" },
                                      backend: backend, vault: vault, device: device,
                                      clock: SystemEngineClock(), haptics: SystemEngineHaptics(),
                                      pendingAlerts: .keychain, duressRecords: .keychain)
        #else
        let engine = GuardEngine.makeLive(backend: backend, vault: vault, device: device)
        #endif
        return assemble(flavor: .live, engine: engine, backend: backend, vault: vault, device: device,
                        liveActivity: LiveActivityController(), notifications: NotificationService(flavor: .live),
                        heartbeat: HeartbeatScheduler(backend: backend))
    }

    private static func assemble(flavor: Flavor, engine: GuardEngineServices, backend: any BackendClientProtocol,
                                 vault: any EvidenceVaultProtocol, device: any DeviceStatusProviding,
                                 liveActivity: any LiveActivityControllerProtocol,
                                 notifications: any NotificationServiceProtocol,
                                 heartbeat: any HeartbeatServiceProtocol) -> ServiceContainer {
        let container = ServiceContainer(
            flavor: flavor,
            audio: engine.audio,
            motion: engine.motion,
            location: engine.location,
            risk: engine.risk,
            secondOpinion: engine.secondOpinion,
            escalation: engine.escalation,
            backend: backend,
            vault: vault,
            liveActivity: liveActivity,
            notifications: notifications,
            heartbeat: heartbeat,
            device: device
        )
        SystemBridge.install(container)                   // intents, notifications, heartbeat wiring
        return container
    }
}
