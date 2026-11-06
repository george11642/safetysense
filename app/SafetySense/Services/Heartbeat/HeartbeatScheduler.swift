import BackgroundTasks
import Foundation
import os

/// Sends `session/heartbeat` every 60 s while a Guard session runs and the app is alive
/// (Guard keeps the app running with its audio / location background modes). During a live
/// alert it beats every 15 s and also posts `alert/location`, so contacts' map stays fresh.
///
/// If the phone goes dark (powered off, smashed, airplane mode), the beats stop and the
/// server's watchdog raises a `heartbeat_lost` alert on its own (SPEC 6.1.6). A best-effort
/// `BGAppRefreshTask` also sends a beat and drains the offline outbox when iOS allows it.
@MainActor
final class HeartbeatScheduler: HeartbeatServiceProtocol {
    nonisolated static let refreshTaskIdentifier = "com.georgeteifel.SafetySense.refresh"
    static let alertInterval: TimeInterval = 15

    private(set) var isRunning = false
    private(set) var lastSentAt: Date?
    /// Why the last beat failed (nil when it got through).
    private(set) var lastError: String?
    var isFailing: Bool { lastError != nil }

    private let backend: any BackendClientProtocol
    private let log = Logger(subsystem: "com.georgeteifel.SafetySense", category: "heartbeat")
    private var loop: Task<Void, Never>?
    private var serverSessionID: String?
    private var interval: TimeInterval = 60

    // Attached after the container is built (see `SystemBridge.install`).
    private weak var location: (any LocationService)?
    private weak var device: (any DeviceStatusProviding)?
    private weak var escalation: (any EscalationControllerProtocol)?

    init(backend: any BackendClientProtocol) {
        self.backend = backend
        if let stored = AppGroup.defaults.object(forKey: AppGroup.Keys.heartbeatLastSentAt) as? Double {
            lastSentAt = Date(timeIntervalSince1970: stored)
        }
    }

    func attach(location: any LocationService, device: any DeviceStatusProviding,
                escalation: any EscalationControllerProtocol) {
        self.location = location
        self.device = device
        self.escalation = escalation
    }

    // MARK: HeartbeatServiceProtocol

    func start(serverSessionID: String, interval: TimeInterval) {
        stop()
        self.serverSessionID = serverSessionID
        self.interval = max(interval, 15)
        isRunning = true
        AppGroup.defaults.set(serverSessionID, forKey: AppGroup.Keys.heartbeatSessionID)
        Self.scheduleAppRefresh()
        loop = Task { [weak self] in
            while !Task.isCancelled {
                guard let self else { return }
                await self.beat()
                let wait = self.currentInterval
                try? await Task.sleep(for: .seconds(wait))
            }
        }
    }

    func stop() {
        loop?.cancel()
        loop = nil
        isRunning = false
        serverSessionID = nil
        AppGroup.defaults.removeObject(forKey: AppGroup.Keys.heartbeatSessionID)
        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: Self.refreshTaskIdentifier)
    }

    /// Sends one beat now (also used when the app returns to the foreground).
    func beatNow() {
        guard isRunning else { return }
        Task { await beat() }
    }

    // MARK: Beating

    private var liveAlertID: String? {
        guard let alert = escalation?.activeAlert, !alert.isDrill,
              alert.status == .active || alert.status == .dispatched else { return nil }
        return alert.serverAlertID
    }

    private var currentInterval: TimeInterval {
        liveAlertID == nil ? interval : min(interval, Self.alertInterval)
    }

    private func beat() async {
        guard let sessionID = serverSessionID else { return }
        var fix = location?.lastFix
        if fix == nil { fix = await location?.currentFix() }
        let battery = device?.batteryLevel
        let request = HeartbeatRequest(sessionId: sessionID, lat: fix?.latitude, lng: fix?.longitude,
                                       accuracy: fix?.accuracy, battery: battery)
        do {
            _ = try await backend.heartbeat(request)
            markSent()
        } catch BackendError.http(let status, _) where status == 409 || status == 404 {
            // The server already ended this session (ended elsewhere or erased). Stop quietly.
            log.notice("Session closed on the server; stopping heartbeats")
            stop()
            return
        } catch {
            lastError = (error as? BackendError)?.logDescription ?? "failed"
            // HTTPBackendClient keeps the beat in its outbox; nothing else to do.
        }

        // The heartbeat already feeds the live map for session alerts; this also covers an
        // alert raised outside a session and keeps the trail if the session row is gone.
        // `alert/location` requires a battery value, so it's skipped when the level is unknown.
        if let alertID = liveAlertID, let fix, let battery {
            _ = try? await backend.updateAlertLocation(AlertLocationRequest(
                alertId: alertID, lat: fix.latitude, lng: fix.longitude,
                accuracy: fix.accuracy, battery: min(max(battery, 0), 1)))
        }
    }

    private func markSent() {
        let now = Date.now
        lastSentAt = now
        lastError = nil
        AppGroup.defaults.set(now.timeIntervalSince1970, forKey: AppGroup.Keys.heartbeatLastSentAt)
    }

    // MARK: Background refresh (best effort)

    private static var didRegister = false

    /// Must run before the app finishes launching (called from `SystemBridge.install`).
    static func registerBackgroundTasks() {
        guard !didRegister else { return }
        didRegister = true
        BGTaskScheduler.shared.register(forTaskWithIdentifier: refreshTaskIdentifier, using: nil,
                                        launchHandler: makeLaunchHandler())
    }

    /// Built outside the main actor: BackgroundTasks calls it on its own queue.
    private nonisolated static func makeLaunchHandler() -> @Sendable (BGTask) -> Void {
        { task in
            let box = BackgroundTaskBox(task)
            Task.detached { await HeartbeatScheduler.runBackgroundRefresh(box) }
        }
    }

    nonisolated static func scheduleAppRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: refreshTaskIdentifier)
        request.earliestBeginDate = .now.addingTimeInterval(15 * 60)
        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            // Unavailable in the simulator and when Background App Refresh is off; the
            // in-app loop and the server watchdog still cover the session.
        }
    }

    private nonisolated static func runBackgroundRefresh(_ box: BackgroundTaskBox) async {
        let backend = HTTPBackendClient.shared
        let work = Task.detached {
            if let sessionID = AppGroup.defaults.string(forKey: AppGroup.Keys.heartbeatSessionID) {
                _ = try? await backend.heartbeat(HeartbeatRequest(sessionId: sessionID))
                scheduleAppRefresh()
            }
            await backend.flushOutbox()
        }
        box.task.expirationHandler = { @Sendable in work.cancel() }
        _ = await work.result
        box.task.setTaskCompleted(success: !work.isCancelled)
    }
}

/// `BGTask` isn't `Sendable`; it is only touched from the task's own handler and completion.
private final class BackgroundTaskBox: @unchecked Sendable {
    let task: BGTask
    init(_ task: BGTask) { self.task = task }
}
