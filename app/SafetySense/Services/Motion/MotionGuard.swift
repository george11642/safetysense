@preconcurrency import CoreMotion
import Foundation

enum MotionGuardError: LocalizedError, Equatable {
    case unavailable

    var errorDescription: String? {
        "Motion sensing isn't available on this device."
    }
}

/// CoreMotion guard (SPEC 6.1.3). Samples device motion at 30 Hz on a background queue,
/// runs `MotionPatternDetector`, and reports signals on the main actor.
@MainActor
final class MotionGuard: MotionGuardService {
    static let sampleRate: Double = 30

    private(set) var isRunning = false
    var onSignal: RiskSignalHandler?

    private let manager = CMMotionManager()
    private let queue: OperationQueue = {
        let q = OperationQueue()
        q.name = "com.georgeteifel.SafetySense.motion"
        q.maxConcurrentOperationCount = 1
        q.qualityOfService = .utility
        return q
    }()
    private var processor: MotionProcessor?

    var isAvailable: Bool { manager.isDeviceMotionAvailable }

    func requestPermission() async -> Bool {
        // Device motion needs no prompt; the usage string covers the activity APIs.
        manager.isDeviceMotionAvailable
    }

    func start(mode: GuardMode) throws {
        guard manager.isDeviceMotionAvailable else { throw MotionGuardError.unavailable }
        stop()
        var config = MotionPatternDetector.Config()
        if mode == .nightOut {
            // Dancing is normal at a party: demand more before calling it erratic.
            config.erraticRMS = 1.3
        }
        let processor = MotionProcessor(config: config) { [weak self] events, date in
            Task { @MainActor in
                guard let self, self.isRunning else { return }
                for event in events { self.onSignal?(MotionPatternDetector.signal(for: event, at: date)) }
            }
        }
        self.processor = processor
        manager.deviceMotionUpdateInterval = 1 / Self.sampleRate
        processor.start(manager: manager, queue: queue)
        isRunning = true
    }

    func stop() {
        guard isRunning else { return }
        manager.stopDeviceMotionUpdates()
        processor = nil
        isRunning = false
    }
}

/// Queue-confined detector state. Only touched on the motion OperationQueue.
final class MotionProcessor: @unchecked Sendable {
    private var detector: MotionPatternDetector
    private let report: @Sendable ([MotionEvent], Date) -> Void

    init(config: MotionPatternDetector.Config, report: @escaping @Sendable ([MotionEvent], Date) -> Void) {
        self.detector = MotionPatternDetector(config: config)
        self.report = report
    }

    /// Nonisolated: the handler runs on `queue`, never on the main actor.
    func start(manager: CMMotionManager, queue: OperationQueue) {
        manager.startDeviceMotionUpdates(using: .xArbitraryZVertical, to: queue) { [weak self] motion, _ in
            guard let self, let motion else { return }
            let a = motion.userAcceleration
            let g = motion.gravity
            let sample = MotionSample(time: motion.timestamp,
                                      userAcceleration: SIMD3(a.x, a.y, a.z),
                                      gravity: SIMD3(g.x, g.y, g.z))
            let events = self.detector.process(sample)
            if !events.isEmpty { self.report(events, Date()) }
        }
    }
}
