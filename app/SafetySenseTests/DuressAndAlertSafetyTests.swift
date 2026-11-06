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
        #expect(h.vaultShows(hidden))
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
                         ContactMessage.headsUp(destination: "", eta: .now, delivery: delivery)]
            for line in lines {
                for promise in ["will be alerted", "are alerted", "is alerted", "alerts your contacts", "let your people know",
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

extension MockEvidenceVault {
    fileprivate func startCaptureForTest() async {
        try? await startCapture(alertID: UUID(), serverAlertID: nil, prebuffer: nil)
    }
}
