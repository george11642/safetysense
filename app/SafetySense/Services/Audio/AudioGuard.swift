@preconcurrency import AVFoundation
import Foundation
import Observation

enum AudioGuardError: LocalizedError, Equatable {
    case microphoneDenied
    case noInput

    var errorDescription: String? {
        switch self {
        case .microphoneDenied: "SafetySense doesn't have microphone access. You can turn it on in Settings."
        case .noInput: "No microphone is available right now."
        }
    }
}

/// The on-device audio guard (SPEC 6.1.1, 6.1.2, 11).
///
/// - `AVAudioSession` `.playAndRecord` / `.measurement`, mixing with other audio so music keeps playing.
/// - One `AVAudioEngine` input tap feeds: the SoundAnalysis classifier, the 30 s RAM ring
///   buffer, the speech recognizer, and (only during an alert) the live evidence stream.
/// - Interruptions (calls, Siri), route changes and media-server resets restart the engine.
///   A watchdog restarts it if buffers stop arriving.
/// - Nothing is written to disk. When escalation reaches Alert, `EvidenceHandoff` takes the
///   ring buffer and the live stream into the encrypted vault.
@Observable
@MainActor
final class AudioGuard: AudioGuardService {
    enum Health: Equatable, Sendable {
        case idle, listening, interrupted, recovering
        case paused(String)

        var statusLine: String {
            switch self {
            case .idle: "Not listening"
            case .listening: "Listening on your phone only"
            case .interrupted: "Paused for a call or Siri"
            case .recovering: "Reconnecting the microphone"
            case .paused(let why): why
            }
        }
    }

    private(set) var isRunning = false
    private(set) var health: Health = .idle
    private(set) var speechBackend: SpeechKeywordListener.Backend = .none
    /// Background sounds heard recently (e.g. "music", "laughter"), for context only.
    private(set) var ambientContext: [String] = []

    @ObservationIgnored var onSignal: RiskSignalHandler?
    @ObservationIgnored var onHealthChange: (@MainActor (Health) -> Void)?
    @ObservationIgnored var onListeningChange: (@MainActor (ListeningState) -> Void)?

    @ObservationIgnored private let clock: any EngineClock
    @ObservationIgnored private let pipeline = AudioPipeline()
    @ObservationIgnored private let speech = SpeechKeywordListener()
    @ObservationIgnored private var engine: AVAudioEngine?
    @ObservationIgnored private var inputFormat: AVAudioFormat?
    @ObservationIgnored private var soundPolicy = SoundEventPolicy()
    @ObservationIgnored private var spotter = PhraseSpotter()
    @ObservationIgnored private var transcript = TranscriptLog(window: 90)
    @ObservationIgnored private var ambientSeenAt: [String: Date] = [:]
    @ObservationIgnored private var mode: GuardMode = .everyday
    @ObservationIgnored private var watchdog: EngineTimer?
    @ObservationIgnored private var retryTimer: EngineTimer?
    @ObservationIgnored private var observers: [any NSObjectProtocol] = []
    @ObservationIgnored private var restartFailures = 0
    @ObservationIgnored private var interruptedAt: Date?
    @ObservationIgnored private var speechTask: Task<Void, Never>?
    @ObservationIgnored private(set) var evidenceAlertID: UUID?

    static let watchdogInterval: TimeInterval = 3
    static let staleAfter: TimeInterval = 5
    static let maxRestartFailures = 5
    /// iOS doesn't always send "interruption ended", so stop waiting for it after this long.
    static let maxInterruption: TimeInterval = 120

    init(clock: any EngineClock = SystemEngineClock()) {
        self.clock = clock
        speech.onText = { [weak self] text, isFinal in self?.handleTranscript(text, isFinal: isFinal) }
    }

    // MARK: AudioGuardService

    var microphonePermission: PermissionState {
        switch AVAudioApplication.shared.recordPermission {
        case .granted: .granted
        case .denied: .denied
        default: .notAsked
        }
    }

    func requestPermission() async -> Bool {
        let mic = await AVAudioApplication.requestRecordPermission()
        _ = await SpeechKeywordListener.requestAuthorization()
        return mic
    }

