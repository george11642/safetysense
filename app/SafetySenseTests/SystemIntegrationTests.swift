import Foundation
import Testing
import UserNotifications
@testable import SafetySense

@Suite("Shared store")
struct SharedStoreTests {
    private func memoryStore() -> SharedStore { SharedStore(backend: InMemorySharedBackend()) }

    @Test func valuesRoundTrip() {
        let store = memoryStore()
        #expect(store.bool(forKey: "b") == false)
        store.set(true, forKey: "b")
        #expect(store.bool(forKey: "b"))
        store.set(false, forKey: "b")
        #expect(store.bool(forKey: "b") == false)
        #expect(store.int(forKey: "i") == nil)
        store.set(3, forKey: "i")
        #expect(store.int(forKey: "i") == 3)
    }

    @Test func queueDrainsOldestFirstAndEmpties() {
        let store = memoryStore()
        let now = Date.now
        SharedCommandQueue.enqueue(SharedCommand(kind: .checkInOkay, source: .liveActivity, createdAt: now), store: store)
        SharedCommandQueue.enqueue(SharedCommand(kind: .triggerAlert, source: .controlCenter, createdAt: now.addingTimeInterval(-5)),
                                   store: store)
        #expect(SharedCommandQueue.drain(store: store).map(\.kind) == [.triggerAlert, .checkInOkay])
        #expect(SharedCommandQueue.drain(store: store).isEmpty)
    }

    /// Each command is its own item, so no enqueue can overwrite another.
    @Test func concurrentEnqueuesAreNeverLost() async {
        let store = memoryStore()
        await withTaskGroup(of: Void.self) { group in
            for _ in 0..<200 {
                group.addTask { SharedCommandQueue.enqueue(SharedCommand(kind: .triggerAlert, source: .shortcut), store: store) }
            }
        }
        #expect(SharedCommandQueue.drain(store: store).count == 200)
    }

    @Test func legacyQueueMovesOnce() throws {
        let name = "ss.test.legacy.\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: name))
        defer { defaults.removePersistentDomain(forName: name) }
        let old = [SharedCommand(kind: .triggerAlert, source: .controlCenter)]
        defaults.set(try JSONEncoder().encode(old), forKey: AppGroup.Keys.pendingCommands)
        let store = memoryStore()
        SharedCommandQueue.migrateLegacyQueue(from: defaults, store: store)
        SharedCommandQueue.migrateLegacyQueue(from: defaults, store: store)
        #expect(SharedCommandQueue.drain(store: store) == old)
    }

    @Test func adoptMovesItemsWithoutOverwriting() {
        let older = InMemorySharedBackend()
        let store = memoryStore()
        older.set(Data([1]), forKey: "ss.cmd.a")
        older.set(Data([1]), forKey: "mirror")
        store.set(Data([2]), forKey: "mirror")
        store.adopt(from: older, keys: ["mirror"], prefixes: ["ss.cmd."])
        #expect(store.data(forKey: "ss.cmd.a") == Data([1]))
        #expect(store.data(forKey: "mirror") == Data([2]))
        #expect(older.keys(withPrefix: "").isEmpty)
    }

    @Test func eraseAllRemovesQueueAndMirrors() {
        let store = memoryStore()
        store.set(true, forKey: AppGroup.Keys.widgetGuardActive)
        SharedCommandQueue.enqueue(SharedCommand(kind: .startGuard, source: .siri), store: store)
        store.eraseAll()
        #expect(store.keys(withPrefix: "").isEmpty)
    }

