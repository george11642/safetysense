import Foundation

/// Callback every sensor uses to report a signal to the risk engine. Always called on the main actor.
typealias RiskSignalHandler = @MainActor (RiskSignal) -> Void

/// Whether the microphone is really listening, for the Guard screen and the Live Activity.
enum ListeningState: Sendable, Equatable {
    case listening
    /// A call or Siri has the microphone; it should come back by itself.
    case interrupted
    /// It stopped and couldn't restart. Opening the app brings it back.
    case paused
}

/// On-device audio guard: SoundAnalysis classifier + SpeechAnalyzer safe word / distress phrases,
/// with a 30 s RAM-only ring buffer (SPEC 6.1, 11). Owned by the Guard Engine module.
@MainActor
protocol AudioGuardService: AnyObject {
    var isRunning: Bool { get }
    var onSignal: RiskSignalHandler? { get set }
    /// Called whenever `ListeningState` changes during a session.
    var onListeningChange: (@MainActor (ListeningState) -> Void)? { get set }
    /// The app came to the foreground: restart listening if it stopped.
    func resumeIfNeeded()
    /// Microphone + speech permission. Ask only when the user starts a listening session.
    /// Whether iOS lets SafetySense use the microphone right now.
    var microphonePermission: PermissionState { get }
    func requestPermission() async -> Bool
    func start(mode: GuardMode, safeWord: String?) async throws
    func stop()
    /// Last ~30 s of audio from RAM (PCM/CAF data) for evidence when an Alert starts. Never written to disk unencrypted.
    func snapshotRecentAudio() -> Data?
    /// Recent transcript text for the second opinion (RAM only).
    func recentTranscript() -> String
}

/// CoreMotion guard: impact / fall / erratic then still / phone dropped.
@MainActor
protocol MotionGuardService: AnyObject {
    var isRunning: Bool { get }
    var onSignal: RiskSignalHandler? { get set }
    func requestPermission() async -> Bool
    func start(mode: GuardMode) throws
    func stop()
}

struct LocationFix: Codable, Sendable, Equatable {
    var latitude: Double
    var longitude: Double
    var accuracy: Double
    var timestamp: Date
    var speed: Double?

    init(latitude: Double, longitude: Double, accuracy: Double, timestamp: Date = .now, speed: Double? = nil) {
        self.latitude = latitude
        self.longitude = longitude
        self.accuracy = accuracy
        self.timestamp = timestamp
        self.speed = speed
    }

    /// UNM main campus, for demos.
    static let unmCampus = LocationFix(latitude: 35.0844, longitude: -106.6198, accuracy: 12)
}

enum LocationAuthorization: String, Sendable { case notDetermined, denied, whenInUse, always }

/// CoreLocation: live fixes, geofence / route deviation signals (CLServiceSession, CLMonitor).
@MainActor
protocol LocationService: AnyObject {
    var authorization: LocationAuthorization { get }
    var lastFix: LocationFix? { get }
    var onSignal: RiskSignalHandler? { get set }
    var onFix: (@MainActor (LocationFix) -> Void)? { get set }
    /// Called once when the session's destination is reached.
    var onArrival: (@MainActor () -> Void)? { get set }
    func requestWhenInUse() async -> LocationAuthorization
    func requestAlways() async -> LocationAuthorization
    /// `destination` enables arrival / route checks for Walk and Ride.
    func start(mode: GuardMode, destination: LocationFix?) throws
    func stop()
    func currentFix() async -> LocationFix?
    /// Keeps fixes coming for an alert, with or without a session, even in the background.
    func startAlertTracking()
    func stopAlertTracking()
}

/// Battery level 0...1 (nil when unknown). Kept tiny so tests can stub it.
@MainActor
protocol DeviceStatusProviding: AnyObject {
    var batteryLevel: Double? { get }
}
