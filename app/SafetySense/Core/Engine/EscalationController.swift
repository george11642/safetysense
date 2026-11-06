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
    /// A cancel didn't reach the server yet. The client keeps it queued, but until it lands the
    /// person shouldn't be told their contacts know. Fires for both PINs, so they read the same.
    @ObservationIgnored var onCancelUnconfirmed: (@MainActor () -> Void)?
    /// The server doesn't recognize this device (never registered, or its row is gone).
    @ObservationIgnored var onDeviceNotRecognized: (@MainActor () -> Void)?

    @ObservationIgnored private let backend: any BackendClientProtocol
    @ObservationIgnored private let clock: any EngineClock
    @ObservationIgnored private let context: (any AlertContextProviding)?
    @ObservationIgnored private let evidence: (any EvidenceHandling)?
    @ObservationIgnored private let haptics: any EngineHaptics
    @ObservationIgnored private let pendingStore: PendingAlertStore
    @ObservationIgnored private let duressStore: DuressRecordStore
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
    @ObservationIgnored private var serverRetryTimer: EngineTimer?
    @ObservationIgnored private var drillCloseTimers: [String: EngineTimer] = [:]
    @ObservationIgnored private var okaySuppressedUntil: Date?

    /// Every alert raised while this controller lives, by local id.
    @ObservationIgnored private var known: [UUID: AlertRecord] = [:]
    /// A duress-cancelled alert the server is silently escalating. Never shown on screen.
    @ObservationIgnored private(set) var duressAlertID: UUID?
    @ObservationIgnored private var duressUntil: Date?
    /// Earlier duress alerts replaced by a newer one. Their capture ends when the window does.
    @ObservationIgnored private var supersededDuressIDs: [UUID] = []
    /// Duress alerts started in this run, in case a Keychain write failed. See `duressRecords`.
    @ObservationIgnored private var sessionDuressRecords: [DuressRecord] = []
    /// Alerts `alert/create` hasn't confirmed, mirrored to `pendingStore` so they survive a relaunch.
    @ObservationIgnored private var pendingCreates: [UUID: PendingAlert] = [:]
    @ObservationIgnored private var creating: Set<UUID> = []
    /// Server alerts this phone already closed (or a drill): a heartbeat can't bring them back.
    @ObservationIgnored private var closedServerAlertIDs: Set<String> = []
    @ObservationIgnored private var dispatchRequested: Set<UUID> = []
    @ObservationIgnored private var dispatchReasons: [UUID: String] = [:]
    @ObservationIgnored private var seenServerEvents: Set<String> = []
    @ObservationIgnored private var inflight: [UUID: Task<Void, Never>] = [:]

    init(backend: any BackendClientProtocol,
         clock: any EngineClock = SystemEngineClock(),
         context: (any AlertContextProviding)? = nil,
         evidence: (any EvidenceHandling)? = nil,
         haptics: any EngineHaptics = SystemEngineHaptics(),
         timing: EscalationTiming = .standard,
         pendingAlerts: PendingAlertStore = .memory,
         duressRecords: DuressRecordStore = .memory) {
        self.pendingStore = pendingAlerts
        self.duressStore = duressRecords
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

    /// Refused during an alert: wiping it here would take away the PIN screen while the server
    /// keeps going. `AppModel.startGuard` won't get this far, so this is the last line of defense.
    func begin(session: GuardSession, policies: DispatchPolicySettings) {
        guard activeAlert == nil else { return }
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

    /// Settings changed. Without a session this is the only way an SOS sees them.
    func updatePolicies(_ policies: DispatchPolicySettings) {
        self.policies = policies
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
                       policy: policies.policy(for: mode), contactCause: AlertReasonText.askedForHelp)
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
        startAlert(trigger: trigger, reason: reason, at: start, contactCause: Self.contactCause(trigger, reason))
    }

    private static func contactCause(_ trigger: AlertTrigger, _ reason: String) -> String {
        if trigger == .missedCheckIn { return AlertReasonText.missedCheckIn }
        return reason == "Asked for help at a check-in" ? AlertReasonText.askedForHelp : reason
    }

    private func startAlert(trigger: AlertTrigger, reason: String, at start: EscalationLevel,
                            policy: DispatchPolicy? = nil, contactCause: String) {
        cancelLadderTimers()
        nextCheckInAt = nil
        checkInReason = nil
        checkInCause = nil
        let t = now
        let record = AlertRecord(sessionID: serverSessionID, level: start, trigger: trigger, reason: reason,
                                 policy: policy ?? policies.policy(for: trigger, in: mode),
                                 status: start == .dispatch ? .dispatched : .active,
                                 startedAt: t, levelChangedAt: t,
                                 events: [AlertEvent(who: "SafetySense", action: "alert_started", at: t)],
                                 contactReason: AlertReasonText.contact(contactCause, mode: mode))
        known[record.id] = record
        trackPending(PendingAlert(record: record))
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

    private func armDispatchCountdown(after seconds: TimeInterval? = nil) {
        let wait = seconds ?? timing.alertToDispatch
        stepDeadline = now.addingTimeInterval(wait)
        stepTimer?.cancel()
        stepTimer = clock.schedule(after: wait) { [weak self] in
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
            if duress { startHiddenDuressAlert(reason: "Duress PIN entered") }
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
            beginDuressTracking(alertID: record.id, hiddenFrom: now, serverAlertID: record.serverAlertID)
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
            // With no answer from the server yet, contacts may be hearing about this right now.
            onCancelUnconfirmed?()
            if var entry = pendingCreates[record.id] {
                entry.cancel = duress
                entry.record = record
                trackPending(entry)
                finishCancelledCreate(record.id)
            }
        }
    }

    /// A valid cancel of an alert the server hasn't confirmed. If nothing can have reached it,
    /// there's nobody to tell. Otherwise the cancel goes now, not on the next retry.
    private func finishCancelledCreate(_ id: UUID) {
        guard !creating.contains(id), let entry = pendingCreates[id], entry.cancel == false else { return }
        if entry.mayHaveLanded {
            track { [weak self] in await self?.createOnServer(alertID: id) }
        } else {
            stopTrackingPending(id)
        }
    }

    /// A duress PIN with no alert to cancel: at a check-in, or ending a session. Nothing on screen
    /// changes. It goes through the same durable path as any alert, so a dead zone can't lose it,
    /// and `cancel: true` delivers `alert/cancel {duress:true}` once it lands, which sets the server's
    /// flag and starts dispatch. Everything the caller needs is in place when this returns, so a
    /// session can end right after it without the mic and location stopping.
    ///
    /// `hidingAllClips`: a forced "Delete everything". Every clip saved so far leaves the Vault with
    /// this alert's own, and nothing is destroyed. Only the safety PIN brings them back.
    ///
    /// One is already running (a duress PIN at a check-in, then again at End Guard): the server is
    /// already sending help and evidence is already recording, so a second alert would only break
    /// that recording. This one renews the window instead.
    func startHiddenDuressAlert(reason: String, hidingAllClips: Bool = false) {
        let t = now
        if let live = duressAlertID {
            renewDuress(live, hidesClipsBefore: hidingAllClips ? t : nil)
            return
        }
        let record = AlertRecord(sessionID: serverSessionID, level: .dispatch, trigger: .manualSOS, reason: reason,
                                 policy: .dispatchImmediately, status: .dispatched, startedAt: t, levelChangedAt: t,
                                 events: [AlertEvent(who: "SafetySense", action: "alert_started", at: t)],
                                 contactReason: AlertReasonText.contact(AlertReasonText.askedForHelp, mode: mode))
        known[record.id] = record
        dispatchReasons[record.id] = reason
        trackPending(PendingAlert(record: record, cancel: true, dispatchReason: reason, hidden: true))
        evidence?.prepare(alertID: record.id)
        beginDuressTracking(alertID: record.id, hiddenFrom: .distantPast, hidesClipsBefore: hidingAllClips ? t : nil)
        track { [weak self] in await self?.createOnServer(alertID: record.id) }
    }

    private func beginDuressTracking(alertID: UUID, hiddenFrom: Date, serverAlertID: String? = nil,
                                     hidesClipsBefore: Date? = nil) {
        if let previous = duressAlertID, previous != alertID { supersededDuressIDs.append(previous) }
        duressAlertID = alertID
        saveDuressRecord(DuressRecord(alertID: alertID, hiddenFrom: hiddenFrom, enteredAt: now,
                                      serverAlertID: serverAlertID, hidesClipsBefore: hidesClipsBefore))
        duressUntil = now.addingTimeInterval(timing.duressTrackingDuration)
        onDuressTracking?(true)
        scheduleDuressLocation()
    }

    private func renewDuress(_ id: UUID, hidesClipsBefore: Date?) {
        duressUntil = now.addingTimeInterval(timing.duressTrackingDuration)
        sessionDuressRecords = DuressRecordStore.renewing(id, at: now, hidesClipsBefore: hidesClipsBefore, in: sessionDuressRecords)
        duressStore.save(DuressRecordStore.renewing(id, at: now, hidesClipsBefore: hidesClipsBefore, in: duressStore.load()))
    }

    private func saveDuressRecord(_ record: DuressRecord) {
        sessionDuressRecords = DuressRecordStore.merging(record, into: sessionDuressRecords)
        duressStore.save(DuressRecordStore.merging(record, into: duressStore.load()))
    }

    /// iOS can end the app during the 30 minutes a duress alert keeps sharing, and once
    /// `alert/create` has landed nothing else remembers it. Nothing shows on screen. The window
    /// stays the original one, so a relaunch can't stretch it.
    private func resumeDuressTracking() {
        guard duressAlertID == nil else { return }
        let cutoff = now.addingTimeInterval(-timing.duressTrackingDuration)
        guard let record = duressRecords.filter({ $0.enteredAt > cutoff }).max(by: { $0.enteredAt < $1.enteredAt }) else { return }
        let id = record.alertID
        // The server keeps the phone's own id unless it folded this into a live alert.
        let serverID = record.serverAlertID ?? id.uuidString.lowercased()
        if known[id] == nil {
            known[id] = AlertRecord(id: id, serverAlertID: serverID, level: .dispatch, trigger: .manualSOS, reason: "",
                                    policy: .dispatchImmediately, status: .dispatched, startedAt: record.enteredAt,
                                    levelChangedAt: record.enteredAt)
        }
        closedServerAlertIDs.insert(serverID)
        duressAlertID = id
        duressUntil = record.enteredAt.addingTimeInterval(timing.duressTrackingDuration)
        onDuressTracking?(true)
        scheduleDuressLocation()
        evidence?.prepare(alertID: id)
        let mode = self.mode
        track { [weak self] in await self?.evidence?.commit(alertID: id, serverAlertID: serverID, mode: mode) }
    }

    private func scheduleDuressLocation() {
        duressTimer?.cancel()
        duressTimer = clock.schedule(after: timing.locationInterval) { [weak self] in
            guard let self, let id = self.duressAlertID else { return }
            if let until = self.duressUntil, self.now >= until {
                self.stopDuressTracking(id)
                return
            }
            self.track { [weak self] in await self?.pushLocation(alertID: id) }
            self.scheduleDuressLocation()
        }
    }

    private func stopDuressTracking(_ id: UUID) {
        duressTimer?.cancel()
        duressAlertID = nil
        duressUntil = nil
        for earlier in supersededDuressIDs { evidence?.stop(alertID: earlier) }
        supersededDuressIDs = []
        evidence?.stop(alertID: id)
        onDuressTracking?(false)
        // An alert that started during the window has been sharing this capture. It needs its own now.
        if let alert = activeAlert, !alert.isDrill {
            let alertID = alert.id, serverID = alert.serverAlertID, mode = self.mode
            track { [weak self] in await self?.evidence?.commit(alertID: alertID, serverAlertID: serverID, mode: mode) }
        }
    }

    /// The saved records, plus any from this run that the Keychain didn't take.
    private var duressRecords: [DuressRecord] {
        let saved = duressStore.load()
        return saved + sessionDuressRecords.filter { record in !saved.contains { $0.alertID == record.alertID } }
    }

    /// What the Vault may list. Someone may be standing over the person when it's unlocked, so a
    /// duress alert's own recording stays out of it until the person brings it back.
    func vaultClips(_ clips: [EvidenceClip]) -> [EvidenceClip] {
        let records = duressRecords
        return clips.filter { clip in !records.contains { $0.hides(clip) } }
    }

    func vaultShows(_ clip: EvidenceClip) -> Bool { !vaultClips([clip]).isEmpty }

    /// True while any clip is held out of the Vault, so a PIN reset must not unlock it.
    var isHidingClips: Bool { duressRecords.contains { $0.hiddenFrom != nil } }

    /// The safety PIN was entered in the Vault, which only the person's own choice can do.
    func releaseVaultClips() {
        let released = duressRecords.map {
            DuressRecord(alertID: $0.alertID, hiddenFrom: nil, enteredAt: $0.enteredAt, serverAlertID: $0.serverAlertID)
        }
        sessionDuressRecords = released
        let cutoff = now.addingTimeInterval(-DuressRecordStore.liveLinkLifetime)
        duressStore.save(released.filter { $0.enteredAt > cutoff })
    }

    /// True while a duress alert's live link can still open. The server folds a later alert into
    /// that one, so the new alert's link would be the same page.
    var hasOpenDuressLink: Bool {
        let cutoff = now.addingTimeInterval(-DuressRecordStore.liveLinkLifetime)
        return duressRecords.contains { $0.enteredAt > cutoff }
    }

    /// "Delete everything" with the safety PIN removes the clips these records point at, and the
    /// person's own choice to wipe the phone also ends any recording still going.
    func forgetDuressRecords() {
        if let id = duressAlertID { stopDuressTracking(id) }
        sessionDuressRecords = []
        duressStore.save([])
    }

    // MARK: External alerts

    /// Takes over an alert that already exists on the server (created by an App Intent while
    /// the ladder wasn't running, e.g. Action Button from a cold start). Shows it, keeps the
    /// countdown going if it is still at Alert, and resumes location + status loops. The
    /// countdown keeps its real deadline, because the server's own clock never stopped. The first
    /// status poll reconciles anything that changed while the app was gone.
    func adopt(_ alert: AlertRecord) {
        guard activeAlert == nil, alert.serverAlertID != nil || pendingCreates[alert.id] != nil else { return }
        cancelLadderTimers()
        nextCheckInAt = nil
        var record = alert
        if record.dispatch != nil { dispatchRequested.insert(record.id) }
        record.events.append(AlertEvent(who: "SafetySense", action: "alert_resumed", at: now))
        known[record.id] = record
        activeAlert = record
        level = record.level
        if record.level == .alert {
            // A few seconds at least, so an overdue countdown hears from the server first.
            let left = timing.alertToDispatch - now.timeIntervalSince(record.levelChangedAt)
            armDispatchCountdown(after: max(left, Self.adoptedCountdownMinimum))
        } else {
            stepDeadline = nil
            if record.dispatch == nil, record.serverAlertID != nil {
                let id = record.id
                track { [weak self] in await self?.requestDispatch(alertID: id) }
            }
        }
        evidence?.prepare(alertID: record.id)
        let id = record.id, serverID = record.serverAlertID, mode = self.mode
        track { [weak self] in await self?.evidence?.commit(alertID: id, serverAlertID: serverID, mode: mode) }
        startAlertLoops()
        emit()
        track { [weak self] in await self?.pollStatus(alertID: id) }
    }

    static let adoptedCountdownMinimum: TimeInterval = 3

    /// An alert the server raised on its own, seen in a heartbeat: the watchdog fired while the
    /// phone was out of reach. Contacts already have it, so the person needs the countdown, the
    /// PIN and "I'm safe" right away. Never brings back one this phone closed.
    func adoptServerAlert(_ dto: LiveAlertDTO) {
        guard activeAlert == nil, !closedServerAlertIDs.contains(dto.id),
              !known.values.contains(where: { $0.serverAlertID == dto.id }),
              // The server keeps the phone's own id, so this also catches one still marked unconfirmed.
              UUID(uuidString: dto.id).flatMap({ known[$0] }) == nil,
              dto.status != "cancelled", dto.status != "resolved" else { return }
        let trigger = dto.trigger.flatMap(AlertTrigger.init(rawValue:)) ?? .heartbeatLost
        let dispatching = dto.level >= 3
        let started = BackendCoding.date(from: dto.startedAt) ?? now
        let record = AlertRecord(serverAlertID: dto.id, shareURL: URL(string: dto.shareUrl),
                                 sessionID: serverSessionID, level: dispatching ? .dispatch : .alert, trigger: trigger,
                                 reason: trigger == .heartbeatLost ? "Your phone lost its connection" : (dto.reason ?? trigger.displayName),
                                 policy: dto.dispatchPolicy.flatMap(DispatchPolicy.init(rawValue:)) ?? policies.policy(for: mode),
                                 status: dispatching ? .dispatched : .active, startedAt: started, levelChangedAt: started,
                                 contactReason: dto.reason)
        adopt(record)
    }

    // MARK: Drill

    func startDrill() async {
        let t = now
        var record = AlertRecord(sessionID: serverSessionID, level: .alert, trigger: .manualSOS, reason: "Practice drill",
                                 policy: .contactsFirst, status: .active, startedAt: t, levelChangedAt: t,
                                 events: [AlertEvent(who: "SafetySense", action: "drill_started", at: t)],
                                 isDrill: true)
        let ctx = (await context?.alertContext() ?? .unknown).forServer
        do {
            let response = try await backend.createAlert(AlertCreateRequest(
                sessionId: record.sessionID, level: 2, reason: "TEST: practice drill",
                trigger: AlertTrigger.manualSOS.rawValue, lat: ctx.latitude, lng: ctx.longitude,
                accuracy: ctx.accuracy, battery: ctx.battery, dryRun: true,
                dispatchPolicy: DispatchPolicy.contactsFirst.rawValue,
                clientAlertId: record.id.uuidString.lowercased()))
            record.serverAlertID = response.alertId
            closeDrillOnServer(response.alertId)
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

    /// Whatever started the drill, its TEST alert closes by itself, so the server's countdown never
    /// runs it into a simulated dispatch. Onboarding reads its events first.
    private func closeDrillOnServer(_ serverID: String) {
        closedServerAlertIDs.insert(serverID)
        drillCloseTimers[serverID] = clock.schedule(after: timing.drillCloseDelay) { [weak self] in
            guard let self else { return }
            self.drillCloseTimers[serverID] = nil
            let backend = self.backend
            self.track { _ = try? await backend.cancelAlert(AlertCancelRequest(alertId: serverID, duress: false)) }
        }
    }

    // MARK: Server

    /// Every alert that hasn't reached the server is sent again, for as long as it stays relevant.
    func retryServerWork() {
        serverRetryTimer?.cancel()
        serverRetryTimer = nil
        for id in pendingCreates.keys {
            track { [weak self] in await self?.createOnServer(alertID: id) }
        }
        if let alert = activeAlert, alert.level == .dispatch, alert.serverAlertID != nil, alert.dispatch == nil {
            track { [weak self] in await self?.requestDispatch(alertID: alert.id) }
        }
    }

    /// At launch: picks up alerts that hadn't reached the server when iOS ended the app. The one
    /// that was on screen comes back on screen, a hidden one goes out without a trace, and a duress
    /// alert still inside its window goes back to sharing location and recording.
    func restorePendingAlerts() {
        for entry in pendingStore.load(now: now) where pendingCreates[entry.record.id] == nil {
            pendingCreates[entry.record.id] = entry
            known[entry.record.id] = entry.record
            dispatchReasons[entry.record.id] = entry.dispatchReason
            if !entry.hidden, entry.cancel == nil { adopt(entry.record) }
            if entry.cancel == true, duressAlertID == nil {
                beginDuressTracking(alertID: entry.record.id, hiddenFrom: entry.hidden ? .distantPast : now)
            }
        }
        persistPending()
        resumeDuressTracking()
        retryServerWork()
    }

    private func armServerRetry() {
        guard serverRetryTimer == nil else { return }
        serverRetryTimer = clock.schedule(after: timing.serverRetryInterval) { [weak self] in
            self?.retryServerWork()
        }
    }

    private func trackPending(_ entry: PendingAlert) {
        pendingCreates[entry.record.id] = entry
        persistPending()
    }

    private func stopTrackingPending(_ id: UUID) {
        pendingCreates[id] = nil
        persistPending()
    }

    private func persistPending() {
        pendingStore.save(Array(pendingCreates.values))
    }

    private func createOnServer(alertID: UUID) async {
        guard pendingCreates[alertID] != nil, !creating.contains(alertID) else { return }
        creating.insert(alertID)
        defer { creating.remove(alertID) }
        guard known[alertID] != nil else { return }
        var ctx = (await context?.alertContext() ?? .unknown).forServer
        guard let snapshot = known[alertID], let entry = pendingCreates[alertID] else { return }
        if entry.cancel == false {
            // Cancelled with a valid PIN. `alert/create` must never go again from here: if the first
            // try didn't land, it would call everyone for someone already shown Marked safe.
            if entry.mayHaveLanded {
                await closeAlertThatMayHaveLanded(alertID, sessionID: snapshot.sessionID)
            } else {
                stopTrackingPending(alertID)   // It never reached the server: nobody needs to be told.
            }
            return
        }
        if entry.dropsOptionalFields == true { ctx = .unknown }
        // Dispatch hears about coercion only on a new alarm, so a duress alert must not start one
        // here. It goes in at level 2, and the cancel that follows sets the flag and escalates.
        // If that cancel never lands, the server's own countdown still reaches dispatch.
        let underDuress = entry.cancel == true
        let sessionToSend = entry.skipSession ? nil : snapshot.sessionID ?? serverSessionID
        func request(_ ctx: AlertContext) -> AlertCreateRequest {
            AlertCreateRequest(
                sessionId: sessionToSend,
                level: underDuress ? EscalationLevel.alert.rawValue : max(2, snapshot.level.rawValue),
                reason: snapshot.contactReason ?? snapshot.reason, trigger: snapshot.trigger.rawValue,
                lat: ctx.latitude, lng: ctx.longitude, accuracy: ctx.accuracy, battery: ctx.battery,
                dryRun: nil, dispatchPolicy: (underDuress ? DispatchPolicy.contactsFirst : snapshot.policy).rawValue,
                clientAlertId: alertID.uuidString.lowercased())
        }
        var answer: AlertCreateResponse?
        var failure: BackendError?
        var delays = [0] + timing.retryDelays
        while !delays.isEmpty {
            let delay = delays.removeFirst()
            if delay > 0 { try? await Task.sleep(for: .seconds(delay)) }
            guard pendingCreates[alertID]?.cancel != false else { break }   // A PIN landed during that wait.
            do {
                answer = try await backend.createAlert(request(ctx))
                break
            } catch {
                let backendError = error as? BackendError ?? .transport("request failed")
                failure = backendError
                if !backendError.neverReachedServer { pendingCreates[alertID]?.mayHaveLanded = true }
                if pendingCreates[alertID]?.cancel == false { break }
                // A location or battery value is never worth an alert: send it again without them.
                if case .http(400, _) = backendError, pendingCreates[alertID]?.dropsOptionalFields != true {
                    pendingCreates[alertID]?.dropsOptionalFields = true
                    persistPending()
                    ctx = .unknown
                    if delays.isEmpty { delays = [0] }
                    continue
                }
                if backendError.isPermanentRejection { break }
            }
        }
        guard let response = answer else {
            await createFailed(alertID: alertID, sessionID: snapshot.sessionID, sessionSent: sessionToSend != nil, error: failure)
            return
        }
        connectionNote = nil
        let delivered = pendingCreates[alertID]
        stopTrackingPending(alertID)
        guard var alert = known[alertID] else { return }
        alert.serverAlertID = response.alertId
        alert.shareURL = URL(string: response.shareUrl)
        alert.notified = response.notified
        alert.events += response.notified.map {
            AlertEvent(who: $0.name, action: "notified_by_\($0.channel.rawValue)", at: now)
        }
        store(alert)
        if delivered?.cancel == true || duressAlertID == alertID {
            saveDuressRecord(DuressRecord(alertID: alertID, hiddenFrom: nil, enteredAt: now, serverAlertID: response.alertId))
        }
        // No fix was ready for `alert/create` (a cold start): fill the map in as soon as one is.
        if ctx.latitude == nil { track { [weak self] in await self?.pushLocation(alertID: alertID) } }

        if let duress = delivered?.cancel {
            await sendCancel(serverID: response.alertId, duress: duress)
            if !duress {
                await closeEndedSession(snapshot.sessionID)
                emit()
                return
            }
        } else if alert.level == .dispatch {
            await requestDispatch(alertID: alertID)
        }
        // Either wait can outlast a valid PIN, and evidence must not restart after one.
        if evidenceWanted(alertID) {
            await evidence?.commit(alertID: alertID, serverAlertID: response.alertId, mode: mode)
        }
        emit()
    }

    private func evidenceWanted(_ alertID: UUID) -> Bool {
        activeAlert?.id == alertID || duressAlertID == alertID
    }

    /// A valid PIN went in and an attempt may have reached the server, so all that's left is the
    /// cancel. The server stores the alert under the phone's own id, and a 404 means it never landed.
    private func closeAlertThatMayHaveLanded(_ alertID: UUID, sessionID: String?) async {
        let serverID = alertID.uuidString.lowercased()
        closedServerAlertIDs.insert(serverID)
        do {
            _ = try await backend.cancelAlert(AlertCancelRequest(alertId: serverID, duress: false))
        } catch {
            guard (error as? BackendError)?.isPermanentRejection == true else {
                armServerRetry()
                return
            }
        }
        stopTrackingPending(alertID)
        await closeEndedSession(sessionID)
    }

    /// A create that landed after `session/end` sets the ended session to "alerted", and its cancel
    /// then sets it to "active". The watchdog would raise an alert on a phone that stopped sending
    /// heartbeats, and the phone could never see or stop it. Ending it again closes that.
    private func closeEndedSession(_ sessionID: String?) async {
        guard let sessionID, sessionID != serverSessionID else { return }
        _ = try? await backend.endSession(SessionEndRequest(sessionId: sessionID))
    }

    private func createFailed(alertID: UUID, sessionID: String?, sessionSent: Bool, error: BackendError?) async {
        guard let entry = pendingCreates[alertID] else { return }
        if entry.cancel == false {
            if entry.mayHaveLanded {
                await closeAlertThatMayHaveLanded(alertID, sessionID: sessionID)
            } else {
                stopTrackingPending(alertID)
            }
            return
        }
        persistPending()
        connectionNote = "Couldn't reach SafetySense's server yet. If you can, call 911."
        if var alert = known[alertID], !alert.events.contains(where: { $0.action == "server_unreachable" }) {
            alert.events.append(AlertEvent(who: "SafetySense", action: "server_unreachable", at: now))
            store(alert)
        }
        if evidenceWanted(alertID) { await evidence?.commit(alertID: alertID, serverAlertID: nil, mode: mode) }

        if error == .notRegistered || error.isUnauthorized { onDeviceNotRecognized?() }
        if case .http(404, _)? = error, sessionSent {
            pendingCreates[alertID]?.skipSession = true   // A session the server no longer has.
            persistPending()
            armServerRetry()
        } else if error?.isPermanentRejection == true {
            stopTrackingPending(alertID)   // The note stays up: 911 is the way from here.
        } else {
            armServerRetry()
        }
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
            connectionNote = nil
            current.dispatch = info
            current.events.append(AlertEvent(who: "dispatch", action: info.provider == .simulated
                                             ? "simulated_\(info.status)" : info.status, at: now))
            store(current)
            emit()
        } catch {
            dispatchRequested.remove(alertID)
            connectionNote = "Couldn't confirm dispatch yet. If you can, call 911."
            if (error as? BackendError)?.isPermanentRejection != true { armServerRetry() }
            emit()
        }
    }

    private func sendCancel(serverID: String, duress: Bool) async {
        closedServerAlertIDs.insert(serverID)
        let backend = self.backend
        let request = AlertCancelRequest(alertId: serverID, duress: duress)
        do {
            _ = try await withRetry { try await backend.cancelAlert(request) }
        } catch {
            // Queued in the client's outbox, which keeps trying.
            onCancelUnconfirmed?()
        }
    }

    private func pushLocation(alertID: UUID) async {
        guard let serverID = known[alertID]?.serverAlertID else { return }
        let ctx = (await context?.alertContext() ?? .unknown).forServer
        guard let lat = ctx.latitude, let lng = ctx.longitude else { return }
        let request = AlertLocationRequest(alertId: serverID, lat: lat, lng: lng, accuracy: max(0, ctx.accuracy ?? 0),
                                           battery: min(max(ctx.battery ?? 0, 0), 1))
        _ = try? await backend.updateAlertLocation(request)
    }

    private func pollStatus(alertID: UUID) async {
        guard let serverID = known[alertID]?.serverAlertID else { return }
        guard let response = try? await backend.alertStatus(AlertStatusRequest(alertId: serverID)),
              var alert = known[alertID] else { return }
        if activeAlert?.id == alertID, response.status == "cancelled" || response.status == "resolved" {
            endedOnServer(alert, status: response.status)
            return
        }
        alert.notified = CallProgress.apply(response.events, to: alert.notified)
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

    /// The server closed this alert while the app was gone, so the screen shouldn't keep counting.
    private func endedOnServer(_ alert: AlertRecord, status: String) {
        cancelLadderTimers()
        stopAlertLoops()
        level = .guarding
        activeAlert = nil
        stepDeadline = nil
        scheduleNextCheckIn()
        var record = alert
        record.status = status == "resolved" ? .resolved : .cancelled
        known[record.id] = record
        evidence?.stop(alertID: record.id)
        emit()
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
        if pendingCreates[alert.id] != nil {
            pendingCreates[alert.id]?.record = alert
            pendingCreates[alert.id]?.dispatchReason = dispatchReasons[alert.id]
            persistPending()
        }
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
                if error is CancellationError || (error as? BackendError)?.isPermanentRejection == true { break }
            }
        }
        throw lastError ?? CancellationError()
    }
}