    /// The real Keychain item path, in the test host's own entitlements.
    @Test func keychainBackendRoundTrips() throws {
        let backend = KeychainSharedBackend(service: "com.georgeteifel.SafetySense.tests.\(UUID().uuidString)")
        try #require(backend.isUsable)
        let store = SharedStore(backend: backend)
        store.set(Data([1]), forKey: "ss.cmd.a")
        store.set(Data([2]), forKey: "ss.cmd.a")
        store.set(Data([3]), forKey: "ss.cmd.b")
        #expect(store.data(forKey: "ss.cmd.a") == Data([2]))
        #expect(store.keys(withPrefix: "ss.cmd.").sorted() == ["ss.cmd.a", "ss.cmd.b"])
        store.set(nil, forKey: "ss.cmd.a")
        store.set(nil, forKey: "ss.cmd.b")
        #expect(store.keys(withPrefix: "ss.cmd.").isEmpty)
    }

    @Test func staleCommandsExpire() {
        let now = Date.now
        #expect(SharedCommand(kind: .triggerAlert, source: .controlCenter, createdAt: now.addingTimeInterval(-600)).isFresh(at: now))
        #expect(!SharedCommand(kind: .triggerAlert, source: .controlCenter, createdAt: now.addingTimeInterval(-3600)).isFresh(at: now))
        #expect(!SharedCommand(kind: .checkInOkay, source: .liveActivity, createdAt: now.addingTimeInterval(-300)).isFresh(at: now))
    }

    /// The first group is the default for every SecItemAdd: it has to be the app's private one,
    /// and the widget must not be able to read it. Both entitlement files are checked because
    /// Release signs with the TestFlight ones.
    @Test(arguments: ["SafetySense.entitlements", "TestFlight.entitlements"])
    func appEntitlementsKeepSecretsOutOfTheSharedGroup(file: String) throws {
        let groups = try keychainGroups(folder: "SafetySense", file: file)
        #expect(groups == ["$(AppIdentifierPrefix)com.georgeteifel.SafetySense",
                           "$(AppIdentifierPrefix)com.georgeteifel.SafetySense.shared"])
    }

    @Test(arguments: ["SafetySenseWidgets.entitlements", "TestFlight.entitlements"])
    func widgetOnlySeesTheSharedGroup(file: String) throws {
        let groups = try keychainGroups(folder: "SafetySenseWidgets", file: file)
        #expect(groups == ["$(AppIdentifierPrefix)com.georgeteifel.SafetySense.shared"])
    }

    private func keychainGroups(folder: String, file: String) throws -> [String] {
        let url = URL(filePath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
            .appending(path: "\(folder)/\(file)")
        let plist = try PropertyListSerialization.propertyList(from: Data(contentsOf: url), format: nil)
        return (plist as? [String: Any])?["keychain-access-groups"] as? [String] ?? []
    }
}

