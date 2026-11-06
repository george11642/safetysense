import Foundation
import Testing
import UserNotifications
@testable import SafetySense

@Suite("Check-in defaults")
struct CheckInDefaultsTests {
    @Test func nightOutAndDateRepeatEveryTwentyMinutes() {
        #expect(GuardMode.nightOut.defaultCheckInInterval == 20 * 60)
        #expect(GuardMode.date.defaultCheckInInterval == 20 * 60)
        #expect(GuardMode.repeatingCheckInModes == [.nightOut, .date])
    }

    @Test func walkAndRideDontRepeat() {
        #expect(GuardMode.walk.defaultCheckInInterval == 0)
        #expect(GuardMode.ride.defaultCheckInInterval == 0)
        #expect(GuardMode.walk.usesArrivalCheck && GuardMode.ride.usesArrivalCheck)
    }

    @Test func settingsOverrideStillWins() {
        var settings = AppSettings()
        #expect(!settings.hasCustomCheckIns)
        settings.checkInIntervalOverrides[.nightOut] = 3600
        #expect(settings.checkInInterval(for: .nightOut) == 3600)
        #expect(settings.hasCustomCheckIns)
    }

    @Test func overrideSavedForWalkByAnOlderBuildIsIgnored() {
        var settings = AppSettings()
        settings.checkInIntervalOverrides[.walk] = 600
        #expect(settings.checkInInterval(for: .walk) == 0)
        #expect(!settings.hasCustomCheckIns)
    }

    @Test func serverIntervalStaysInTheRangeItAccepts() {
        #expect(GuardSession(mode: .nightOut, checkInInterval: 90 * 60).serverCheckInInterval == 3600)
        #expect(GuardSession(mode: .everyday).serverCheckInInterval == 15)
        #expect(GuardSession(mode: .nightOut).serverCheckInInterval == 1200)
    }
}

@Suite("Alert delivery")
struct AlertDeliveryTests {
    @Test func resolves() {
        #expect(AlertDelivery.resolve(flavor: .live, allowRealCalls: false) == .test)
        #expect(AlertDelivery.resolve(flavor: .live, allowRealCalls: true) == .real)
        #expect(AlertDelivery.resolve(flavor: .demo, allowRealCalls: true) == .demo)
        #expect(AlertDelivery.resolve(flavor: .live, allowRealCalls: false, cleanScreenshots: true) == .real)
    }

    @Test func unitTestsAndDemoNeverLookReal() {
        #expect(AlertDelivery.current(flavor: .live) == .test)
        #expect(AlertDelivery.current(flavor: .demo) == .demo)
    }

    @Test func realAlertsKeepTheirWordsAndShowNoBanner() {
        let real = AlertDelivery.real
        #expect(real.bannerText == nil && real.liveActivityNote == nil)
        #expect(real.countdownHeadline == "Your people are being told")
        #expect(real.dispatchHeadline == "Help is on the way")
        #expect(real.statusLine(.dispatch) == EscalationLevel.dispatch.statusLine)
    }

    @Test func demoShowsNobodyAsReached() {
        let maya = NotifiedContact(name: "Maya", channel: .call, status: "ringing")
        #expect(AlertDelivery.demo.shown([maya]).map(\.status) == ["dry_run"])
        #expect(AlertDelivery.real.shown([maya]).map(\.status) == ["ringing"])
    }

    @Test(arguments: [AlertDelivery.test, .demo])
    func nothingPromisesHelpWhenNobodyIsContacted(delivery: AlertDelivery) throws {
        let banner = try #require(delivery.bannerText)
        #expect(banner.contains("911"))
        #expect(delivery.liveActivityNote != nil)
        let words = [
            delivery.countdownHeadline, delivery.reaching("Maya"), delivery.stillReaching("Maya"), delivery.dispatchPill,
            delivery.dispatchHeadline, delivery.dispatchDetail, delivery.reconnecting, delivery.mapLabel,
            delivery.sendHelpConfirmMessage, delivery.forgotPINHint, delivery.pinPrompt,
            delivery.statusLine(.alert), delivery.statusLine(.dispatch),
            delivery.alertTitle(.alert), delivery.alertTitle(.dispatch),
            delivery.alertBody(.alert), delivery.alertBody(.dispatch),
            delivery.spokenAlert(.alert) ?? "", delivery.spokenAlert(.dispatch) ?? "",
        ]
        for line in words {
            #expect(!line.contains("on the way"), "\(line)")
            #expect(!line.contains("are being told"), "\(line)")
            #expect(!line.contains("Calling and texting"), "\(line)")
            #expect(!line.contains("monitoring center"), "\(line)")
            #expect(!line.hasPrefix("Dispatch active"), "\(line)")
        }
        #expect(delivery.dispatchCallNote == nil)
    }
}

