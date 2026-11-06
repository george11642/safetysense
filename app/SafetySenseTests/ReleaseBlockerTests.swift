import AVFoundation
import Foundation
import Testing
@testable import SafetySense

private let timedOut = BackendError.transport("timed out")

@MainActor
private func waitUntil(_ condition: @MainActor () async -> Bool) async {
    for _ in 0..<400 {
        if await condition() { return }
        try? await Task.sleep(for: .milliseconds(5))
    }
}

@MainActor
private func makeModel(_ backend: EngineFakeBackend, store: SettingsStore = .ephemeral(),
                       heartbeat: (any HeartbeatServiceProtocol)? = nil,
                       clock: ManualEngineClock = ManualEngineClock(now: .now)) -> AppModel {
    let vault = MockEvidenceVault()
    let engine = GuardEngine.makeSimulated(backend: backend, vault: vault, device: MockDeviceStatus(),
                                           clock: clock)
    let services = ServiceContainer(flavor: .demo, audio: engine.audio, motion: engine.motion,
                                    location: engine.location, risk: engine.risk,
                                    secondOpinion: engine.secondOpinion, escalation: engine.escalation,
                                    backend: backend, vault: vault,
                                    liveActivity: NoopLiveActivityController(),
                                    notifications: NoopNotificationService(),
                                    heartbeat: heartbeat ?? NoopHeartbeatService(), device: MockDeviceStatus())
    let model = AppModel(services: services, store: store)
    model.sessionLinkDelays = [0.01]
    return model
}

@Suite("One session/start at a time")
@MainActor
struct SessionStartTests {
    @Test func aReturnToTheAppDuringAStartDoesntSendASecondOne() async {
        let backend = EngineFakeBackend()
        await backend.setHoldSessionStarts(true)
        let model = makeModel(backend)
        await model.onLaunch()
        let start = Task { await model.startGuard(mode: .nightOut) }
        await waitUntil { await backend.isHoldingSessionStart }
        model.retryWaitingWork()
        model.appBecameActive()
        try? await Task.sleep(for: .milliseconds(30))
        #expect(await backend.sessionStarts.count == 1)
        await backend.releaseSessionStart()
        await start.value
        await waitUntil { model.currentSession?.serverSessionID != nil }
        #expect(await backend.sessionStarts.count == 1)
        #expect(model.currentSession?.serverSessionID == "session-1")
    }

    @Test func aSessionTheServerEndedLinksAgainInsteadOfGoingQuiet() async throws {
        let backend = EngineFakeBackend()
        let heartbeat = HeartbeatScheduler(backend: backend)
        let model = makeModel(backend, heartbeat: heartbeat)
        await model.startGuard(mode: .nightOut)
        await waitUntil { await !backend.heartbeats.isEmpty }
        #expect(model.currentSession?.serverSessionID == "session-1")

        await backend.setEndedSessions(["session-1"])
        heartbeat.beatNow()
        await waitUntil { model.currentSession?.serverSessionID == "session-2" }
        #expect(model.currentSession?.serverSessionID == "session-2")
        await waitUntil { await backend.heartbeats.last?.sessionId == "session-2" }
        #expect(heartbeat.isRunning)
        #expect(await backend.heartbeats.last?.sessionId == "session-2")
        heartbeat.stop()
    }

    // MARK: An answer that never came

    @Test func anUnansweredStartIsClosedWhenTheSessionEnds() async {
        let backend = EngineFakeBackend()
        await backend.setSessionStartError(timedOut, count: 1)
        let model = makeModel(backend)
        model.sessionLinkDelays = [60]
        await model.startGuard(mode: .nightOut)
        #expect(model.store.sessionStartMayHaveLanded)
        await model.endGuard()
        await waitUntil { !model.store.sessionStartMayHaveLanded }
        let starts = await backend.sessionStarts
        #expect(starts.count == 2)
        #expect(starts.last?.graceS == SessionStartWire.maximumHeartbeatGrace)
        #expect(await backend.sessionEnds.map(\.sessionId) == ["session-1"])
    }

