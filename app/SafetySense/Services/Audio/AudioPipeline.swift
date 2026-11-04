@preconcurrency import AVFoundation
import Foundation
import SoundAnalysis

/// Something that takes mic buffers on the real-time tap thread (speech recognizers).
protocol AudioBufferFeeding: AnyObject, Sendable {
    func feed(_ buffer: AVAudioPCMBuffer)
    func finish()
}

/// Wraps a non-Sendable audio buffer for a hop to the analysis queue. The tap hands each
/// buffer over exactly once and never touches it again.
struct UncheckedPCMBuffer: @unchecked Sendable {
    let buffer: AVAudioPCMBuffer
}

/// The stream analyzer is only ever used on `analysisQueue`.
struct UncheckedAnalyzer: @unchecked Sendable {
    let analyzer: SNAudioStreamAnalyzer
}

/// Everything that runs off the main actor for the audio guard: the AVAudioEngine tap,
/// the SoundAnalysis stream analyzer (on its own serial queue), the 30 s RAM ring buffer,
/// the live evidence chunker and the speech feed. All shared state sits behind `lock`.
final class AudioPipeline: @unchecked Sendable {
    /// Ring buffer length (SPEC 11).
    static let bufferSeconds: TimeInterval = 30
    /// Stored sample rate target; 48 kHz input is decimated to 16 kHz to keep RAM small.
    static let storedRateTarget: Double = 16_000
    /// Seconds per live evidence chunk handed to the vault during an alert.
    static let evidenceChunkSeconds: TimeInterval = 5

    private let lock = NSLock()
    private let analysisQueue = DispatchQueue(label: "com.georgeteifel.SafetySense.audio-analysis", qos: .userInitiated)

    private var ring = PCMRingBuffer(seconds: AudioPipeline.bufferSeconds, sampleRate: AudioPipeline.storedRateTarget)
    private var decimation = 1
    private var storedRate: Double = AudioPipeline.storedRateTarget
    private var analyzer: SNAudioStreamAnalyzer?
    private var observer: SoundObserver?
    private var framePosition: AVAudioFramePosition = 0
    private var lastBufferUptime: TimeInterval = 0
    private var speechFeed: (any AudioBufferFeeding)?
    private var evidenceSamples: [Float] = []
    private var evidenceSequence = 0
    private var evidenceHandler: (@Sendable (Data, Int) -> Void)?

    // MARK: Setup

    /// Prepares the analyzer and ring buffer for `format` (the input node's format).
    func configure(format: AVAudioFormat, onSounds: @escaping @Sendable ([SoundClassification]) -> Void) throws {
        let request = try SNClassifySoundRequest(classifierIdentifier: .version1)
        request.windowDuration = CMTimeMakeWithSeconds(1.5, preferredTimescale: 48_000)
        request.overlapFactor = 0.5
        let analyzer = SNAudioStreamAnalyzer(format: format)
        let observer = SoundObserver(handler: onSounds)
        try analyzer.add(request, withObserver: observer)

        let factor = max(1, Int((format.sampleRate / Self.storedRateTarget).rounded(.down)))
        lock.withLock {
            self.analyzer = analyzer
            self.observer = observer
            self.framePosition = 0
            if self.decimation != factor || self.ring.capacity == 0 {
                self.decimation = factor
                self.storedRate = format.sampleRate / Double(factor)
                self.ring = PCMRingBuffer(seconds: Self.bufferSeconds, sampleRate: self.storedRate)
            }
            self.lastBufferUptime = ProcessInfo.processInfo.systemUptime
        }
    }

    /// Installs the tap. Kept nonisolated on purpose: the tap block runs on a real-time
    /// audio thread and must not inherit main-actor isolation.
    func install(on node: AVAudioInputNode, format: AVAudioFormat) {
        node.installTap(onBus: 0, bufferSize: 4096, format: format) { [weak self] buffer, _ in
            self?.process(buffer)
        }
    }