    func start(mode: GuardMode, safeWord: String?) async throws {
        if isRunning {
            self.mode = mode
            if safeWord != nil { spotter = PhraseSpotter(safeWord: safeWord) }
            return
        }
        guard AVAudioApplication.shared.recordPermission == .granted else { throw AudioGuardError.microphoneDenied }
        self.mode = mode
        spotter = PhraseSpotter(safeWord: safeWord)
        soundPolicy = SoundEventPolicy()
        try configureSession()
        try startEngine()
        isRunning = true
        restartFailures = 0
        setHealth(.listening)
        observeSession()
        armWatchdog()
        // Speech can need a one-time model download; never make the session wait for it.
        startSpeech()
    }

    /// After a call or a failed restart, recording usually can't start again from the background.
    /// Once the app is open again it can, so try fresh with a clean failure count.
    func resumeIfNeeded() {
        guard isRunning else { return }
        switch health {
        case .paused, .interrupted:
            restartFailures = 0
            restartEngine()
        case .idle, .listening, .recovering:
            break
        }
    }

    /// Downloads the on-device speech model ahead of time (called from onboarding and at launch).
    static func prepareSpeechAssets() async -> Bool {
        await SpeechKeywordListener.prepareAssets()
    }

    func stop() {
        guard isRunning || engine != nil else { return }
        isRunning = false
        watchdog?.cancel()
        retryTimer?.cancel()
        removeObservers()
        endEvidenceStream()
        speechTask?.cancel()
        speechTask = nil
        speech.stop()
        speechBackend = .none
        stopEngine()
        pipeline.clear()
        transcript.clear()
        ambientSeenAt.removeAll()
        ambientContext = []
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
        setHealth(.idle)
    }

    func snapshotRecentAudio() -> Data? {
        pipeline.snapshotWAV()
    }

    func recentTranscript() -> String {
        transcript.text(at: clock.now)
    }

    /// Transcript plus background labels, for the second opinion prompt.
    func recentContext() -> String {
        let text = recentTranscript()
        guard !ambientContext.isEmpty else { return text }
        return "[Background: \(ambientContext.joined(separator: ", "))] \(text)"
    }

    // MARK: Evidence

    /// Starts handing ~5 s WAV chunks of live audio to `handler` (the evidence vault).
    func beginEvidenceStream(alertID: UUID, handler: @escaping @MainActor (Data, Int) -> Void) {
        evidenceAlertID = alertID
        pipeline.setEvidenceHandler { data, sequence in
            Task { @MainActor in handler(data, sequence) }
        }
    }

    func endEvidenceStream() {
        evidenceAlertID = nil
        pipeline.setEvidenceHandler(nil)
    }

    // MARK: Engine

    private func configureSession() throws {
        let session = AVAudioSession.sharedInstance()
        // A2DP keeps music on AirPods in stereo while the phone's own mic listens.
        try session.setCategory(.playAndRecord, mode: .measurement,
                                options: [.mixWithOthers, .defaultToSpeaker, .allowBluetoothA2DP])
        // Without this, iOS silences the quiet check-in haptic while the mic is on.
        try session.setAllowHapticsAndSystemSoundsDuringRecording(true)
        try session.setActive(true)
    }

    private func startEngine() throws {
        let engine = AVAudioEngine()
        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard format.sampleRate > 0, format.channelCount > 0 else { throw AudioGuardError.noInput }
        try pipeline.configure(format: format) { [weak self] classifications in
            Task { @MainActor in self?.handleSounds(classifications) }
        }
        pipeline.install(on: input, format: format)
        engine.prepare()
        do {
            try engine.start()
        } catch {
            input.removeTap(onBus: 0)
            pipeline.tearDownAnalyzer()
            throw error
        }
        self.engine = engine
        self.inputFormat = format
    }

    private func stopEngine() {
        if let engine {
            engine.inputNode.removeTap(onBus: 0)
            engine.stop()
        }
        engine = nil
        pipeline.tearDownAnalyzer()
    }

    private func restartEngine() {
        guard isRunning else { return }
        retryTimer?.cancel()
        setHealth(.recovering)
        let previousFormat = inputFormat
        stopEngine()
        do {
            try configureSession()
            try startEngine()
            restartFailures = 0
            setHealth(.listening)
            if previousFormat != inputFormat || speech.backend == .none { startSpeech() }
        } catch {
            restartFailures += 1
            if restartFailures >= Self.maxRestartFailures {
                setHealth(.paused("Listening paused. Open SafetySense to resume."))
                return
            }
            let delay = pow(2, Double(restartFailures))
            retryTimer = clock.schedule(after: delay) { [weak self] in self?.restartEngine() }
        }
    }

