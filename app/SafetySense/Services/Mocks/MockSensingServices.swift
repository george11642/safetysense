import Foundation

/// Demo/test audio guard. Never touches the microphone. Call `simulate(_:)` to inject a signal.
@MainActor
final class MockAudioGuardService: AudioGuardService {
    private(set) var isRunning = false
    var onSignal: RiskSignalHandler?
    var onListeningChange: (@MainActor (ListeningState) -> Void)?
    private(set) var resumeCount = 0
    var transcript = ""

    var microphonePermission: PermissionState = .granted
    func requestPermission() async -> Bool { true }
    func start(mode: GuardMode, safeWord: String?) async throws { isRunning = true }
    func stop() { isRunning = false }
    func resumeIfNeeded() { resumeCount += 1 }
    func snapshotRecentAudio() -> Data? { isRunning ? Data(repeating: 0, count: 1024) : nil }
    func recentTranscript() -> String { transcript }

    func simulate(_ kind: RiskSignalKind, weight: Double = 1.0, detail: String = "simulated") {
        onSignal?(RiskSignal(kind: kind, weight: weight, detail: detail, confidence: 0.9))
    }

    func simulate(listening state: ListeningState) { onListeningChange?(state) }
}

@MainActor
final class MockMotionGuardService: MotionGuardService {
    private(set) var isRunning = false
    var onSignal: RiskSignalHandler?

    func requestPermission() async -> Bool { true }
    func start(mode: GuardMode) throws { isRunning = true }
    func stop() { isRunning = false }

    func simulate(_ kind: RiskSignalKind, weight: Double = 1.0) {
        onSignal?(RiskSignal(kind: kind, weight: weight, detail: "simulated"))
    }
}

@MainActor
final class MockLocationService: LocationService {
    var authorization: LocationAuthorization = .always
    private(set) var lastFix: LocationFix? = .unmCampus
    var onSignal: RiskSignalHandler?
    var onFix: (@MainActor (LocationFix) -> Void)?
    var onArrival: (@MainActor () -> Void)?
    private(set) var isRunning = false
    private(set) var isTrackingAlert = false
    private(set) var startedDestination: LocationFix?

    func requestWhenInUse() async -> LocationAuthorization { authorization }
    func requestAlways() async -> LocationAuthorization { authorization }
    func start(mode: GuardMode, destination: LocationFix?) throws {
        isRunning = true
        startedDestination = destination
    }
    func stop() { isRunning = false }
    func currentFix() async -> LocationFix? { lastFix }
    func startAlertTracking() { isTrackingAlert = true }
    func stopAlertTracking() { isTrackingAlert = false }

    func simulateFix(_ fix: LocationFix) {
        lastFix = fix
        onFix?(fix)
    }
}

@MainActor
final class MockDeviceStatus: DeviceStatusProviding {
    var batteryLevel: Double? = 0.82
}
