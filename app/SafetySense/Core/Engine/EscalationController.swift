import Foundation
import Observation

/// The production escalation ladder (SPEC 6.3, 15.2).
///
/// ```
/// 0 Guarding --risk elevated / scheduled check-in--> 1 Check-in --45 s, no answer--> 2 Alert
/// 0/1 --risk high, heartbeat lost--> start level from the mode's dispatch policy
/// manual (SOS, Action Button, safe word, "Need help") --> start level from the manual policy
/// 2 Alert --90 s, no valid cancel / a contact taps "Send help"--> 3 Dispatch
/// "I need help" at a check-in --> start level from the mode's policy, so the PIN can still stop it
/// valid PIN --> back to 0 (server: cancel)   duress PIN --> looks the same, server: cancel{duress:true}
///
/// A cancel only moves the ladder back to 0. `AppModel.cancelAlert` then shows Marked safe and
/// ends the session, so both PINs land on the same screen.
/// ```
///
/// All timing goes through `EngineClock`, so tests drive it with `ManualEngineClock`.
/// Backend calls never block the UI state: the level changes first, the network follows.
@Observable
@MainActor
final class EscalationController: EscalationControllerProtocol {
    private(set) var level: EscalationLevel = .guarding
    private(set) var activeAlert: AlertRecord?
    private(set) var stepDeadline: Date?
    /// When the next scheduled check-in fires (nil when the mode has none or a step is active).
    private(set) var nextCheckInAt: Date?
    /// Why the current check-in was raised ("Scheduled check-in", or the risk explanation).
    private(set) var checkInReason: String?
    /// The same reason, typed, so the prompt can word it for the Guard you're in.
    private(set) var checkInCause: CheckInCause?
    private(set) var lastAssessment: RiskAssessment = .calm
    private(set) var lastDrill: AlertRecord?
    private(set) var failedPINAttempts = 0
    /// Calm, non-alarming note when the server can't be reached (nil when all is well).
    private(set) var connectionNote: String?

    @ObservationIgnored var onChange: (@MainActor (EscalationLevel, AlertRecord?) -> Void)?
    /// "I'm okay" or a cancel: the risk engine should discount what it has seen so far.
    @ObservationIgnored var onUserConfirmedOkay: (@MainActor () -> Void)?
    /// True while a duress alert silently keeps sharing location, false when that ends.
    @ObservationIgnored var onDuressTracking: (@MainActor (Bool) -> Void)?
    /// Returns the backend `session_id` once `session/start` has answered.
    @ObservationIgnored var serverSessionIDProvider: (@MainActor () -> String?)?

    @ObservationIgnored private let backend: any BackendClientProtocol
    @ObservationIgnored private let clock: any EngineClock
    @ObservationIgnored private let context: (any AlertContextProviding)?
    @ObservationIgnored private let evidence: (any EvidenceHandling)?
    @ObservationIgnored private let haptics: any EngineHaptics
    @ObservationIgnored let timing: EscalationTiming

    @ObservationIgnored private var session: GuardSession?
    /// When a Walk or Ride should have arrived. A check-in for a long stop leaves this alone.
    @ObservationIgnored private var arrivalDeadline: Date?
    @ObservationIgnored private var policies = DispatchPolicySettings.default
    @ObservationIgnored private var stepTimer: EngineTimer?
    @ObservationIgnored private var scheduledCheckInTimer: EngineTimer?
    @ObservationIgnored private var locationTimer: EngineTimer?
    @ObservationIgnored private var statusTimer: EngineTimer?
    @ObservationIgnored private var duressTimer: EngineTimer?
    @ObservationIgnored private var okaySuppressedUntil: Date?

