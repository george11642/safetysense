import Foundation
import Testing
@testable import SafetySense

@Suite("Engine: EscalationController")
@MainActor
struct EngineEscalationTests {
    // MARK: Check-in -> Alert -> Dispatch

    @Test func elevatedRiskStartsA45SecondCheckInThenMissedCheckInAlerts() async throws {
        let h = LadderHarness()
        h.controller.handle(h.assessment(.elevated))
        #expect(h.controller.level == .checkIn)
        #expect(h.controller.stepDeadline == h.clock.now.addingTimeInterval(45))
        #expect(h.controller.checkInReason == "Scream")
        #expect(h.haptics.checkIns == 1)

        await h.advance(44)
        #expect(h.controller.level == .checkIn)
        await h.advance(1)
        #expect(h.controller.level == .alert)
        let alert = try #require(h.controller.activeAlert)
        #expect(alert.trigger == .missedCheckIn)
        #expect(alert.policy == .contactsFirst)
        #expect(alert.serverAlertID == "alert-1")
        #expect(alert.shareURL?.absoluteString == "https://safetysense-live.vercel.app/a/token1")
        #expect(alert.notified.first?.name == "Maya Chen")

        let creates = await h.backend.creates
        #expect(creates.count == 1)
        #expect(creates[0].trigger == "missed_check_in")
        #expect(creates[0].level == 2)
        #expect(creates[0].dispatchPolicy == "contacts_first")
        #expect(creates[0].sessionId == "session-1")
        #expect(creates[0].lat == 35.0844)
        #expect(creates[0].battery == 0.8)
        #expect(creates[0].dryRun == nil)
        #expect(h.evidence.prepared == [alert.id])
        #expect(h.evidence.committed.first?.1 == "alert-1")
    }

    @Test func alertMovesToDispatchAfter90SecondsWithoutACancel() async throws {
        let h = LadderHarness()
        h.controller.handle(h.assessment(.high))
        #expect(h.controller.level == .alert)
        #expect(h.controller.stepDeadline == h.clock.now.addingTimeInterval(90))
        await h.controller.settle()

        await h.advance(89)
        #expect(h.controller.level == .alert)
        #expect(await h.backend.escalations.isEmpty)
        await h.advance(1)
        #expect(h.controller.level == .dispatch)
        #expect(h.controller.stepDeadline == nil)
        let escalations = await h.backend.escalations
        #expect(escalations.count == 1)
        #expect(escalations[0].alertId == "alert-1")
        let dispatch = try #require(h.controller.activeAlert?.dispatch)
        #expect(dispatch.provider == .simulated)
        #expect(dispatch.displayStatus.hasPrefix("Simulated dispatch"))
        #expect(h.controller.statusText.hasPrefix("Simulated dispatch"))
        #expect(h.controller.activeAlert?.status == .dispatched)
    }

    @Test func alertSharesLocationWhileActive() async {
        let h = LadderHarness()
        h.controller.handle(h.assessment(.high))
        await h.controller.settle()
        await h.advance(41)
        let locations = await h.backend.locations
        #expect(locations.count == 2)
        #expect(locations.allSatisfy { $0.alertId == "alert-1" && $0.lat == 35.0844 })
    }

    @Test func repeatedHighRiskDoesNotRaiseASecondAlert() async {
        let h = LadderHarness()
        h.controller.handle(h.assessment(.high))
        h.controller.handle(h.assessment(.high))
        h.controller.handle(h.assessment(.elevated))
        await h.controller.settle()
        #expect(await h.backend.creates.count == 1)
        #expect(h.controller.level == .alert)
    }

    // MARK: Check-in answers

