@preconcurrency import CoreLocation
import Foundation
import UIKit

/// CoreLocation guard (SPEC 6.1.4, 12): `CLLocationUpdate.liveUpdates` inside a
/// `CLServiceSession` (+ `CLBackgroundActivitySession` so updates continue on the Lock
/// Screen), `CLMonitor` geofences for the destination and the planned area, and
/// `RouteMonitor` for off-route, vehicle-speed and unexpected-stop checks in Ride / Walk.
/// Location is only read during a session or an alert.
///
/// A session also runs classic updates with pausing off (`keepsProcessAlive`). Live updates pause
/// when you stop moving, and with no microphone nothing else keeps the app running through a long
/// red light. The heartbeat would stop and the watchdog would call contacts for someone who's fine.
@MainActor
final class LocationGuard: NSObject, LocationService, CLLocationManagerDelegate {
    private(set) var lastFix: LocationFix?
    var onSignal: RiskSignalHandler?
    var onFix: (@MainActor (LocationFix) -> Void)?
    /// Called once when the destination geofence is entered.
    var onArrival: (@MainActor () -> Void)?
    private(set) var isRunning = false
    private(set) var arrived = false

    private let manager = CLLocationManager()
    private let calendar: Calendar
    private var serviceSession: CLServiceSession?
    private var backgroundSession: CLBackgroundActivitySession?
    private var updatesTask: Task<Void, Never>?
    private var monitorEventsTask: Task<Void, Never>?
    /// One for the app's lifetime: Apple allows a single live CLMonitor per name, so a quick End
    /// then Start must reuse it. Sessions only add and remove its conditions.
    private var monitor: CLMonitor?
    /// Condition changes run strictly in order, so a stop can't remove a new session's geofence.
    private var conditionsWork: Task<Void, Never>?
    private(set) var isTrackingAlert = false
    private var keepsProcessAlive = false
    private var promptWatcher: Task<Void, Never>?
    private var route = RouteMonitor(mode: .everyday, destination: nil)
    private var mode: GuardMode = .everyday
    private var destination: LocationFix?
    private var plannedAreaArmed = false
    private var wasInsidePlannedArea = false
    private var authWaiters: [CheckedContinuation<LocationAuthorization, Never>] = []

    static let monitorName = "SafetySenseGuard"
    static let destinationID = "destination"
    static let plannedAreaID = "plannedArea"
    static let destinationRadius: CLLocationDistance = 150
    static let plannedAreaRadius: CLLocationDistance = 400
    /// The app counts as past the Always prompt after it has been active this long: while a
    /// system prompt is up, the app isn't active.
    static let promptSettle: TimeInterval = 2
    static let promptMaxWait: TimeInterval = 180

    init(calendar: Calendar = .current) {
        self.calendar = calendar
        super.init()
        manager.delegate = self
    }

    // MARK: Authorization

    var authorization: LocationAuthorization { Self.map(manager.authorizationStatus) }

    static func map(_ status: CLAuthorizationStatus) -> LocationAuthorization {
        switch status {
        case .notDetermined: .notDetermined
        case .restricted, .denied: .denied
        case .authorizedWhenInUse: .whenInUse
        case .authorizedAlways: .always
        @unknown default: .denied
        }
    }

    func requestWhenInUse() async -> LocationAuthorization {
        guard authorization == .notDetermined else { return authorization }
        return await withCheckedContinuation { continuation in
            authWaiters.append(continuation)
            manager.requestWhenInUseAuthorization()
        }
    }

    func requestAlways() async -> LocationAuthorization {
        switch authorization {
        case .always, .denied: return authorization
        case .notDetermined:
            _ = await requestWhenInUse()
            guard authorization == .whenInUse else { return authorization }
        case .whenInUse:
            break
        }
        return await withCheckedContinuation { continuation in
            authWaiters.append(continuation)
            manager.requestAlwaysAuthorization()
            watchAlwaysPrompt()
        }
    }

