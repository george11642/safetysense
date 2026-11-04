import AVFoundation
import AudioToolbox
import Foundation
import os

/// The ringtone, the vibration and the caller's voice.
///
/// - The ringtone is synthesized on the phone (a soft marimba-like phrase), so there's no
///   bundled audio file. The same tone is written to `Library/Sounds` for the notification.
/// - It rings out loud even with the Ring/Silent switch on silent: the point is that the people
///   around you hear the call too.
/// - If a Guard session is listening, its `.playAndRecord` session is left alone so the
///   microphone keeps running; the tone then plays through the same session.
@MainActor
final class FakeCallAudio: NSObject, FakeCallEffects {
    private var player: AVAudioPlayer?
    private var vibration: Task<Void, Never>?
    private let synthesizer = AVSpeechSynthesizer()
    private var ownsSession = false
    private let log = Logger(subsystem: "com.georgeteifel.SafetySense", category: "fakecall")

    // MARK: Ringing

    func startRinging() {
        activateSession()
        if player == nil {
            player = try? AVAudioPlayer(data: Ringtone.wav(loops: 1))
            player?.numberOfLoops = -1
            player?.volume = 0.9
        }
        player?.currentTime = 0
        if player?.play() != true { log.error("Ringtone didn't start") }
        vibration?.cancel()
        vibration = Task {
            while !Task.isCancelled {
                AudioServicesPlayAlertSound(SystemSoundID(kSystemSoundID_Vibrate))
                try? await Task.sleep(for: .seconds(Ringtone.loopSeconds))
            }
        }
    }

    func stopRinging() {
        vibration?.cancel()
        vibration = nil
        player?.stop()
    }

    // MARK: The call

    func startCall(script: FakeCallScript) {
        activateSession()
        synthesizer.stopSpeaking(at: .immediate)
        let voice = Self.voice
        var lead: TimeInterval = 1.6   // a beat of "line noise" before they talk
        for line in script.lines {
            let u = AVSpeechUtterance(string: line.text)
            u.voice = voice
            u.rate = AVSpeechUtteranceDefaultSpeechRate * 1.02
            u.pitchMultiplier = 1.04
            u.volume = 0.85
            u.preUtteranceDelay = lead
            u.postUtteranceDelay = line.pauseAfter
            lead = 0
            synthesizer.speak(u)
        }
    }

    func endCall() {
        synthesizer.stopSpeaking(at: .immediate)
        stopRinging()
        deactivateSession()
    }

    /// The best installed US English voice (premium or enhanced if the person downloaded one).
    private static var voice: AVSpeechSynthesisVoice? {
        let english = AVSpeechSynthesisVoice.speechVoices().filter { $0.language == "en-US" }
        return english.max { $0.quality.rawValue < $1.quality.rawValue } ?? AVSpeechSynthesisVoice(language: "en-US")
    }

    // MARK: Session

    private func activateSession() {
        let session = AVAudioSession.sharedInstance()
        // Guard is listening: keep its record session (and the microphone) as it is.
        guard session.category != .playAndRecord else { return }
        do {
            try session.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
            try session.setActive(true)
            ownsSession = true
        } catch {
            log.error("Couldn't start the call audio")
        }
    }

    private func deactivateSession() {
        guard ownsSession else { return }
        ownsSession = false
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}

/// An original two-phrase marimba-style ring, synthesized as 16-bit mono PCM in a WAV container.
enum Ringtone {
    static let sampleRate = 22_050
    /// One loop: two short rising phrases and a rest, about the rhythm of a phone ringing.
    static let loopSeconds: TimeInterval = 3.0
    static let notificationFileName = "ss-ring.wav"

    /// (frequency Hz, start s) in A major: rises, answers, rises again.
    private static let notes: [(Double, Double)] = [
        (659.25, 0.00), (880.00, 0.16), (1108.73, 0.32), (880.00, 0.48),
        (659.25, 0.80), (880.00, 0.96), (1318.51, 1.12), (1108.73, 1.28),
    ]

    static func wav(loops: Int) -> Data {
        let perLoop = Int(loopSeconds * Double(sampleRate))
        var samples = [Int16](repeating: 0, count: perLoop * max(1, loops))
        let loop = loopSamples(count: perLoop)
        for i in 0..<max(1, loops) {
            samples.replaceSubrange(i * perLoop..<(i + 1) * perLoop, with: loop)
        }
        return wavData(samples)
    }

    /// Writes the notification ringtone to `Library/Sounds` (where iOS looks for custom
    /// notification sounds) once, and returns its file name. Under 30 s, as iOS requires.
    @discardableResult
    static func installNotificationSound() -> String? {
        let fm = FileManager.default
        guard let library = fm.urls(for: .libraryDirectory, in: .userDomainMask).first else { return nil }
        let dir = library.appending(path: "Sounds", directoryHint: .isDirectory)
        let url = dir.appending(path: notificationFileName)
        if fm.fileExists(atPath: url.path) { return notificationFileName }
        do {
            try fm.createDirectory(at: dir, withIntermediateDirectories: true)
            try wav(loops: 9).write(to: url, options: .atomic)   // 27 s
            return notificationFileName
        } catch {
            return nil
        }
    }

    private static func loopSamples(count: Int) -> [Int16] {
        var buffer = [Double](repeating: 0, count: count)
        let noteLength = Int(0.42 * Double(sampleRate))
        for (freq, start) in notes {
            let offset = Int(start * Double(sampleRate))
            for n in 0..<noteLength where offset + n < count {
                let t = Double(n) / Double(sampleRate)
                let attack = min(1, t / 0.004)
                let body = exp(-t * 9)          // wooden, quick decay
                let ring = exp(-t * 26)         // bright strike partial fades first
                let s = sin(2 * .pi * freq * t) * body
                    + 0.35 * sin(2 * .pi * freq * 4 * t) * ring
                    + 0.12 * sin(2 * .pi * freq * 2 * t) * body
                buffer[offset + n] += attack * s * 0.42
            }
        }
        return buffer.map { Int16(max(-1, min(1, $0)) * Double(Int16.max)) }
    }

    private static func wavData(_ samples: [Int16]) -> Data {
        var data = Data()
        func append<T: FixedWidthInteger>(_ value: T) { withUnsafeBytes(of: value.littleEndian) { data.append(contentsOf: $0) } }
        let byteCount = samples.count * 2
        data.append(contentsOf: Array("RIFF".utf8)); append(UInt32(36 + byteCount))
        data.append(contentsOf: Array("WAVE".utf8))
        data.append(contentsOf: Array("fmt ".utf8)); append(UInt32(16)); append(UInt16(1)); append(UInt16(1))
        append(UInt32(sampleRate)); append(UInt32(sampleRate * 2)); append(UInt16(2)); append(UInt16(16))
        data.append(contentsOf: Array("data".utf8)); append(UInt32(byteCount))
        samples.withUnsafeBufferPointer { ptr in
            for s in ptr { withUnsafeBytes(of: s.littleEndian) { data.append(contentsOf: $0) } }
        }
        return data
    }
}