    /// Every alert raised while this controller lives, by local id.
    @ObservationIgnored private var known: [UUID: AlertRecord] = [:]
    /// A duress-cancelled alert the server is silently escalating. Never shown on screen.
    @ObservationIgnored private(set) var duressAlertID: UUID?
    @ObservationIgnored private var duressUntil: Date?
    /// Cancels that arrived before the server answered `alert/create` (value: duress).
    @ObservationIgnored private var pendingCancels: [UUID: Bool] = [:]
    @ObservationIgnored private var dispatchRequested: Set<UUID> = []
    @ObservationIgnored private var dispatchReasons: [UUID: String] = [:]
    @ObservationIgnored private var seenServerEvents: Set<String> = []
    @ObservationIgnored private var inflight: [UUID: Task<Void, Never>] = [:]

    init(backend: any BackendClientProtocol,
         clock: any EngineClock = SystemEngineClock(),
         context: (any AlertContextProviding)? = nil,
         evidence: (any EvidenceHandling)? = nil,
         haptics: any EngineHaptics = SystemEngineHaptics(),
         timing: EscalationTiming = .standard) {
        self.backend = backend
        self.clock = clock
        self.context = context
        self.evidence = evidence
        self.haptics = haptics
        self.timing = timing
    }

    // MARK: Derived

    private var mode: GuardMode { session?.mode ?? .everyday }
    private var serverSessionID: String? { serverSessionIDProvider?() ?? session?.serverSessionID }
    private var now: Date { clock.now }
    private var isSuppressed: Bool { okaySuppressedUntil.map { now < $0 } ?? false }

    /// One calm status line for the UI and the Live Activity.
    var statusText: String {
        if level == .dispatch, let dispatch = activeAlert?.dispatch { return dispatch.displayStatus }
        return level.statusLine
    }

    /// Seconds left in the current step (check-in window or alert countdown).
    var secondsRemaining: TimeInterval? {
        stepDeadline.map { max(0, $0.timeIntervalSince(now)) }
    }

    func alert(withID id: UUID) -> AlertRecord? { known[id] }

    /// The app came to the foreground: the mic may be able to start now.
    func resumeEvidence() async {
        await evidence?.resume(mode: mode)
    }

    // MARK: Session

    func begin(session: GuardSession, policies: DispatchPolicySettings) {
        cancelLadderTimers()
        stopAlertLoops()
        self.session = session
        self.policies = policies
        arrivalDeadline = session.usesArrivalCheck ? session.nextCheckInAt : nil
        level = .guarding
        activeAlert = nil
        stepDeadline = nil
        checkInReason = nil
        checkInCause = nil
        okaySuppressedUntil = nil
        failedPINAttempts = 0
        lastAssessment = .calm
        connectionNote = nil
        scheduleNextCheckIn()
        emit()
    }

    /// Lets the app hand over the `session_id` (or other changes) after `session/start`.
    func updateSession(_ session: GuardSession) {
        guard self.session?.id == session.id else { return }
        self.session = session
    }

    func end() {
        cancelLadderTimers()
        stopAlertLoops()
        if let alert = activeAlert { evidence?.stop(alertID: alert.id) }
        session = nil
        arrivalDeadline = nil
        level = .guarding
        activeAlert = nil
        stepDeadline = nil
        nextCheckInAt = nil
        checkInReason = nil
        checkInCause = nil
        okaySuppressedUntil = nil
        emit()
        // A duress alert keeps sharing location until `duressUntil`, even after the session ends.
    }

    // MARK: Risk

