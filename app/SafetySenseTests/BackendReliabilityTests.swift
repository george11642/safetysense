import Foundation
import Testing
@testable import SafetySense

@Suite("Backend outbox")
struct BackendOutboxTests {
    private let now = Date(timeIntervalSince1970: 1_800_000_000)

    private func entries(_ items: BackendOutbox.Item...) -> [BackendOutbox.Entry] {
        items.reduce([]) { BackendOutbox.merging($1, into: $0, now: now) }
    }

    private func fix(_ alert: String) -> BackendOutbox.Item {
        .location(AlertLocationRequest(alertId: alert, lat: 35, lng: -106, accuracy: 5, battery: 0.5))
    }

    @Test func aSessionEndClearsThatSessionsHeartbeats() {
        let merged = entries(.heartbeat(HeartbeatRequest(sessionId: "a")), .heartbeat(HeartbeatRequest(sessionId: "b")),
                             .sessionEnd(SessionEndRequest(sessionId: "a")), .sessionEnd(SessionEndRequest(sessionId: "a")))
        #expect(merged.map(\.item) == [.heartbeat(HeartbeatRequest(sessionId: "b")), .sessionEnd(SessionEndRequest(sessionId: "a"))])
    }

    @Test func aValidCancelDropsTheTrailButADuressCancelKeepsIt() {
        let safe = entries(fix("a"), fix("b"), .alertCancel(AlertCancelRequest(alertId: "a", duress: false)))
        #expect(safe.map(\.item) == [fix("b"), .alertCancel(AlertCancelRequest(alertId: "a", duress: false))])
        let duress = entries(fix("a"), .alertCancel(AlertCancelRequest(alertId: "a", duress: true)))
        #expect(duress.count == 2)
    }

    @Test func closingWorkOutlivesTelemetry() throws {
        let suite = "ss.outbox.\(UUID().uuidString)"
        let outbox = BackendOutbox(key: "outbox", suiteName: suite)
        defer { UserDefaults.standard.removePersistentDomain(forName: suite) }
        outbox.enqueue(fix("a"), now: now)
        outbox.enqueue(.sessionEnd(SessionEndRequest(sessionId: "s")), now: now)
        let later = now.addingTimeInterval(BackendOutbox.maxAge + 60)
        #expect(outbox.load(now: later).map(\.item) == [.sessionEnd(SessionEndRequest(sessionId: "s"))])
        #expect(outbox.load(now: now.addingTimeInterval(BackendOutbox.durableMaxAge + 60)).isEmpty)
    }

    @Test func durableRetryBacksOffToTwoMinutes() {
        #expect(HTTPBackendClient.durableRetryDelay(attempt: 1) == 15)
        #expect(HTTPBackendClient.durableRetryDelay(attempt: 2) == 30)
        #expect(HTTPBackendClient.durableRetryDelay(attempt: 9) == 120)
    }
}

@Suite("Backend errors")
struct BackendErrorTests {
    @Test func classifiesWhatCouldHaveLanded() {
        #expect(BackendError.transport("offline").neverReachedServer)
        #expect(BackendError.notRegistered.neverReachedServer)
        #expect(!BackendError.transport("timed out").neverReachedServer)
        #expect(!BackendError.http(status: 500, message: "x").neverReachedServer)
    }

    @Test func onlyRealRefusalsArePermanent() {
        #expect(BackendError.http(status: 400, message: "x").isPermanentRejection)
        #expect(BackendError.http(status: 409, message: "x").isPermanentRejection)
        #expect(!BackendError.http(status: 401, message: "x").isPermanentRejection)
        #expect(!BackendError.http(status: 429, message: "x").isPermanentRejection)
        #expect(!BackendError.http(status: 503, message: "x").isPermanentRejection)
    }

