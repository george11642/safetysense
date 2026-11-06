import Foundation
import Testing
@testable import SafetySense

/// What has to keep working after a relaunch, a failed mic start, an early PIN or a forced wipe.
@Suite("Alert recovery")
@MainActor
struct AlertRecoveryTests {
    private func makeModel(_ backend: EngineFakeBackend, clock: ManualEngineClock = ManualEngineClock(now: .now),
                           vault: MockEvidenceVault = MockEvidenceVault()) -> AppModel {
        let engine = GuardEngine.makeSimulated(backend: backend, vault: vault, device: MockDeviceStatus(), clock: clock)
        let services = ServiceContainer(flavor: .demo, audio: engine.audio, motion: engine.motion,
                                        location: engine.location, risk: engine.risk,
                                        secondOpinion: engine.secondOpinion, escalation: engine.escalation,
                                        backend: backend, vault: vault,
                                        liveActivity: NoopLiveActivityController(),
                                        notifications: NoopNotificationService(),
                                        heartbeat: NoopHeartbeatService(), device: MockDeviceStatus())
        let model = AppModel(services: services, store: .ephemeral())
        model.sessionLinkDelays = [0.01]
        return model
    }

    private func controller(_ model: AppModel) -> EscalationController {
        model.services.escalation as! EscalationController   // swiftlint:disable:this force_cast
    }

    private func waitUntil(_ condition: @MainActor () async -> Bool) async {
        for _ in 0..<300 {
            if await condition() { return }
            try? await Task.sleep(for: .milliseconds(10))
        }
    }

    private func clip(_ alertID: UUID, at start: Date) -> EvidenceClip {
        EvidenceClip(alertID: alertID, seq: 0, startedAt: start, duration: 15, sha256: "", fileName: "x", byteCount: 1)
    }

    // MARK: Listening

    @Test func listeningComesBackWhenTheMicFailedToStart() async throws {
        let model = makeModel(EngineFakeBackend())
        let audio = try #require(model.services.audio as? MockAudioGuardService)
        audio.startError = CancellationError()
        await model.onLaunch()
        await model.startGuard(mode: .nightOut)
        #expect(model.listening == .paused)
        audio.startError = nil
        model.appBecameActive()
        await waitUntil { model.listening == .listening }
        #expect(model.listening == .listening)
        #expect(audio.isRunning)
    }

    @Test func aSessionThatDoesntListenNeverOpensTheMic() async throws {
        let model = makeModel(EngineFakeBackend())
        let audio = try #require(model.services.audio as? MockAudioGuardService)
        model.settings.listenDuringWalk = false
        await model.onLaunch()
        await model.startGuard(mode: .walk)
        model.appBecameActive()
        try? await Task.sleep(for: .milliseconds(30))
        #expect(!audio.isRunning)
    }

    // MARK: Duress across a relaunch

    @Test func aRelaunchResumesDuressTrackingInsideItsWindow() async throws {
        let store = DuressRecordStore.memory
        let first = LadderHarness(duressRecords: store)
        first.controller.triggerManual(.manualSOS, reason: "SOS")
        await first.controller.settle()
        let id = try #require(first.controller.activeAlert?.id)
        let serverID = try #require(first.controller.activeAlert?.serverAlertID)
        await first.controller.cancel(with: .duress)
        await first.controller.settle()

        let second = LadderHarness(duressRecords: store)
        second.controller.restorePendingAlerts()
        await second.controller.settle()
        #expect(second.controller.duressAlertID == id)
        #expect(second.controller.activeAlert == nil)
        #expect(second.evidence.committed.map(\.0) == [id])
        await second.advance(20)
        #expect(await second.backend.locations.map(\.alertId).contains(serverID))
    }

    @Test func aRelaunchAfterTheWindowResumesNothing() async throws {
        let store = DuressRecordStore.memory
        let old = DuressRecord(alertID: UUID(), hiddenFrom: .distantPast, enteredAt: Date(timeIntervalSinceNow: -31 * 60))
        store.save([old])
        let clock = ManualEngineClock(now: .now)
        let controller = EscalationController(backend: EngineFakeBackend(), clock: clock, duressRecords: store)
        controller.restorePendingAlerts()
        await controller.settle()
        #expect(controller.duressAlertID == nil)
    }

    // MARK: Evidence before the alert is live