    private func armWatchdog() {
        watchdog?.cancel()
        watchdog = clock.schedule(after: Self.watchdogInterval) { [weak self] in
            guard let self, self.isRunning else { return }
            switch self.health {
            case .listening:
                if self.engine?.isRunning != true || self.pipeline.secondsSinceLastBuffer > Self.staleAfter {
                    self.restartEngine()
                }
            case .interrupted:
                if let since = self.interruptedAt, self.clock.now.timeIntervalSince(since) > Self.maxInterruption {
                    self.restartEngine()
                }
            case .recovering, .paused, .idle:
                break
            }
            self.armWatchdog()
        }
    }

    private func startSpeech() {
        speechTask?.cancel()
        speechTask = Task { [weak self] in
            guard let self else { return }
            await self.speech.start(pipeline: self.pipeline)
            guard !Task.isCancelled, self.isRunning else { return }
            self.speechBackend = self.speech.backend
        }
    }

    // MARK: Session notifications

    private func observeSession() {
        removeObservers()
        let center = NotificationCenter.default
        let session = AVAudioSession.sharedInstance()
        observers.append(center.addObserver(forName: AVAudioSession.interruptionNotification, object: session,
                                            queue: .main) { [weak self] note in
            let type = (note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt)
                .flatMap(AVAudioSession.InterruptionType.init(rawValue:))
            MainActor.assumeIsolated { self?.handleInterruption(type) }
        })
        observers.append(center.addObserver(forName: AVAudioSession.routeChangeNotification, object: session,
                                            queue: .main) { [weak self] note in
            let reason = (note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt)
                .flatMap(AVAudioSession.RouteChangeReason.init(rawValue:))
            MainActor.assumeIsolated { self?.handleRouteChange(reason) }
        })
        observers.append(center.addObserver(forName: AVAudioSession.mediaServicesWereResetNotification, object: session,
                                            queue: .main) { [weak self] _ in
            MainActor.assumeIsolated { self?.restartEngine() }
        })
    }

    private func removeObservers() {
        observers.forEach { NotificationCenter.default.removeObserver($0) }
        observers.removeAll()
    }

    private func handleInterruption(_ type: AVAudioSession.InterruptionType?) {
        guard isRunning else { return }
        switch type {
        case .began:
            setHealth(.interrupted)
        case .ended, .none:
            restartEngine()
        @unknown default:
            restartEngine()
        }
    }

    private func handleRouteChange(_ reason: AVAudioSession.RouteChangeReason?) {
        guard isRunning, health == .listening else { return }
        switch reason {
        case .oldDeviceUnavailable, .newDeviceAvailable, .override, .wakeFromSleep:
            // Our own category change also posts here, so only restart when the input
            // actually changed or the engine stopped.
            let current = engine?.inputNode.outputFormat(forBus: 0)
            if engine?.isRunning != true || current != inputFormat { restartEngine() }
        default:
            break
        }
    }

    // MARK: Results

    private func handleSounds(_ classifications: [SoundClassification]) {
        guard isRunning else { return }
        let now = clock.now
        for label in SoundEventPolicy.ambientSummary(classifications) { ambientSeenAt[label] = now }
        ambientSeenAt = ambientSeenAt.filter { now.timeIntervalSince($0.value) < 60 }
        let context = ambientSeenAt.sorted { $0.value > $1.value }.prefix(4).map(\.key)
        if context != ambientContext { ambientContext = context }
        for signal in soundPolicy.signals(from: classifications, at: now) {
            onSignal?(signal)
        }
    }

    private func handleTranscript(_ text: String, isFinal: Bool) {
        guard isRunning else { return }
        let now = clock.now
        if isFinal { transcript.append(text, at: now) }
        for match in spotter.process(text, isFinal: isFinal, at: now) {
            onSignal?(RiskSignal(kind: match.kind, weight: match.weight, timestamp: now, detail: match.detail))
        }
    }

    private func setHealth(_ new: Health) {
        guard health != new else { return }
        health = new
        interruptedAt = new == .interrupted ? clock.now : nil
        onHealthChange?(new)
        switch new {
        case .listening: onListeningChange?(.listening)
        case .interrupted: onListeningChange?(.interrupted)
        case .paused: onListeningChange?(.paused)
        case .idle, .recovering: break
        }
    }
}