    func tearDownAnalyzer() {
        let analyzer = lock.withLock { () -> SNAudioStreamAnalyzer? in
            let a = self.analyzer
            self.analyzer = nil
            self.observer = nil
            return a
        }
        if let analyzer {
            let boxed = UncheckedAnalyzer(analyzer: analyzer)
            analysisQueue.async { boxed.analyzer.completeAnalysis() }
        }
    }

    // MARK: Tap thread

    /// Feeds a buffer as if it came from the mic tap (tests, demo injection).
    func feedForTesting(_ buffer: AVAudioPCMBuffer) {
        process(buffer)
    }

    /// Waits until queued SoundAnalysis work has run (tests).
    func drainAnalysis() async {
        await withCheckedContinuation { (c: CheckedContinuation<Void, Never>) in analysisQueue.async { c.resume() } }
    }

    private func process(_ buffer: AVAudioPCMBuffer) {
        let (analyzer, position, feed) = lock.withLock { () -> (SNAudioStreamAnalyzer?, AVAudioFramePosition, (any AudioBufferFeeding)?) in
            lastBufferUptime = ProcessInfo.processInfo.systemUptime
            appendMono(buffer)
            let p = framePosition
            framePosition += AVAudioFramePosition(buffer.frameLength)
            return (self.analyzer, p, speechFeed)
        }
        feed?.feed(buffer)
        if let analyzer {
            // The engine may reuse tap memory, so analyze a copy.
            guard let copy = Self.copy(buffer) else { return }
            let boxed = UncheckedPCMBuffer(buffer: copy)
            let target = UncheckedAnalyzer(analyzer: analyzer)
            analysisQueue.async {
                target.analyzer.analyze(boxed.buffer, atAudioFramePosition: position)
            }
        }
    }

    /// Lock must be held.
    private func appendMono(_ buffer: AVAudioPCMBuffer) {
        guard let channel = buffer.floatChannelData?[0] else { return }
        let frames = Int(buffer.frameLength)
        guard frames > 0 else { return }
        var mono: [Float]
        if decimation == 1 {
            mono = Array(UnsafeBufferPointer(start: channel, count: frames))
        } else {
            let outCount = frames / decimation
            mono = [Float](repeating: 0, count: outCount)
            let scale = 1 / Float(decimation)
            for i in 0..<outCount {
                var sum: Float = 0
                let base = i * decimation
                for j in 0..<decimation { sum += channel[base + j] }
                mono[i] = sum * scale
            }
        }
        ring.append(mono)
        if let handler = evidenceHandler {
            evidenceSamples.append(contentsOf: mono)
            let chunkSize = Int(storedRate * Self.evidenceChunkSeconds)
            if evidenceSamples.count >= chunkSize {
                let chunk = Array(evidenceSamples.prefix(chunkSize))
                evidenceSamples.removeFirst(chunkSize)
                let seq = evidenceSequence
                evidenceSequence += 1
                let data = WAVEncoder.encode(chunk, sampleRate: Int(storedRate))
                DispatchQueue.global(qos: .utility).async { handler(data, seq) }
            }
        }
    }

    private static func copy(_ buffer: AVAudioPCMBuffer) -> AVAudioPCMBuffer? {
        guard let copy = AVAudioPCMBuffer(pcmFormat: buffer.format, frameCapacity: buffer.frameLength) else { return nil }
        copy.frameLength = buffer.frameLength
        let channels = Int(buffer.format.channelCount)
        if let src = buffer.floatChannelData, let dst = copy.floatChannelData {
            for c in 0..<channels { dst[c].update(from: src[c], count: Int(buffer.frameLength)) }
        } else if let src = buffer.int16ChannelData, let dst = copy.int16ChannelData {
            for c in 0..<channels { dst[c].update(from: src[c], count: Int(buffer.frameLength)) }
        } else {
            return nil
        }
        return copy
    }

    // MARK: Accessors

    var secondsSinceLastBuffer: TimeInterval {
        lock.withLock { ProcessInfo.processInfo.systemUptime - lastBufferUptime }
    }

    var bufferedSeconds: TimeInterval { lock.withLock { ring.duration } }