    @Test func aStartThatNeverLeftThePhoneNeedsNoClosing() async {
        let backend = EngineFakeBackend()
        await backend.setSessionStartFailures(100)
        let model = makeModel(backend)
        model.sessionLinkDelays = [60]
        await model.startGuard(mode: .nightOut)
        await model.endGuard()
        try? await Task.sleep(for: .milliseconds(40))
        #expect(!model.store.sessionStartMayHaveLanded)
        #expect(await backend.sessionStarts.count == 1)
        #expect(await backend.sessionEnds.isEmpty)
    }

    @Test func aRetryThatNeverLeftThePhoneRemembersTheOneThatMightHaveLanded() async {
        let backend = EngineFakeBackend()
        await backend.setSessionStartError(timedOut, count: 1)
        let model = makeModel(backend)
        await model.startGuard(mode: .nightOut)
        await backend.setSessionStartFailures(100)
        model.retryWaitingWork()
        await waitUntil { (await backend.sessionStarts.count) >= 2 }
        #expect(model.store.sessionStartMayHaveLanded)
        await backend.setSessionStartFailures(0)
        await model.endGuard()
        await waitUntil { !model.store.sessionStartMayHaveLanded }
        #expect(await backend.sessionEnds.count == 1)
    }

    @Test func aClosedStartKeepsTryingAndSurvivesARelaunch() async {
        let store = SettingsStore.ephemeral()
        store.sessionStartMayHaveLanded = true
        let backend = EngineFakeBackend()
        await backend.setSessionStartError(timedOut, count: 2)
        let model = makeModel(backend, store: store)
        await model.onLaunch()
        await waitUntil { !store.sessionStartMayHaveLanded }
        #expect(await backend.sessionStarts.count == 3)
        #expect(await backend.sessionEnds.map(\.sessionId) == ["session-1"])
    }

    @Test func closingNeverRunsOverANewSession() async {
        let store = SettingsStore.ephemeral()
        store.sessionStartMayHaveLanded = true
        let backend = EngineFakeBackend()
        let model = makeModel(backend, store: store)
        await model.startGuard(mode: .nightOut)
        model.retryWaitingWork()
        await waitUntil { !store.sessionStartMayHaveLanded }
        try? await Task.sleep(for: .milliseconds(30))
        #expect(await backend.sessionStarts.count == 1)
        #expect(await backend.sessionEnds.isEmpty)
        #expect(model.currentSession?.serverSessionID == "session-1")
    }

    @Test func aDeviceTheServerForgotHasNothingToClose() async {
        let store = SettingsStore.ephemeral()
        store.sessionStartMayHaveLanded = true
        let backend = EngineFakeBackend()
        await backend.setSessionStartError(.http(status: 401, message: "unauthorized"), count: 1)
        let model = makeModel(backend, store: store)
        model.retryWaitingWork()
        await waitUntil { !store.sessionStartMayHaveLanded }
        #expect(!store.sessionStartMayHaveLanded)
        #expect(await backend.sessionEnds.isEmpty)
    }
}

@Suite("A cancel must reach an alert that may have landed")
@MainActor
struct MayHaveLandedTests {
    /// P2: the process dies with the first `alert/create` still on its way, after a valid PIN.
    @Test func aPINDuringTheFirstCreateSurvivesTheProcessDying() async throws {
        let store = PendingAlertStore.memory
        let first = LadderHarness(pendingAlerts: store)
        await first.backend.setHoldCreates(true)
        first.controller.triggerManual(.manualSOS, reason: "SOS")
        while await first.backend.heldCount == 0 { await Task.yield() }
        await first.controller.cancel(with: .valid)
        // Nothing else runs on this controller: the process is gone.
        let saved = try #require(store.load(now: first.clock.now).first)
        #expect(saved.mayHaveLanded)

        let second = LadderHarness(pendingAlerts: store)
        second.controller.restorePendingAlerts()
        await second.controller.settle()
        #expect(await second.backend.creates.isEmpty)
        #expect(await second.backend.cancels.map(\.alertId) == [saved.record.id.uuidString.lowercased()])
        await first.backend.releaseCreates()
    }

