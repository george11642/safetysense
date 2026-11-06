import Foundation
import Testing
@testable import SafetySense

@Suite("Duress and alert safety")
@MainActor
struct DuressAndAlertSafetyTests {
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

    // MARK: Evidence and cancels

    @Test func aValidCancelDuringDispatchLeavesEvidenceStopped() async {
        let h = LadderHarness()
        await h.backend.setHoldEscalations(true)
        h.controller.triggerManual(.manualSOS, reason: "SOS")
        await waitUntil { await h.backend.isHoldingEscalation }
        await h.controller.cancel(with: .valid)
        #expect(h.evidence.committed.isEmpty)
        #expect(h.evidence.stopped.count == 1)
        await h.backend.releaseEscalation()
        await h.controller.settle()
        #expect(h.evidence.committed.isEmpty)   // Used to restart capture and the mic here.
    }

    @Test func aDuressCancelDuringDispatchKeepsEvidenceGoing() async {
        let h = LadderHarness()
        await h.backend.setHoldEscalations(true)
        h.controller.triggerManual(.manualSOS, reason: "SOS")
        await waitUntil { await h.backend.isHoldingEscalation }
        await h.controller.cancel(with: .duress)
        await h.backend.releaseEscalation()
        await h.controller.settle()
        #expect(h.evidence.committed.count == 1)
        #expect(h.evidence.stopped.isEmpty)
    }

    @Test func aLateCommitCantRestartCaptureAndTheNextAlertStillRecords() async {
        let vault = MockEvidenceVault()
        let handoff = EvidenceHandoff(audio: MockAudioGuardService(), vault: vault)
        let cancelled = UUID(), next = UUID()
        handoff.prepare(alertID: cancelled)
        handoff.stop(alertID: cancelled)
        await handoff.commit(alertID: cancelled, serverAlertID: "a", mode: .walk)
        #expect(!vault.isCapturing)
        handoff.prepare(alertID: next)
        await handoff.commit(alertID: next, serverAlertID: "b", mode: .walk)
        #expect(vault.isCapturing)
        handoff.stop(alertID: next)
        #expect(!vault.isCapturing)
    }

    @Test func anAlertTheServerEndedTurnsOffAMicItOpened() async {
        let backend = EngineFakeBackend()
        let clock = ManualEngineClock(now: .now)
        let model = makeModel(backend, clock: clock)
        let audio = model.services.audio as? MockAudioGuardService
        model.triggerSOS(.safeWord, reason: "Safe word")
        await controller(model).settle()
        try? await audio?.start(mode: .everyday, safeWord: nil)
        await backend.setStatus(AlertStatusResponse(status: "cancelled", level: 2, dispatch: nil, events: []))
        clock.advance(by: 8)
        await controller(model).settle()
        #expect(controller(model).activeAlert == nil)
        #expect(audio?.isRunning == false)
    }

    // MARK: Duress PIN at End Guard

    @Test func aDuressEndSurvivesADeadZoneAndSetsTheServerFlag() async throws {
        let backend = EngineFakeBackend()
        let model = makeModel(backend)
        await model.startGuard(mode: .nightOut)
        await waitUntil { model.currentSession?.serverSessionID != nil }
        await backend.setFailCreates(true)

        await model.endGuardUnderDuress()
        await controller(model).settle()
        #expect(model.currentSession == nil)
        #expect(model.overlay == .none)
        #expect(controller(model).activeAlert == nil)
        #expect(controller(model).duressAlertID != nil)
        #expect((model.services.audio as? MockAudioGuardService)?.isRunning == true)   // Evidence keeps going.
        #expect(await backend.cancels.isEmpty)

        await backend.setFailCreates(false)
        model.retryWaitingWork()
        await waitUntil { await !backend.cancels.isEmpty }
        await controller(model).settle()
        let create = try #require(await backend.creates.last)
        #expect(create.level == 2)                              // Not dispatched before the flag is set.
        #expect(create.dispatchPolicy == "contacts_first")
        #expect(create.clientAlertId != nil)
        #expect(!create.reason.lowercased().contains("duress"))  // Contacts read this.
        #expect(await backend.cancels.map(\.duress) == [true])
        #expect(controller(model).activeAlert == nil)
    }