    /// The last ~30 s as a 16-bit mono WAV, or nil when nothing is buffered.
    func snapshotWAV() -> Data? {
        let (samples, rate) = lock.withLock { (ring.snapshot(), storedRate) }
        guard !samples.isEmpty else { return nil }
        return WAVEncoder.encode(samples, sampleRate: Int(rate))
    }

    func setSpeechFeed(_ feed: (any AudioBufferFeeding)?) {
        let old = lock.withLock { () -> (any AudioBufferFeeding)? in
            let previous = speechFeed
            speechFeed = feed
            return previous
        }
        if let old, old !== feed { old.finish() }
    }

    func setEvidenceHandler(_ handler: (@Sendable (Data, Int) -> Void)?) {
        lock.withLock {
            evidenceHandler = handler
            evidenceSamples.removeAll()
            if handler == nil { evidenceSequence = 0 }
        }
    }

    /// Wipes the RAM buffer (end of session).
    func clear() {
        lock.withLock {
            ring.clear()
            evidenceSamples.removeAll()
        }
    }
}

/// SoundAnalysis results observer. Forwards only the labels SafetySense cares about.
final class SoundObserver: NSObject, SNResultsObserving, @unchecked Sendable {
    private let handler: @Sendable ([SoundClassification]) -> Void
    private let interesting = SoundEventPolicy.interestingLabels

    init(handler: @escaping @Sendable ([SoundClassification]) -> Void) {
        self.handler = handler
    }

    func request(_ request: SNRequest, didProduce result: SNResult) {
        guard let result = result as? SNClassificationResult else { return }
        let picked = result.classifications
            .filter { interesting.contains($0.identifier) && $0.confidence >= 0.3 }
            .map { SoundClassification(identifier: $0.identifier, confidence: $0.confidence) }
        guard !picked.isEmpty else { return }
        handler(picked)
    }

    func request(_ request: SNRequest, didFailWithError error: any Error) {}
    func requestDidComplete(_ request: SNRequest) {}
}

/// Converts mic buffers to the SpeechAnalyzer's preferred format and yields them.
final class AnalyzerAudioFeed<Input: Sendable>: AudioBufferFeeding, @unchecked Sendable {
    private let lock = NSLock()
    private let outputFormat: AVAudioFormat
    private let continuation: AsyncStream<Input>.Continuation
    private let wrap: @Sendable (AVAudioPCMBuffer) -> Input
    private var converter: AVAudioConverter?
    private var finished = false

    init(outputFormat: AVAudioFormat, continuation: AsyncStream<Input>.Continuation,
         wrap: @escaping @Sendable (AVAudioPCMBuffer) -> Input) {
        self.outputFormat = outputFormat
        self.continuation = continuation
        self.wrap = wrap
    }

    func feed(_ buffer: AVAudioPCMBuffer) {
        lock.lock()
        defer { lock.unlock() }
        guard !finished, buffer.frameLength > 0 else { return }
        if converter == nil || converter?.inputFormat != buffer.format {
            converter = AVAudioConverter(from: buffer.format, to: outputFormat)
        }
        guard let converter else { return }
        let ratio = outputFormat.sampleRate / buffer.format.sampleRate
        let capacity = AVAudioFrameCount((Double(buffer.frameLength) * ratio).rounded(.up)) + 32
        guard let out = AVAudioPCMBuffer(pcmFormat: outputFormat, frameCapacity: capacity) else { return }
        let source = UncheckedPCMBuffer(buffer: buffer)
        let consumed = ConsumedFlag()
        var error: NSError?
        let status = converter.convert(to: out, error: &error) { _, inputStatus in
            if consumed.value {
                inputStatus.pointee = .noDataNow
                return nil
            }
            consumed.value = true
            inputStatus.pointee = .haveData
            return source.buffer
        }
        if status != .error, out.frameLength > 0 {
            continuation.yield(wrap(out))
        }
    }

    func finish() {
        lock.withLock {
            guard !finished else { return }
            finished = true
            continuation.finish()
        }
    }
}

private final class ConsumedFlag: @unchecked Sendable {
    var value = false
}