@Suite("Storage migration")
struct StorageMigrationTests {
    private func suite() throws -> (UserDefaults, String) {
        let name = "ss.test.migrate.\(UUID().uuidString)"
        return (try #require(UserDefaults(suiteName: name)), name)
    }

    private func legacyPlist(_ values: [String: Any]) throws -> URL {
        let url = FileManager.default.temporaryDirectory.appending(path: "\(UUID().uuidString).plist")
        try PropertyListSerialization.data(fromPropertyList: values, format: .binary, options: 0).write(to: url)
        return url
    }

    @Test func legacySuiteMovesAndIsRemoved() throws {
        let (destination, name) = try suite()
        defer { destination.removePersistentDomain(forName: name) }
        let url = try legacyPlist([AppGroup.Keys.onboardingComplete: true, AppGroup.Keys.profile: Data([7])])
        StorageMigration.migrate(keys: AppGroup.Keys.appLocal, legacySuite: url, standard: nil, into: destination)
        #expect(destination.bool(forKey: AppGroup.Keys.onboardingComplete))
        #expect(destination.data(forKey: AppGroup.Keys.profile) == Data([7]))
        #expect(!FileManager.default.fileExists(atPath: url.path()))
    }

    @Test func newerValuesAreNeverOverwritten() throws {
        let (destination, name) = try suite()
        defer { destination.removePersistentDomain(forName: name) }
        destination.set(Data([1]), forKey: AppGroup.Keys.contacts)
        let url = try legacyPlist([AppGroup.Keys.contacts: Data([9])])
        StorageMigration.migrate(keys: AppGroup.Keys.appLocal, legacySuite: url, standard: nil, into: destination)
        #expect(destination.data(forKey: AppGroup.Keys.contacts) == Data([1]))
    }

    /// The day the App Group is enabled: nobody goes back to onboarding.
    @Test func standardMovesIntoTheGroup() throws {
        let (destination, name) = try suite()
        let (standard, otherName) = try suite()
        defer {
            destination.removePersistentDomain(forName: name)
            standard.removePersistentDomain(forName: otherName)
        }
        standard.set(true, forKey: AppGroup.Keys.onboardingComplete)
        StorageMigration.migrate(keys: AppGroup.Keys.appLocal, legacySuite: URL(filePath: "/nonexistent"),
                                 standard: standard, into: destination)
        #expect(destination.bool(forKey: AppGroup.Keys.onboardingComplete))
        #expect(standard.object(forKey: AppGroup.Keys.onboardingComplete) == nil)
    }

    @Test func contactsStayOutOfTheSharedStore() {
        #expect(AppGroup.Keys.appLocal.contains(AppGroup.Keys.contacts))
        #expect(AppGroup.Keys.appLocal.contains(AppGroup.Keys.profile))
        #expect(!AppGroup.Keys.contacts.hasPrefix(SharedCommandQueue.itemPrefix))
    }
}

@Suite("Release safety")
struct ReleaseSafetyTests {
    @Test func releaseNeverAllowsRealCalls() {
        #expect(!BackendRuntimeOptions.resolveAllowRealCalls(stored: true, arguments: ["-ssAllowRealCalls", "1"],
                                                             isTesting: false, isReleaseBuild: true))
    }

    @Test func testsNeverAllowRealCalls() {
        #expect(!BackendRuntimeOptions.resolveAllowRealCalls(stored: true, arguments: [], isTesting: true, isReleaseBuild: false))
    }

    @Test func debugFollowsTheSwitchAndArgument() {
        #expect(BackendRuntimeOptions.resolveAllowRealCalls(stored: true, arguments: [], isTesting: false, isReleaseBuild: false))
        #expect(!BackendRuntimeOptions.resolveAllowRealCalls(stored: true, arguments: ["-ssAllowRealCalls", "0"],
                                                             isTesting: false, isReleaseBuild: false))
    }
}

@Suite("Deep links")
struct DeepLinkTests {
    @Test func parsesEveryRoute() throws {
        for link in DeepLink.allCases { #expect(DeepLink(url: link.url) == link) }
        #expect(DeepLink(url: try #require(URL(string: "SAFETYSENSE://Vault"))) == .vault)
    }

    @Test func rejectsEverythingElse() throws {
        #expect(DeepLink(url: try #require(URL(string: "https://checkin"))) == nil)
        #expect(DeepLink(url: try #require(URL(string: "safetysense://sos"))) == nil)
    }

    @Test func liveActivityRoutesFollowTheLevel() {
        #expect(DeepLink.forLevel(0) == .home)
        #expect(DeepLink.forLevel(1) == .checkIn)
        #expect(DeepLink.forLevel(2) == .alert)
        #expect(DeepLink.forLevel(3) == .alert)
    }
}

@Suite("Live status")
struct LiveStatusTests {
    private func alert(_ events: [AlertEvent]) -> AlertRecord {
        AlertRecord(level: .dispatch, trigger: .manualSOS, reason: "SOS", policy: .dispatchImmediately,
                    status: .dispatched, startedAt: .now, levelChangedAt: .now, events: events)
    }

    @Test func aConfirmedResponseWins() {
        let now = Date.now
        let record = alert([AlertEvent(who: "Jordan Lee", action: "called_911", at: now.addingTimeInterval(-30)),
                            AlertEvent(who: "Maya", action: "on_my_way", at: now)])
        #expect(LiveStatusLine.text(level: .dispatch, alert: record, ladderStatus: "Help is on the way.", listening: nil)
            == "Maya is on the way.")
    }

