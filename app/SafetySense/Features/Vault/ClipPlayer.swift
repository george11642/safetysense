@preconcurrency import AVFoundation
import Foundation
import Observation

/// Plays one Vault clip. The decrypted audio stays in memory, in `AVAudioPlayer(data:)`, so it
/// never reaches the disk, and it's released the moment playback stops. The Vault stops this
/// whenever it locks.
@Observable
@MainActor
final class ClipPlayer {
    enum PlayError: LocalizedError {
        case noAudio

        var errorDescription: String? {
            switch self {
            case .noAudio: "This clip has no audio to play."
            }
        }
    }

    private(set) var playingID: UUID?
    private(set) var loadingID: UUID?
    /// When the clip started and when it ends, for the row's progress bar.
    private(set) var playback: ClosedRange<Date>?

    @ObservationIgnored private var player: AVAudioPlayer?
    @ObservationIgnored private var watcher: Task<Void, Never>?
    @ObservationIgnored private var ownsAudioSession = false
    /// The latest tap. One that a later tap or a stop replaced doesn't start playing.
    @ObservationIgnored private var request: UUID?

    func isPlaying(_ clip: EvidenceClip) -> Bool { playingID == clip.id }
    func isLoading(_ clip: EvidenceClip) -> Bool { loadingID == clip.id }
    func playback(of clip: EvidenceClip) -> ClosedRange<Date>? { isPlaying(clip) ? playback : nil }

    /// Plays the clip, or stops it if it's the one playing. A locked vault refuses to decrypt.
    func toggle(_ clip: EvidenceClip, vault: any EvidenceVaultProtocol) async throws {
        let wasPlaying = isPlaying(clip)
        stop()
        guard !wasPlaying else { return }
        let thisRequest = UUID()
        request = thisRequest
        loadingID = clip.id
        defer { if request == thisRequest { loadingID = nil } }
        let audio = try await vault.decrypt(clip)
        // The Vault can lock, or another clip can be tapped, while that was opening.
        guard request == thisRequest, vault.isUnlocked else { return }
        guard !audio.isEmpty, let player = try? AVAudioPlayer(data: audio) else { throw PlayError.noAudio }
        activateAudioSession()
        guard player.play() else {
            deactivateAudioSession()
            throw PlayError.noAudio
        }
        self.player = player
        playingID = clip.id
        playback = Date.now...Date.now.addingTimeInterval(max(player.duration, 0.1))
        // Also catches a phone call or Siri taking the audio.
        watcher = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .milliseconds(200))
                guard !Task.isCancelled, let self else { return }
                if self.player?.isPlaying != true {
                    self.stop()
                    return
                }
            }
        }
    }

    func stop() {
        request = nil
        watcher?.cancel()
        watcher = nil
        player?.stop()
        player = nil
        playingID = nil
        loadingID = nil
        playback = nil
        deactivateAudioSession()
    }

    /// A running mic keeps its `.playAndRecord` session, and the clip plays through that.
    private func activateAudioSession() {
        let session = AVAudioSession.sharedInstance()
        guard session.category != .playAndRecord else { return }
        do {
            try session.setCategory(.playback, mode: .default)
            try session.setActive(true)
            ownsAudioSession = true
        } catch {
            ownsAudioSession = false   // The player can still try on whatever session is active.
        }
    }

    private func deactivateAudioSession() {
        guard ownsAudioSession else { return }
        ownsAudioSession = false
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}
