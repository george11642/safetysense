import Foundation

/// Fixed-size, RAM-only ring of mono Float32 PCM samples (SPEC 11: the 30 s buffer is
/// overwritten continuously and never written to disk unencrypted).
struct PCMRingBuffer: Sendable {
    let capacity: Int
    let sampleRate: Double
    private var storage: [Float]
    private var writeIndex = 0
    private(set) var count = 0

    init(seconds: TimeInterval, sampleRate: Double) {
        self.sampleRate = max(1, sampleRate)
        self.capacity = max(1, Int((seconds * self.sampleRate).rounded()))
        self.storage = Array(repeating: 0, count: capacity)
    }

    /// Seconds of audio currently held.
    var duration: TimeInterval { Double(count) / sampleRate }

    mutating func append(_ samples: UnsafeBufferPointer<Float>) {
        guard !samples.isEmpty, let base = samples.baseAddress else { return }
        if samples.count >= capacity {
            // Only the newest `capacity` samples survive.
            let start = base + (samples.count - capacity)
            storage.withUnsafeMutableBufferPointer { dst in
                dst.baseAddress!.update(from: start, count: capacity)
            }
            writeIndex = 0
            count = capacity
            return
        }
        var copied = 0
        storage.withUnsafeMutableBufferPointer { dst in
            while copied < samples.count {
                let n = min(samples.count - copied, capacity - writeIndex)
                (dst.baseAddress! + writeIndex).update(from: base + copied, count: n)
                copied += n
                writeIndex = (writeIndex + n) % capacity
            }
        }
        count = min(capacity, count + samples.count)
    }

    mutating func append(_ samples: [Float]) {
        samples.withUnsafeBufferPointer { append($0) }
    }

    /// Oldest to newest.
    func snapshot() -> [Float] {
        guard count > 0 else { return [] }
        if count < capacity { return Array(storage[0..<count]) }
        return Array(storage[writeIndex..<capacity]) + Array(storage[0..<writeIndex])
    }

    /// Zeroes the memory so nothing lingers after a session.
    mutating func clear() {
        storage.withUnsafeMutableBufferPointer { $0.update(repeating: 0) }
        writeIndex = 0
        count = 0
    }
}

/// Minimal 16-bit PCM mono WAV writer for evidence clips (the vault encrypts the result).
enum WAVEncoder {
    static func encode(_ samples: [Float], sampleRate: Int) -> Data {
        let bytesPerSample = 2
        let dataSize = samples.count * bytesPerSample
        var data = Data(capacity: 44 + dataSize)
        func append<T: FixedWidthInteger>(_ value: T) {
            withUnsafeBytes(of: value.littleEndian) { data.append(contentsOf: $0) }
        }
        data.append(contentsOf: Array("RIFF".utf8))
        append(UInt32(36 + dataSize))
        data.append(contentsOf: Array("WAVE".utf8))
        data.append(contentsOf: Array("fmt ".utf8))
        append(UInt32(16))                                   // fmt chunk size
        append(UInt16(1))                                    // PCM
        append(UInt16(1))                                    // mono
        append(UInt32(sampleRate))
        append(UInt32(sampleRate * bytesPerSample))          // byte rate
        append(UInt16(bytesPerSample))                       // block align
        append(UInt16(16))                                   // bits per sample
        data.append(contentsOf: Array("data".utf8))
        append(UInt32(dataSize))
        var pcm = [Int16](repeating: 0, count: samples.count)
        for (i, s) in samples.enumerated() {
            pcm[i] = Int16((min(max(s, -1), 1) * Float(Int16.max)).rounded())
        }
        pcm.withUnsafeBytes { data.append(contentsOf: $0) }   // iOS is little-endian, as WAV expects
        return data
    }
}