    @Test func fullNamesAreShortened() {
        #expect(LiveStatusLine.latestResponse(in: [AlertEvent(who: "Jordan Lee", action: "called_911", at: .now)])
            == "Jordan called 911.")
    }

    @Test func noResponseKeepsTheLadderLine() {
        #expect(LiveStatusLine.text(level: .alert, alert: alert([]), ladderStatus: "Told", listening: .paused) == "Told")
    }

    @Test func pausedListeningShowsWhileGuarding() {
        #expect(LiveStatusLine.text(level: .guarding, alert: nil, ladderStatus: "Quiet", listening: .paused)
            == "Listening paused. Open SafetySense to resume.")
    }
}

@Suite("Evidence gate")
struct EvidenceGateTests {
    @Test func holdsChunksUntilOpenThenPassesThrough() {
        var gate = EvidenceChunkGate()
        #expect(gate.receive(Data([1]), sequence: 0) == nil)
        #expect(gate.receive(Data([2]), sequence: 1) == nil)
        #expect(gate.open().map(\.sequence) == [0, 1])
        #expect(gate.receive(Data([3]), sequence: 2)?.sequence == 2)
    }
}

@Suite("Notification urgency")
@MainActor
struct NotificationUrgencyTests {
    @Test func degradesWithoutTheCapability() {
        #expect(NotificationUrgency.level(for: .notSupported) == .active)
        #expect(NotificationUrgency.level(for: .enabled) == .timeSensitive)
        #expect(NotificationUrgency.level(for: .disabled) == .active)
    }
}

@Suite("Session destinations")
struct SessionDestinationTests {
    @Test func walkAndRideUseArrivalChecks() {
        #expect(GuardSession(mode: .walk).usesArrivalCheck)
        #expect(GuardSession(mode: .ride).usesArrivalCheck)
        #expect(!GuardSession(mode: .nightOut).usesArrivalCheck)
    }

    @Test func rideDestinationIsUsed() {
        let ride = RideDetails(destinationLatitude: 35, destinationLongitude: -106)
        #expect(GuardSession(mode: .ride, ride: ride).destinationFix?.latitude == 35)
    }

    @Test func sessionsSavedBeforeDestinationsStillDecode() throws {
        var json = try #require(JSONSerialization.jsonObject(with: JSONEncoder().encode(GuardSession(mode: .date))) as? [String: Any])
        json.removeValue(forKey: "destinationName")
        let data = try JSONSerialization.data(withJSONObject: json)
        #expect(try JSONDecoder().decode(GuardSession.self, from: data).destinationFix == nil)
    }

    @Test func siriCantStartEveryday() {
        #expect(!GuardModeOption.allCases.map(\.mode).contains(.everyday))
        #expect(GuardModeOption.allCases.count == GuardMode.guardModes.count)
    }

    @Test func actionButtonReasonIsHumane() {
        #expect(SharedCommand(kind: .triggerAlert, source: .actionButton).alertReason == "Pressed the Action Button")
    }
}

/// AppModel's system wiring, on all-mock services.
@MainActor
@Suite("System wiring")
struct SystemWiringTests {
    private func rig() -> (AppModel, ServiceContainer) {
        let services = ServiceContainer.demo(sampleEvidence: false)
        return (AppModel(services: services, store: .ephemeral()), services)
    }

    private func settle(_ condition: () -> Bool) async {
        for _ in 0..<200 where !condition() { try? await Task.sleep(for: .milliseconds(5)) }
    }