    @Test func imOkayReturnsToGuardingAndHoldsBackRiskCheckIns() async {
        let h = LadderHarness()
        var okays = 0
        h.controller.onUserConfirmedOkay = { okays += 1 }
        h.controller.handle(h.assessment(.elevated))
        h.controller.respondToCheckIn(okay: true)
        #expect(h.controller.level == .guarding)
        #expect(h.controller.stepDeadline == nil)
        #expect(okays == 1)

        h.controller.handle(h.assessment(.elevated))
        #expect(h.controller.level == .guarding)
        await h.advance(h.controller.timing.okayCooldown + 1)
        h.controller.handle(h.assessment(.elevated))
        #expect(h.controller.level == .checkIn)
        #expect(await h.backend.creates.isEmpty)
    }

    @Test func highRiskStillAlertsDuringTheOkayCooldown() async {
        let h = LadderHarness()
        h.controller.handle(h.assessment(.elevated))
        h.controller.respondToCheckIn(okay: true)
        h.controller.handle(h.assessment(.high))
        #expect(h.controller.level == .alert)
    }

    @Test func respondingWhenNoCheckInIsOpenDoesNothing() {
        let h = LadderHarness()
        h.controller.respondToCheckIn(okay: false)
        #expect(h.controller.level == .guarding)
    }

    // MARK: Policies

    @Test func manualSOSFollowsTheManualPolicy() async {
        var policies = DispatchPolicySettings.default
        policies.manualSOS = .contactsFirst
        let h = LadderHarness(policies: policies)
        h.controller.triggerManual(.actionButton, reason: "SOS from the Action Button")
        #expect(h.controller.level == .alert)
        #expect(h.controller.activeAlert?.trigger == .actionButton)
        // Pressing SOS again while contacts are being told doesn't start a second alert.
        h.controller.triggerManual(.manualSOS, reason: "again")
        await h.controller.settle()
        #expect(await h.backend.creates.count == 1)
    }

    @Test func manualSOSDuringAContactsFirstAlertEscalatesWhenManualPolicyIsDispatch() async {
        let h = LadderHarness()
        h.controller.handle(h.assessment(.high))
        await h.controller.settle()
        h.controller.triggerManual(.manualSOS, reason: "Held SOS")
        #expect(h.controller.level == .dispatch)
        await h.controller.settle()
        #expect(await h.backend.escalations.count == 1)
    }

    @Test func dispatchImmediatelyModeSendsHighRiskStraightToDispatch() async {
        var policies = DispatchPolicySettings.default
        policies.perMode[.nightOut] = .dispatchImmediately
        let h = LadderHarness(policies: policies)
        h.controller.handle(h.assessment(.high))
        #expect(h.controller.level == .dispatch)
        await h.controller.settle()
        #expect(await h.backend.creates.first?.dispatchPolicy == "dispatch_immediately")
        #expect(h.controller.activeAlert?.dispatch?.provider == .simulated)
    }

    @Test func safeWordUsesTheManualPolicy() async {
        let h = LadderHarness()
        h.controller.handle(h.assessment(.critical, kinds: [.safeWord], explanation: "Safe word heard"))
        #expect(h.controller.level == .dispatch)
        #expect(h.controller.activeAlert?.trigger == .safeWord)
        await h.controller.settle()
        #expect(await h.backend.creates.first?.trigger == "safe_word")
    }

    @Test func lostHeartbeatUsesTheModePolicy() {
        let h = LadderHarness()
        h.controller.handle(h.assessment(.critical, kinds: [.heartbeatLost], explanation: "Phone went dark"))
        #expect(h.controller.level == .alert)
        #expect(h.controller.activeAlert?.trigger == .heartbeatLost)
    }

    @Test func secondOpinionAloneNeverEscalates() {
        let h = LadderHarness()
        h.controller.handle(h.assessment(.high, kinds: [.secondOpinion]))
        #expect(h.controller.level == .guarding)
        h.controller.handle(h.assessment(.elevated, kinds: []))
        #expect(h.controller.level == .guarding)
    }

    // MARK: PIN cancel and duress

