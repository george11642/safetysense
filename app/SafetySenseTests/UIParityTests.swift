import Foundation
import Testing
@testable import SafetySense

/// Figma parity: the states behind the prototype's screens.
@Suite("UI parity")
@MainActor
struct UIParityTests {
    private func model(safety: String? = "1111", duress: String? = "9999",
                       services: ServiceContainer = .demo()) -> AppModel {
        let store = SettingsStore.ephemeral()
        if let safety { store.setSafetyPIN(safety) }
        if let duress { store.setDuressPIN(duress) }
        let model = AppModel(services: services, store: store)
        model.contacts = SampleData.contacts
        return model
    }

    // MARK: Marked safe

    @Test func aPINOnTheCountdownEndsAtMarkedSafeAndTheGuardEnds() async {
        let model = model()
        await model.startGuard(mode: .walk, arrivalCheckAfter: 1800)
        model.services.escalation.triggerManual(.riskEngine, reason: "test")
        #expect(model.overlay == .alertCountdown)
        await model.cancelAlert(pin: "1111")
        #expect(model.overlay == .markedSafe)
        #expect(model.currentSession == nil)
        #expect(model.markedSafe?.reachedDispatch == false)
        #expect(model.markedSafe?.mode == .walk)
        #expect(model.markedSafe?.summaryLine(clipCount: 0).hasSuffix("STOPPED PRE-DISPATCH") == true)
    }

    @Test func aPINOnAlertActiveKeepsTheAlertsTimes() async throws {
        let model = model()
        await model.startGuard(mode: .nightOut)
        model.triggerSOS()
        #expect(model.overlay == .alertActive)
        await model.cancelAlert(pin: "1111")
        let summary = try #require(model.markedSafe)
        #expect(summary.reachedDispatch)
        #expect(model.overlay == .markedSafe)
    }

    @Test func safetyAndDuressPINsProduceTheSameScreen() async throws {
        func run(_ pin: String) async throws -> MarkedSafeSummary {
            let model = model()
            await model.startGuard(mode: .date)
            model.services.escalation.triggerManual(.riskEngine, reason: "test")
            await model.cancelAlert(pin: pin)
            #expect(model.overlay == .markedSafe)
            #expect(model.currentSession == nil)
            return try #require(model.markedSafe)
        }
        var safety = try await run("1111")
        let duress = try await run("9999")
        safety.alertID = duress.alertID
        safety.startedAt = duress.startedAt
        safety.endedAt = duress.endedAt
        #expect(safety == duress)
    }

    @Test func aWrongPINChangesNothing() async {
        let model = model()
        await model.startGuard(mode: .nightOut)
        model.services.escalation.triggerManual(.riskEngine, reason: "test")
        await model.cancelAlert(pin: "0000")
        #expect(model.overlay == .alertCountdown)
        #expect(model.markedSafe == nil)
        #expect(model.currentSession != nil)
    }

    @Test func leavingMarkedSafeLandsOnTheAlertsMode() async {
        let model = model()
        await model.startGuard(mode: .ride)
        model.homeMode = .nightOut
        model.services.escalation.triggerManual(.riskEngine, reason: "test")
        await model.cancelAlert(pin: "1111")
        model.selectedTab = .vault
        model.leaveMarkedSafe(toSupport: false)
        #expect(model.selectedTab == .home)
        #expect(model.homeMode == .ride)
        #expect(model.overlay == .none)

        model.markedSafe = SampleData.markedSafe(reachedDispatch: true, mode: .date)
        model.leaveMarkedSafe(toSupport: true)
        #expect(model.selectedTab == .support)
    }