    @Test func arrivalCheckDrivesEveryClock() async {
        let (model, services) = rig()
        let destination = GuardDestination(name: "Dorm", fix: LocationFix(latitude: 35, longitude: -106, accuracy: 10))
        await model.startGuard(mode: .walk, destination: destination, arrivalCheckAfter: 32 * 60)
        let session = model.currentSession
        #expect(session?.checkInInterval == 1920.0)
        #expect(session?.destinationName == "Dorm")
        let scheduled = (services.notifications as? NoopNotificationService)?.scheduled.first
        #expect(scheduled == session?.nextCheckInAt)
        #expect((services.location as? MockLocationService)?.startedDestination?.latitude == 35)
        await model.endGuard()
    }

    @Test func arrivingPromptsButKeepsTheCheck() async {
        let (model, services) = rig()
        await model.startGuard(mode: .walk, arrivalCheckAfter: 600)
        services.location.onArrival?()
        services.location.onArrival?()
        #expect(model.hasArrived)
        #expect(model.currentSession?.nextCheckInAt != nil)
        #expect((services.notifications as? NoopNotificationService)?.notes == ["Looks like you're there"])
        await model.endGuard()
        #expect(!model.hasArrived)
    }

    @Test func pausedListeningNotifiesOnce() async {
        let (model, services) = rig()
        await model.startGuard(mode: .nightOut)
        #expect(model.listening == .listening)
        let audio = services.audio as? MockAudioGuardService
        audio?.simulate(listening: .paused)
        audio?.simulate(listening: .paused)
        #expect(model.listening == .paused)
        #expect((services.notifications as? NoopNotificationService)?.notes == ["Listening paused"])
        let activity = services.liveActivity as? NoopLiveActivityController
        await settle { activity?.lastStatus?.hasPrefix("Listening paused") == true }
        #expect(activity?.lastStatus == "Listening paused. Open SafetySense to resume.")
        audio?.simulate(listening: .listening)
        #expect(model.listening == .listening)
        await model.endGuard()
    }

    @Test func listeningOffStaysNil() async {
        let (model, services) = rig()
        model.settings.listensDuringRide = false
        await model.startGuard(mode: .ride)
        (services.audio as? MockAudioGuardService)?.simulate(listening: .listening)
        #expect(model.listening == nil)
        await model.endGuard()
    }

    @Test func foregroundResumesListeningAndTheActivity() async {
        let (model, services) = rig()
        model.appBecameActive()
        #expect((services.audio as? MockAudioGuardService)?.resumeCount == 1)
        let activity = services.liveActivity as? NoopLiveActivityController
        await settle { activity?.refreshes == 1 }
        #expect(activity?.refreshes == 1)
    }

    @Test func anAlertOutsideASessionStartsLocationAndTheLiveActivity() async {
        let (model, services) = rig()
        model.triggerSOS(.actionButton, reason: "Pressed the Action Button")
        #expect((services.location as? MockLocationService)?.isTrackingAlert == true)
        let activity = services.liveActivity as? NoopLiveActivityController
        await settle { activity?.alertStarts == 1 }
        #expect(activity?.alertStarts == 1)
        await services.escalation.cancel(with: .valid)
        #expect((services.location as? MockLocationService)?.isTrackingAlert == false)
        await settle { activity?.isActive == false }
        #expect(activity?.isActive == false)
    }

    @Test func linksNeverStartACheckInEarly() async {
        let (model, services) = rig()
        await model.onLaunch()
        await model.startGuard(mode: .walk, arrivalCheckAfter: 600)
        model.open(.checkIn)
        #expect(services.escalation.level == .guarding)
        model.open(.alert)
        #expect(services.escalation.activeAlert == nil)
        model.currentSession?.nextCheckInAt = .now.addingTimeInterval(-5)
        model.open(.checkIn)
        #expect(services.escalation.level == .checkIn)
        await model.endGuard()
    }

    @Test func linksWaitForLaunch() async {
        let (model, _) = rig()
        model.open(.vault)
        #expect(model.selectedTab == .home)
        await model.onLaunch()
        #expect(model.selectedTab == .vault)
    }
}
