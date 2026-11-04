@preconcurrency import AVFoundation
import Foundation

/// Records microphone audio for evidence while an alert is active. PCM is kept in RAM only
/// and handed to the vault as small 16 kHz mono WAV chunks, which the vault encrypts before
/// anything touches storage. Never runs outside an alert.
@MainActor
final class EvidenceMicrophone {
    /// (wav data, duration seconds, chunk start time). Called on the main actor.
    var onChunk: (@MainActor (Data, TimeInterval, Date) -> Void)?

    private let engine = AVAudioEngine()
    private let buffer = PCMAccumulator(sampleRate: 16_000)
    private var flushTask: Task<Void, Never>?
    private(set) var isRunning = false

    func start(chunkSeconds: TimeInterval) throws {
        guard !isRunning else { return }
        let session = AVAudioSession.sharedInstance()
        // Mix with the audio guard if it's already listening rather than interrupting it.
        try session.setCategory(.playAndRecord, mode: .default,
                                options: [.mixWithOthers, .allowBluetoothHFP, .defaultToSpeaker])
        try session.setActive(true)

        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard format.sampleRate > 0, format.channelCount > 0 else { return }
        buffer.reset()
        input.installTap(onBus: 0, bufferSize: 4096, format: format, block: Self.makeTap(buffer, inputFormat: format))
        engine.prepare()
        try engine.start()
        isRunning = true

        flushTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(chunkSeconds))
                self?.flush()
            }
        }
    }

    func stop() {
        guard isRunning else { return }
        flushTask?.cancel()
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        isRunning = false
        flush()
    }

    private func flush() {
        guard let (samples, startedAt) = buffer.drain(), !samples.isEmpty else { return }
        let duration = Double(samples.count) / buffer.sampleRate
        onChunk?(WAV.encode(samples: samples, sampleRate: Int(buffer.sampleRate)), duration, startedAt)
    }

    /// Built outside the main actor: the tap runs on a realtime audio thread.
    nonisolated private static func makeTap(_ acc: PCMAccumulator, inputFormat: AVAudioFormat) -> AVAudioNodeTapBlock {
        let target = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: acc.sampleRate, channels: 1, interleaved: true)!
        let converter = AVAudioConverter(from: inputFormat, to: target)
        return { pcm, _ in
            guard let converter else { return }
            let ratio = target.sampleRate / inputFormat.sampleRate
            let capacity = AVAudioFrameCount(Double(pcm.frameLength) * ratio) + 32
            guard let out = AVAudioPCMBuffer(pcmFormat: target, frameCapacity: capacity) else { return }
            nonisolated(unsafe) var supplied = false
            var error: NSError?
            converter.convert(to: out, error: &error) { _, status in
                if supplied { status.pointee = .noDataNow; return nil }
                supplied = true
                status.pointee = .haveData
                return pcm
            }
            guard error == nil, let channel = out.int16ChannelData?[0] else { return }
            acc.append(UnsafeBufferPointer(start: channel, count: Int(out.frameLength)))
        }
    }
}

/// Thread-safe RAM buffer of Int16 samples.
final class PCMAccumulator: @unchecked Sendable {
    let sampleRate: Double
    private let lock = NSLock()
    private var samples: [Int16] = []
    private var startedAt: Date?

    init(sampleRate: Double) { self.sampleRate = sampleRate }

    func append(_ chunk: UnsafeBufferPointer<Int16>) {
        lock.withLock {
            if startedAt == nil { startedAt = .now }
            samples.append(contentsOf: chunk)
        }
    }

    func drain() -> ([Int16], Date)? {
        lock.withLock {
            guard let start = startedAt else { return nil }
            defer { samples.removeAll(keepingCapacity: true); startedAt = nil }
            return (samples, start)
        }
    }

    func reset() { lock.withLock { samples.removeAll(); startedAt = nil } }
}

/// Minimal PCM16 mono WAV writer.
enum WAV {
    static func encode(samples: [Int16], sampleRate: Int) -> Data {
        var d = Data()
        let dataBytes = samples.count * 2
        func u32(_ v: UInt32) { withUnsafeBytes(of: v.littleEndian) { d.append(contentsOf: $0) } }
        func u16(_ v: UInt16) { withUnsafeBytes(of: v.littleEndian) { d.append(contentsOf: $0) } }
        d.append(contentsOf: Array("RIFF".utf8)); u32(UInt32(36 + dataBytes))
        d.append(contentsOf: Array("WAVE".utf8))
        d.append(contentsOf: Array("fmt ".utf8)); u32(16); u16(1); u16(1)
        u32(UInt32(sampleRate)); u32(UInt32(sampleRate * 2)); u16(2); u16(16)
        d.append(contentsOf: Array("data".utf8)); u32(UInt32(dataBytes))
        samples.withUnsafeBufferPointer { buf in
            for s in buf { withUnsafeBytes(of: s.littleEndian) { d.append(contentsOf: $0) } }
        }
        return d
    }
}
