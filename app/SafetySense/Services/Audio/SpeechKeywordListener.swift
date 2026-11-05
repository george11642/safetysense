@preconcurrency import AVFoundation
import Foundation
@preconcurrency import Speech

/// On-device speech for the safe word and distress phrases (SPEC 6.1.2).
///
/// Prefers iOS 26 `SpeechAnalyzer` + `SpeechTranscriber` (fully on device, assets installed
/// through `AssetInventory`). Falls back to `SFSpeechRecognizer` with
/// `requiresOnDeviceRecognition`. If neither is available the guard keeps running on
/// sound events alone. Audio and text never leave the phone.
@MainActor
final class SpeechKeywordListener {
    enum Backend: String, Sendable { case speechAnalyzer, onDeviceRecognizer, none }

    private(set) var backend: Backend = .none
    /// (text, isFinal) for the current utterance.
    var onText: (@MainActor (String, Bool) -> Void)?

    private weak var pipeline: AudioPipeline?
    // SpeechAnalyzer
    private var analyzer: SpeechAnalyzer?
    private var resultsTask: Task<Void, Never>?
    // SFSpeechRecognizer fallback
    private var recognizer: SFSpeechRecognizer?
    private var legacyFeed: LegacySpeechFeed?
    private var legacyTask: SFSpeechRecognitionTask?
    private var rotationTask: Task<Void, Never>?
    private var upgradeTask: Task<Void, Never>?
    private var generation = 0

    /// Authorization for speech recognition. Required by the fallback recognizer.
    static func requestAuthorization() async -> Bool {
        let status = SFSpeechRecognizer.authorizationStatus()
        if status != .notDetermined { return status == .authorized }
        return await askForAuthorization()
    }

    /// Nonisolated with a `@Sendable` callback: the framework calls back on its own queue, and a
    /// closure that inherited the main actor would trap there on the first run.
    nonisolated private static func askForAuthorization() async -> Bool {
        await withCheckedContinuation { continuation in
            let handler: @Sendable (SFSpeechRecognizerAuthorizationStatus) -> Void = { status in
                continuation.resume(returning: status == .authorized)
            }
            SFSpeechRecognizer.requestAuthorization(handler)
        }
    }

    private static func transcriberLocale() async -> Locale? {
        let preferred = await SpeechTranscriber.supportedLocale(equivalentTo: Locale.current)
        if let preferred { return preferred }
        return await SpeechTranscriber.supportedLocale(equivalentTo: Locale(identifier: "en-US"))
    }

    /// Installs the SpeechTranscriber model if needed. True when it's ready.
    static func prepareAssets() async -> Bool {
        guard SpeechTranscriber.isAvailable, let locale = await transcriberLocale() else { return false }
        let transcriber = SpeechTranscriber(locale: locale, transcriptionOptions: [], reportingOptions: [], attributeOptions: [])
        do {
            if let install = try await AssetInventory.assetInstallationRequest(supporting: [transcriber]) {
                try await install.downloadAndInstall()
            }
            return true
        } catch {
            return false
        }
    }

    private static func assetsInstalled() async -> Bool {
        guard SpeechTranscriber.isAvailable, let locale = await transcriberLocale() else { return false }
        let transcriber = SpeechTranscriber(locale: locale, transcriptionOptions: [], reportingOptions: [], attributeOptions: [])
        return await AssetInventory.status(forModules: [transcriber]) == .installed
    }

    /// A session never waits on a download: without the model it starts on the older recognizer,
    /// which covers the safe word now, and moves to SpeechAnalyzer once the model has arrived.
    func start(pipeline: AudioPipeline) async {
        stop()
        generation += 1
        self.pipeline = pipeline
        let token = generation
        if await Self.assetsInstalled(), await startAnalyzer(pipeline: pipeline, token: token) {
            backend = .speechAnalyzer
            return
        }
        guard token == generation else { return }
        backend = startRecognizer(pipeline: pipeline) ? .onDeviceRecognizer : .none
        upgradeTask = Task { [weak self] in
            guard await Self.prepareAssets(), let self, token == self.generation else { return }
            self.stopRecognizer()
            let upgraded = await self.startAnalyzer(pipeline: pipeline, token: token)
            guard token == self.generation else { return }
            self.backend = upgraded ? .speechAnalyzer
                : (self.startRecognizer(pipeline: pipeline) ? .onDeviceRecognizer : .none)
        }
    }

    func stop() {
        generation += 1
        pipeline?.setSpeechFeed(nil)
        resultsTask?.cancel()
        resultsTask = nil
        if let analyzer {
            Task { await analyzer.cancelAndFinishNow() }
        }
        analyzer = nil
        upgradeTask?.cancel()
        upgradeTask = nil
        stopRecognizer()
        backend = .none
    }