@Suite("Permissions summary")
@MainActor
struct PermissionsSummaryTests {
    @Test func summarizes() {
        #expect(GuardPermissions().summary == "On")
        #expect(GuardPermissions(notifications: .denied).summary == "1 off")
        #expect(GuardPermissions(microphone: .denied, location: .denied).summary == "2 off")
        #expect(GuardPermissions(location: .whenInUse).summary == "Review")
        #expect(GuardPermissions(notifications: .notAsked).summary == "Review")
    }

    @Test func focusPromiseFollowsTheRealSetting() {
        #expect(GuardPermissions(timeSensitive: true).notificationDetail.contains("Time-Sensitive is on"))
        #expect(GuardPermissions(timeSensitive: false).notificationDetail.contains("can hold check-ins back"))
    }

    @Test func deniedNotificationsSayWhatThatChanges() {
        #expect(GuardPermissions(notifications: .denied).notificationDetail.contains("still starts an alert"))
    }

    @Test func pinRowHasFourStates() {
        #expect(PINSettingsView.summary(safety: true, duress: true) == "On")
        #expect(PINSettingsView.summary(safety: true, duress: false) == "Safety only")
        #expect(PINSettingsView.summary(safety: false, duress: true) == "Duress only")
        #expect(PINSettingsView.summary(safety: false, duress: false) == "Not set")
    }
}

@Suite("Status notifications and sessions")
@MainActor
struct StatusNotificationTests {
    private func rig(active: Bool = false) -> (AppModel, NoopNotificationService) {
        let services = ServiceContainer.demo()
        let model = AppModel(services: services, store: .ephemeral())
        model.isAppActive = { active }
        return (model, services.notifications as! NoopNotificationService)
    }

    @Test func walkWithoutSetupStillGetsAnArrivalCheck() async {
        let (model, _) = rig(active: true)
        await model.startGuard(mode: .walk)
        #expect(model.currentSession?.checkInInterval == 900.0)
        #expect(model.currentSession?.nextCheckInAt != nil)
    }

    @Test func nightOutUsesTheTwentyMinuteDefault() async {
        let (model, _) = rig(active: true)
        await model.startGuard(mode: .nightOut)
        #expect(model.currentSession?.checkInInterval == 1200.0)
    }

    @Test func drinkChecksRunOnlyDuringNightOut() async {
        let (model, notifications) = rig(active: true)
        await model.startGuard(mode: .walk)
        #expect(!notifications.drinkChecksOn)
        await model.endGuard()
        await model.startGuard(mode: .nightOut)
        #expect(notifications.drinkChecksOn)
        await model.endGuard()
        #expect(!notifications.drinkChecksOn)
    }

    @Test func drinkChecksFollowTheToggle() async {
        let (model, notifications) = rig(active: true)
        model.settings.drinkCheckPrompts = false
        await model.startGuard(mode: .nightOut)
        #expect(!notifications.drinkChecksOn)
    }

    @Test func drinkCheckIsAQuietNudge() {
        let content = NotificationService.drinkCheckContent()
        #expect(content.sound == nil)
        #expect(content.interruptionLevel == .active)
        #expect(content.categoryIdentifier == NotificationService.Identifier.statusCategory)
    }

    private func event(_ action: String) -> AlertEvent { AlertEvent(who: "Maya Ortiz", action: action, at: .now) }

    @Test func contactResponseNotifiesOnlyWhenAway() {
        let id = UUID()
        let (away, awayNotes) = rig(active: false)
        away.noteResponses(alertID: id, events: [])
        away.noteResponses(alertID: id, events: [event("on_my_way")])
        #expect(awayNotes.notes == ["Maya is on the way."])

        let (open, openNotes) = rig(active: true)
        open.noteResponses(alertID: id, events: [])
        open.noteResponses(alertID: id, events: [event("called_911")])
        #expect(openNotes.notes.isEmpty)
        #expect(open.toast?.title == "Maya called 911.")
    }

    @Test func serverProblemNotifiesOncePerSession() async {
        let (model, notifications) = rig(active: false)
        model.heartbeatBecameFailing()
        #expect(notifications.notes.isEmpty)     // No session, nothing to say.
        await model.startGuard(mode: .nightOut)
        model.heartbeatBecameFailing()
        model.heartbeatBecameFailing()
        #expect(notifications.notes.filter { $0.contains("server") }.count == 1)
    }
}