    /// iOS shows the upgrade prompt only once and sends no callback when the answer is "Keep While
    /// Using" or the prompt never appears, so nothing else would ever end the wait.
    private func watchAlwaysPrompt() {
        promptWatcher?.cancel()
        promptWatcher = Task { [weak self] in
            var settled: TimeInterval = 0
            var waited: TimeInterval = 0
            while !Task.isCancelled, settled < Self.promptSettle, waited < Self.promptMaxWait {
                try? await Task.sleep(for: .milliseconds(500))
                waited += 0.5
                settled = UIApplication.shared.applicationState == .active ? settled + 0.5 : 0
            }
            guard !Task.isCancelled, let self else { return }
            self.resolveWaiters(self.authorization)
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        Task { @MainActor in self.resolveWaiters(Self.map(status)) }
    }

    private func resolveWaiters(_ status: LocationAuthorization) {
        guard status != .notDetermined else { return }
        promptWatcher?.cancel()
        promptWatcher = nil
        let waiters = authWaiters
        authWaiters.removeAll()
        waiters.forEach { $0.resume(returning: status) }
    }

    // MARK: Session

    func start(mode: GuardMode, destination: LocationFix?) throws {
        stop()
        self.mode = mode
        self.destination = destination
        route = RouteMonitor(mode: mode, destination: destination)
        arrived = false
        plannedAreaArmed = false
        wasInsidePlannedArea = false
        serviceSession = CLServiceSession(authorization: .whenInUse)
        backgroundSession = CLBackgroundActivitySession()
        isRunning = true
        startKeepingProcessAlive()

        let configuration: CLLocationUpdate.LiveConfiguration = switch mode {
        case .ride: .automotiveNavigation
        case .walk: .fitness
        default: .default
        }
        updatesTask = Task { [weak self] in
            do {
                for try await update in CLLocationUpdate.liveUpdates(configuration) {
                    guard let self, self.isRunning, !Task.isCancelled else { break }
                    if let location = update.location { self.handle(location) }
                }
            } catch {
                // Updates end on stop or when authorization is withdrawn.
            }
        }
        if let destination { addDestinationCondition(destination) }
    }

    func stop() {
        guard isRunning else { return }
        isRunning = false
        stopKeepingProcessAlive()
        updatesTask?.cancel()
        updatesTask = nil
        updateConditions { monitor in
            await monitor.remove(Self.destinationID)
            await monitor.remove(Self.plannedAreaID)
        }
        serviceSession?.invalidate()
        serviceSession = nil
        backgroundSession?.invalidate()
        backgroundSession = nil
    }

    func currentFix() async -> LocationFix? {
        if let lastFix, Date.now.timeIntervalSince(lastFix.timestamp) < 30 { return lastFix }
        guard authorization == .whenInUse || authorization == .always else { return lastFix }
        let session = isRunning ? nil : CLServiceSession(authorization: authorization == .always ? .always : .whenInUse)
        defer { session?.invalidate() }
        let found: LocationFix? = await withTaskGroup(of: LocationFix?.self) { group in
            group.addTask {
                do {
                    for try await update in CLLocationUpdate.liveUpdates() {
                        if let loc = update.location, loc.horizontalAccuracy >= 0, loc.horizontalAccuracy < 200 {
                            return Self.fix(from: loc)
                        }
                    }
                } catch {}
                return nil
            }
            group.addTask {
                try? await Task.sleep(for: .seconds(5))
                return nil
            }
            let first = await group.next() ?? nil
            group.cancelAll()
            return first
        }
        if let found { lastFix = found }
        return found ?? lastFix
    }

    // MARK: Alerts

    /// Classic updates, because they can start from a background launch under Always and they
    /// keep the process running for the alert's location and status loops.
    func startAlertTracking() {
        guard !isTrackingAlert, canRunClassicUpdates else { return }
        isTrackingAlert = true
        runClassicUpdates(accuracy: kCLLocationAccuracyBest)
    }

    func stopAlertTracking() {
        guard isTrackingAlert else { return }
        isTrackingAlert = false
        if keepsProcessAlive {
            manager.desiredAccuracy = Self.keepAliveAccuracy
        } else {
            stopClassicUpdates()
        }
    }

    private var canRunClassicUpdates: Bool { authorization == .always || authorization == .whenInUse }

    /// Coarse is enough: this only has to keep running. `liveUpdates` does the route work.
    static let keepAliveAccuracy = kCLLocationAccuracyHundredMeters

    private func startKeepingProcessAlive() {
        guard !keepsProcessAlive, canRunClassicUpdates else { return }
        keepsProcessAlive = true
        runClassicUpdates(accuracy: isTrackingAlert ? kCLLocationAccuracyBest : Self.keepAliveAccuracy)
    }

    private func stopKeepingProcessAlive() {
        guard keepsProcessAlive else { return }
        keepsProcessAlive = false
        if !isTrackingAlert { stopClassicUpdates() }
    }

    private func runClassicUpdates(accuracy: CLLocationAccuracy) {
        manager.allowsBackgroundLocationUpdates = true
        manager.pausesLocationUpdatesAutomatically = false
        manager.desiredAccuracy = accuracy
        manager.startUpdatingLocation()
    }

    private func stopClassicUpdates() {
        manager.stopUpdatingLocation()
        manager.allowsBackgroundLocationUpdates = false
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        let fix = Self.fix(from: location)
        Task { @MainActor in self.handleAlertFix(fix) }
    }

    private func handleAlertFix(_ fix: LocationFix) {
        guard isTrackingAlert, fix.isUsable else { return }
        lastFix = fix
        onFix?(fix)
    }

    // MARK: Updates

    nonisolated static func fix(from location: CLLocation) -> LocationFix {
        LocationFix(latitude: location.coordinate.latitude, longitude: location.coordinate.longitude,
                    accuracy: location.horizontalAccuracy, timestamp: location.timestamp,
                    speed: location.speed >= 0 ? location.speed : nil)
    }

    private func handle(_ location: CLLocation) {
        let fix = Self.fix(from: location)
        guard fix.isUsable else { return }
        lastFix = fix
        onFix?(fix)
        if !plannedAreaArmed, fix.accuracy <= 100 { armPlannedArea(around: fix) }
        let hour = calendar.component(.hour, from: fix.timestamp)
        for event in route.process(fix, hour: hour) {
            if event == .arrived {
                markArrived()
            } else if let signal = RouteMonitor.signal(for: event, at: fix.timestamp) {
                onSignal?(signal)
            }
        }
    }

    private func markArrived() {
        guard !arrived else { return }
        arrived = true
        onArrival?()
    }

    // MARK: Geofences (CLMonitor)

    /// Creates the monitor once and reads its events for the rest of the app's life.
    private func sharedMonitor() async -> CLMonitor {
        if let monitor { return monitor }
        let created = await CLMonitor(Self.monitorName)
        monitor = created
        // Clear anything left from an earlier launch.
        for id in await created.identifiers { await created.remove(id) }
        monitorEventsTask = Task { [weak self] in
            do {
                for try await event in await created.events {
                    guard let self else { return }
                    if self.isRunning { self.handleMonitorEvent(identifier: event.identifier, state: event.state) }
                }
            } catch {}
        }
        return created
    }

    private func updateConditions(_ change: @escaping @Sendable (CLMonitor) async -> Void) {
        let previous = conditionsWork
        conditionsWork = Task { [weak self] in
            await previous?.value
            guard let self else { return }
            await change(await self.sharedMonitor())
        }
    }

    private func addDestinationCondition(_ destination: LocationFix) {
        let center = CLLocationCoordinate2D(latitude: destination.latitude, longitude: destination.longitude)
        updateConditions { monitor in
            await monitor.add(CLMonitor.CircularGeographicCondition(center: center, radius: Self.destinationRadius),
                              identifier: Self.destinationID, assuming: .unsatisfied)
        }
    }

    /// Night Out and Date: the planned area is where the session started (or the venue).
    private func armPlannedArea(around fix: LocationFix) {
        guard mode == .nightOut || mode == .date else { return }
        plannedAreaArmed = true
        let anchor = mode == .date ? (destination ?? fix) : fix
        let center = CLLocationCoordinate2D(latitude: anchor.latitude, longitude: anchor.longitude)
        updateConditions { monitor in
            await monitor.add(CLMonitor.CircularGeographicCondition(center: center, radius: Self.plannedAreaRadius),
                              identifier: Self.plannedAreaID, assuming: .satisfied)
        }
    }

    private func handleMonitorEvent(identifier: String, state: CLMonitor.Event.State) {
        switch (identifier, state) {
        case (Self.destinationID, .satisfied):
            markArrived()
        case (Self.plannedAreaID, .satisfied):
            wasInsidePlannedArea = true
        case (Self.plannedAreaID, .unsatisfied):
            guard wasInsidePlannedArea || plannedAreaArmed else { return }
            wasInsidePlannedArea = false
            onSignal?(RiskSignal(kind: .leftPlannedArea, weight: RiskWeights.basePoints(for: .leftPlannedArea),
                                 detail: "Left the area where the night started"))
        default:
            break
        }
    }
}