    @Test func aHeartbeatNeverShowsTheHiddenAlert() async throws {
        let h = LadderHarness()
        await h.backend.setFailCreates(true)
        h.controller.startHiddenDuressAlert(reason: "Duress")
        await h.controller.settle()
        let id = try #require(h.controller.duressAlertID)
        // The server's id is the phone's, and it hasn't told the phone yet.
        h.controller.adoptServerAlert(LiveAlertDTO(id: id.uuidString.lowercased(), level: 2, shareUrl: "https://x", status: "active"))
        #expect(h.controller.activeAlert == nil)
    }

    @Test func aDuressAlertKeepsItsRecordingOutOfTheVault() async {
        let clock = ManualEngineClock(now: .now)
        let vault = MockEvidenceVault()
        let model = makeModel(EngineFakeBackend(), clock: clock, vault: vault)
        let h = controller(model)
        func clip(_ id: UUID, at date: Date) -> EvidenceClip {
            EvidenceClip(id: UUID(), alertID: id, serverAlertID: nil, seq: 0, kind: .audio, startedAt: date, duration: 5,
                         sha256: "", fileName: "x", byteCount: 1)
        }
        h.startHiddenDuressAlert(reason: "Duress")
        await h.settle()
        let hidden = clip(h.duressAlertID!, at: clock.now), other = clip(UUID(), at: clock.now)
        #expect(h.vaultShows(other))
        #expect(!h.vaultShows(hidden))
        #expect(!model.showsRecording)
        await vault.startCaptureForTest()
        #expect(!model.showsRecording)
        clock.advance(by: 30 * 60 + 20)
        #expect(h.duressAlertID == nil)
        #expect(!h.vaultShows(hidden))            // Used to reappear when the alert stopped running.
    }

    // MARK: Duress and the Vault across relaunches

    private func clip(_ alertID: UUID, at date: Date, duration: TimeInterval = 5) -> EvidenceClip {
        EvidenceClip(id: UUID(), alertID: alertID, serverAlertID: nil, seq: 0, kind: .audio, startedAt: date,
                     duration: duration, sha256: "", fileName: "x", byteCount: 1)
    }

    private func duressCancel(_ h: LadderHarness) async -> UUID? {
        h.controller.triggerManual(.manualSOS, reason: "SOS")
        await h.controller.settle()
        let id = h.controller.activeAlert?.id
        await h.controller.cancel(with: .duress)
        await h.controller.settle()
        return id
    }

    @Test func aRelaunchKeepsClipsFromAfterTheFakeCancelHidden() async throws {
        let store = DuressRecordStore.memory
        let first = LadderHarness(duressRecords: store)
        let id = try #require(await duressCancel(first))
        let cancelledAt = first.clock.now

        let second = LadderHarness(duressRecords: store)
        #expect(second.controller.duressAlertID == nil)
        #expect(!second.controller.vaultShows(clip(id, at: cancelledAt.addingTimeInterval(1))))
        #expect(second.controller.vaultShows(clip(id, at: cancelledAt.addingTimeInterval(-60))))   // From before the PIN.
        #expect(second.controller.vaultShows(clip(UUID(), at: cancelledAt.addingTimeInterval(1))))
        await second.advance(30 * 24 * 3600)
        #expect(!second.controller.vaultShows(clip(id, at: cancelledAt.addingTimeInterval(1))))
    }

    @Test func aClipRunningOverTheCancelStaysHidden() async throws {
        let h = LadderHarness()
        let id = try #require(await duressCancel(h))
        let started = h.clock.now.addingTimeInterval(-3)
        #expect(!h.controller.vaultShows(clip(id, at: started, duration: 5)))
        #expect(h.controller.vaultShows(clip(id, at: started, duration: 2)))
    }

    @Test func aSecondDuressAlertDoesntUncoverTheFirst() async throws {
        let h = LadderHarness()
        let first = try #require(await duressCancel(h))
        let later = h.clock.now.addingTimeInterval(1)
        h.controller.startHiddenDuressAlert(reason: "Duress")
        await h.controller.settle()
        #expect(h.controller.duressAlertID == first)   // A second alert would break the recording.
        #expect(!h.controller.vaultShows(clip(first, at: later)))
    }

