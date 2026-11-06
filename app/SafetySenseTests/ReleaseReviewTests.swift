import Foundation
import Testing
@testable import SafetySense

@Suite("Call progress")
struct CallProgressTests {
    private func event(_ detail: String) -> EventDTO {
        EventDTO(who: "SafetySense", action: "call_status", at: "2026-11-06T01:00:00Z", detail: detail)
    }
    private let notified = [NotifiedContact(name: "Maya Chen", channel: .sms, status: "sent"),
                            NotifiedContact(name: "Maya Chen", channel: .call, status: "ringing")]

    @Test func readsTheServersRow() throws {
        let update = try #require(CallProgress.update(from: event("Call to Maya: no-answer")))
        #expect(update.name == "Maya" && update.status == "no-answer")
        #expect(CallProgress.update(from: event("Call to A contact: answered")) == nil)
        #expect(CallProgress.update(from: EventDTO(who: "x", action: "text_sent", at: "", detail: "Call to Maya: answered")) == nil)
    }

    @Test(arguments: [("answered", "Answered"), ("in-progress", "Answered"), ("completed", "Call ended"),
                      ("no-answer", "Couldn't reach"), ("busy", "Couldn't reach"), ("failed", "Couldn't reach")])
    func theRowFollowsTheCall(status: String, shown: String) throws {
        let updated = CallProgress.apply([event("Call to Maya: \(status)")], to: notified)
        let person = try #require(AlertPresentation.people(updated).first)
        #expect(person.status(events: []).text == shown)
        #expect(person.channels == "Call + text")
    }

    @Test func aResponseStaysOnTop() throws {
        let updated = CallProgress.apply([event("Call to Maya: no-answer")], to: notified)
        let person = try #require(AlertPresentation.people(updated).first)
        let events = [AlertEvent(who: "Maya", action: "on_my_way", at: .now)]
        #expect(person.status(events: events).text == "On the way")
    }

    @Test func aLateCallbackNeverMovesTheCallBackward() {
        let updated = CallProgress.apply([event("Call to Maya: completed"), event("Call to Maya: ringing")], to: notified)
        #expect(updated[1].status == "completed")
    }

    @Test func aTestRowStaysATestRow() {
        let test = [NotifiedContact(name: "Maya Chen", channel: .call, status: "dry_run")]
        #expect(CallProgress.apply([event("Call to Maya: answered")], to: test) == test)
    }

    @Test func anAdoptedAlertGetsARow() {
        let updated = CallProgress.apply([event("Call to Maya: answered")], to: [])
        #expect(updated == [NotifiedContact(name: "Maya", channel: .call, status: "answered")])
    }
}

@Suite("Release review")
@MainActor
struct ReleaseReviewTests {
    private func makeModel(_ backend: EngineFakeBackend, clock: ManualEngineClock, vault: MockEvidenceVault,
                           store: SettingsStore = .ephemeral()) -> AppModel {
        let engine = GuardEngine.makeSimulated(backend: backend, vault: vault, device: MockDeviceStatus(), clock: clock)
        let services = ServiceContainer(flavor: .demo, audio: engine.audio, motion: engine.motion,
                                        location: engine.location, risk: engine.risk,
                                        secondOpinion: engine.secondOpinion, escalation: engine.escalation,
                                        backend: backend, vault: vault,
                                        liveActivity: NoopLiveActivityController(),
                                        notifications: NoopNotificationService(),
                                        heartbeat: NoopHeartbeatService(), device: MockDeviceStatus())
        return AppModel(services: services, store: store)
    }

    private func controller(_ model: AppModel) -> EscalationController {
        model.services.escalation as! EscalationController   // swiftlint:disable:this force_cast
    }

    private func passDuressWindow(_ clock: ManualEngineClock, _ ladder: EscalationController) async {
        var left = ladder.timing.duressTrackingDuration + ladder.timing.locationInterval
        while left > 0 {
            clock.advance(by: ladder.timing.locationInterval)
            left -= ladder.timing.locationInterval
            await ladder.settle()
        }
    }

    // MARK: Call status on the ladder

    @Test func aPollMovesThePersonRow() async throws {
        let h = LadderHarness()
        h.controller.triggerManual(.manualSOS, reason: "SOS")
        await h.controller.settle()
        await h.backend.setStatus(AlertStatusResponse(status: "active", level: 3, dispatch: nil, events: [
            EventDTO(who: "SafetySense", action: "call_status", at: "2026-11-06T01:00:00Z", detail: "Call to Maya: answered"),
        ]))
        let id = try #require(h.controller.activeAlert?.id)
        await h.advance(h.controller.timing.statusPollInterval + 0.1)
        await h.controller.settle()
        let call = h.controller.alert(withID: id)?.notified.first { $0.channel == .call }
        #expect(call?.status == "answered")
    }