    func handle(_ assessment: RiskAssessment) {
        lastAssessment = assessment
        guard session != nil else { return }
        // The AI second opinion can never be the only reason to escalate.
        let ruleSignals = assessment.contributors.filter { $0.kind != .secondOpinion }
        guard !ruleSignals.isEmpty else { return }

        switch assessment.level {
        case .critical:
            if ruleSignals.contains(where: { $0.kind == .safeWord }) {
                triggerManual(.safeWord, reason: "Safe word heard")
            } else if ruleSignals.contains(where: { $0.kind == .heartbeatLost }) {
                raiseAlert(trigger: .heartbeatLost, reason: "Phone went dark")
            } else {
                raiseAlert(trigger: .riskEngine, reason: assessment.explanation)
            }
        case .high:
            if level < .alert { raiseAlert(trigger: .riskEngine, reason: assessment.explanation) }
        case .elevated:
            if level == .guarding, !isSuppressed {
                enterCheckIn(reason: assessment.explanation, cause: Self.cause(for: ruleSignals, explanation: assessment.explanation))
            }
        case .calm:
            // A long stop on a Walk or Ride is reason enough to ask, whatever the score and
            // sensitivity say: there's no repeating check-in to catch it otherwise.
            if level == .guarding, !isSuppressed, session?.usesArrivalCheck == true,
               ruleSignals.contains(where: { $0.kind == .unexpectedStop }) {
                enterCheckIn(reason: assessment.explanation, cause: .unexpectedStop)
            }
        }
    }

    // MARK: Check-ins

    func scheduledCheckInDue() {
        guard session != nil, level == .guarding else { return }
        enterCheckIn(reason: "Scheduled check-in", cause: .scheduled)
    }

    func respondToCheckIn(okay: Bool) {
        guard level == .checkIn else { return }
        if okay {
            confirmOkay()
        } else {
            // Same countdown as a missed check-in: "Send help now" is there, and a PIN can stop it.
            // Hold-to-SOS keeps its dispatch-first default (SPEC 15.2).
            startAlert(trigger: .manualSOS, reason: "Asked for help at a check-in",
                       at: policies.startingLevel(for: .missedCheckIn, in: mode),
                       policy: policies.policy(for: mode))
        }
    }

    private static func cause(for signals: [RiskSignal], explanation: String) -> CheckInCause {
        signals.first?.kind == .unexpectedStop ? .unexpectedStop : .noticed(explanation)
    }

    private func enterCheckIn(reason: String, cause: CheckInCause) {
        scheduledCheckInTimer?.cancel()
        nextCheckInAt = nil
        level = .checkIn
        checkInReason = reason
        checkInCause = cause
        let window = max(10, session?.graceSeconds ?? timing.checkInWindow)
        stepDeadline = now.addingTimeInterval(window)
        stepTimer?.cancel()
        stepTimer = clock.schedule(after: window) { [weak self] in
            guard let self, self.level == .checkIn else { return }
            self.raiseAlert(trigger: .missedCheckIn, reason: "No answer to a check-in")
        }
        haptics.checkIn()
        emit()
    }

    private func confirmOkay() {
        stepTimer?.cancel()
        level = .guarding
        stepDeadline = nil
        checkInReason = nil
        checkInCause = nil
        okaySuppressedUntil = now.addingTimeInterval(timing.okayCooldown)
        onUserConfirmedOkay?()
        scheduleNextCheckIn()
        emit()
    }

    private func scheduleNextCheckIn() {
        scheduledCheckInTimer?.cancel()
        guard let session, session.checkInInterval > 0 else {
            nextCheckInAt = nil
            return
        }
        let next = session.nextCheckIn(after: now, arrival: arrivalDeadline)
        nextCheckInAt = next
        scheduledCheckInTimer = clock.schedule(after: next.timeIntervalSince(now)) { [weak self] in
            self?.scheduledCheckInDue()
        }
    }

    // MARK: Manual triggers

    func triggerManual(_ trigger: AlertTrigger, reason: String) {
        guard level < .dispatch else { return }
        raiseAlert(trigger: trigger, reason: reason)
    }

    func contactRequestedHelp(name: String) {
        guard var alert = activeAlert else { return }
        alert.events.append(AlertEvent(who: name, action: "send_help", at: now))
        store(alert)
        if level == .alert {
            escalateToDispatch(reason: "\(name) asked for help to be sent")
        } else {
            emit()
        }
    }

    // MARK: Alerts

    private func raiseAlert(trigger: AlertTrigger, reason: String) {
        let start = policies.startingLevel(for: trigger, in: mode)
        if level >= .alert {
            if start == .dispatch, level == .alert { escalateToDispatch(reason: reason) }
            return
        }
        startAlert(trigger: trigger, reason: reason, at: start)
    }