    /// A cold-start SOS runs before `restorePendingAlerts`, and must not write over a hidden
    /// duress alert the killed process left behind.
    @Test func aColdStartSOSKeepsAHiddenDuressAlertFromTheKilledProcess() async throws {
        let pending = PendingAlertStore.memory, records = DuressRecordStore.memory
        let first = LadderHarness(pendingAlerts: pending, duressRecords: records)
        await first.backend.setFailCreates(true)
        first.controller.startHiddenDuressAlert(reason: "Duress PIN entered")
        await first.controller.settle()
        let hidden = try #require(pending.load(now: first.clock.now).first { $0.hidden })

        let second = LadderHarness(pendingAlerts: pending, duressRecords: records)
        second.controller.triggerManual(.manualSOS, reason: "SOS")   // Before anything is restored.
        #expect(pending.load(now: second.clock.now).contains { $0.record.id == hidden.record.id && $0.cancel == true })

        second.controller.restorePendingAlerts()
        await second.controller.settle()
        #expect(second.controller.duressAlertID == hidden.record.id)
        #expect(await second.backend.creates.contains { $0.clientAlertId == hidden.record.id.uuidString.lowercased() })
        #expect(await second.backend.cancels.contains { $0.duress == true })
    }

    /// The same path, with a valid cancel still owed to an alert that may have landed.
    @Test func aColdStartSOSKeepsACancelStillOwed() async throws {
        let store = PendingAlertStore.memory
        let first = LadderHarness(pendingAlerts: store)
        await first.backend.setHoldCreates(true)
        first.controller.triggerManual(.manualSOS, reason: "SOS")
        while await first.backend.heldCount == 0 { await Task.yield() }
        await first.controller.cancel(with: .valid)
        let owed = try #require(store.load(now: first.clock.now).first)

        let second = LadderHarness(pendingAlerts: store)
        second.controller.triggerManual(.manualSOS, reason: "SOS")
        await second.controller.settle()
        #expect(store.load(now: second.clock.now).contains { $0.record.id == owed.record.id && $0.cancel == false })

        second.controller.restorePendingAlerts()
        await second.controller.settle()
        #expect(await second.backend.cancels.map(\.alertId).contains(owed.record.id.uuidString.lowercased()))
        await first.backend.releaseCreates()
    }

    /// What this run finished can't come back from an older saved copy, and restoring twice (at
    /// launch, then after the first unlock) sends nothing twice.
    @Test func restoringAgainRepeatsNothing() async throws {
        let store = PendingAlertStore.memory
        let first = LadderHarness(pendingAlerts: store)
        await first.backend.setFailCreates(true)
        first.controller.triggerManual(.manualSOS, reason: "SOS")
        await first.controller.settle()
        #expect(store.load(now: first.clock.now).count == 1)

        let second = LadderHarness(pendingAlerts: store)
        second.controller.restorePendingAlerts()
        await second.controller.settle()
        #expect(store.load(now: second.clock.now).isEmpty)
        let sent = await second.backend.creates.count

        second.controller.restorePendingAlerts()
        await second.controller.settle()
        #expect(await second.backend.creates.count == sent)
    }

    /// P3: an attempt timed out after the PIN, the cancel failed, and the app was killed.
    @Test func aTimedOutAttemptAndAFailedCancelSurviveARelaunch() async throws {
        let store = PendingAlertStore.memory
        let first = LadderHarness(pendingAlerts: store)
        await first.backend.setHoldCreates(true)
        await first.backend.setCreateError(timedOut)
        await first.backend.setFailCancels(true)
        first.controller.triggerManual(.manualSOS, reason: "SOS")
        while await first.backend.heldCount == 0 { await Task.yield() }
        await first.controller.cancel(with: .valid)
        await first.backend.releaseCreates()
        await first.controller.settle()
        let saved = try #require(store.load(now: first.clock.now).first)
        #expect(saved.mayHaveLanded)
        #expect(saved.cancel == false)

        let second = LadderHarness(pendingAlerts: store)
        second.controller.restorePendingAlerts()
        await second.controller.settle()
        #expect(await second.backend.cancels.count == 1)
        #expect(store.load(now: second.clock.now).isEmpty)
    }