    // MARK: A wrong PIN

    @Test func aWrongPINLeavesANewAlertAlone() async throws {
        let store = SettingsStore.ephemeral()
        store.setSafetyPIN("2580")
        let backend = EngineFakeBackend()
        let model = makeModel(backend, clock: ManualEngineClock(now: .now), vault: MockEvidenceVault(), store: store)
        model.triggerSOS()
        await controller(model).settle()
        await model.cancelAlert(pin: "2580")
        #expect(model.overlay == .markedSafe)

        model.triggerSOS()   // From the Action Button, with Marked safe still up.
        #expect(model.markedSafe == nil)
        await controller(model).settle()
        let result = await model.cancelAlert(pin: "0000")
        #expect(result == .invalid)
        #expect(model.services.escalation.activeAlert != nil)
        #expect(model.overlay == .alertActive)
    }

    // MARK: Duress

    @Test func aSecondDuressPINDoesNotBreakTheRecording() async {
        let clock = ManualEngineClock(now: .now)
        let backend = EngineFakeBackend()
        let vault = MockEvidenceVault()
        let store = SettingsStore.ephemeral()
        store.setSafetyPIN("2580")
        store.setDuressPIN("1111")
        let model = makeModel(backend, clock: clock, vault: vault, store: store)
        let ladder = controller(model)
        await model.startGuard(mode: .walk)
        ladder.startHiddenDuressAlert(reason: "Duress PIN entered")
        await ladder.settle()
        let creates = await backend.creates.count
        let first = ladder.duressAlertID
        #expect(vault.isCapturing)

        await model.endGuardUnderDuress()
        await ladder.settle()
        #expect(await backend.creates.count == creates)
        #expect(ladder.duressAlertID == first)
        #expect(vault.isCapturing)

        await passDuressWindow(clock, ladder)
        #expect(ladder.duressAlertID == nil)
        #expect(!vault.isCapturing)
    }

    @Test func aRepeatDuressCancelOverALiveDuressAlsoStopsTheFirstCapture() async {
        let clock = ManualEngineClock(now: .now)
        let vault = MockEvidenceVault()
        let model = makeModel(EngineFakeBackend(), clock: clock, vault: vault)
        let ladder = controller(model)
        ladder.startHiddenDuressAlert(reason: "Duress PIN entered")
        await ladder.settle()
        ladder.triggerManual(.manualSOS, reason: "SOS")
        await ladder.settle()
        await ladder.cancel(with: .duress)
        await ladder.settle()
        await passDuressWindow(clock, ladder)
        #expect(!vault.isCapturing)
    }

    @Test func theWindowEndingDuringASessionStopsTheMicAndTracking() async {
        let clock = ManualEngineClock(now: .now)
        let model = makeModel(EngineFakeBackend(), clock: clock, vault: MockEvidenceVault())
        let ladder = controller(model)
        model.settings.listenDuringWalk = false
        await model.startGuard(mode: .walk, arrivalCheckAfter: 7200)
        ladder.startHiddenDuressAlert(reason: "Duress PIN entered")
        await ladder.settle()
        try? await model.services.audio.start(mode: .walk, safeWord: nil)   // As `EvidenceHandoff` does.
        let location = model.services.location as? MockLocationService
        #expect(location?.isTrackingAlert == true)

        await passDuressWindow(clock, ladder)
        #expect(!model.services.audio.isRunning)
        #expect(location?.isTrackingAlert == false)
        #expect(location?.isRunning == true)   // The Walk still needs it.
    }

    @Test func theWindowEndingLeavesALiveAlertAlone() async {
        let clock = ManualEngineClock(now: .now)
        let vault = MockEvidenceVault()
        let model = makeModel(EngineFakeBackend(), clock: clock, vault: vault)
        let ladder = controller(model)
        ladder.startHiddenDuressAlert(reason: "Duress PIN entered")
        await ladder.settle()
        model.triggerSOS()
        await ladder.settle()
        try? await model.services.audio.start(mode: .walk, safeWord: nil)

        await passDuressWindow(clock, ladder)
        #expect(ladder.activeAlert != nil)
        #expect(model.services.audio.isRunning)
        #expect((model.services.location as? MockLocationService)?.isTrackingAlert == true)
        #expect(vault.isCapturing)   // The alert took over its own recording.
    }

