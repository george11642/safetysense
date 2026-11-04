import Foundation

/// One CoreMotion sample in g. `userAcceleration` excludes gravity; `gravity` is the gravity vector.
struct MotionSample: Sendable, Equatable {
    var time: TimeInterval
    var userAcceleration: SIMD3<Double>
    var gravity: SIMD3<Double>

    var userMagnitude: Double { (userAcceleration * userAcceleration).sum().squareRoot() }
    /// Total acceleration felt by the phone. Near 0 means free fall.
    var totalMagnitude: Double {
        let t = userAcceleration + gravity
        return (t * t).sum().squareRoot()
    }
}

enum MotionEvent: Sendable, Equatable {
    /// A hard spike (g) with no free fall before it.
    case impact(peak: Double)
    /// Free fall, then a spike: the phone fell.
    case phoneDropped(peak: Double)
    /// A spike, then the phone stayed still (seconds). The "fall" pattern.
    case impactThenStill(peak: Double, stillFor: TimeInterval)
    /// Sustained violent movement (RMS g over the window).
    case erratic(rms: Double)
    /// Erratic movement, then long stillness (seconds).
    case erraticThenStill(stillFor: TimeInterval)
}

/// Pure, deterministic CoreMotion pattern detector (SPEC 6.1.3): impact or fall (a spike then
/// stillness), erratic movement then long stillness, and a dropped phone.
struct MotionPatternDetector: Sendable {
    struct Config: Sendable, Equatable {
        var impactThreshold = 2.5            // g of user acceleration
        var freeFallThreshold = 0.3          // g total
        var freeFallMinDuration = 0.15       // s
        var dropWindow = 1.0                 // s from end of free fall to the spike
        var stillThreshold = 0.05            // g, smoothed
        var smoothing = 0.15                 // EMA factor per sample
        var stillAfterImpact: TimeInterval = 15
        var impactStillStartWithin: TimeInterval = 6
        var impactPatternTimeout: TimeInterval = 45
        var erraticWindow: TimeInterval = 4
        var erraticRMS = 0.9
        var erraticCooldown: TimeInterval = 30
        var stillAfterErratic: TimeInterval = 45
        var erraticStillStartWithin: TimeInterval = 20
        var erraticPatternTimeout: TimeInterval = 150
        var spikeCooldown: TimeInterval = 1.5
    }

    var config: Config
    private var smoothed: Double = 0
    private var stillSince: TimeInterval?
    private var freeFallStart: TimeInterval?
    private var lastFreeFallEnd: TimeInterval?
    private var lastSpike: TimeInterval = -.infinity
    private var pendingImpact: (time: TimeInterval, peak: Double)?
    private var lastErratic: TimeInterval = -.infinity
    private var pendingErratic: TimeInterval?
    private var window: [(time: TimeInterval, squared: Double)] = []
    private var windowSum: Double = 0

    init(config: Config = Config()) {
        self.config = config
    }

    mutating func process(_ s: MotionSample) -> [MotionEvent] {
        var events: [MotionEvent] = []
        let user = s.userMagnitude
        let total = s.totalMagnitude

        // Free fall tracking.
        if total < config.freeFallThreshold {
            if freeFallStart == nil { freeFallStart = s.time }
        } else if let start = freeFallStart {
            if s.time - start >= config.freeFallMinDuration { lastFreeFallEnd = s.time }
            freeFallStart = nil
        }

        // Spikes.
        if user >= config.impactThreshold, s.time - lastSpike >= config.spikeCooldown {
            lastSpike = s.time
            if let end = lastFreeFallEnd, s.time - end <= config.dropWindow {
                events.append(.phoneDropped(peak: user))
                lastFreeFallEnd = nil
            } else {
                events.append(.impact(peak: user))
            }
            pendingImpact = (s.time, user)
            stillSince = nil
            smoothed = user
        }

        // Stillness (smoothed so tiny jitters don't reset it).
        smoothed += config.smoothing * (user - smoothed)
        if smoothed < config.stillThreshold {
            if stillSince == nil { stillSince = s.time }
        } else {
            stillSince = nil
        }

        // Erratic movement: RMS of user acceleration over a sliding window.
        window.append((s.time, user * user))
        windowSum += user * user
        while let first = window.first, s.time - first.time > config.erraticWindow {
            windowSum -= first.squared
            window.removeFirst()
        }
        if let first = window.first, s.time - first.time >= config.erraticWindow * 0.75 {
            let rms = (max(0, windowSum) / Double(window.count)).squareRoot()
            if rms >= config.erraticRMS, s.time - lastErratic >= config.erraticCooldown {
                lastErratic = s.time
                pendingErratic = s.time
                events.append(.erratic(rms: rms))
            }
        }

        // Impact, then stillness.
        if let impact = pendingImpact {
            if let still = stillSince, still - impact.time <= config.impactStillStartWithin,
               s.time - still >= config.stillAfterImpact {
                events.append(.impactThenStill(peak: impact.peak, stillFor: s.time - still))
                pendingImpact = nil
            } else if s.time - impact.time > config.impactPatternTimeout {
                pendingImpact = nil
            }
        }

        // Erratic, then stillness.
        if let erratic = pendingErratic {
            if let still = stillSince, still - erratic <= config.erraticStillStartWithin,
               s.time - still >= config.stillAfterErratic {
                events.append(.erraticThenStill(stillFor: s.time - still))
                pendingErratic = nil
            } else if s.time - erratic > config.erraticPatternTimeout {
                pendingErratic = nil
            }
        }
        return events
    }

    /// Risk signal for an event (points from `RiskWeights`, scaled by severity).
    static func signal(for event: MotionEvent, at date: Date) -> RiskSignal {
        switch event {
        case .impact(let peak):
            let c = min(1, peak / 4)
            return RiskSignal(kind: .impact, weight: RiskWeights.points(for: .impact, confidence: c), timestamp: date,
                              detail: String(format: "Sudden impact (%.1f g)", peak), confidence: c)
        case .phoneDropped(let peak):
            return RiskSignal(kind: .phoneDropped, weight: RiskWeights.basePoints(for: .phoneDropped), timestamp: date,
                              detail: String(format: "Phone dropped (%.1f g)", peak))
        case .impactThenStill(let peak, let still):
            return RiskSignal(kind: .fall, weight: RiskWeights.basePoints(for: .fall), timestamp: date,
                              detail: String(format: "Hard impact (%.1f g), then still for %.0f s", peak, still))
        case .erratic(let rms):
            return RiskSignal(kind: .erraticMotion, weight: RiskWeights.basePoints(for: .erraticMotion), timestamp: date,
                              detail: String(format: "Erratic movement (%.1f g)", rms))
        case .erraticThenStill(let still):
            return RiskSignal(kind: .prolongedStillness, weight: RiskWeights.basePoints(for: .prolongedStillness),
                              timestamp: date, detail: String(format: "Erratic movement, then still for %.0f s", still))
        }
    }
}