    @Test func aRequestThatNeverLeftThePhoneStillDropsCleanly() async {
        let h = LadderHarness()
        await h.backend.setFailCreates(true)
        h.controller.triggerManual(.manualSOS, reason: "SOS")
        await h.controller.settle()
        await h.controller.cancel(with: .valid)
        await h.controller.settle()
        #expect(await h.backend.cancels.isEmpty)
    }

    @Test func anOfflineRetryDoesntForgetAnAttemptThatMayHaveLanded() async {
        let store = PendingAlertStore.memory
        let h = LadderHarness(pendingAlerts: store)
        await h.backend.setCreateError(timedOut)
        h.controller.triggerManual(.manualSOS, reason: "SOS")
        await h.controller.settle()
        await h.backend.setCreateError(nil)
        await h.backend.setFailCreates(true)
        h.controller.retryServerWork()
        await h.controller.settle()
        #expect(store.load(now: h.clock.now).first?.mayHaveLanded == true)
        await h.controller.cancel(with: .valid)
        await h.controller.settle()
        #expect(await h.backend.cancels.count == 1)
    }
}

@Suite("Cold start")
@MainActor
struct ColdStartTests {
    private func storeWithSession(serverID: String? = "session-9") -> SettingsStore {
        let store = SettingsStore.ephemeral()
        var session = GuardSession(serverSessionID: serverID, mode: .nightOut, checkInInterval: 1200)
        session.nextCheckInAt = .now.addingTimeInterval(600)
        store.currentSession = session
        return store
    }

    @Test func anSOSBeforeLaunchFinishesKeepsTheSessionsMode() async throws {
        let backend = EngineFakeBackend()
        let model = makeModel(backend, store: storeWithSession())
        model.triggerSOS()   // The Action Button, before `onLaunch` has run.
        let alert = try #require(model.services.escalation.activeAlert)
        #expect(alert.contactReason?.contains("Night Out") == true)
        #expect(alert.sessionID == "session-9")
    }

    @Test func theSessionComesBackAroundAnAlertAlreadyRunning() async throws {
        let backend = EngineFakeBackend()
        let heartbeat = RecordingHeartbeat()
        let model = makeModel(backend, store: storeWithSession(), heartbeat: heartbeat)
        model.triggerSOS()
        let level = model.escalationLevel
        await model.onLaunch()
        #expect(model.escalationLevel == level)
        #expect(model.services.escalation.activeAlert != nil)
        #expect(heartbeat.started == ["session-9"])
        #expect(model.services.audio.isRunning)
    }

    @Test func whenTheServerClosesThatAlertCheckInsAreStillRunning() async throws {
        let backend = EngineFakeBackend()
        let clock = ManualEngineClock(now: .now)
        let model = makeModel(backend, store: storeWithSession(), clock: clock)
        let controller = try #require(model.services.escalation as? EscalationController)
        model.settings.dispatchPolicies.manualSOS = .contactsFirst
        model.triggerSOS()
        await model.onLaunch()
        await controller.settle()
        await backend.setStatus(AlertStatusResponse(status: "cancelled", level: 2, dispatch: nil, events: []))
        clock.advance(by: controller.timing.statusPollInterval)
        await controller.settle()
        #expect(controller.level == .guarding)
        #expect(controller.nextCheckInAt != nil)
    }
}

@Suite("Duress and session/end")
@MainActor
struct DuressSessionEndTests {
    private func model(_ backend: EngineFakeBackend) async -> AppModel {
        let model = makeModel(backend)
        model.store.setSafetyPIN("1111")
        model.store.setDuressPIN("2222")
        await model.startGuard(mode: .nightOut)
        return model
    }

