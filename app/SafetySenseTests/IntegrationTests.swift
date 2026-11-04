import Foundation
import Testing
@testable import SafetySense

/// End-to-end checks of the coordinator wiring: AppModel + real RiskEngine + real
/// EscalationController on a manual clock, against a fake backend (never the network).
@MainActor
@Suite("Integration")
struct IntegrationTests {
    @MainActor
    struct Rig {
        let clock = ManualEngineClock(now: .now)
        let backend = EngineFakeBackend()
        let services: ServiceContainer
        let model: AppModel
        let escalation: EscalationController
        let store: SettingsStore

        init(store: SettingsStore? = nil) {
            let store = store ?? SettingsStore.ephemeral()
            let engine = GuardEngine.makeSimulated(backend: backend, vault: MockEvidenceVault(),
                                                   device: MockDeviceStatus(), clock: clock)
            services = ServiceContainer(flavor: .demo, audio: engine.audio, motion: engine.motion,
                                        location: engine.location, risk: engine.risk,
                                        secondOpinion: engine.secondOpinion, escalation: engine.escalation,
                                        backend: backend, vault: MockEvidenceVault(),
                                        liveActivity: NoopLiveActivityController(),
                                        notifications: NoopNotificationService(),
                                        heartbeat: NoopHeartbeatService(), device: MockDeviceStatus())
            escalation = engine.escalation
            self.store = store
            model = AppModel(services: services, store: store)
        }
    }

    @Test func nightOutJourneyFromGuardToDispatchToSafe() async throws {
        let store = SettingsStore.ephemeral()
        store.setSafetyPIN("2580")
        let rig = Rig(store: store)
        await rig.model.startGuard(mode: .nightOut)
        #expect(rig.model.currentSession?.serverSessionID == "session-1")

        let player = DemoScenarioPlayer(clock: rig.clock)
        player.attach(to: rig.services)
        player.play()

        rig.clock.advance(by: 13)
        #expect(rig.model.overlay == .checkIn)
        // No answer: the scenario's stillness (and the missed check-in) push it to Alert.
        rig.clock.advance(by: 18)
        #expect(rig.model.overlay == .alertCountdown)
        await rig.escalation.settle()
        let creates = await rig.backend.creates
        #expect(creates.count == 1)
        // The server session id reaches alert/create (AppModel hands it to the ladder).
        #expect(creates.first?.sessionId == "session-1")
        #expect(creates.first?.dispatchPolicy == DispatchPolicy.contactsFirst.rawValue)

        rig.clock.advance(by: 90)
        #expect(rig.model.overlay == .alertActive)
        await rig.escalation.settle()
        #expect(await rig.backend.escalations.count == 1)
        #expect(rig.model.currentAlert?.dispatch != nil)

        let result = await rig.model.cancelAlert(pin: "2580")
        #expect(result == .valid)
        await rig.escalation.settle()
        #expect(rig.model.overlay == .guardActive)
        #expect(await rig.backend.cancels.first?.duress == false)
        await rig.model.endGuard()
        #expect(rig.model.overlay == .none)
    }

    @Test func dateModeSealedDetailsReachSessionStart() async throws {
        let rig = Rig()
        let sealed = SealedDateDetails(matchName: "Alex", datingApp: "Hinge", venueName: "Frontier Restaurant")
        await rig.model.startGuard(mode: .date, sealedDate: sealed)
        let start = try #require(await rig.backend.sessionStarts.first)
        #expect(start.mode == "date")
        #expect(start.sealedDetails?.contains("Alex") == true)
        #expect(start.sealedDetails?.contains("Frontier Restaurant") == true)
        await rig.model.endGuard()
    }

    @Test func externalAlertIsAdoptedAndKeepsCountingDown() async throws {
        let rig = Rig()
        let external = AlertRecord(serverAlertID: "ext-1", shareURL: URL(string: "https://example.test/a/x"),
                                   level: .alert, trigger: .actionButton, reason: "SOS from Action Button",
                                   policy: .contactsFirst, status: .active, startedAt: rig.clock.now,
                                   levelChangedAt: rig.clock.now)
        rig.escalation.adopt(external)
        #expect(rig.model.overlay == .alertCountdown)
        #expect(rig.model.currentAlert?.serverAlertID == "ext-1")
        rig.clock.advance(by: 90)
        await rig.escalation.settle()
        #expect(rig.model.overlay == .alertActive)
        #expect(await rig.backend.escalations.first?.alertId == "ext-1")
        // No second alert/create for an alert the server already has.
        #expect(await rig.backend.creates.isEmpty)
    }

    @Test func startGuardCommandUsesItsMode() async throws {
        let rig = Rig()
        _ = SharedCommandQueue.drain()
        SharedCommandQueue.enqueue(SharedCommand(kind: .startGuard, source: .siri, mode: GuardMode.walk.rawValue))
        rig.model.drainSharedCommands()
        for _ in 0..<50 where rig.model.currentSession == nil { await Task.yield() }
        #expect(rig.model.currentSession?.mode == .walk)
        await rig.model.endGuard()
        _ = SharedCommandQueue.drain()
    }

    @Test func secondOpinionFollowsTheSetting() {
        let rig = Rig()
        let risk = rig.services.risk as! RiskEngine
        rig.model.settings.useSecondOpinion = false
        #expect(risk.isSecondOpinionEnabled() == false)
        rig.model.settings.useSecondOpinion = true
        #expect(risk.isSecondOpinionEnabled() == true)
    }

    @Test func demoEngineContainerUsesTheRealLadder() {
        let services = ServiceContainer.demoEngine()
        #expect(services.flavor == .demo)
        #expect(services.escalation is EscalationController)
        #expect(services.risk is RiskEngine)
        #expect(services.backend is MockBackendClient)
    }

    @Test func vaultTakesLiveAudioChunksOnlyWhileCapturing() async throws {
        let dir = FileManager.default.temporaryDirectory.appending(path: "it-\(UUID().uuidString)")
        let backend = MockBackendClient(credentials: DeviceCredentials(deviceId: "d", deviceSecret: "s"))
        let vault = SecureEvidenceVault(backend: backend, secrets: InMemorySecretStore(), directory: dir,
                                        useMicrophone: false)
        let alert = UUID()
        let chunk = WAV.encode(samples: Array(repeating: 1, count: 16_000 * 5), sampleRate: 16_000)
        vault.appendLiveAudio(chunk, alertID: alert, sequence: 0)
        #expect(vault.clips.isEmpty)
        try await vault.startCapture(alertID: alert, serverAlertID: "srv", prebuffer: nil)
        vault.appendLiveAudio(chunk, alertID: alert, sequence: 0)
        #expect(vault.clips.count == 1)
        #expect(abs((vault.clips.first?.duration ?? 0) - 5) < 0.1)
        vault.stopCapture()
        try vault.deleteAll()
    }

    @Test func eraseClearsSystemIntegrationKeys() throws {
        // Isolated suite: never touch the simulator's real App Group defaults from a test.
        let suite = "ss.tests.\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        defaults.set(Data([1]), forKey: AppGroup.Keys.externalAlert)
        defaults.set("s", forKey: AppGroup.Keys.heartbeatSessionID)
        let store = SettingsStore(defaults: defaults, secrets: InMemorySecretStore())
        store.eraseAll()
        #expect(defaults.data(forKey: AppGroup.Keys.externalAlert) == nil)
        #expect(defaults.string(forKey: AppGroup.Keys.heartbeatSessionID) == nil)
    }
}