    private func stopRecognizer() {
        rotationTask?.cancel()
        rotationTask = nil
        legacyTask?.cancel()
        legacyTask = nil
        legacyFeed = nil
        recognizer = nil
    }

    // MARK: SpeechAnalyzer (iOS 26)

    private func startAnalyzer(pipeline: AudioPipeline, token: Int) async -> Bool {
        guard SpeechTranscriber.isAvailable else { return false }
        guard let locale = await Self.transcriberLocale() else { return false }
        let transcriber = SpeechTranscriber(locale: locale, transcriptionOptions: [],
                                            reportingOptions: [.volatileResults], attributeOptions: [])
        do {
            if let install = try await AssetInventory.assetInstallationRequest(supporting: [transcriber]) {
                try await install.downloadAndInstall()
            }
            guard token == generation,
                  let format = await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [transcriber])
            else { return false }
            let (stream, continuation) = AsyncStream<AnalyzerInput>.makeStream(bufferingPolicy: .bufferingNewest(128))
            let analyzer = SpeechAnalyzer(modules: [transcriber])
            try await analyzer.start(inputSequence: stream)
            guard token == generation else {
                continuation.finish()
                await analyzer.cancelAndFinishNow()
                return false
            }
            let feed = AnalyzerAudioFeed<AnalyzerInput>(outputFormat: format, continuation: continuation) {
                AnalyzerInput(buffer: $0)
            }
            self.analyzer = analyzer
            pipeline.setSpeechFeed(feed)
            resultsTask = Task { [weak self] in
                do {
                    for try await result in transcriber.results {
                        let text = String(result.text.characters)
                        self?.onText?(text, result.isFinal)
                    }
                } catch {
                    // Analyzer ended (stop, interruption). The guard restarts it if needed.
                }
            }
            return true
        } catch {
            return false
        }
    }

    // MARK: SFSpeechRecognizer fallback

    private func startRecognizer(pipeline: AudioPipeline) -> Bool {
        guard SFSpeechRecognizer.authorizationStatus() == .authorized else { return false }
        let candidate = SFSpeechRecognizer(locale: .current) ?? SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
        guard let recognizer = candidate, recognizer.isAvailable, recognizer.supportsOnDeviceRecognition else { return false }
        self.recognizer = recognizer
        let feed = LegacySpeechFeed()
        legacyFeed = feed
        pipeline.setSpeechFeed(feed)
        beginRecognitionTask()
        return true
    }

    private func beginRecognitionTask() {
        guard let recognizer, let legacyFeed else { return }
        legacyTask?.cancel()
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.requiresOnDeviceRecognition = true
        request.shouldReportPartialResults = true
        request.addsPunctuation = false
        legacyFeed.setRequest(request)
        let token = generation
        legacyTask = Self.recognize(recognizer, request: request) { [weak self] text, isFinal, failed in
            Task { @MainActor in self?.handleRecognizer(text: text, isFinal: isFinal, failed: failed, token: token) }
        }
        // On-device recognition tasks are rotated so they never hit the per-request limit.
        rotationTask?.cancel()
        rotationTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(50))
            guard !Task.isCancelled else { return }
            request.endAudio()
            self?.beginRecognitionTask()
        }
    }

    private func handleRecognizer(text: String?, isFinal: Bool, failed: Bool, token: Int) {
        guard token == generation else { return }
        if let text, !text.isEmpty { onText?(text, isFinal || failed) }
        if isFinal || failed {
            // Start the next utterance.
            beginRecognitionTask()
        }
    }

    /// Nonisolated so the result handler doesn't inherit main-actor isolation (it runs on a
    /// Speech framework queue).
    nonisolated private static func recognize(_ recognizer: SFSpeechRecognizer, request: SFSpeechAudioBufferRecognitionRequest,
                                              handler: @escaping @Sendable (String?, Bool, Bool) -> Void) -> SFSpeechRecognitionTask {
        recognizer.recognitionTask(with: request) { result, error in
            handler(result?.bestTranscription.formattedString, result?.isFinal ?? false, error != nil)
        }
    }
}

/// Feeds tap buffers into the current SFSpeech request.
final class LegacySpeechFeed: AudioBufferFeeding, @unchecked Sendable {
    private let lock = NSLock()
    private var request: SFSpeechAudioBufferRecognitionRequest?

    func setRequest(_ request: SFSpeechAudioBufferRecognitionRequest?) {
        lock.withLock { self.request = request }
    }

    func feed(_ buffer: AVAudioPCMBuffer) {
        lock.withLock { request?.append(buffer) }
    }

    func finish() {
        lock.withLock {
            request?.endAudio()
            request = nil
        }
    }
}