    @Test func forgotPINKeepsDuressClipsHidden() async {
        let store = SettingsStore.ephemeral()
        store.setSafetyPIN("2580")
        store.setDuressPIN("1111")
        let vault = MockEvidenceVault()
        let model = makeModel(EngineFakeBackend(), clock: ManualEngineClock(now: .now), vault: vault, store: store)
        let ladder = controller(model)
        ladder.startHiddenDuressAlert(reason: "Duress PIN entered")
        await ladder.settle()
        let id = ladder.duressAlertID!
        let clip = EvidenceClip(alertID: id, seq: 0, startedAt: .now, duration: 30, sha256: "x", fileName: "x", byteCount: 1)
        vault.clips = [clip]
        #expect(model.vaultClips.isEmpty)

        model.clearForgottenPINs()
        #expect(!store.hasSafetyPIN && !store.hasDuressPIN)
        store.setSafetyPIN("9999")
        #expect(model.checkForMoreClips(pin: "9999") == .valid)   // Reads the same...
        #expect(model.vaultClips.isEmpty)                         // ...and brings nothing back.
        _ = model.checkForMoreClips(pin: "2580")
        #expect(model.vaultClips == [clip])
    }

    @Test func forgotPINWithNothingHiddenParksNothing() {
        let store = SettingsStore.ephemeral()
        store.setSafetyPIN("2580")
        let model = makeModel(EngineFakeBackend(), clock: ManualEngineClock(now: .now), vault: MockEvidenceVault(), store: store)
        model.clearForgottenPINs()
        #expect(!store.hasParkedSafetyPIN)
    }

    // MARK: Staying awake

    @Test func noKeepAliveAsksForTheLongestGraceAndSaysSo() async throws {
        let services = ServiceContainer.demo()
        let model = AppModel(services: services, store: .ephemeral())
        (services.location as? MockLocationService)?.authorization = .denied
        model.settings.listenDuringWalk = false
        await model.startGuard(mode: .walk)
        let backend = try #require(services.backend as? MockBackendClient)
        #expect(await backend.lastSessionStart?.graceS == SessionStartWire.maximumHeartbeatGrace)
        #expect(model.sessionPermissionIssues.contains(.noBackgroundRun))
    }

    @Test func locationKeepsTheNormalGrace() async throws {
        let services = ServiceContainer.demo()
        let model = AppModel(services: services, store: .ephemeral())
        await model.startGuard(mode: .walk)
        let backend = try #require(services.backend as? MockBackendClient)
        #expect(await backend.lastSessionStart?.graceS == 45)
        #expect(!model.sessionPermissionIssues.contains(.noBackgroundRun))
    }

    @Test func theMicAloneKeepsTheNormalGrace() async throws {
        let services = ServiceContainer.demo()
        let model = AppModel(services: services, store: .ephemeral())
        (services.location as? MockLocationService)?.authorization = .denied
        await model.startGuard(mode: .nightOut)
        let backend = try #require(services.backend as? MockBackendClient)
        #expect(await backend.lastSessionStart?.graceS == 45)
    }

    // MARK: Words

    @Test func siriOnlySoundsSettledAtACheckIn() {
        #expect(ImOkayIntent.reply(level: .checkIn, handled: true) == "Thanks. SafetySense knows you're okay.")
        for level in [EscalationLevel.alert, .dispatch] {
            let reply = ImOkayIntent.reply(level: level, handled: true)
            #expect(reply.contains("didn't cancel") && !reply.contains("Thanks"))
        }
        #expect(!ImOkayIntent.reply(level: .guarding, handled: true).contains("knows you're okay"))
        #expect(!ImOkayIntent.reply(level: nil, handled: false).contains("knows you're okay"))
    }