    @Test func aPINBeforeCommitLeavesNothingAndTheNextAlertRecords() async throws {
        let dir = FileManager.default.temporaryDirectory.appending(path: "vt-\(UUID().uuidString)")
        let vault = SecureEvidenceVault(backend: EngineFakeBackend(), secrets: InMemorySecretStore(),
                                        directory: dir, useMicrophone: false)
        let audio = MockAudioGuardService()
        try await audio.start(mode: .nightOut, safeWord: nil)
        let handoff = EvidenceHandoff(audio: audio, vault: vault)
        let cancelled = UUID(), next = UUID()
        handoff.prepare(alertID: cancelled)
        handoff.stop(alertID: cancelled)
        #expect(vault.clips.isEmpty)
        #expect(!vault.isCapturing)
        handoff.prepare(alertID: next)
        await handoff.commit(alertID: next, serverAlertID: "srv", mode: .nightOut)
        #expect(vault.isCapturing)
        #expect(vault.clips.map(\.alertID) == [next])
    }

    @Test func theAlertScreenDoesntStartCaptureAheadOfTheLadder() async throws {
        let backend = EngineFakeBackend()
        let vault = MockEvidenceVault()
        let model = makeModel(backend, vault: vault)
        await backend.setHoldCreates(true)
        model.triggerSOS()
        await waitUntil { await backend.heldCount > 0 }
        let alert = try #require(model.services.escalation.activeAlert)
        await model.ensureEvidenceCapture(for: alert)
        #expect(!vault.isCapturing)
        await backend.releaseCreates()
        await controller(model).settle()
    }

    @Test func stopEndsCaptureNobodyHereStarted() async throws {
        let vault = MockEvidenceVault()
        let handoff = EvidenceHandoff(audio: MockAudioGuardService(), vault: vault)
        let id = UUID()
        try await vault.startCapture(alertID: id, serverAlertID: nil, prebuffer: nil)
        handoff.stop(alertID: id)
        #expect(!vault.isCapturing)
    }

    // MARK: A forced "Delete everything"

    @Test func theDuressPINDeletesNothingAndRaisesAHiddenAlert() async throws {
        let clock = ManualEngineClock(now: .now)
        let backend = EngineFakeBackend()
        let vault = MockEvidenceVault()
        let model = makeModel(backend, clock: clock, vault: vault)
        model.store.setSafetyPIN("1234")
        model.store.setDuressPIN("9999")
        let credentials = DeviceCredentials(deviceId: "d", deviceSecret: "s")
        model.store.deviceCredentials = credentials
        model.profile = SampleData.profile
        model.hasCompletedOnboarding = true
        let saved = clip(UUID(), at: clock.now.addingTimeInterval(-3600))
        vault.clips = [saved]
        clock.advance(by: 1)

        await model.eraseUnderDuress()
        await controller(model).settle()

        // Reads as a wipe.
        #expect(!model.hasCompletedOnboarding)
        #expect(model.profile == nil)
        #expect(!model.store.hasSafetyPIN)
        #expect(model.vaultClips.isEmpty)
        // Isn't one.
        #expect(vault.clips == [saved])
        #expect(await backend.deletions == 0)
        #expect(model.store.deviceCredentials == credentials)
        #expect(await backend.creates.first?.reason.isEmpty == false)
        #expect(await backend.cancels.map(\.duress) == [true])

        // A PIN set up afterward can't bring them back. The old one can.
        model.store.setSafetyPIN("5555")
        _ = model.checkForMoreClips(pin: "5555")
        #expect(model.vaultClips.isEmpty)
        #expect(model.checkForMoreClips(pin: "1234") == .valid)
        #expect(model.vaultClips == [saved])
    }

    // MARK: Marked safe

    @Test func aPINBeforeTheServerAnswersPromisesNothing() async {
        let backend = EngineFakeBackend()
        let model = makeModel(backend)
        model.store.setSafetyPIN("1234")
        await backend.setHoldCreates(true)
        model.triggerSOS()
        await waitUntil { await backend.heldCount > 0 }
        await model.cancelAlert(pin: "1234")
        #expect(model.markedSafe?.couldntConfirm == true)
        #expect(model.markedSafe?.wasTest == true)   // The test host is a demo build.
        #expect(model.markedSafe?.bodyText.contains("We told") == false)
        await backend.releaseCreates()
        await controller(model).settle()
    }

    @Test func aRealIntroAsksContactsNotToCallThePhone() {
        let intro = ContactMessage.intro(to: SampleData.contacts[0], from: SampleData.profile, delivery: .real)
        #expect(intro.contains("please don't call or text my phone"))
        #expect(!intro.contains("try calling me"))
    }
}
