import Foundation
import Testing
@testable import SafetySense

@Suite("Core")
@MainActor
struct CoreTests {
    @Test func launchOptionsParse() {
        let o = LaunchOptions(arguments: ["app", "-ssScreen", "checkin", "-ssDemo", "1", "-ssSkipOnboarding", "YES"])
        #expect(o.screen == .checkIn)
        #expect(o.demo)
        #expect(o.skipOnboarding)
        #expect(LaunchOptions(arguments: ["app"]) == LaunchOptions())
        #expect(AppScreen(argument: "AlertActive") == .alertActive)
    }

    @Test func pinVerificationPrefersDuress() {
        let store = SettingsStore.ephemeral()
        store.setSafetyPIN("1234")
        store.setDuressPIN("4321")
        #expect(store.verifyPIN("1234") == .valid)
        #expect(store.verifyPIN("4321") == .duress)
        #expect(store.verifyPIN("0000") == .invalid)
    }

    @Test func storePersistsProfileAndContacts() {
        let store = SettingsStore.ephemeral()
        store.profile = SampleData.profile
        store.contacts = SampleData.contacts
        store.onboardingComplete = true
        #expect(store.profile == SampleData.profile)
        #expect(store.contacts.count == 3)
        store.eraseAll()
        #expect(store.profile == nil)
        #expect(!store.onboardingComplete)
    }

    @Test func manualSOSGoesStraightToDispatchByDefault() async throws {
        let model = AppModel(services: .demo(), store: .ephemeral())
        await model.startGuard(mode: .nightOut)
        #expect(model.overlay == .guardActive)
        model.triggerSOS()
        #expect(model.escalationLevel == .dispatch)
        #expect(model.overlay == .alertActive)
        await model.endGuard()
        #expect(model.overlay == .none)
    }

    @Test func riskSignalsLeadToCheckInThenAlert() async {
        let services = ServiceContainer.demo()
        let model = AppModel(services: services, store: .ephemeral())
        await model.startGuard(mode: .nightOut)
        let audio = try! #require(services.audio as? MockAudioGuardService)
        audio.simulate(.shout, weight: 1.2)
        #expect(model.escalationLevel == .checkIn)
        audio.simulate(.scream, weight: 1.5)
        #expect(model.escalationLevel == .alert)
        #expect(model.currentAlert?.trigger == .riskEngine)
    }

    @Test func duressCancelLooksLikeCancel() async {
        let store = SettingsStore.ephemeral()
        store.setSafetyPIN("1111")
        store.setDuressPIN("9999")
        let model = AppModel(services: .demo(), store: store)
        await model.startGuard(mode: .date)
        model.services.escalation.triggerManual(.riskEngine, reason: "test")
        #expect(model.escalationLevel == .alert)
        let result = await model.cancelAlert(pin: "9999")
        #expect(result == .duress)
        #expect(model.escalationLevel == .guarding)
        #expect(model.currentAlert == nil)
    }

    @Test func sharedCommandQueueDrains() {
        _ = SharedCommandQueue.drain()
        SharedCommandQueue.enqueue(SharedCommand(kind: .checkInOkay, source: .liveActivity))
        SharedCommandQueue.enqueue(SharedCommand(kind: .triggerAlert, source: .actionButton))
        let drained = SharedCommandQueue.drain()
        #expect(drained.map(\.kind) == [.checkInOkay, .triggerAlert])
        #expect(SharedCommandQueue.drain().isEmpty)
    }
}