    @Test func nothingSaysHelpIsComingUntilDispatchAnswers() {
        let real = AlertDelivery.real
        let sent = AlertRecord(serverAlertID: "a", level: .dispatch, trigger: .manualSOS, reason: "", policy: .dispatchImmediately)
        let offline = AlertRecord(level: .dispatch, trigger: .manualSOS, reason: "", policy: .dispatchImmediately)
        let dispatch = DispatchInfo(provider: .noonlightSandbox, alarmID: "1", status: "created")
        #expect(AlertPresentation.dispatchConfirmed(alert: sent, dispatch: dispatch, connectionNote: nil))
        #expect(!AlertPresentation.dispatchConfirmed(alert: sent, dispatch: nil, connectionNote: nil))
        #expect(!AlertPresentation.dispatchConfirmed(alert: offline, dispatch: nil, connectionNote: nil))
        #expect(!AlertPresentation.dispatchConfirmed(alert: sent, dispatch: dispatch, connectionNote: "Couldn't confirm"))

        #expect(real.dispatchHeadline(confirmed: true) == "Help is on the way")
        let words = [real.dispatchHeadline(confirmed: false), real.dispatchDetail(confirmed: false),
                     real.dispatchPill(confirmed: false), real.statusLine(.dispatch), real.alertTitle(.dispatch),
                     real.spokenAlert(.dispatch) ?? "", real.forgotPINHint(confirmed: false), real.pinPrompt(confirmed: false)]
        for line in words {
            #expect(!line.contains("on the way") && !line.contains("Dispatch active") && !line.contains("monitoring center"), "\(line)")
        }
        #expect(real.dispatchDetail(confirmed: false).contains("911"))
        #expect(real.dispatchCallNote(confirmed: false) == nil)
    }

    @Test(arguments: [AlertDelivery.test, .demo])
    func theContactsAndSettingsWordsPromiseNothing(delivery: AlertDelivery) {
        let words = [delivery.contactsIntro(max: 5), delivery.contactsEditorPrompt, delivery.homeContactsSubtitle,
                     delivery.noContactsWarning, delivery.welcomeHeadline,
                     delivery.policyExplanation(.contactsFirst), delivery.policyExplanation(.dispatchImmediately)]
        for line in words {
            #expect(!line.contains("gets a call") && !line.contains("Help is sent") && !line.contains("Gets help"), "\(line)")
            #expect(line.contains("build"), "\(line)")
        }
        #expect(!delivery.forgotPINHint(confirmed: true).contains("monitoring center"))
    }

    @Test func realBuildsKeepTheirWords() {
        let real = AlertDelivery.real
        #expect(real.homeContactsSubtitle.hasPrefix("Your first contact gets a call"))
        #expect(real.policyExplanation(.contactsFirst).hasPrefix("Your people hear first"))
        #expect(real.welcomeHeadline == "Gets help to you when you can't reach your phone.")
    }

    // MARK: The demo

    @Test func theDemoCallIsAnswered() async throws {
        let backend = MockBackendClient(credentials: DeviceCredentials(deviceId: "d", deviceSecret: "s"))
        await backend.setLatency(.zero, callAnswerDelay: 0)
        let created = try await backend.createAlert(AlertCreateRequest(sessionId: nil, level: 2, reason: "x", trigger: "manual_sos",
                                                                       dryRun: nil, dispatchPolicy: "contacts_first"))
        #expect(created.notified.first?.status == "ringing")
        let status = try await backend.alertStatus(AlertStatusRequest(alertId: created.alertId))
        let updated = CallProgress.apply(status.events, to: created.notified)
        #expect(updated.first?.status == "answered")
    }

    @Test func aDemoAlertReachesTheSummaryAndTheVault() async throws {
        let clock = ManualEngineClock(now: .now)
        let store = SettingsStore.ephemeral()
        store.setSafetyPIN("2580")
        let vault = MockEvidenceVault(simulatesRecording: true, clipLength: 0.02)
        let model = makeModel(EngineFakeBackend(), clock: clock, vault: vault, store: store)
        await model.startGuard(mode: .nightOut)
        model.triggerSOS()
        await controller(model).settle()
        try? await Task.sleep(for: .milliseconds(90))
        await model.cancelAlert(pin: "2580")
        let summary = try #require(model.markedSafe)
        #expect(summary.clipCount > 1)
        #expect(summary.summaryLine(clipCount: summary.clipCount).contains("CLIPS IN VAULT"))
        #expect(model.vaultClips.contains { $0.alertID == summary.alertID })
        #expect(!vault.isCapturing)
    }

    @Test func theDemoLeavesClipsInTheVault() async throws {
        let vault = MockEvidenceVault(simulatesRecording: true, clipLength: 0.02)
        let id = UUID()
        try await vault.startCapture(alertID: id, serverAlertID: "a", prebuffer: nil)
        #expect(vault.clips.count == 1)
        try? await Task.sleep(for: .milliseconds(120))
        vault.stopCapture()
        let count = vault.clips.count
        #expect(count > 1 && vault.clips.allSatisfy { $0.alertID == id })
        try? await Task.sleep(for: .milliseconds(60))
        #expect(vault.clips.count == count)
    }
}