    private func startAlert(trigger: AlertTrigger, reason: String, at start: EscalationLevel,
                            policy: DispatchPolicy? = nil) {
        cancelLadderTimers()
        nextCheckInAt = nil
        checkInReason = nil
        checkInCause = nil
        let t = now
        let record = AlertRecord(sessionID: serverSessionID, level: start, trigger: trigger, reason: reason,
                                 policy: policy ?? policies.policy(for: trigger, in: mode),
                                 status: start == .dispatch ? .dispatched : .active,
                                 startedAt: t, levelChangedAt: t,
                                 events: [AlertEvent(who: "SafetySense", action: "alert_started", at: t)])
        known[record.id] = record
        level = start
        activeAlert = record
        if start == .alert {
            armDispatchCountdown()
        } else {
            stepDeadline = nil
            dispatchReasons[record.id] = reason
        }
        evidence?.prepare(alertID: record.id)
        startAlertLoops()
        emit()
        track { [weak self] in await self?.createOnServer(alertID: record.id) }
    }

    private func armDispatchCountdown() {
        stepDeadline = now.addingTimeInterval(timing.alertToDispatch)
        stepTimer?.cancel()
        stepTimer = clock.schedule(after: timing.alertToDispatch) { [weak self] in
            guard let self, self.level == .alert else { return }
            self.escalateToDispatch(reason: "No cancel within 90 seconds")
        }
    }

    private func escalateToDispatch(reason: String, serverAlreadyKnows: Bool = false) {
        guard var alert = activeAlert, alert.level < .dispatch, !alert.isDrill else { return }
        stepTimer?.cancel()
        alert.level = .dispatch
        alert.status = .dispatched
        alert.levelChangedAt = now
        alert.events.append(AlertEvent(who: "SafetySense", action: "dispatch_requested", at: now))
        dispatchReasons[alert.id] = reason
        level = .dispatch
        stepDeadline = nil
        store(alert)
        emit()
        if serverAlreadyKnows {
            dispatchRequested.insert(alert.id)
        } else if alert.serverAlertID != nil {
            let id = alert.id
            track { [weak self] in await self?.requestDispatch(alertID: id) }
        }
        // Otherwise `createOnServer` requests dispatch once the server id arrives.
    }

    // MARK: Cancel

    func cancel(with verification: PINVerification) async {
        guard verification != .invalid else {
            failedPINAttempts += 1
            return
        }
        failedPINAttempts = 0
        let duress = verification == .duress

        guard let alert = activeAlert else {
            // No alert yet: at a check-in a PIN is an "I'm okay". A duress PIN looks identical
            // but silently raises a hidden alert straight to dispatch.
            if level == .checkIn { confirmOkay() }
            if duress { await startHiddenDuressAlert(reason: "Duress PIN entered") }
            return
        }

        // Both paths look exactly the same on screen.
        cancelLadderTimers()
        stopAlertLoops()
        level = .guarding
        activeAlert = nil
        stepDeadline = nil
        checkInReason = nil
        checkInCause = nil
        okaySuppressedUntil = now.addingTimeInterval(timing.okayCooldown)
        onUserConfirmedOkay?()
        scheduleNextCheckIn()
        haptics.cancelled()

        var record = alert
        record.events.append(AlertEvent(who: "you", action: "cancelled", at: now))
        if duress {
            // Evidence and location keep flowing; the server escalates silently.
            known[record.id] = record
            beginDuressTracking(alertID: record.id)
        } else {
            record.status = .cancelled
            known[record.id] = record
            evidence?.stop(alertID: record.id)
        }
        emit()

        // Never makes the screen wait for the network: retries can take a long time offline.
        if let serverID = record.serverAlertID {
            track { [weak self] in await self?.sendCancel(serverID: serverID, duress: duress) }
        } else {
            pendingCancels[record.id] = duress
        }
    }