    @Test func validPINCancelsQuietlyAndTellsTheServer() async throws {
        let h = LadderHarness()
        h.controller.handle(h.assessment(.high))
        await h.controller.settle()
        let id = try #require(h.controller.activeAlert?.id)
        await h.controller.cancel(with: .valid)
        await h.controller.settle()
        #expect(h.controller.level == .guarding)
        #expect(h.controller.activeAlert == nil)
        #expect(h.controller.stepDeadline == nil)
        #expect(await h.backend.cancels == [AlertCancelRequest(alertId: "alert-1", duress: false)])
        #expect(h.evidence.stopped == [id])
        #expect(h.controller.alert(withID: id)?.status == .cancelled)
        await h.advance(200)
        #expect(h.controller.level == .guarding)
        #expect(await h.backend.escalations.isEmpty)
        #expect(await h.backend.locations.isEmpty)
    }

    @Test func duressPINLooksExactlyLikeACancelButKeepsHelpComing() async throws {
        let valid = LadderHarness()
        valid.controller.handle(valid.assessment(.high))
        await valid.controller.settle()
        await valid.controller.cancel(with: .valid)
        await valid.controller.settle()

        let duress = LadderHarness()
        duress.controller.handle(duress.assessment(.high))
        await duress.controller.settle()
        let id = try #require(duress.controller.activeAlert?.id)
        await duress.controller.cancel(with: .duress)
        await duress.controller.settle()

        // On screen: identical.
        #expect(duress.controller.level == valid.controller.level)
        #expect(duress.controller.activeAlert == nil)
        #expect(duress.controller.stepDeadline == valid.controller.stepDeadline)
        #expect(duress.controller.statusText == valid.controller.statusText)
        #expect(duress.changes.last?.0 == .guarding)
        #expect(duress.changes.last?.1 == nil)
        #expect(duress.haptics.cancels == valid.haptics.cancels)

        // Underneath: the server escalates silently, evidence and location keep flowing.
        #expect(await duress.backend.cancels == [AlertCancelRequest(alertId: "alert-1", duress: true)])
        #expect(duress.evidence.stopped.isEmpty)
        #expect(duress.controller.duressAlertID == id)
        await duress.advance(21)
        #expect(await duress.backend.locations.count == 1)
    }

    @Test func invalidPINChangesNothing() async {
        let h = LadderHarness()
        h.controller.handle(h.assessment(.high))
        await h.controller.cancel(with: .invalid)
        await h.controller.cancel(with: .invalid)
        #expect(h.controller.level == .alert)
        #expect(h.controller.failedPINAttempts == 2)
        await h.controller.settle()
        #expect(await h.backend.cancels.isEmpty)
    }

    @Test func pinAtACheckInCountsAsImOkay() async {
        let h = LadderHarness()
        h.controller.handle(h.assessment(.elevated))
        await h.controller.cancel(with: .valid)
        await h.controller.settle()
        #expect(h.controller.level == .guarding)
        #expect(await h.backend.creates.isEmpty)
    }

    @Test func duressPINAtACheckInSilentlyRaisesAHiddenDispatch() async {
        let h = LadderHarness()
        h.controller.handle(h.assessment(.elevated))
        await h.controller.cancel(with: .duress)
        await h.controller.settle()
        #expect(h.controller.level == .guarding)
        #expect(h.controller.activeAlert == nil)
        await h.controller.settle()
        let creates = await h.backend.creates
        #expect(creates.count == 1)
        #expect(creates.first?.level == 2)
        #expect(creates.first?.dispatchPolicy == "contacts_first")
        // The cancel raises it, so the flag is on the server before dispatch starts.
        #expect(await h.backend.cancels.map(\.duress) == [true])
        #expect(h.controller.duressAlertID != nil)
    }

    @Test func validCancelBeforeTheServerAnswersStillClosesTheServerAlert() async {
        let h = LadderHarness()
        await h.backend.setHoldCreates(true)
        h.controller.handle(h.assessment(.high))
        while await h.backend.heldCount == 0 { await Task.yield() }
        await h.controller.cancel(with: .valid)
        #expect(h.controller.level == .guarding)
        await h.backend.releaseCreates()
        await h.controller.settle()
        #expect(await h.backend.cancels == [AlertCancelRequest(alertId: "alert-1", duress: false)])
        #expect(h.evidence.committed.isEmpty)
    }