    @Test func summaryLineMatchesThePrototype() throws {
        let calendar = Calendar.current
        let start = try #require(calendar.date(from: DateComponents(year: 2026, month: 11, day: 4, hour: 14, minute: 11)))
        let end = start.addingTimeInterval(20 * 60)
        let summary = MarkedSafeSummary(alertID: UUID(), mode: .nightOut, startedAt: start, endedAt: end,
                                        reachedDispatch: true, contactFirstNames: ["Maya", "Jordan", "Sam"])
        #expect(summary.summaryLine(clipCount: 3) == "NIGHT OUT · ALERT 2:11–2:31 · 3 CLIPS IN VAULT")
        #expect(summary.summaryLine(clipCount: 1) == "NIGHT OUT · ALERT 2:11–2:31 · 1 CLIP IN VAULT")
        #expect(summary.summaryLine(clipCount: 0) == "NIGHT OUT · ALERT 2:11–2:31")
        var early = summary
        early.reachedDispatch = false
        early.mode = nil
        #expect(early.summaryLine(clipCount: 2) == "ALERT 2:11 · STOPPED PRE-DISPATCH")
        #expect(summary.bodyText == "We told Maya, Jordan and Sam that you're okay, and your live link stopped sharing your location.")
    }

    @Test func aTestAlertDoesntClaimAnyoneWasTold() {
        var summary = SampleData.markedSafe(reachedDispatch: false)
        summary.wasTest = true
        #expect(summary.bodyText.contains("nobody was contacted"))
        let alert = AlertRecord(level: .dispatch, trigger: .manualSOS, reason: "SOS", policy: .dispatchImmediately,
                                notified: [NotifiedContact(name: "Maya Chen", channel: .sms, status: "dry_run")])
        #expect(AlertPresentation.isTest(alert))
    }

    @Test func markedSafePromisesNothingTheServerCouldntConfirm() {
        var summary = SampleData.markedSafe(reachedDispatch: false)
        summary.couldntConfirm = true
        #expect(!summary.bodyText.contains("We told"))
        #expect(summary.bodyText.contains("may not know"))
        summary.wasTest = true
        #expect(summary.bodyText.contains("nobody was contacted"), "A build that contacts nobody has nobody to tell")
    }

    @Test func markedSafeNamesNobodyWhenThereIsNobody() {
        var summary = SampleData.markedSafe(reachedDispatch: false)
        summary.contactFirstNames = []
        #expect(!summary.bodyText.contains("We told"))
    }

    @Test func clipsAreCountedWithTheVaultLocked() {
        let vault = MockEvidenceVault(clips: SampleData.evidence)
        #expect(!vault.isUnlocked)
        #expect(vault.clips.filter { $0.alertID == SampleData.evidence[0].alertID }.count == 3)
    }

    @Test func aPersonWithNoPINCanStillCancel() async {
        let model = model(safety: nil, duress: nil)
        await model.startGuard(mode: .nightOut)
        model.triggerSOS()
        await model.cancelAlertWithoutPIN()
        #expect(model.overlay == .markedSafe)
    }

    @Test func thePINBypassIsClosedOnceAPINExists() async {
        let model = model()
        await model.startGuard(mode: .nightOut)
        model.triggerSOS()
        await model.cancelAlertWithoutPIN()
        #expect(model.overlay == .alertActive)
    }

    // MARK: Check-ins

    @Test func helpAtACheckInStartsTheCountdownNotDispatch() async {
        let h = LadderHarness()
        h.controller.handle(h.assessment(.elevated))
        h.controller.respondToCheckIn(okay: false)
        #expect(h.controller.level == .alert)
        #expect(h.controller.stepDeadline != nil)
        #expect(h.controller.activeAlert?.reason == "Asked for help at a check-in")
        #expect(h.controller.activeAlert?.policy == .contactsFirst)
        await h.controller.settle()
        #expect(await h.backend.creates.first?.dispatchPolicy == "contacts_first")
        #expect(await h.backend.creates.first?.level == 2)
        #expect(await h.backend.escalations.isEmpty)
        await h.controller.cancel(with: .valid)
        #expect(h.controller.level == .guarding)
    }

    @Test func holdToSOSKeepsItsDispatchDefault() {
        let h = LadderHarness()
        h.controller.handle(h.assessment(.elevated))
        h.controller.triggerManual(.manualSOS, reason: "Held")
        #expect(h.controller.level == .dispatch)
    }

    @Test func helpAtACheckInFollowsADispatchRightAwayMode() {
        var policies = DispatchPolicySettings.default
        policies.perMode[.nightOut] = .dispatchImmediately
        let h = LadderHarness(policies: policies)
        h.controller.handle(h.assessment(.elevated))
        h.controller.respondToCheckIn(okay: false)
        #expect(h.controller.level == .dispatch)
    }