    @Test func aDuressPINHoldsSessionEndUntilTheCancelLands() async throws {
        let backend = EngineFakeBackend()
        let model = await self.model(backend)
        let controller = try #require(model.services.escalation as? EscalationController)
        model.settings.dispatchPolicies.manualSOS = .contactsFirst
        model.triggerSOS()
        await controller.settle()
        await backend.setFailCancels(true)
        await model.cancelAlert(pin: "2222")
        await controller.settle()
        try? await Task.sleep(for: .milliseconds(30))
        #expect(await !backend.cancels.isEmpty)
        #expect(await backend.sessionEnds.isEmpty)
    }

    @Test func sessionEndFollowsADuressCancelThatLanded() async throws {
        let backend = EngineFakeBackend()
        let model = await self.model(backend)
        let controller = try #require(model.services.escalation as? EscalationController)
        model.settings.dispatchPolicies.manualSOS = .contactsFirst
        model.triggerSOS()
        await controller.settle()
        await model.cancelAlert(pin: "2222")
        await waitUntil { await !backend.sessionEnds.isEmpty }
        await controller.settle()
        #expect(await backend.cancels.last?.duress == true)
        #expect(await backend.sessionEnds.map(\.sessionId) == ["session-1"])
    }

    @Test func aValidPINStillEndsTheSessionRightAway() async throws {
        let backend = EngineFakeBackend()
        let model = await self.model(backend)
        let controller = try #require(model.services.escalation as? EscalationController)
        model.settings.dispatchPolicies.manualSOS = .contactsFirst
        model.triggerSOS()
        await controller.settle()
        await backend.setFailCancels(true)
        await model.cancelAlert(pin: "1111")
        await waitUntil { await !backend.sessionEnds.isEmpty }
        #expect(await backend.sessionEnds.map(\.sessionId) == ["session-1"])
    }

    @Test func endingUnderDuressFollowsTheHiddenAlertsCancel() async throws {
        let backend = EngineFakeBackend()
        let model = await self.model(backend)
        let controller = try #require(model.services.escalation as? EscalationController)
        await backend.setHoldCreates(true)
        await model.endGuardUnderDuress()
        try? await Task.sleep(for: .milliseconds(20))
        #expect(await backend.sessionEnds.isEmpty)
        await backend.releaseCreates()
        await waitUntil { await !backend.sessionEnds.isEmpty }
        await controller.settle()
        #expect(await backend.cancels.last?.duress == true)
        #expect(await backend.sessionEnds.map(\.sessionId) == ["session-1"])
    }
}

@Suite("Vault playback")
@MainActor
struct VaultPlaybackTests {
    private final class StubVault: EvidenceVaultProtocol {
        var clips: [EvidenceClip] = []
        var isCapturing = false
        var isRecordingEvidence = false
        var isUnlocked = true
        var audio: Data
        var lockDuringDecrypt = false
        init(audio: Data) { self.audio = audio }
        func startCapture(alertID: UUID, serverAlertID: String?, prebuffer: Data?) async throws {}
        func stopCapture() {}
        func unlock(reason: String) async -> Bool { true }
        func lock() { isUnlocked = false }
        func decrypt(_ clip: EvidenceClip) async throws -> Data {
            if lockDuringDecrypt { lock() }
            guard isUnlocked else { throw SecureEvidenceVault.VaultError.locked }
            return audio
        }
        func delete(_ clip: EvidenceClip) throws {}
        func deleteAll() throws {}
    }

    private let clip = EvidenceClip(alertID: UUID(), seq: 0, startedAt: .now, duration: 1, sha256: "x", fileName: "x", byteCount: 1)
    private var second: Data { WAV.encode(samples: [Int16](repeating: 500, count: 16_000), sampleRate: 16_000) }

    private func hasPlaintextOnDisk(_ audio: Data) -> Bool {
        let manager = FileManager.default
        guard let walker = manager.enumerator(at: manager.temporaryDirectory, includingPropertiesForKeys: nil) else { return false }
        for case let url as URL in walker where (try? Data(contentsOf: url)) == audio { return true }
        return false
    }