    @Test func duressBeforeTheServerAnswersIsSentOnceTheAlertExists() async {
        let h = LadderHarness()
        await h.backend.setHoldCreates(true)
        h.controller.handle(h.assessment(.high))
        while await h.backend.heldCount == 0 { await Task.yield() }
        await h.controller.cancel(with: .duress)
        #expect(h.controller.level == .guarding)
        await h.backend.releaseCreates()
        await h.controller.settle()
        #expect(await h.backend.cancels == [AlertCancelRequest(alertId: "alert-1", duress: true)])
        #expect(h.evidence.committed.first?.1 == "alert-1")
    }

    // MARK: Contacts

    @Test func contactTappingSendHelpDispatches() async {
        let h = LadderHarness()
        h.controller.handle(h.assessment(.high))
        await h.controller.settle()
        h.controller.contactRequestedHelp(name: "Maya Chen")
        #expect(h.controller.level == .dispatch)
        #expect(h.controller.activeAlert?.events.contains { $0.who == "Maya Chen" && $0.action == "send_help" } == true)
        await h.controller.settle()
        let escalations = await h.backend.escalations
        #expect(escalations.first?.reason == "Maya Chen asked for help to be sent")
    }

    @Test func statusPollPicksUpSendHelpFromTheSharePage() async {
        let h = LadderHarness()
        h.controller.handle(h.assessment(.high))
        await h.controller.settle()
        await h.backend.setStatus(AlertStatusResponse(
            status: "dispatched", level: 3,
            dispatch: DispatchDTO(provider: "simulated", alarmId: "sim-9", status: "requested"),
            events: [EventDTO(who: "Maya Chen", action: "on_my_way", at: "2026-11-04T23:00:00Z"),
                     EventDTO(who: "Maya Chen", action: "send_help", at: "2026-11-04T23:00:05Z")]))
        await h.advance(8)
        #expect(h.controller.level == .dispatch)
        #expect(h.controller.activeAlert?.dispatch?.alarmID == "sim-9")
        #expect(h.controller.activeAlert?.events.contains { $0.action == "on_my_way" } == true)
        // The server already escalated; the phone doesn't ask twice.
        #expect(await h.backend.escalations.isEmpty)
    }

    // MARK: Scheduled check-ins

    @Test func scheduledCheckInsRepeatAndAMissedOneAlerts() async {
        let h = LadderHarness(checkInInterval: 600)
        #expect(h.controller.nextCheckInAt == h.clock.now.addingTimeInterval(600))
        await h.advance(600)
        #expect(h.controller.level == .checkIn)
        #expect(h.controller.checkInReason == "Scheduled check-in")
        h.controller.respondToCheckIn(okay: true)
        #expect(h.controller.nextCheckInAt == h.clock.now.addingTimeInterval(600))
        await h.advance(600 + 45)
        #expect(h.controller.level == .alert)
        #expect(h.controller.activeAlert?.trigger == .missedCheckIn)
    }

    @Test func scheduledCheckInDueIsIgnoredDuringAnAlert() {
        let h = LadderHarness()
        h.controller.handle(h.assessment(.high))
        h.controller.scheduledCheckInDue()
        #expect(h.controller.level == .alert)
    }

    // MARK: Drill, end, failures

    @Test func drillSendsATestAlertAndNeverDispatches() async throws {
        let h = LadderHarness()
        await h.controller.startDrill()
        let creates = await h.backend.creates
        #expect(creates.count == 1)
        #expect(creates[0].dryRun == true)
        #expect(creates[0].reason == "TEST: practice drill")
        #expect(h.controller.level == .guarding)
        let drill = try #require(h.controller.lastDrill)
        #expect(drill.isDrill)
        #expect(drill.status == .resolved)
        #expect(h.changes.last?.1?.isDrill == true)
        await h.advance(200)
        #expect(await h.backend.escalations.isEmpty)
    }