    @Test func aRestoredDuressAlertKeepsItsOriginalHidingTime() async throws {
        let pending = PendingAlertStore.memory, records = DuressRecordStore.memory
        let first = LadderHarness(pendingAlerts: pending, duressRecords: records)
        await first.backend.setFailCreates(true)
        let id = try #require(await duressCancel(first))
        let cancelledAt = first.clock.now

        let second = LadderHarness(pendingAlerts: pending, duressRecords: records)
        second.clock.advance(by: 600)
        await second.backend.setFailCreates(true)
        second.controller.restorePendingAlerts()
        await second.controller.settle()
        #expect(second.controller.duressAlertID == id)
        #expect(!second.controller.vaultShows(clip(id, at: cancelledAt.addingTimeInterval(60))))
    }

    @Test func aSavedRecordSurvivesAKeychainReload() async throws {
        let secrets = InMemorySecretStore()
        let h = LadderHarness(duressRecords: DuressRecordStore(secrets: secrets))
        let id = try #require(await duressCancel(h))
        #expect(DuressRecordStore(secrets: secrets).load().map(\.alertID) == [id])
    }

    @Test func aFailedKeychainWriteStillHidesClipsInThisRun() async throws {
        let h = LadderHarness(duressRecords: DuressRecordStore(secrets: FailingSecretStore()))
        let id = try #require(await duressCancel(h))
        let late = clip(id, at: h.clock.now.addingTimeInterval(1))
        await h.advance(31 * 60)
        #expect(!h.controller.vaultShows(late))
    }

    @Test func onlyTheSafetyPINBringsClipsBack() async throws {
        let clock = ManualEngineClock(now: .now)
        let vault = MockEvidenceVault()
        let model = makeModel(EngineFakeBackend(), clock: clock, vault: vault)
        model.store.setSafetyPIN("1234")
        model.store.setDuressPIN("4321")
        let h = controller(model)
        h.startHiddenDuressAlert(reason: "Duress")
        await h.settle()
        let hidden = clip(h.duressAlertID!, at: clock.now)
        vault.clips = [hidden]
        #expect(model.vaultClips.isEmpty)

        #expect(model.checkForMoreClips(pin: "0000") == .invalid)
        #expect(model.checkForMoreClips(pin: "4321") == .duress)
        #expect(model.vaultClips.isEmpty)
        #expect(model.checkForMoreClips(pin: "1234") == .valid)
        #expect(model.vaultClips == [hidden])
    }

    @Test func aForcedDeleteAllLeavesHiddenClips() async throws {
        let clock = ManualEngineClock(now: .now)
        let vault = MockEvidenceVault()
        let model = makeModel(EngineFakeBackend(), clock: clock, vault: vault)
        let h = controller(model)
        h.startHiddenDuressAlert(reason: "Duress")
        await h.settle()
        let hidden = clip(h.duressAlertID!, at: clock.now), shown = clip(UUID(), at: clock.now)
        vault.clips = [hidden, shown]
        model.deleteVaultClips()
        #expect(vault.clips == [hidden])
    }

    @Test func eraseForgetsDuressRecords() async throws {
        let store = DuressRecordStore.memory
        let h = LadderHarness(duressRecords: store)
        _ = try #require(await duressCancel(h))
        h.controller.forgetDuressRecords()
        #expect(store.load().isEmpty)
        #expect(!h.controller.hasOpenDuressLink)
    }

    // MARK: The live link after a duress PIN

    @Test func aDuressAlertsLiveLinkIsNotOfferedWhileItCanOpen() async {
        let clock = ManualEngineClock(now: .now)
        let model = makeModel(EngineFakeBackend(), clock: clock)
        #expect(model.offersShareLink)
        controller(model).startHiddenDuressAlert(reason: "Duress")
        await controller(model).settle()
        #expect(!model.offersShareLink)
        clock.advance(by: 47 * 3600)              // Well past the half hour the alert runs.
        #expect(!model.offersShareLink)
        clock.advance(by: 2 * 3600)
        #expect(model.offersShareLink)
    }

    @Test func bringingClipsBackDoesntOfferTheLink() async {
        let clock = ManualEngineClock(now: .now)
        let model = makeModel(EngineFakeBackend(), clock: clock)
        model.store.setSafetyPIN("1234")
        controller(model).startHiddenDuressAlert(reason: "Duress")
        await controller(model).settle()
        _ = model.checkForMoreClips(pin: "1234")
        #expect(!model.offersShareLink)
    }

    // MARK: A Guard during an alert

