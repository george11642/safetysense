@preconcurrency import CoreLocation
import Foundation

/// CoreLocation guard (SPEC 6.1.4, 12): `CLLocationUpdate.liveUpdates` inside a
/// `CLServiceSession` (+ `CLBackgroundActivitySession` so updates continue on the Lock
/// Screen), `CLMonitor` geofences for the destination and the planned area, and
/// `RouteMonitor` for off-route, vehicle-speed and unexpected-stop checks in Ride / Walk.
/// Location is only read during a session or an alert.
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
    private var monitorTask: Task<Void, Never>?
    private var monitor: CLMonitor?
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
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        Task { @MainActor in self.resolveWaiters(Self.map(status)) }
    }

    private func resolveWaiters(_ status: LocationAuthorization) {
        guard status != .notDetermined else { return }
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
        startMonitoring()
    }

    func stop() {
        guard isRunning else { return }
        isRunning = false
        updatesTask?.cancel()
        updatesTask = nil
        monitorTask?.cancel()
        monitorTask = nil
        if let monitor {
            Task {
                await monitor.remove(Self.destinationID)
                await monitor.remove(Self.plannedAreaID)
            }
        }
        monitor = nil
        serviceSession?.invalidate()
        serviceSession = nil
        backgroundSession?.invalidate()
        backgroundSession = nil
    }

    func currentFix() async -> LocationFix? {
        if let lastFix, Date.now.timeIntervalSince(lastFix.timestamp) < 30 { return lastFix }
        guard authorization == .whenInUse || authorization == .always else { return lastFix }
        let session = isRunning ? nil : CLServiceSession(authorization: .whenInUse)
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

    // MARK: Updates

    nonisolated static func fix(from location: CLLocation) -> LocationFix {
        LocationFix(latitude: location.coordinate.latitude, longitude: location.coordinate.longitude,
                    accuracy: location.horizontalAccuracy, timestamp: location.timestamp,
                    speed: location.speed >= 0 ? location.speed : nil)
    }

    private func handle(_ location: CLLocation) {
        let fix = Self.fix(from: location)
        lastFix = fix
        onFix?(fix)
        if !plannedAreaArmed, fix.accuracy >= 0, fix.accuracy <= 100 { armPlannedArea(around: fix) }
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

    private func startMonitoring() {
        let destination = self.destination
        monitorTask = Task { [weak self] in
            let monitor = await CLMonitor(Self.monitorName)
            // Clear anything left from an earlier session.
            for id in await monitor.identifiers { await monitor.remove(id) }
            guard let self, self.isRunning else { return }
            self.monitor = monitor
            if let destination {
                let center = CLLocationCoordinate2D(latitude: destination.latitude, longitude: destination.longitude)
                await monitor.add(CLMonitor.CircularGeographicCondition(center: center, radius: Self.destinationRadius),
                                  identifier: Self.destinationID, assuming: .unsatisfied)
            }
            do {
                for try await event in await monitor.events {
                    guard !Task.isCancelled else { break }
                    self.handleMonitorEvent(identifier: event.identifier, state: event.state)
                }
            } catch {}
        }
    }

    /// Night Out and Date: the planned area is where the session started (or the venue).
    private func armPlannedArea(around fix: LocationFix) {
        guard mode == .nightOut || mode == .date, let monitor else { return }
        plannedAreaArmed = true
        let anchor = mode == .date ? (destination ?? fix) : fix
        let center = CLLocationCoordinate2D(latitude: anchor.latitude, longitude: anchor.longitude)
        Task {
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