    @Test func endStopsEveryTimer() async {
        let h = LadderHarness(checkInInterval: 60)
        h.controller.handle(h.assessment(.elevated))
        h.controller.end()
        #expect(h.controller.level == .guarding)
        #expect(h.controller.nextCheckInAt == nil)
        await h.advance(500)
        #expect(h.controller.level == .guarding)
        #expect(await h.backend.creates.isEmpty)
    }

    @Test func serverDownStillRunsTheLadderLocally() async {
        let h = LadderHarness()
        await h.backend.setFailCreates(true)
        h.controller.handle(h.assessment(.high))
        await h.controller.settle()
        #expect(h.controller.level == .alert)
        #expect(h.controller.connectionNote != nil)
        #expect(h.evidence.committed.first?.1 == nil)
        await h.advance(90)
        #expect(h.controller.level == .dispatch)
        #expect(await h.backend.escalations.isEmpty)
    }

    @Test func riskWithoutASessionIsIgnoredButManualSOSWorks() async {
        let backend = EngineFakeBackend()
        let controller = EscalationController(backend: backend, clock: ManualEngineClock(),
                                              haptics: SilentEngineHaptics(), timing: .immediate)
        controller.handle(RiskAssessment(score: 3, level: .high,
                                         contributors: [RiskSignal(kind: .scream, weight: 3)],
                                         explanation: "Scream", secondOpinionAdjustment: nil, evaluatedAt: .now))
        #expect(controller.level == .guarding)
        controller.triggerManual(.actionButton, reason: "SOS")
        #expect(controller.level == .dispatch)
        await controller.settle()
        #expect(await backend.creates.first?.trigger == "action_button")
    }

    @Test func onChangeReportsEveryStep() async {
        let h = LadderHarness()
        h.controller.handle(h.assessment(.elevated))
        await h.advance(45)
        await h.advance(90)
        let levels = h.changes.map(\.0)
        #expect(levels.first == .guarding)
        #expect(levels.contains(.checkIn))
        #expect(levels.contains(.alert))
        #expect(levels.last == .dispatch)
    }
}

@Suite("Engine: integration")
@MainActor
struct EngineIntegrationTests {
    @Test func nightOutDemoDrivesTheRealEngineThroughAppModel() async throws {
        let clock = ManualEngineClock(now: .now)
        let backend = EngineFakeBackend()
        let engine = GuardEngine.makeSimulated(backend: backend, vault: MockEvidenceVault(), device: MockDeviceStatus(),
                                               clock: clock)
        let services = ServiceContainer(flavor: .demo, audio: engine.audio, motion: engine.motion,
                                        location: engine.location, risk: engine.risk,
                                        secondOpinion: engine.secondOpinion, escalation: engine.escalation,
                                        backend: backend, vault: MockEvidenceVault(),
                                        liveActivity: NoopLiveActivityController(),
                                        notifications: NoopNotificationService(),
                                        heartbeat: NoopHeartbeatService(), device: MockDeviceStatus())
        let model = AppModel(services: services, store: .ephemeral())
        await model.startGuard(mode: .nightOut)
        #expect(model.overlay == .guardActive)

        let player = DemoScenarioPlayer(clock: clock)
        player.attach(to: services)
        player.play()

        clock.advance(by: 12)
        #expect(model.overlay == .guardActive)
        clock.advance(by: 1)
        #expect(model.overlay == .checkIn)
        clock.advance(by: 18)
        #expect(model.overlay == .alertCountdown)
        #expect(player.progress == 1)
        await engine.escalation.settle()
        let alert = try #require(model.currentAlert)
        #expect(alert.trigger == .riskEngine)
        #expect(alert.serverAlertID == "alert-1")
        #expect(alert.reason.contains("Impact, then stillness") || alert.reason.contains("Distress words"))
        #expect((services.audio as? MockAudioGuardService)?.transcript.contains("get off me") == true)
        await model.endGuard()
    }
}