    @Test func aGuardCantStartOverALiveAlert() async {
        let backend = EngineFakeBackend()
        let model = makeModel(backend)
        model.triggerSOS()
        await controller(model).settle()
        let alert = controller(model).activeAlert
        #expect(alert != nil)
        #expect(!model.canStartGuard)
        await model.startGuard(mode: .walk)
        #expect(model.currentSession == nil)
        #expect(controller(model).activeAlert?.id == alert?.id)
        #expect(controller(model).level >= .alert)
    }

    @Test func theLadderRefusesASessionDuringAnAlert() async {
        let h = LadderHarness()
        h.controller.handle(h.assessment(.high))
        await h.controller.settle()
        h.controller.begin(session: GuardSession(mode: .walk), policies: .default)
        #expect(h.controller.level == .alert)
        #expect(h.controller.activeAlert != nil)
    }

    // MARK: Listening

    @Test func walkAndRideListenByDefaultAndKeepTheChoice() throws {
        var settings = AppSettings()
        #expect(settings.listens(in: .walk))
        #expect(settings.listens(in: .ride))
        #expect(!settings.listens(in: .everyday))
        settings.listensDuringRide = false
        settings.listenDuringWalk = false
        #expect(!settings.listens(in: .ride))
        #expect(!settings.listens(in: .walk))
        #expect(settings.listens(in: .nightOut))
        #expect(GuardSession(mode: .ride).listening)

        // Settings saved before the Ride toggle existed.
        var saved = try #require(JSONSerialization.jsonObject(with: JSONEncoder().encode(AppSettings())) as? [String: Any])
        saved["listenDuringRide"] = nil
        let older = try JSONDecoder().decode(AppSettings.self, from: JSONSerialization.data(withJSONObject: saved))
        #expect(older.listensDuringRide)
    }

    @Test func startingARideUsesTheChoice() async {
        let model = makeModel(EngineFakeBackend())
        model.settings.listensDuringRide = false
        await model.startGuard(mode: .ride)
        #expect(model.currentSession?.listening == false)
        await model.endGuard()
        model.settings.listensDuringRide = true
        await model.startGuard(mode: .ride)
        #expect(model.currentSession?.listening == true)
    }

    // MARK: A test build promises nothing

    @Test func aTestBuildNeverPromisesContact() {
        let contact = SampleData.contacts[0]
        for delivery in [AlertDelivery.test, .demo] {
            let lines = [delivery.noAnswerNote("Maya"), delivery.checkInNotificationBody, delivery.closingTheAppNote,
                         delivery.dateEndCheckNote, delivery.dateSetupSubtitle, delivery.dateAlertPoint,
                         delivery.walkFooter("Maya", count: 1), delivery.rideFooter(arrival: "8:30", names: "Maya", count: 1),
                         delivery.helpPromiseBody, AlertPresentation.whoHears([contact], delivery: delivery),
                         ContactMessage.intro(to: contact, from: nil, delivery: delivery),
                         ContactMessage.test(to: contact, from: nil, delivery: delivery),
                         ContactMessage.headsUp(destination: "", eta: .now, delivery: delivery),
                         delivery.twoPINsSubtitle, delivery.duressResultLabel, delivery.duressAnimationLabel,
                         delivery.duressReadinessDetail, delivery.duressSetDetail, delivery.checkInSettingsFooter,
                         delivery.policySummaryFooter]
            for line in lines {
                for promise in ["sends help", "help still", "still sent", "Help still", "contacts are told", "contacts hear first",
                                "will be alerted", "are alerted", "is alerted", "alerts your contacts", "let your people know",
                                "will call and text", "will let you know", "calls your people", "your people will know",
                                "gets a call", "gets the plate", "see them on your live link"] {
                    #expect(!line.contains(promise), "\(line)")
                }
            }
        }
    }

    @Test func aRealBuildKeepsTheRealWords() {
        #expect(AlertDelivery.real.noAnswerNote("Maya") == "If you don't answer, Maya will be alerted with your live location.")
        #expect(AlertDelivery.real.walkFooter("Maya and Sam", count: 2) == "If you don't arrive, Maya and Sam are alerted.")
    }
}

private struct FailingSecretStore: SecretStore {
    func data(for account: String) -> Data? { nil }
    func set(_ data: Data?, for account: String) -> Bool { false }
}

extension MockEvidenceVault {
    fileprivate func startCaptureForTest() async {
        try? await startCapture(alertID: UUID(), serverAlertID: nil, prebuffer: nil)
    }
}