    private func startHiddenDuressAlert(reason: String) async {
        let t = now
        let record = AlertRecord(sessionID: serverSessionID, level: .dispatch, trigger: .manualSOS, reason: reason,
                                 policy: .dispatchImmediately, status: .dispatched, startedAt: t, levelChangedAt: t,
                                 events: [AlertEvent(who: "SafetySense", action: "alert_started", at: t)])
        known[record.id] = record
        dispatchReasons[record.id] = reason
        evidence?.prepare(alertID: record.id)
        beginDuressTracking(alertID: record.id)
        await createOnServer(alertID: record.id)
    }

    private func beginDuressTracking(alertID: UUID) {
        duressAlertID = alertID
        duressUntil = now.addingTimeInterval(timing.duressTrackingDuration)
        onDuressTracking?(true)
        scheduleDuressLocation()
    }

    private func scheduleDuressLocation() {
        duressTimer?.cancel()
        duressTimer = clock.schedule(after: timing.locationInterval) { [weak self] in
            guard let self, let id = self.duressAlertID else { return }
            if let until = self.duressUntil, self.now >= until {
                self.duressAlertID = nil
                self.evidence?.stop(alertID: id)
                self.onDuressTracking?(false)
                return
            }
            self.track { [weak self] in await self?.pushLocation(alertID: id) }
            self.scheduleDuressLocation()
        }
    }

    // MARK: External alerts

    /// Takes over an alert that already exists on the server (created by an App Intent while
    /// the ladder wasn't running, e.g. Action Button from a cold start). Shows it, keeps the
    /// countdown going if it is still at Alert, and resumes location + status loops.
    func adopt(_ alert: AlertRecord) {
        guard activeAlert == nil, alert.serverAlertID != nil else { return }
        cancelLadderTimers()
        nextCheckInAt = nil
        var record = alert
        if record.dispatch != nil { dispatchRequested.insert(record.id) }
        record.events.append(AlertEvent(who: "SafetySense", action: "alert_resumed", at: now))
        known[record.id] = record
        activeAlert = record
        level = record.level
        if record.level == .alert {
            armDispatchCountdown()
        } else {
            stepDeadline = nil
            if record.dispatch == nil {
                let id = record.id
                track { [weak self] in await self?.requestDispatch(alertID: id) }
            }
        }
        evidence?.prepare(alertID: record.id)
        let id = record.id, serverID = record.serverAlertID, mode = self.mode
        track { [weak self] in await self?.evidence?.commit(alertID: id, serverAlertID: serverID, mode: mode) }
        startAlertLoops()
        emit()
    }

    // MARK: Drill

    func startDrill() async {
        let t = now
        var record = AlertRecord(sessionID: serverSessionID, level: .alert, trigger: .manualSOS, reason: "Practice drill",
                                 policy: .contactsFirst, status: .active, startedAt: t, levelChangedAt: t,
                                 events: [AlertEvent(who: "SafetySense", action: "drill_started", at: t)],
                                 isDrill: true)
        let ctx = await context?.alertContext() ?? .unknown
        do {
            let response = try await backend.createAlert(AlertCreateRequest(
                sessionId: record.sessionID, level: 2, reason: "TEST: practice drill",
                trigger: AlertTrigger.manualSOS.rawValue, lat: ctx.latitude, lng: ctx.longitude,
                accuracy: ctx.accuracy, battery: ctx.battery, dryRun: true,
                dispatchPolicy: DispatchPolicy.contactsFirst.rawValue))
            record.serverAlertID = response.alertId
            record.shareURL = URL(string: response.shareUrl)
            record.notified = response.notified
            record.events += response.notified.map {
                AlertEvent(who: $0.name, action: "test_\($0.channel.rawValue)_\($0.status)", at: now)
            }
        } catch {
            record.events.append(AlertEvent(who: "SafetySense", action: "drill_offline", at: now))
        }
        record.status = .resolved
        lastDrill = record
        onChange?(level, record)
    }

