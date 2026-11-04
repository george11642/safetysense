import Foundation

enum RouteEvent: Sendable, Equatable {
    case arrived
    /// Distance (m) outside the expected corridor.
    case routeDeviation(meters: Double)
    /// Moving at vehicle speed (m/s) while outside the corridor.
    case vehicleSpeedOffRoute(speed: Double, meters: Double)
    /// Stopped this long (s) somewhere that isn't the destination.
    case unexpectedStop(seconds: TimeInterval)
    /// Far (m) from where the session started, late at night.
    case unknownPlaceLateNight(meters: Double)
}

/// Pure route logic for Walk, Ride, Night Out and Date (SPEC 5, 6.1.4). Uses a straight-line
/// corridor between the start and the destination; good enough for city distances and
/// fully explainable ("1.2 km off the way home").
struct RouteMonitor: Sendable {
    struct Config: Sendable, Equatable {
        var corridorMinimum: Double = 350          // m
        var corridorFraction: Double = 0.3         // of trip length
        var vehicleSpeed: Double = 7               // m/s (about 16 mph)
        var stopSpeed: Double = 0.6                // m/s
        var stopDrift: Double = 25                 // m moved while still "stopped"
        var rideStopLimit: TimeInterval = 180      // SPEC: a stop longer than 3 min
        var walkStopLimit: TimeInterval = 420
        var arrivalRadius: Double = 150            // m
        var lateNightDistance: Double = 2500       // m from the start
        var cooldown: TimeInterval = 300
        var maxAccuracy: Double = 100              // ignore fixes worse than this
    }

    let mode: GuardMode
    let destination: LocationFix?
    var config: Config
    private(set) var origin: LocationFix?
    private(set) var arrived = false
    private var stopAnchor: LocationFix?
    private var stopReported = false
    private var lastEmitted: [String: Date] = [:]
    private var lateNightReported = false

    init(mode: GuardMode, destination: LocationFix?, config: Config = Config()) {
        self.mode = mode
        self.destination = destination
        self.config = config
    }

    mutating func process(_ fix: LocationFix, hour: Int) -> [RouteEvent] {
        guard fix.accuracy >= 0, fix.accuracy <= config.maxAccuracy else { return [] }
        if origin == nil { origin = fix }
        guard let origin else { return [] }
        var events: [RouteEvent] = []

        if let destination, !arrived, Self.distance(fix, destination) <= config.arrivalRadius {
            arrived = true
            events.append(.arrived)
        }

        // Off route (Walk and Ride with a destination).
        if let destination, !arrived, mode == .walk || mode == .ride {
            let trip = Self.distance(origin, destination)
            let corridor = max(config.corridorMinimum, config.corridorFraction * trip)
            let off = Self.distanceToSegment(fix, from: origin, to: destination)
            if off > corridor {
                let speed = fix.speed ?? 0
                if mode == .ride, speed >= config.vehicleSpeed {
                    if allow("vehicle", at: fix.timestamp) {
                        events.append(.vehicleSpeedOffRoute(speed: speed, meters: off - corridor))
                    }
                } else if allow("deviation", at: fix.timestamp) {
                    events.append(.routeDeviation(meters: off - corridor))
                }
            }
        }

        // Unexpected stops (Ride and Walk).
        if (mode == .ride || mode == .walk), !arrived {
            let slow = (fix.speed ?? 0) < config.stopSpeed
            if slow, let anchor = stopAnchor, Self.distance(anchor, fix) <= config.stopDrift {
                let stopped = fix.timestamp.timeIntervalSince(anchor.timestamp)
                let limit = mode == .ride ? config.rideStopLimit : config.walkStopLimit
                if stopped >= limit, !stopReported {
                    stopReported = true
                    events.append(.unexpectedStop(seconds: stopped))
                }
            } else if slow {
                stopAnchor = fix
                stopReported = false
            } else {
                stopAnchor = nil
                stopReported = false
            }
        }

        // Somewhere unfamiliar, late (Night Out and Date).
        if (mode == .nightOut || mode == .date), !lateNightReported, RiskWeights.isLateNight(hour: hour),
           hour < 5 || hour >= 23 {
            let away = Self.distance(origin, fix)
            if away >= config.lateNightDistance {
                lateNightReported = true
                events.append(.unknownPlaceLateNight(meters: away))
            }
        }
        return events
    }

    private mutating func allow(_ key: String, at date: Date) -> Bool {
        if let last = lastEmitted[key], date.timeIntervalSince(last) < config.cooldown { return false }
        lastEmitted[key] = date
        return true
    }

    // MARK: Geometry (local equirectangular projection, metres)

    static let earthRadius = 6_371_000.0

    static func distance(_ a: LocationFix, _ b: LocationFix) -> Double {
        let p = project(b, around: a)
        return (p.x * p.x + p.y * p.y).squareRoot()
    }

    static func distanceToSegment(_ p: LocationFix, from a: LocationFix, to b: LocationFix) -> Double {
        let pb = project(b, around: a)
        let pp = project(p, around: a)
        let lengthSquared = pb.x * pb.x + pb.y * pb.y
        guard lengthSquared > 0 else { return (pp.x * pp.x + pp.y * pp.y).squareRoot() }
        let t = min(1, max(0, (pp.x * pb.x + pp.y * pb.y) / lengthSquared))
        let dx = pp.x - t * pb.x
        let dy = pp.y - t * pb.y
        return (dx * dx + dy * dy).squareRoot()
    }

    private static func project(_ p: LocationFix, around origin: LocationFix) -> (x: Double, y: Double) {
        let lat0 = origin.latitude * .pi / 180
        let x = (p.longitude - origin.longitude) * .pi / 180 * cos(lat0) * earthRadius
        let y = (p.latitude - origin.latitude) * .pi / 180 * earthRadius
        return (x, y)
    }

    /// Risk signal for a route event (nil for arrival).
    static func signal(for event: RouteEvent, at date: Date) -> RiskSignal? {
        switch event {
        case .arrived:
            return nil
        case .routeDeviation(let m):
            let c = min(1, 0.5 + m / 2000)
            return RiskSignal(kind: .routeDeviation, weight: RiskWeights.points(for: .routeDeviation, confidence: c),
                              timestamp: date, detail: "About \(formatted(m)) off the planned route", confidence: c)
        case .vehicleSpeedOffRoute(let speed, let m):
            return RiskSignal(kind: .vehicleSpeedOffRoute, weight: RiskWeights.basePoints(for: .vehicleSpeedOffRoute),
                              timestamp: date,
                              detail: String(format: "Moving %.0f mph, %@ off route", speed * 2.237, formatted(m)))
        case .unexpectedStop(let seconds):
            return RiskSignal(kind: .unexpectedStop, weight: RiskWeights.basePoints(for: .unexpectedStop), timestamp: date,
                              detail: "Stopped for \(Int(seconds / 60)) min away from the destination")
        case .unknownPlaceLateNight(let m):
            return RiskSignal(kind: .unknownPlaceLateNight, weight: RiskWeights.basePoints(for: .unknownPlaceLateNight),
                              timestamp: date, detail: "\(formatted(m)) from where the night started")
        }
    }

    private static func formatted(_ meters: Double) -> String {
        meters >= 1000 ? String(format: "%.1f km", meters / 1000) : "\(Int(meters.rounded())) m"
    }
}