    @Test func oldHeartbeatResponsesStillDecode() throws {
        let data = Data(#"{"ok":true,"server_time":"2026-11-04T23:00:00Z"}"#.utf8)
        #expect(try BackendCoding.makeDecoder().decode(HeartbeatResponse.self, from: data).alert == nil)
    }

    @Test func heartbeatCarriesTheLiveAlert() throws {
        let data = Data(#"{"ok":true,"server_time":"t","alert":{"id":"a","level":2,"share_url":"https://x/a","trigger":"heartbeat_lost"}}"#.utf8)
        let alert = try #require(try BackendCoding.makeDecoder().decode(HeartbeatResponse.self, from: data).alert)
        #expect(alert.shareUrl == "https://x/a")
        #expect(alert.trigger == "heartbeat_lost")
    }

    @Test func clientAlertIDGoesOutInSnakeCase() throws {
        let request = AlertCreateRequest(level: 2, reason: "r", trigger: "manual_sos", dispatchPolicy: "contacts_first",
                                         clientAlertId: "abc")
        let json = try #require(String(data: BackendCoding.makeEncoder().encode(request), encoding: .utf8))
        #expect(json.contains(#""client_alert_id":"abc""#))
    }
}

@Suite("Alert reasons")
struct AlertReasonTests {
    @Test func composesCauseAndMode() {
        #expect(AlertReasonText.contact(AlertReasonText.missedCheckIn, mode: .nightOut) == "Missed check-in during Night Out")
        #expect(AlertReasonText.contact(AlertReasonText.askedForHelp, mode: .walk) == "Tapped \u{201C}I need help\u{201D} during Walk Home")
        #expect(AlertReasonText.contact("SOS", mode: .everyday) == "SOS")
    }

    @Test func saysWhoGetsACall() {
        let maya = TrustedContact(name: "Maya Chen", phone: "+15055550111", isPrimary: true)
        let jordan = TrustedContact(name: "Jordan Lee", phone: "+15055550112")
        let sam = TrustedContact(name: "Sam Ortiz", phone: "+15055550113")
        #expect(AlertPresentation.whoHears([maya], delivery: .real) == "Maya gets a call and your live location.")
        #expect(AlertPresentation.whoHears([jordan, maya, sam], delivery: .real) == "Maya gets a call and your live location. Jordan and Sam get it by text.")
    }

    @Test func staysInsideTheServersLimit() {
        let long = String(repeating: "x", count: 300)
        let text = AlertReasonText.contact(long, mode: .nightOut)
        #expect(text.count == AlertReasonText.maxLength)
        #expect(text.hasSuffix(" during Night Out"))
    }
}

@Suite("Session details")
@MainActor
struct SessionDetailsTests {
    @Test func walkRouteIsSealedForTheLiveLink() throws {
        var session = GuardSession(mode: .walk, checkInInterval: 900)
        session.destinationName = "Coronado Hall"
        session.followerName = "Maya"
        let summary = try #require(session.sealedDetailsString)
        #expect(summary.contains("Walking to: Coronado Hall"))
        #expect(summary.contains("Expected by: "))
        #expect(summary.contains("Following along: Maya"))
    }

    @Test func nightOutSealsNothing() {
        #expect(GuardSession(mode: .nightOut).sealedDetailsString == nil)
    }

    @Test func rideAndDateCarryTheirTimes() {
        let time = Date(timeIntervalSince1970: 1_800_000_000)
        #expect(RideDetails(plate: "ABC", expectedArrival: time).sealedSummary.contains("Expected by: "))
        #expect(SealedDateDetails(matchName: "Sam", expectedEnd: time).sealedSummary.contains("Expected to end: "))
    }

    @Test func anArrivalCheckSurvivesAResume() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        var session = GuardSession(mode: .walk, startedAt: now, checkInInterval: 1800)
        let arrival = now.addingTimeInterval(600)
        session.nextCheckInAt = arrival
        #expect(session.resumedCheckIn(now: now) == arrival)
    }

    @Test func aMissedArrivalCheckComesUpSoonNotAWalkFromNow() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        var session = GuardSession(mode: .walk, startedAt: now, checkInInterval: 1800)
        session.nextCheckInAt = now.addingTimeInterval(-5)
        #expect(session.resumedCheckIn(now: now) == now.addingTimeInterval(60))
    }