    @Test(arguments: [GuardMode.walk, .ride], [Sensitivity.relaxed, .balanced, .vigilant])
    func aLongStopReachesACheckIn(mode: GuardMode, sensitivity: Sensitivity) throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try #require(TimeZone(identifier: "UTC"))
        let midday = try #require(calendar.date(from: DateComponents(year: 2026, month: 11, day: 4, hour: 13)))
        let engine = RiskEngine(calendar: calendar)
        engine.configure(mode: mode, sensitivity: sensitivity)
        let h = LadderHarness(mode: mode, checkInInterval: 3600)
        let seconds: TimeInterval = mode == .ride ? 181 : 421
        let signal = try #require(RouteMonitor.signal(for: .unexpectedStop(seconds: seconds), at: midday))
        h.controller.handle(engine.ingest(signal, at: midday))
        #expect(h.controller.level == .checkIn)
        #expect(h.controller.checkInCause == .unexpectedStop)
    }

    @Test func routeMonitorStopsBecomeCheckInsEndToEnd() throws {
        var monitor = RouteMonitor(mode: .walk, destination: nil)
        let start = Date(timeIntervalSince1970: 1_800_000_000)
        func fix(_ t: TimeInterval) -> LocationFix {
            LocationFix(latitude: 35.08, longitude: -106.62, accuracy: 10, timestamp: start.addingTimeInterval(t), speed: 0)
        }
        _ = monitor.process(fix(0), hour: 13)
        let events = monitor.process(fix(430), hour: 13)
        #expect(events == [.unexpectedStop(seconds: 430)])
    }

    @Test func checkInWordingFollowsTheMode() {
        #expect(CheckInCause.unexpectedStop.line(mode: .walk) == "You've been stopped for a while.")
        #expect(CheckInCause.unexpectedStop.line(mode: .ride) == "Your ride stopped somewhere unexpected.")
        #expect(CheckInCause.scheduled.line(mode: .nightOut) == "Just checking on you.")
        #expect(CheckInCause.scheduled.line(mode: .walk) == "You should be there by now.")
        #expect(CheckInCause.noticed("Scream").line(mode: .date) == "SafetySense noticed: scream")
        #expect(CheckInCause.noticed("All quiet").line(mode: .date) == "Just checking on you.")
    }

    @Test func aLongStopLeavesTheArrivalCheckWhereItWas() async {
        let h = LadderHarness(mode: .walk, checkInInterval: 1800)
        let arrival = h.clock.now.addingTimeInterval(1800)
        await h.advance(600)
        h.controller.handle(h.assessment(.calm, kinds: [.unexpectedStop], explanation: "Stopped"))
        #expect(h.controller.level == .checkIn)
        h.controller.respondToCheckIn(okay: true)
        #expect(h.controller.nextCheckInAt == arrival)
        await h.advance(1200)
        #expect(h.controller.level == .checkIn)
        #expect(h.controller.checkInCause == .scheduled)
    }

    @Test func aDatesEndIsOneMoreCheckNotAReplacement() {
        let now = Date.now
        var date = SealedDateDetails(matchName: "Chris")
        date.expectedEnd = now.addingTimeInterval(7200)
        let session = GuardSession(mode: .date, startedAt: now, checkInInterval: 1800, sealedDate: date)
        #expect(session.nextCheckInAt == now.addingTimeInterval(1800))
        let late = now.addingTimeInterval(6000)
        #expect(session.nextCheckIn(after: late, arrival: nil) == date.expectedEnd)
    }

    // MARK: Toasts

    @Test func checkedInToastSaysWhatHappensNext() throws {
        let now = Date.now
        let night = AppToast.checkedIn(mode: .nightOut, next: now.addingTimeInterval(1200), now: now)
        #expect(night.title == "Checked in. Glad you're okay.")
        #expect(night.detail == "Next check-in in 20 minutes.")
        let at = now.addingTimeInterval(1200)
        #expect(AppToast.checkedIn(mode: .date, next: at, now: now).detail
                == "Next check-in at \(at.formatted(date: .omitted, time: .shortened)).")
        #expect(AppToast.checkedIn(mode: .walk, next: at, now: now).detail == "Guard stays on until you arrive.")
        #expect(AppToast.checkedIn(mode: .ride, next: at, now: now).detail == "Guard stays on until you arrive.")
    }

    @Test func checkInAnsweredFromANotificationStillShowsTheToast() async {
        let model = model()
        await model.startGuard(mode: .nightOut)
        model.services.escalation.scheduledCheckInDue()
        #expect(model.toast == nil)
        _ = SystemBridge.handle(SharedCommand(kind: .checkInOkay, source: .notification), escalation: model.services.escalation)
        #expect(model.toast?.title == "Checked in. Glad you're okay.")
        await model.endGuard()
    }

    @Test func aNewResponseToastsOnceAndOldOnesStayQuiet() {
        let model = model()
        let id = UUID()
        let old = AlertEvent(who: "Jordan", action: "on_my_way", at: .now)
        model.noteResponses(alertID: id, events: [old])
        #expect(model.toast == nil)
        let maya = AlertEvent(who: "Maya", action: "called_911", at: .now)
        model.noteResponses(alertID: id, events: [old, maya])
        #expect(model.toast?.title == "Maya called 911.")
        #expect(model.toast?.detail == "It's noted on your alert timeline.")
        model.toast = nil
        model.noteResponses(alertID: id, events: [old, maya])
        #expect(model.toast == nil)
        #expect(AppToast.response(who: "Maya Chen", action: "on_my_way").title == "Maya is on the way.")
    }

    // MARK: Alert presentation

    @Test func alertStartedAlwaysLeadsTheTimeline() {
        let t = Date.now
        let events = AlertPresentation.merge(
            [AlertEvent(who: "Maya Chen", action: "notified_by_call", at: t),
             AlertEvent(who: "SafetySense", action: "alert_started", at: t)],
            [AlertEvent(who: "SafetySense", action: "notified", at: t.addingTimeInterval(-1))])
        #expect(events.first?.action == "alert_started")
    }

    @Test func contactsCollapseToOneTimelineRow() {
        let t = Date.now
        let events = AlertPresentation.merge([
            AlertEvent(who: "SafetySense", action: "alert_started", at: t),
            AlertEvent(who: "Maya Chen", action: "notified_by_call", at: t),
            AlertEvent(who: "Maya Chen", action: "notified_by_sms", at: t),
            AlertEvent(who: "Jordan Lee", action: "notified_by_sms", at: t),
            AlertEvent(who: "SafetySense", action: "call_placed", at: t.addingTimeInterval(1)),
            AlertEvent(who: "SafetySense", action: "call_status", at: t.addingTimeInterval(2)),
            AlertEvent(who: "SafetySense", action: "dispatch_requested", at: t.addingTimeInterval(3)),
            AlertEvent(who: "SafetySense", action: "dispatch_requested", at: t.addingTimeInterval(9)),
            AlertEvent(who: "dispatch", action: "dispatcher calling you", at: t.addingTimeInterval(10)),
            AlertEvent(who: "Maya", action: "on_my_way", at: t.addingTimeInterval(11)),
        ], [])
        let rows = AlertPresentation.timeline(events, isTest: false).map(\.text)
        #expect(rows == ["Alert started", "Your contacts were called and texted", "Professional help requested",
                         "Monitoring center is calling you", "Maya is on the way"])
        #expect(AlertPresentation.timeline(events, isTest: true)[1].text.hasPrefix("Test alert"))
        let simulated = AlertEvent(who: "dispatch", action: "simulated_dispatcher calling you", at: t)
        #expect(simulated.displayText.hasPrefix("Simulated"))
    }

    @Test func aFullContactListStaysOnTwoRows() {
        let names = ["Maya Chen", "Jordan Lee", "Sam Rivera", "Ana Ruiz", "Lee Park"]
        var notified = names.map { NotifiedContact(name: $0, channel: .sms, status: "sent") }
        notified.append(NotifiedContact(name: "Maya Chen", channel: .call, status: "ringing"))
        let people = AlertPresentation.people(notified)
        #expect(people.count == 5)
        #expect(people[0].channels == "Call + text")
        let rows = AlertPresentation.countdownRows(people, events: [])
        #expect(rows.count == 2)
        #expect(rows[0].title == "Maya Chen")
        #expect(rows[0].status.text == "Calling…")
        #expect(rows[1].title == "Jordan, Sam & 2 more")
        #expect(rows[1].status.text == "Text sent")
    }

    @Test func aGroupWithAFailedTextSaysSo() {
        let people = AlertPresentation.people([
            NotifiedContact(name: "Maya Chen", channel: .call, status: "ringing"),
            NotifiedContact(name: "Jordan Lee", channel: .sms, status: "sent"),
            NotifiedContact(name: "Sam Rivera", channel: .sms, status: "failed:21608"),
        ])
        let rows = AlertPresentation.countdownRows(people, events: [])
        #expect(rows[1].title == "Jordan & Sam")
        #expect(rows[1].status.text == "Some didn't send")
    }

    @Test func whyLineUsesThePersonsOwnWords() {
        var alert = AlertRecord(level: .alert, trigger: .missedCheckIn, reason: "No answer to a check-in", policy: .contactsFirst)
        #expect(AlertPresentation.why(alert) == "No answer to your check-in")
        alert.reason = "Asked for help at a check-in"
        #expect(AlertPresentation.why(alert)?.contains("I need help") == true)
    }

    @Test func offlineFallbackIsADraftForEveryContact() throws {
        let url = try #require(ContactFallback.textURL(to: SampleData.contacts, from: SampleData.profile, location: .unmCampus))
        #expect(url.scheme == "sms")
        #expect(url.absoluteString.contains("addresses=+15055550111,+15055550122,+15055550133"))
        #expect(url.absoluteString.contains("body="))
        #expect(ContactFallback.textURL(to: [], from: nil, location: nil) == nil)
    }

    @Test func aHiddenDuressFailureNeverShowsUp() async {
        let model = model()
        #expect(model.alertConnectionNote == nil)
    }

    // MARK: Permissions

    @Test func onlyWhatTheSessionNeedsCounts() {
        var p = GuardPermissions()
        #expect(p.issues(listening: true).isEmpty)
        p.microphone = .denied
        #expect(p.issues(listening: true) == [.microphone])
        #expect(p.issues(listening: false).isEmpty)
        p.location = .denied
        p.notifications = .denied
        #expect(p.issues(listening: true) == [.microphone, .location, .notifications])
        var asked = GuardPermissions()
        asked.microphone = .notAsked
        asked.location = .notDetermined
        asked.notifications = .notAsked
        #expect(asked.issues(listening: true).isEmpty)
    }

    @Test func aDeniedMicShowsUpOnTheSession() async throws {
        let services = ServiceContainer.demo()
        let audio = try #require(services.audio as? MockAudioGuardService)
        audio.microphonePermission = .denied
        let model = model(services: services)
        await model.startGuard(mode: .nightOut)
        #expect(model.sessionPermissionIssues == [.microphone])
        await model.endGuard()
        #expect(model.sessionPermissionIssues.isEmpty)
    }

    // MARK: Modes

    @Test func homeModeFollowsAGuardAndSurvivesARelaunch() async {
        let store = SettingsStore.ephemeral()
        let first = AppModel(services: .demo(), store: store)
        #expect(first.homeMode == .nightOut)
        await first.startGuard(mode: .date)
        await first.endGuard()
        #expect(AppModel(services: .demo(), store: store).homeMode == .date)
    }

    @Test func settingsFromOlderBuildsStillDecode() throws {
        var older = try #require(try JSONSerialization.jsonObject(with: JSONEncoder().encode(AppSettings())) as? [String: Any])
        older.removeValue(forKey: "lastHomeMode")
        let data = try JSONSerialization.data(withJSONObject: older)
        #expect(try JSONDecoder().decode(AppSettings.self, from: data).lastHomeMode == nil)
    }

    @Test func sealedDetailsLeaveOutWhatWasntGiven() {
        let date = SealedDateDetails(matchName: "Chris")
        #expect(date.sealedSummary == "Date with: Chris")
        let ride = RideDetails(service: .uber, plate: "BXR 482")
        #expect(ride.sealedSummary == "Ride: Uber\nPlate: BXR 482")
    }

    @Test func arrivalChecksMatchTheSetupScreensAndThePrototype() {
        #expect(GuardMode.walk.defaultArrivalCheck == TimeInterval(1800))   // Frame 22: 1:50 to 2:20.
        #expect(GuardMode.ride.defaultArrivalCheck == TimeInterval(2100))   // Frames 25, 26: 1:50 to 2:25.
    }

    @Test func guardCopyMatchesEachMode() {
        #expect(GuardCopy.nextCheckInLabels(.nightOut).remaining == "Time left")
        #expect(GuardCopy.nextCheckInLabels(.date).title == "Next check-in")
        #expect(GuardCopy.nextCheckInLabels(.date).remaining == "In")
        #expect(GuardCopy.nextCheckInLabels(.ride).title == "Arrival check")
        #expect(GuardCopy.endTitle(.nightOut) == "End Guard")
        #expect(GuardCopy.endTitle(.date) == "End Date guard")
        #expect(GuardCopy.endTitle(.walk) == "I made it · End Guard")
        #expect(GuardCopy.endTitle(.ride) == "I've arrived · End Guard")
        #expect(GuardCopy.quietLine(.walk) == "Guarding quietly. No audio is being saved.")
        #expect(GuardCopy.quietLine(.nightOut) == "No audio is saved unless something seems wrong.")
        let ride = SampleData.rideDetails
        #expect(GuardCopy.rideTitle(ride) == "Silver Camry · BXR 482")
        #expect(GuardCopy.rideTitle(ride, includesService: true) == "Uber · Silver Camry · BXR 482")
        #expect(GuardCopy.rideDetail(ride) == "Driver: Daniel. Your people see this only if an alert fires.")
        #expect(GuardCopy.dateDetail(SampleData.dateDetails) == "Chris.\nOpened for your contacts only if an alert fires.")
        var withPhoto = SampleData.dateDetails
        withPhoto.photoFileName = "match.ssenc"
        #expect(GuardCopy.dateDetail(withPhoto).contains("Their photo stays encrypted on this phone."))
    }

    @Test func aWalkRemembersWhoIsFollowing() async {
        let model = model()
        await model.startGuard(mode: .walk, arrivalCheckAfter: 1800, follower: SampleData.contacts[0], sendHeadsUp: true)
        #expect(model.currentSession?.followerName == "Maya")
        #expect(model.currentSession?.followerNotified == nil)
        #expect(model.wantsHeadsUp)
        await model.endGuard()
        #expect(ContactMessage.headsUp(destination: "", eta: .now, delivery: .real).hasPrefix("Heading home,"))
        #expect(ContactMessage.headsUp(destination: "Coronado Hall", eta: .now, delivery: .real).hasPrefix("Heading to Coronado Hall,"))
    }

    @Test func vaultTitleReadsLikeThePrototype() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .current
        let alert = try #require(calendar.date(from: DateComponents(year: 2026, month: 11, day: 4, hour: 14, minute: 11)))
        let time = alert.formatted(date: .omitted, time: .shortened)
        #expect(VaultView.alertTitle(startedAt: alert, now: alert.addingTimeInterval(3600), calendar: calendar) == "Alert · today at \(time)")
        #expect(VaultView.alertTitle(startedAt: alert, now: alert.addingTimeInterval(3 * 86400), calendar: calendar) == "Alert · Nov 4 at \(time)")
    }

    @Test func pinSummaryAndOnboardingLabels() {
        #expect(PINSettingsView.summary(safety: true, duress: true) == "On")
        #expect(PINSettingsView.summary(safety: false, duress: false) == "Not set")
        #expect(PINSettingsView.summary(safety: true, duress: false) == "Safety only")
        #expect(PINSettingsView.summary(safety: false, duress: true) == "Duress only")
        #expect(OnboardingStep.contacts.label == "Step 4 of 9")
        #expect(OnboardingStep.promises.skipTarget == .contacts)
        #expect(OnboardingStep.triggers.skipTarget == nil)
    }

    @Test func cnmTitleIXListsTheExtensionFromCNMsPolicyPage() {
        #expect(SupportDirectory.cnmTitleIX.phone == "505-224-4000")
        #expect(SupportDirectory.cnmTitleIX.detail.contains("51240"))
    }
}