    // MARK: Server

    private func createOnServer(alertID: UUID) async {
        guard known[alertID] != nil else { return }
        let ctx = await context?.alertContext() ?? .unknown
        guard let snapshot = known[alertID] else { return }
        if pendingCancels[alertID] == false {
            // Cancelled with a valid PIN before we reached the server: nobody needs to be told.
            pendingCancels.removeValue(forKey: alertID)
            return
        }
        let request = AlertCreateRequest(
            sessionId: snapshot.sessionID ?? serverSessionID, level: max(2, snapshot.level.rawValue),
            reason: snapshot.reason, trigger: snapshot.trigger.rawValue,
            lat: ctx.latitude, lng: ctx.longitude, accuracy: ctx.accuracy, battery: ctx.battery,
            dryRun: nil, dispatchPolicy: snapshot.policy.rawValue)
        let backend = self.backend
        let response: AlertCreateResponse
        do {
            response = try await withRetry { try await backend.createAlert(request) }
        } catch {
            connectionNote = "Couldn't reach SafetySense's server yet. If you can, call 911."
            if var alert = known[alertID] {
                alert.events.append(AlertEvent(who: "SafetySense", action: "server_unreachable", at: now))
                store(alert)
            }
            if pendingCancels[alertID] == nil { await evidence?.commit(alertID: alertID, serverAlertID: nil, mode: mode) }
            emit()
            return
        }
        connectionNote = nil
        guard var alert = known[alertID] else { return }
        alert.serverAlertID = response.alertId
        alert.shareURL = URL(string: response.shareUrl)
        alert.notified = response.notified
        alert.events += response.notified.map {
            AlertEvent(who: $0.name, action: "notified_by_\($0.channel.rawValue)", at: now)
        }
        store(alert)
        // No fix was ready for `alert/create` (a cold start): fill the map in as soon as one is.
        if ctx.latitude == nil { track { [weak self] in await self?.pushLocation(alertID: alertID) } }

        if let duress = pendingCancels.removeValue(forKey: alertID) {
            await sendCancel(serverID: response.alertId, duress: duress)
            if !duress {
                emit()
                return
            }
        } else if alert.level == .dispatch {
            await requestDispatch(alertID: alertID)
        }
        await evidence?.commit(alertID: alertID, serverAlertID: response.alertId, mode: mode)
        emit()
    }

    private func requestDispatch(alertID: UUID) async {
        guard let alert = known[alertID], let serverID = alert.serverAlertID, !alert.isDrill,
              alert.dispatch == nil, !dispatchRequested.contains(alertID) else { return }
        dispatchRequested.insert(alertID)
        let request = AlertEscalateRequest(alertId: serverID, reason: dispatchReasons[alertID] ?? alert.reason)
        let backend = self.backend
        do {
            let response = try await withRetry { try await backend.escalateAlert(request) }
            guard var current = known[alertID] else { return }
            let info = response.dispatch.model
            current.dispatch = info
            current.events.append(AlertEvent(who: "dispatch", action: info.provider == .simulated
                                             ? "simulated_\(info.status)" : info.status, at: now))
            store(current)
            emit()
        } catch {
            dispatchRequested.remove(alertID)
            connectionNote = "Couldn't confirm dispatch yet. If you can, call 911."
            emit()
        }
    }

    private func sendCancel(serverID: String, duress: Bool) async {
        let backend = self.backend
        let request = AlertCancelRequest(alertId: serverID, duress: duress)
        _ = try? await withRetry { try await backend.cancelAlert(request) }
    }

    private func pushLocation(alertID: UUID) async {
        guard let serverID = known[alertID]?.serverAlertID else { return }
        let ctx = await context?.alertContext() ?? .unknown
        guard let lat = ctx.latitude, let lng = ctx.longitude else { return }
        let request = AlertLocationRequest(alertId: serverID, lat: lat, lng: lng, accuracy: max(0, ctx.accuracy ?? 0),
                                           battery: min(max(ctx.battery ?? 0, 0), 1))
        _ = try? await backend.updateAlertLocation(request)
    }

