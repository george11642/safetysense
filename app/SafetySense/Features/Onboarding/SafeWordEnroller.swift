import AVFAudio
import Foundation
@preconcurrency import Speech
import Synchronization

/// Records the safe word a few times during setup to check the phone can hear it (SPEC 8.5).
/// `AudioGuardService` only listens inside a Guard session, so setup uses this small,
/// on-device-only adapter. Nothing is saved: audio is dropped as soon as the text is read.
@MainActor
protocol SafeWordEnrolling: AnyObject {
    /// Microphone + speech recognition. Asked only when the user taps Record.
    func requestPermission() async -> Bool
    /// Listens for up to `seconds` and returns what was heard (lowercased).
    func listen(seconds: Double, expecting word: String) async throws -> String
}

enum SafeWordEnrollerError: LocalizedError {
    case unavailable, notAuthorized

    var errorDescription: String? {
        switch self {
        case .unavailable: "Speech recognition isn't available right now."
        case .notAuthorized: "SafetySense needs the microphone and speech recognition to hear your safe word."
        }
    }
}

enum SafeWordMatcher {
    /// Lowercased, punctuation stripped, single spaces.
    static func normalize(_ s: String) -> String {
        let scalars = s.lowercased().unicodeScalars.map { CharacterSet.alphanumerics.contains($0) ? Character($0) : " " }
        return String(scalars).split(separator: " ").joined(separator: " ")
    }

    /// True when the transcript contains the word, allowing small recognition slips
    /// ("pine apple" for "pineapple", one wrong letter in a long word).
    static func matches(transcript: String, word: String) -> Bool {
        let t = normalize(transcript), w = normalize(word)
        guard !w.isEmpty, !t.isEmpty else { return false }
        if t.contains(w) || t.replacingOccurrences(of: " ", with: "").contains(w.replacingOccurrences(of: " ", with: "")) {
            return true
        }
        let wordCount = w.split(separator: " ").count
        let tokens = t.split(separator: " ").map(String.init)
        guard tokens.count >= wordCount else { return similarity(t, w) >= 0.8 }
        for i in 0...(tokens.count - wordCount) {
            let window = tokens[i..<(i + wordCount)].joined(separator: " ")
            if similarity(window, w) >= 0.8 { return true }
        }
        return false
    }

    /// 1 - normalized Levenshtein distance.
    static func similarity(_ a: String, _ b: String) -> Double {
        let a = Array(a), b = Array(b)
        if a.isEmpty || b.isEmpty { return a.count == b.count ? 1 : 0 }
        var prev = Array(0...b.count)
        for i in 1...a.count {
            var cur = [i] + Array(repeating: 0, count: b.count)
            for j in 1...b.count {
                cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1))
            }
            prev = cur
        }
        return 1 - Double(prev[b.count]) / Double(max(a.count, b.count))
    }

    /// Gentle advice when a safe word is likely to fire by accident or be hard to hear.
    static func advice(for word: String) -> String? {
        let w = normalize(word)
        if w.isEmpty { return nil }
        let common: Set<String> = ["help", "stop", "no", "yes", "hey", "okay", "ok", "please", "wait", "go", "hi"]
        if common.contains(w) { return "That word comes up a lot, so it could start an alert by accident. Try something you'd only say on purpose." }
        if w.count < 4 { return "Short words are easy to miss. Two words, like \u{201C}blue umbrella\u{201D}, are heard more reliably." }
        return nil
    }
}

/// On-device speech recognition (Speech framework) for setup. Real microphone.
@MainActor
final class SpeechSafeWordEnroller: SafeWordEnrolling {
    func requestPermission() async -> Bool {
        let mic = await AVAudioApplication.requestRecordPermission()
        guard mic else { return false }
        let status = await Self.requestSpeechAuthorization()
        return status == .authorized
    }

    nonisolated private static func requestSpeechAuthorization() async -> SFSpeechRecognizerAuthorizationStatus {
        let current = SFSpeechRecognizer.authorizationStatus()
        guard current == .notDetermined else { return current }
        return await withCheckedContinuation { (c: CheckedContinuation<SFSpeechRecognizerAuthorizationStatus, Never>) in
            SFSpeechRecognizer.requestAuthorization { @Sendable status in c.resume(returning: status) }
        }
    }

    func listen(seconds: Double, expecting word: String) async throws -> String {
        guard SFSpeechRecognizer.authorizationStatus() == .authorized,
              AVAudioApplication.shared.recordPermission == .granted else { throw SafeWordEnrollerError.notAuthorized }
        let capture = try SpeechCapture(contextualWord: word)
        try capture.start()
        defer { capture.stop() }
        // Stop early as soon as the word is heard.
        let deadline = Date.now.addingTimeInterval(seconds)
        while Date.now < deadline {
            try await Task.sleep(for: .milliseconds(150))
            if SafeWordMatcher.matches(transcript: capture.transcript, word: word) { break }
        }
        return capture.transcript.lowercased()
    }
}

/// Audio engine + recognition task. The tap and result handler run off the main actor,
/// so the latest transcript sits behind a `Mutex`.
private final class SpeechCapture: @unchecked Sendable {
    private let engine = AVAudioEngine()
    private let request = SFSpeechAudioBufferRecognitionRequest()
    private let recognizer: SFSpeechRecognizer
    private var task: SFSpeechRecognitionTask?
    private let latest = Mutex("")

    var transcript: String { latest.withLock { $0 } }

    init(contextualWord: String) throws {
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US")) ?? SFSpeechRecognizer(),
              recognizer.isAvailable else { throw SafeWordEnrollerError.unavailable }
        self.recognizer = recognizer
        request.shouldReportPartialResults = true
        request.contextualStrings = [contextualWord]
        if recognizer.supportsOnDeviceRecognition { request.requiresOnDeviceRecognition = true }
    }

    func start() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.record, mode: .measurement, options: [.duckOthers])
        try session.setActive(true, options: .notifyOthersOnDeactivation)
        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        nonisolated(unsafe) let request = self.request
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { @Sendable buffer, _ in
            request.append(buffer)
        }
        engine.prepare()
        try engine.start()
        task = recognizer.recognitionTask(with: request) { [weak self] result, _ in
            if let text = result?.bestTranscription.formattedString {
                self?.latest.withLock { $0 = text }
            }
        }
    }

    func stop() {
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        request.endAudio()
        task?.cancel()
        task = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}

/// Demo / simulator stand-in: "hears" the word after a short pause. Never uses the microphone.
@MainActor
final class MockSafeWordEnroller: SafeWordEnrolling {
    var delay: Duration = .milliseconds(1400)
    func requestPermission() async -> Bool { true }
    func listen(seconds: Double, expecting word: String) async throws -> String {
        try await Task.sleep(for: delay)
        return word.lowercased()
    }
}

extension ServiceContainer {
    /// Real speech in live builds; the mock in demo, previews and QA launches.
    func makeSafeWordEnroller() -> any SafeWordEnrolling {
        flavor == .demo ? MockSafeWordEnroller() : SpeechSafeWordEnroller()
    }
}