    @Test func aMissedRepeatingCheckInPicksUpTheRhythm() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        var session = GuardSession(mode: .nightOut, startedAt: now, checkInInterval: 1200)
        session.nextCheckInAt = now.addingTimeInterval(-5)
        #expect(session.resumedCheckIn(now: now) == now.addingTimeInterval(1200))
    }

    private func isolatedStore() -> (SettingsStore, UserDefaults, any SecretStore) {
        let name = "ss.test.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: name)!
        let secrets = InMemorySecretStore()
        return (SettingsStore(defaults: defaults, secrets: secrets, shared: SharedStore(backend: InMemorySharedBackend())), defaults, secrets)
    }

    private func sealedSession() -> GuardSession {
        var session = GuardSession(mode: .date, sealedDate: SealedDateDetails(matchName: "Jordan Secret", venueName: "Frontier"))
        session.destinationName = "Hidden Place"
        return session
    }

    @Test func sealedDetailsNeverReachDefaults() throws {
        let (store, defaults, secrets) = isolatedStore()
        store.currentSession = sealedSession()
        let plist = String(decoding: try #require(defaults.data(forKey: AppGroup.Keys.currentSession)), as: UTF8.self)
        #expect(!plist.contains("Jordan Secret"))
        #expect(!plist.contains("Hidden Place"))
        #expect(secrets.data(for: AppGroup.KeychainAccounts.sessionDetails) != nil)
        #expect(store.currentSession?.sealedDate?.matchName == "Jordan Secret")
        #expect(store.currentSession?.destinationName == "Hidden Place")
    }

    @Test func endingASessionRemovesItsDetails() {
        let (store, _, secrets) = isolatedStore()
        store.currentSession = sealedSession()
        store.currentSession = nil
        #expect(secrets.data(for: AppGroup.KeychainAccounts.sessionDetails) == nil)
    }

    @Test func detailsSavedByAnOlderBuildMoveOut() throws {
        let (store, defaults, secrets) = isolatedStore()
        defaults.set(try JSONEncoder().encode(sealedSession()), forKey: AppGroup.Keys.currentSession)
        #expect(store.currentSession?.sealedDate?.matchName == "Jordan Secret")
        let plist = String(decoding: try #require(defaults.data(forKey: AppGroup.Keys.currentSession)), as: UTF8.self)
        #expect(!plist.contains("Jordan Secret"))
        #expect(secrets.data(for: AppGroup.KeychainAccounts.sessionDetails) != nil)
    }
}

@Suite("Fresh install")
@MainActor
struct FreshInstallTests {
    private func marker() -> URL {
        FileManager.default.temporaryDirectory.appending(path: "ss-marker-\(UUID().uuidString)")
    }

    private func defaults() -> UserDefaults { UserDefaults(suiteName: "ss.test.\(UUID().uuidString)")! }

    @Test func aReinstallDoesntInheritTheOldAccount() {
        let secrets = InMemorySecretStore()
        secrets.set(Data([1]), for: AppGroup.KeychainAccounts.deviceCredentials)
        secrets.set(Data([2]), for: AppGroup.KeychainAccounts.safetyPINHash)
        let file = marker()
        FreshInstall.run(defaults: defaults(), secrets: secrets, shared: SharedStore(backend: InMemorySharedBackend()), marker: file)
        #expect(secrets.data(for: AppGroup.KeychainAccounts.deviceCredentials) == nil)
        #expect(secrets.data(for: AppGroup.KeychainAccounts.safetyPINHash) == nil)
        #expect(FileManager.default.fileExists(atPath: file.path))
    }

    @Test func anUpdateKeepsEverything() {
        let secrets = InMemorySecretStore()
        secrets.set(Data([1]), for: AppGroup.KeychainAccounts.deviceCredentials)
        let d = defaults()
        d.set(true, forKey: AppGroup.Keys.onboardingComplete)
        FreshInstall.run(defaults: d, secrets: secrets, shared: SharedStore(backend: InMemorySharedBackend()), marker: marker())
        #expect(secrets.data(for: AppGroup.KeychainAccounts.deviceCredentials) != nil)
    }

    @Test func runsOnlyOnce() {
        let secrets = InMemorySecretStore()
        let file = marker()
        let shared = SharedStore(backend: InMemorySharedBackend())
        FreshInstall.run(defaults: defaults(), secrets: secrets, shared: shared, marker: file)
        secrets.set(Data([1]), for: AppGroup.KeychainAccounts.deviceCredentials)
        FreshInstall.run(defaults: defaults(), secrets: secrets, shared: shared, marker: file)
        #expect(secrets.data(for: AppGroup.KeychainAccounts.deviceCredentials) != nil)
    }

    @Test func leftoverExportsAreSwept() throws {
        let dir = FileManager.default.temporaryDirectory.appending(path: "ss-sweep-\(UUID().uuidString)")
        let export = dir.appending(path: "\(VaultExport.folderPrefix)abc")
        let other = dir.appending(path: "keep-me")
        try FileManager.default.createDirectory(at: export, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: other, withIntermediateDirectories: true)
        VaultExport.sweepLeftovers(in: dir)
        #expect(!FileManager.default.fileExists(atPath: export.path))
        #expect(FileManager.default.fileExists(atPath: other.path))
    }
}

@Suite("Durable alerts")
@MainActor
struct DurableAlertTests {
    private func sharedStore() -> PendingAlertStore { PendingAlertStore(secrets: InMemorySecretStore()) }

    @Test func alertsCarryTheContactFacingReason() async throws {
        let h = LadderHarness(mode: .nightOut)
        h.controller.handle(h.assessment(.elevated))
        await h.advance(45)
        let request = try #require(await h.backend.creates.first)
        #expect(request.reason == "Missed check-in during Night Out")
        #expect(h.controller.activeAlert?.reason == "No answer to a check-in")
        #expect(request.clientAlertId == h.controller.activeAlert?.id.uuidString.lowercased())
    }

    @Test func askingForHelpReadsTheWayThePrototypeDoes() async throws {
        let h = LadderHarness(mode: .walk)
        h.controller.scheduledCheckInDue()
        h.controller.respondToCheckIn(okay: false)
        await h.controller.settle()
        let request = try #require(await h.backend.creates.first)
        #expect(request.reason == "Tapped \u{201C}I need help\u{201D} during Walk Home")
    }

    @Test func aCreateThatFailedIsRetriedUntilItLands() async throws {
        let h = LadderHarness()
        await h.backend.setFailCreates(true)
        h.controller.handle(h.assessment(.high))
        await h.controller.settle()
        #expect(h.controller.activeAlert?.serverAlertID == nil)
        #expect(h.controller.connectionNote != nil)

        await h.advance(30)     // Still offline: the retry keeps going.
        await h.backend.setFailCreates(false)
        await h.advance(30)
        let alert = try #require(h.controller.activeAlert)
        #expect(alert.serverAlertID == "alert-1")
        #expect(h.controller.connectionNote == nil)
        #expect(h.evidence.committed.contains { $0.1 == "alert-1" })
        let ids = Set(await h.backend.creates.map(\.clientAlertId))
        #expect(ids.count == 1)    // Every retry is the same alert to the server.
    }

    @Test func dispatchThatHappenedOfflineIsRequestedOnceTheAlertExists() async {
        let h = LadderHarness()
        await h.backend.setFailCreates(true)
        h.controller.handle(h.assessment(.high))
        await h.controller.settle()
        await h.advance(90)
        #expect(h.controller.level == .dispatch)
        #expect(await h.backend.escalations.isEmpty)
        await h.backend.setFailCreates(false)
        h.controller.retryServerWork()
        await h.controller.settle()
        #expect(await h.backend.escalations.count == 1)
        #expect(h.controller.activeAlert?.dispatch != nil)
    }

    @Test func aFailedDispatchRequestRetries() async {
        let h = LadderHarness()
        h.controller.handle(h.assessment(.high))
        await h.controller.settle()
        await h.backend.setFailEscalations(true)
        await h.advance(90)
        #expect(h.controller.connectionNote != nil)
        await h.backend.setFailEscalations(false)
        await h.advance(30)
        #expect(h.controller.activeAlert?.dispatch != nil)
        #expect(h.controller.connectionNote == nil)
    }

    @Test func aRelaunchPicksUpAnAlertThatNeverReachedTheServer() async throws {
        let store = sharedStore()
        let first = LadderHarness(pendingAlerts: store)
        await first.backend.setFailCreates(true)
        first.controller.handle(first.assessment(.high))
        await first.controller.settle()
        let id = try #require(first.controller.activeAlert?.id)

        // iOS ended the app.
        let second = LadderHarness(pendingAlerts: store)
        second.clock.advance(by: 0)
        second.controller.restorePendingAlerts()
        await second.controller.settle()
        #expect(second.controller.activeAlert?.id == id)
        #expect(second.controller.level == .alert)
        #expect(second.controller.activeAlert?.serverAlertID == "alert-1")
        #expect(store.load(now: second.clock.now).isEmpty)
    }

    @Test func aHiddenDuressAlertSurvivesARelaunchWithoutShowing() async throws {
        let store = sharedStore()
        let first = LadderHarness(pendingAlerts: store)
        await first.backend.setFailCreates(true)
        first.controller.handle(first.assessment(.high))
        await first.controller.settle()
        await first.controller.cancel(with: .duress)
        #expect(store.load(now: first.clock.now).first?.cancel == true)

        let second = LadderHarness(pendingAlerts: store)
        second.controller.restorePendingAlerts()
        await second.controller.settle()
        #expect(second.controller.activeAlert == nil)
        #expect(second.controller.level == .guarding)
        #expect(await second.backend.creates.count == 1)
        #expect(await second.backend.cancels.map(\.duress) == [true])
    }

    @Test func aDuressPINAtACheckInIsStillDeliveredAfterARelaunch() async {
        let store = sharedStore()
        let first = LadderHarness(pendingAlerts: store)
        await first.backend.setFailCreates(true)
        first.controller.handle(first.assessment(.elevated))
        await first.controller.cancel(with: .duress)
        await first.controller.settle()
        #expect(store.load(now: first.clock.now).first?.hidden == true)

        let second = LadderHarness(pendingAlerts: store)
        second.controller.restorePendingAlerts()
        await second.controller.settle()
        #expect(second.controller.activeAlert == nil)
        // Level 2, so the flag is on the server before dispatch starts: only a new alarm carries it.
        #expect(await second.backend.creates.first?.level == 2)
        #expect(await second.backend.cancels.map(\.duress) == [true])
    }

    @Test func aValidCancelOfAnAlertThatNeverLandedTellsNobody() async {
        let store = sharedStore()
        let h = LadderHarness(pendingAlerts: store)
        await h.backend.setFailCreates(true)
        h.controller.handle(h.assessment(.high))
        await h.controller.settle()
        await h.controller.cancel(with: .valid)
        #expect(store.load(now: h.clock.now).isEmpty)
        await h.backend.setFailCreates(false)
        let attempts = await h.backend.creates.count
        await h.advance(60)
        #expect(await h.backend.creates.count == attempts)
        #expect(await h.backend.cancels.isEmpty)
    }

    @Test func aValidCancelStillClosesAnAlertThatMayHaveLanded() async {
        let h = LadderHarness()
        await h.backend.setCreateError(.transport("timed out"))
        h.controller.handle(h.assessment(.high))
        await h.controller.settle()
        await h.controller.cancel(with: .valid)
        await h.backend.setCreateError(nil)
        await h.advance(30)
        #expect(await h.backend.cancels.map(\.alertId) == ["alert-1"])
    }

    @Test func aRefusedCreateStopsRetryingAndKeepsTheNote() async {
        let store = sharedStore()
        let h = LadderHarness(pendingAlerts: store)
        await h.backend.setCreateError(.http(status: 400, message: "reason is too long"))
        h.controller.triggerManual(.manualSOS, reason: "SOS")
        await h.controller.settle()
        #expect(h.controller.connectionNote != nil)
        // The session's still on the request, so it first tries without it.
        await h.advance(30)
        let count = await h.backend.creates.count
        await h.advance(60)
        #expect(await h.backend.creates.count == count)
        #expect(store.load(now: h.clock.now).isEmpty)
    }

    @Test func aSessionTheServerLostDoesntBlockTheAlert() async throws {
        let h = LadderHarness()
        await h.backend.setCreateError(.http(status: 404, message: "session not found"))
        h.controller.triggerManual(.manualSOS, reason: "SOS")
        await h.controller.settle()
        await h.backend.setCreateError(nil)
        await h.advance(30)
        #expect(await h.backend.creates.last?.sessionId == nil)
        #expect(h.controller.activeAlert?.serverAlertID == "alert-1")
    }

    @Test func notRegisteredAsksForRegistration() async {
        let h = LadderHarness()
        var asked = 0
        h.controller.onDeviceNotRecognized = { asked += 1 }
        await h.backend.setCreateError(.notRegistered)
        h.controller.triggerManual(.manualSOS, reason: "SOS")
        await h.controller.settle()
        #expect(asked == 1)
    }

    @Test func aCancelThatCantGetThroughIsReported() async {
        let h = LadderHarness()
        var unconfirmed = 0
        h.controller.onCancelUnconfirmed = { unconfirmed += 1 }
        h.controller.handle(h.assessment(.high))
        await h.controller.settle()
        await h.backend.setFailCancels(true)
        await h.controller.cancel(with: .valid)
        await h.controller.settle()
        #expect(unconfirmed == 1)
    }

    // MARK: Adoption

    private func persisted(level: EscalationLevel, secondsAgo: TimeInterval, clock: ManualEngineClock) -> AlertRecord {
        let started = clock.now.addingTimeInterval(-secondsAgo)
        return AlertRecord(serverAlertID: "alert-9", level: level, trigger: .missedCheckIn, reason: "No answer to a check-in",
                           policy: .contactsFirst, status: level == .dispatch ? .dispatched : .active,
                           startedAt: started, levelChangedAt: started)
    }

    @Test func aResumedCountdownKeepsItsRealDeadline() async {
        let h = LadderHarness()
        h.controller.adopt(persisted(level: .alert, secondsAgo: 60, clock: h.clock))
        await h.controller.settle()
        #expect(h.controller.level == .alert)
        #expect(h.controller.stepDeadline == h.clock.now.addingTimeInterval(30))
        await h.advance(29)
        #expect(h.controller.level == .alert)
        await h.advance(1)
        #expect(h.controller.level == .dispatch)
    }

    @Test func anOverdueCountdownChecksWithTheServerFirst() async {
        let h = LadderHarness()
        await h.backend.setStatus(AlertStatusResponse(status: "cancelled", level: 2, dispatch: nil, events: []))
        h.controller.adopt(persisted(level: .alert, secondsAgo: 600, clock: h.clock))
        await h.controller.settle()
        #expect(h.controller.level == .guarding)
        #expect(h.controller.activeAlert == nil)
        await h.advance(10)
        #expect(await h.backend.escalations.isEmpty)
    }

    @Test func aHeartbeatShowsAnAlertTheWatchdogRaised() async throws {
        let h = LadderHarness()
        h.controller.adoptServerAlert(LiveAlertDTO(id: "w1", level: 2, shareUrl: "https://x/a/t", trigger: "heartbeat_lost",
                                                   reason: "Their phone stopped checking in 3 min ago",
                                                   startedAt: ISO8601DateFormatter().string(from: h.clock.now),
                                                   status: "active", dispatchPolicy: "contacts_first"))
        await h.controller.settle()
        let alert = try #require(h.controller.activeAlert)
        #expect(h.controller.level == .alert)
        #expect(alert.serverAlertID == "w1")
        #expect(alert.trigger == .heartbeatLost)
        #expect(alert.shareURL != nil)
        #expect(alert.reason == "Your phone lost its connection")
        await h.controller.cancel(with: .valid)
        await h.controller.settle()
        #expect(await h.backend.cancels.map(\.alertId) == ["w1"])
    }

    @Test func aHeartbeatCantBringBackAClosedAlert() async {
        let h = LadderHarness()
        h.controller.handle(h.assessment(.high))
        await h.controller.settle()
        await h.controller.cancel(with: .duress)
        await h.controller.settle()
        h.controller.adoptServerAlert(LiveAlertDTO(id: "alert-1", level: 3, shareUrl: "https://x", status: "dispatched"))
        await h.controller.settle()
        #expect(h.controller.activeAlert == nil)
        #expect(h.controller.level == .guarding)
    }

    @Test func aDrillNeverComesBackThroughAHeartbeatAndClosesItself() async throws {
        let h = LadderHarness()
        await h.controller.startDrill()
        await h.controller.settle()
        let id = try #require(h.controller.lastDrill?.serverAlertID)
        h.controller.adoptServerAlert(LiveAlertDTO(id: id, level: 2, shareUrl: "https://x", status: "active"))
        #expect(h.controller.activeAlert == nil)
        #expect(await h.backend.cancels.isEmpty)
        await h.advance(20)
        #expect(await h.backend.cancels.map(\.alertId) == [id])
    }

    // MARK: Policies

    @Test func anEverydaySOSFollowsTheChosenPolicy() async {
        let backend = EngineFakeBackend()
        let controller = EscalationController(backend: backend, clock: ManualEngineClock(), context: FixedContext(),
                                              evidence: RecordingEvidence(), haptics: CountingHaptics(), timing: .immediate)
        var policies = DispatchPolicySettings.default
        policies.manualSOS = .contactsFirst
        controller.updatePolicies(policies)
        controller.triggerManual(.manualSOS, reason: "SOS")
        #expect(controller.level == .alert)
    }
}

@Suite("App model and the server")
@MainActor
struct AppModelServerTests {
    private func makeModel(_ backend: EngineFakeBackend = EngineFakeBackend(), store: SettingsStore = .ephemeral(),
                           clock: ManualEngineClock = ManualEngineClock(now: .now)) -> AppModel {
        let engine = GuardEngine.makeSimulated(backend: backend, vault: MockEvidenceVault(), device: MockDeviceStatus(), clock: clock)
        let services = ServiceContainer(flavor: .demo, audio: engine.audio, motion: engine.motion,
                                        location: engine.location, risk: engine.risk,
                                        secondOpinion: engine.secondOpinion, escalation: engine.escalation,
                                        backend: backend, vault: MockEvidenceVault(),
                                        liveActivity: NoopLiveActivityController(),
                                        notifications: NoopNotificationService(),
                                        heartbeat: NoopHeartbeatService(), device: MockDeviceStatus())
        let model = AppModel(services: services, store: store)
        model.sessionLinkDelays = [0.01]
        return model
    }

    private func waitUntil(_ condition: @MainActor () async -> Bool) async {
        for _ in 0..<300 {
            if await condition() { return }
            try? await Task.sleep(for: .milliseconds(10))
        }
    }

    @Test func sessionStartKeepsTryingUntilItLands() async {
        let backend = EngineFakeBackend()
        await backend.setSessionStartFailures(2)
        let model = makeModel(backend)
        await model.startGuard(mode: .nightOut)
        #expect(model.currentSession?.serverSessionID == nil)
        #expect(model.banner != nil)
        await waitUntil { model.currentSession?.serverSessionID != nil }
        #expect(model.currentSession?.serverSessionID == "session-1")
        #expect(model.banner == nil)
        #expect(await backend.sessionStarts.count == 3)
        await model.endGuard()
    }

    @Test func endingStopsTheRetries() async {
        let backend = EngineFakeBackend()
        await backend.setSessionStartFailures(100)
        let model = makeModel(backend)
        await model.startGuard(mode: .nightOut)
        await model.endGuard()
        let attempts = await backend.sessionStarts.count
        try? await Task.sleep(for: .milliseconds(80))
        #expect(await backend.sessionStarts.count == attempts)
    }

    @Test func aSessionEndedWhileStartingIsClosedOnTheServer() async {
        let backend = EngineFakeBackend()
        await backend.setHoldSessionStarts(true)
        let model = makeModel(backend)
        let start = Task { await model.startGuard(mode: .nightOut) }
        await waitUntil { await backend.isHoldingSessionStart }
        await model.endGuard()
        await backend.releaseSessionStart()
        await start.value
        #expect(await backend.sessionEnds.map(\.sessionId) == ["session-1"])
    }

    @Test func settingsReachTheLadderWithoutASession() async {
        let model = makeModel()
        model.settings.dispatchPolicies.manualSOS = .contactsFirst
        model.triggerSOS()
        #expect(model.escalationLevel == .alert)
        await model.services.escalation.cancel(with: .valid)
    }

    @Test func aMissingNameStillRegisters() async {
        let backend = EngineFakeBackend()
        let model = makeModel(backend)
        model.profile = Profile()
        await model.syncRegistration()
        #expect(await backend.registrations.first?.name == Profile.unnamed)
        #expect(model.store.deviceCredentials != nil)
    }

    @Test func aPhoneTheServerRefusesDoesntBlockRegistration() async {
        let backend = EngineFakeBackend()
        await backend.setRegisterError(.http(status: 400, message: "phone"))
        let model = makeModel(backend)
        model.profile = Profile(name: "Alex", phone: "+44123")
        await model.syncRegistration()
        #expect(model.store.deviceCredentials != nil)
        #expect(await backend.registrations.last?.phone == "")
    }

    @Test func registrationFailuresShowAndClear() async {
        let backend = EngineFakeBackend()
        await backend.setRegisterError(.http(status: 429, message: "Too many"))
        let model = makeModel(backend)
        model.profile = Profile(name: "Alex")
        await model.syncRegistration()
        #expect(model.banner != nil)
        #expect(model.store.deviceCredentials == nil)
        await backend.setRegisterError(nil)
        await model.syncRegistration()
        #expect(model.banner == nil)
        #expect(model.store.deviceCredentials != nil)
    }

    @Test func aDeviceTheServerForgotRegistersAgain() async {
        let backend = EngineFakeBackend()
        let model = makeModel(backend)
        model.profile = Profile(name: "Alex")
        model.store.deviceCredentials = DeviceCredentials(deviceId: "old", deviceSecret: "old-secret-value")
        await backend.setContactsError(.http(status: 401, message: "unauthorized"))
        await model.syncRegistration()
        #expect(model.store.deviceCredentials?.deviceId == "test-device")
        #expect(model.banner == nil)
        #expect(await backend.lastContacts != nil)
    }

    @Test func profileEditsReachTheServerAndPrimaryIsFirst() async {
        let backend = EngineFakeBackend()
        let model = makeModel(backend)
        model.profile = Profile(name: "Alex New", phone: "+15055550100")
        model.contacts = [TrustedContact(name: "Second", phone: "+15055550112"),
                          TrustedContact(name: "First", phone: "+15055550111", isPrimary: true)]
        model.store.deviceCredentials = DeviceCredentials(deviceId: "d", deviceSecret: "s")
        await model.syncRegistration()
        #expect(await backend.profileUpdates.first?.name == "Alex New")
        #expect(await backend.lastContacts?.contacts.first?.name == "First")
    }

    @Test func homeAsksForAMissingPhone() {
        let model = makeModel()
        model.profile = Profile(name: "Alex")
        model.hasCompletedOnboarding = true
        #expect(model.isMissingPhone)
        model.profile?.phone = "+15055550100"
        #expect(!model.isMissingPhone)
    }

    @Test func eraseOfflineFinishesLater() async {
        let backend = EngineFakeBackend()
        await backend.setDeleteError(.transport("offline"))
        let model = makeModel(backend)
        let credentials = DeviceCredentials(deviceId: "d", deviceSecret: "secret-secret-secret")
        model.store.deviceCredentials = credentials
        await model.eraseEverything()
        #expect(model.store.deviceCredentials == nil)
        #expect(model.store.pendingAccountDeletion == credentials)

        await model.finishAccountDeletion()     // Still offline: kept.
        #expect(model.store.pendingAccountDeletion == credentials)

        await backend.setDeleteError(nil)
        await model.finishAccountDeletion()
        #expect(model.store.pendingAccountDeletion == nil)
        #expect(await backend.deletedWith.last == credentials)
    }

    @Test func eraseOnlineLeavesNothingWaiting() async {
        let backend = EngineFakeBackend()
        let model = makeModel(backend)
        model.store.deviceCredentials = DeviceCredentials(deviceId: "d", deviceSecret: "s")
        await model.eraseEverything()
        #expect(model.store.pendingAccountDeletion == nil)
        #expect(await backend.deletions == 1)
    }

    @Test func markedSafeAdmitsACancelThatDidntLand() async {
        let backend = EngineFakeBackend()
        let model = makeModel(backend)
        model.store.setSafetyPIN("1234")
        await model.startGuard(mode: .nightOut)
        model.triggerSOS()
        await (model.services.escalation as? EscalationController)?.settle()
        await backend.setFailCancels(true)
        await model.cancelAlert(pin: "1234")
        await (model.services.escalation as? EscalationController)?.settle()
        #expect(model.markedSafe?.couldntConfirm == true)
    }

    @Test func aCompletedDuressWindowStopsTheMic() async {
        let clock = ManualEngineClock(now: .now)
        let backend = EngineFakeBackend()
        let model = makeModel(backend, clock: clock)
        model.store.setSafetyPIN("1234")
        model.store.setDuressPIN("9999")
        await model.startGuard(mode: .nightOut)
        model.triggerSOS()
        let controller = model.services.escalation as? EscalationController
        await controller?.settle()
        await model.cancelAlert(pin: "9999")
        await controller?.settle()
        let audio = model.services.audio as? MockAudioGuardService
        #expect(audio?.isRunning == true)   // Evidence keeps going for the hidden alert.
        clock.advance(by: 30 * 60 + 20)
        #expect(audio?.isRunning == false)
    }
}

@Suite("Evidence uploads")
@MainActor
struct EvidenceUploadTests {
    actor FlakyBackend: BackendClientProtocol {
        var isConfigured: Bool { true }
        var offline = true
        var refused = false
        private(set) var uploads: [Int] = []
        func setOffline(_ value: Bool) { offline = value }
        func setRefused(_ value: Bool) { refused = value }
        func setCredentials(_ credentials: DeviceCredentials?) {}
        func register(_ request: RegisterRequest) async throws -> RegisterResponse { throw BackendError.notConfigured }
        func setContacts(_ request: ContactsSetRequest) async throws -> OKResponse { throw BackendError.notConfigured }
        func startSession(_ request: SessionStartRequest) async throws -> SessionStartResponse { throw BackendError.notConfigured }
        func heartbeat(_ request: HeartbeatRequest) async throws -> HeartbeatResponse { throw BackendError.notConfigured }
        func endSession(_ request: SessionEndRequest) async throws -> OKResponse { throw BackendError.notConfigured }
        func createAlert(_ request: AlertCreateRequest) async throws -> AlertCreateResponse { throw BackendError.notConfigured }
        func escalateAlert(_ request: AlertEscalateRequest) async throws -> AlertEscalateResponse { throw BackendError.notConfigured }
        func cancelAlert(_ request: AlertCancelRequest) async throws -> AlertCancelResponse { throw BackendError.notConfigured }
        func updateAlertLocation(_ request: AlertLocationRequest) async throws -> OKResponse { throw BackendError.notConfigured }
        func alertStatus(_ request: AlertStatusRequest) async throws -> AlertStatusResponse { throw BackendError.notConfigured }
        func getShare(_ request: ShareGetRequest) async throws -> ShareGetResponse { throw BackendError.notConfigured }
        func shareAction(_ request: ShareActionRequest) async throws -> OKResponse { throw BackendError.notConfigured }
        func uploadEvidence(_ request: EvidenceUploadRequest) async throws -> OKResponse {
            if offline { throw BackendError.transport("offline") }
            if refused { throw BackendError.http(status: 404, message: "alert not found") }
            uploads.append(request.seq)
            return OKResponse(ok: true)
        }
    }

    private func makeVault(_ backend: FlakyBackend) -> SecureEvidenceVault {
        SecureEvidenceVault(backend: backend, secrets: InMemorySecretStore(),
                            directory: FileManager.default.temporaryDirectory.appending(path: "ev-\(UUID().uuidString)"),
                            useMicrophone: false)
    }

    @Test func clipsSealedOfflineGoOnceTheAlertAndNetworkExist() async throws {
        let backend = FlakyBackend()
        let vault = makeVault(backend)
        let alert = UUID()
        try await vault.startCapture(alertID: alert, serverAlertID: nil, prebuffer: nil)
        try vault.append(Data(repeating: 1, count: 32), duration: 1)
        try vault.append(Data(repeating: 2, count: 32), duration: 1)
        await vault.uploadPending()
        #expect(vault.clips.allSatisfy { !$0.uploaded })

        await backend.setOffline(false)
        vault.setServerAlertID("server-1", for: alert)
        await vault.uploadPending()
        #expect(vault.clips.allSatisfy { $0.uploaded })
        #expect(await backend.uploads.sorted() == [0, 1])
        vault.stopCapture()
    }

    @Test func aRefusedClipDoesntHoldUpOrRetryForever() async throws {
        let backend = FlakyBackend()
        await backend.setOffline(false)
        await backend.setRefused(true)
        let vault = makeVault(backend)
        try await vault.startCapture(alertID: UUID(), serverAlertID: "gone", prebuffer: nil)
        try vault.append(Data(repeating: 1, count: 32), duration: 1)
        await vault.uploadPending()
        #expect(vault.lastUploadError != nil)
        #expect(vault.clips.first?.uploaded == false)
        vault.stopCapture()
    }
}

@Suite("HTTP client outbox")
struct HTTPOutboxTests {
    /// Answers every request with whatever `respond` says, on any route.
    final class Stub: URLProtocol, @unchecked Sendable {
        nonisolated(unsafe) static var respond: (@Sendable (URLRequest) -> (Int, Data)?) = { _ in nil }
        nonisolated(unsafe) static var seen: [String] = []
        private static let lock = NSLock()

        override class func canInit(with request: URLRequest) -> Bool { true }
        override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
        override func stopLoading() {}
        override func startLoading() {
            Self.lock.withLock { Self.seen.append(request.url?.lastPathComponent ?? "") }
            guard let (status, data) = Self.respond(request), let url = request.url,
                  let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: nil, headerFields: nil) else {
                client?.urlProtocol(self, didFailWithError: URLError(.notConnectedToInternet))
                return
            }
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        }
    }

    private func makeClient(_ outbox: BackendOutbox) -> HTTPBackendClient {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [Stub.self]
        let secrets = InMemorySecretStore()
        secrets.set(try? JSONEncoder().encode(DeviceCredentials(deviceId: "d", deviceSecret: "s")),
                    for: AppGroup.KeychainAccounts.deviceCredentials)
        return HTTPBackendClient(configuration: BackendConfiguration(baseURL: URL(string: "https://example.test/api/")!,
                                                                     publishableKey: "key",
                                                                     shareBaseURL: URL(string: "https://example.test/a/")!),
                                 session: URLSession(configuration: config), secrets: secrets,
                                 options: { .safe }, outbox: outbox)
    }

    @Test func closingCallsWaitOutTheOutageAndThenLand() async throws {
        let suite = "ss.http.\(UUID().uuidString)"
        let outbox = BackendOutbox(key: "outbox", suiteName: suite)
        defer { UserDefaults.standard.removePersistentDomain(forName: suite) }
        let client = makeClient(outbox)

        Stub.respond = { _ in nil }
        await #expect(throws: BackendError.self) { try await client.endSession(SessionEndRequest(sessionId: "s1")) }
        await #expect(throws: BackendError.self) { try await client.cancelAlert(AlertCancelRequest(alertId: "a1", duress: true)) }
        #expect(outbox.load().map(\.item) == [.sessionEnd(SessionEndRequest(sessionId: "s1")),
                                              .alertCancel(AlertCancelRequest(alertId: "a1", duress: true))])

        Stub.respond = { request in
            request.url?.lastPathComponent == "cancel" ? (200, Data(#"{"ok":true,"status":"cancelled"}"#.utf8)) : (200, Data(#"{"ok":true}"#.utf8))
        }
        await client.flushOutbox()
        #expect(outbox.load().isEmpty)
    }
}