    private func pollStatus(alertID: UUID) async {
        guard let serverID = known[alertID]?.serverAlertID else { return }
        guard let response = try? await backend.alertStatus(AlertStatusRequest(alertId: serverID)),
              var alert = known[alertID] else { return }
        var helpRequestedBy: String?
        for event in response.events {
            let key = "\(serverID)|\(event.who)|\(event.action)|\(event.at)"
            guard !seenServerEvents.contains(key) else { continue }
            seenServerEvents.insert(key)
            // Skip the echo of a "send help" we already recorded locally.
            if event.action == "send_help",
               alert.events.contains(where: { $0.action == "send_help" && $0.who == event.who }) {
                continue
            }
            // Skip the server's echo of a step the phone already logged (alert_started,
            // dispatch_requested), so the timeline shows each step once.
            let model = event.model
            if alert.events.contains(where: { $0.action == model.action && $0.who == model.who
                                             && abs($0.at.timeIntervalSince(model.at)) < 15 }) {
                continue
            }
            alert.events.append(model)
            if event.action == "send_help" { helpRequestedBy = event.who }
        }
        if let dispatch = response.dispatch { alert.dispatch = dispatch.model }
        store(alert)
        if activeAlert?.id == alertID, level == .alert,
           response.level >= 3 || response.dispatch != nil || helpRequestedBy != nil {
            let reason = helpRequestedBy.map { "\($0) asked for help to be sent" } ?? "Dispatch started"
            escalateToDispatch(reason: reason, serverAlreadyKnows: true)
        } else {
            emit()
        }
    }

    // MARK: Loops

    private func startAlertLoops() {
        scheduleLocationPush()
        scheduleStatusPoll()
    }

    private func stopAlertLoops() {
        locationTimer?.cancel()
        statusTimer?.cancel()
        locationTimer = nil
        statusTimer = nil
    }

    private func scheduleLocationPush() {
        locationTimer?.cancel()
        locationTimer = clock.schedule(after: timing.locationInterval) { [weak self] in
            guard let self, let id = self.activeAlert?.id else { return }
            self.track { [weak self] in await self?.pushLocation(alertID: id) }
            self.scheduleLocationPush()
        }
    }

    private func scheduleStatusPoll() {
        statusTimer?.cancel()
        statusTimer = clock.schedule(after: timing.statusPollInterval) { [weak self] in
            guard let self, let id = self.activeAlert?.id else { return }
            self.track { [weak self] in await self?.pollStatus(alertID: id) }
            self.scheduleStatusPoll()
        }
    }

    private func cancelLadderTimers() {
        stepTimer?.cancel()
        scheduledCheckInTimer?.cancel()
        stepTimer = nil
        scheduledCheckInTimer = nil
    }

    // MARK: Plumbing

    private func store(_ alert: AlertRecord) {
        known[alert.id] = alert
        if activeAlert?.id == alert.id { activeAlert = alert }
    }

    private func emit() {
        onChange?(level, activeAlert)
    }

    private func track(_ work: @escaping @MainActor () async -> Void) {
        let id = UUID()
        inflight[id] = Task { @MainActor [weak self] in
            await work()
            self?.inflight.removeValue(forKey: id)
        }
    }

    /// Waits until every backend call started so far (and any they started) has finished.
    func settle() async {
        while let task = inflight.values.first {
            await task.value
        }
    }

    private func withRetry<T: Sendable>(_ operation: @escaping @Sendable () async throws -> T) async throws -> T {
        var lastError: (any Error)?
        for delay in [0] + timing.retryDelays {
            if delay > 0 { try? await Task.sleep(for: .seconds(delay)) }
            do {
                return try await operation()
            } catch {
                lastError = error
                if error is CancellationError { break }
            }
        }
        throw lastError ?? CancellationError()
    }
}