    @Test func aClipPlaysFromMemoryAndStops() async throws {
        let audio = second
        let player = ClipPlayer()
        try await player.toggle(clip, vault: StubVault(audio: audio))
        #expect(player.isPlaying(clip))
        #expect(player.playback(of: clip) != nil)
        #expect(!hasPlaintextOnDisk(audio))
        try await player.toggle(clip, vault: StubVault(audio: audio))
        #expect(!player.isPlaying(clip))
    }

    @Test func itFinishesByItself() async throws {
        let player = ClipPlayer()
        let short = WAV.encode(samples: [Int16](repeating: 500, count: 1_600), sampleRate: 16_000)
        try await player.toggle(clip, vault: StubVault(audio: short))
        await waitUntil { !player.isPlaying(clip) }
        #expect(player.playingID == nil)
    }

    @Test func aVaultThatLockedWhileOpeningPlaysNothing() async throws {
        let vault = StubVault(audio: second)
        vault.isUnlocked = false
        let player = ClipPlayer()
        await #expect(throws: (any Error).self) { try await player.toggle(clip, vault: vault) }
        #expect(player.playingID == nil)
    }

    @Test func audioThatCantPlaySaysSo() async {
        let player = ClipPlayer()
        await #expect(throws: ClipPlayer.PlayError.self) { try await player.toggle(clip, vault: StubVault(audio: Data())) }
        await #expect(throws: ClipPlayer.PlayError.self) { try await player.toggle(clip, vault: StubVault(audio: Data("not audio".utf8))) }
        #expect(player.loadingID == nil)
    }

    @Test func stoppingLeavesNothingHeld() async throws {
        let player = ClipPlayer()
        try await player.toggle(clip, vault: StubVault(audio: second))
        player.stop()
        #expect(player.playingID == nil && player.playback == nil)
    }
}

@Suite("Words that promise help")
struct DeliveryCopyTests {
    @Test func noTestBuildPromisesAnythingAWordsWorth() {
        for delivery in [AlertDelivery.test, .demo] {
            let lines = [delivery.helpPromiseTitle, delivery.aboutYouSubtitle, delivery.missingPhoneNotice,
                         delivery.profileFooter, delivery.locationReason, delivery.locationWhileUsingSetupNote,
                         delivery.locationWhileUsingNote, delivery.contactsQuestion,
                         delivery.contactsStepSubtitle(max: 5), delivery.connectingToDispatch]
            for line in lines {
                #expect(!line.contains("help can find you"))
                #expect(!line.contains("Help comes"))
                #expect(!line.contains("Who should we call"))
                #expect(!line.contains("Connecting to dispatch"))
                #expect(!line.contains("isn't a surprise"))
            }
            #expect(delivery.startedLabel(reachedServer: true) == "Started")
            #expect(delivery.notifiedHeading(reachedServer: true) != "Notified")
        }
    }

    @Test func aRealBuildSaysSentOnlyOnceTheServerAnswered() {
        #expect(AlertDelivery.real.startedLabel(reachedServer: true) == "Sent")
        #expect(AlertDelivery.real.startedLabel(reachedServer: false) == "Started")
        #expect(AlertDelivery.real.notifiedHeading(reachedServer: true) == "Notified")
        #expect(AlertDelivery.real.notifiedHeading(reachedServer: false) != "Notified")
    }

    @Test func theRealPromiseDoesntGuaranteeARescue() {
        #expect(!AlertDelivery.real.helpPromiseTitle.contains("Help comes"))
    }

    @MainActor @Test func theMicrophoneReasonCoversAlerts() {
        let reason = PermissionsStepView.Permission.microphone.reason(.real)
        #expect(reason.contains("Any alert also turns it on"))
        #expect(!reason.hasPrefix("Only"))
    }
}

@MainActor
final class RecordingHeartbeat: HeartbeatServiceProtocol {
    private(set) var started: [String] = []
    private(set) var isRunning = false
    var lastSentAt: Date? { nil }
    var isFailing: Bool { false }
    func start(serverSessionID: String, interval: TimeInterval) {
        started.append(serverSessionID)
        isRunning = true
    }
    func stop() { isRunning = false }
}
