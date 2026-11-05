import Foundation
import UIKit

/// Timing rules for the escalation ladder (SPEC 6.3). `standard` is what ships.
struct EscalationTiming: Sendable, Equatable {
    /// Seconds to answer a check-in (the session's `graceSeconds` wins when it is set).
    var checkInWindow: TimeInterval = 45
    /// Seconds at Alert with no valid cancel before Dispatch.
    var alertToDispatch: TimeInterval = 90
    /// After "I'm okay", risk-driven check-ins are held back this long (scheduled ones still run).
    var okayCooldown: TimeInterval = 120
    /// How often an active alert pushes `alert/location`.
    var locationInterval: TimeInterval = 20
    /// How often an active alert polls `alert/status` (contacts' "Send help", dispatch state).
    var statusPollInterval: TimeInterval = 8
    /// A duress alert keeps sharing location silently for this long.
    var duressTrackingDuration: TimeInterval = 30 * 60
    /// Backend retries for alert creation / dispatch (delays in seconds).
    var retryDelays: [TimeInterval] = [1, 3, 6]

    static let standard = EscalationTiming()
    /// No retry waits: for tests.
    static let immediate = EscalationTiming(retryDelays: [0, 0])
}

/// Location + battery stamped on alerts.
struct AlertContext: Sendable, Equatable {
    var latitude: Double?
    var longitude: Double?
    var accuracy: Double?
    var battery: Double?

    static let unknown = AlertContext()
}

@MainActor
protocol AlertContextProviding: AnyObject {
    func alertContext() async -> AlertContext
}

/// Reads the newest fix (waiting briefly for one) and the battery level.
@MainActor
final class SensorAlertContext: AlertContextProviding {
    private let location: any LocationService
    private let device: any DeviceStatusProviding

    init(location: any LocationService, device: any DeviceStatusProviding) {
        self.location = location
        self.device = device
    }

    func alertContext() async -> AlertContext {
        let fix: LocationFix?
        if let last = location.lastFix, Date.now.timeIntervalSince(last.timestamp) < 120 {
            fix = last
        } else {
            fix = await location.currentFix() ?? location.lastFix
        }
        return AlertContext(latitude: fix?.latitude, longitude: fix?.longitude, accuracy: fix?.accuracy,
                            battery: device.batteryLevel)
    }
}

/// What the escalation controller asks of evidence capture (SPEC 11). Kept as a seam so
/// tests can observe it and so the vault module can change underneath.
@MainActor
protocol EvidenceHandling: AnyObject {
    /// Called the moment an alert starts: grab the 30 s RAM buffer before it is overwritten.
    func prepare(alertID: UUID)
    /// Called once the server alert id is known (or creation failed: `serverAlertID == nil`).
    func commit(alertID: UUID, serverAlertID: String?, mode: GuardMode) async
    /// Valid cancel or end of session.
    func stop(alertID: UUID)
    /// The app came to the foreground during an alert: reopen the mic if it couldn't start.
    func resume(mode: GuardMode) async
}

extension EvidenceHandling {
    func resume(mode: GuardMode) async {}
}

/// Holds live chunks in RAM from the moment an alert starts until the vault can take them (it
/// waits for `alert/create`), so those seconds aren't lost. Dropped on a cancel: nothing is saved.
struct EvidenceChunkGate {
    private var pending: [(data: Data, sequence: Int)] = []
    private(set) var isOpen = false

    /// Returns the chunk if it should go straight to the vault.
    mutating func receive(_ data: Data, sequence: Int) -> (data: Data, sequence: Int)? {
        if isOpen { return (data, sequence) }
        pending.append((data, sequence))
        return nil
    }

    /// Opens the gate and returns what was held, oldest first.
    mutating func open() -> [(data: Data, sequence: Int)] {
        isOpen = true
        defer { pending = [] }
        return pending
    }
}

/// A vault that can take live audio chunks while an alert runs. The evidence module adopts
/// this to receive the audio guard's mic stream (one AVAudioEngine owns the mic).
@MainActor
protocol LiveEvidenceAudioSink: AnyObject {
    func appendLiveAudio(_ chunk: Data, alertID: UUID, sequence: Int)
}

/// Hands the audio guard's 30 s ring buffer and live mic stream to the evidence vault
/// when escalation reaches Alert.
@MainActor
final class EvidenceHandoff: EvidenceHandling {
    private let audio: any AudioGuardService
    private let vault: any EvidenceVaultProtocol
    private var prebuffers: [UUID: Data] = [:]
    private var capturingAlertID: UUID?
    private var gates: [UUID: EvidenceChunkGate] = [:]

    init(audio: any AudioGuardService, vault: any EvidenceVaultProtocol) {
        self.audio = audio
        self.vault = vault
    }

    func prepare(alertID: UUID) {
        if let snapshot = audio.snapshotRecentAudio() { prebuffers[alertID] = snapshot }
        gates[alertID] = EvidenceChunkGate()
        if let guardAudio = audio as? AudioGuard, guardAudio.isRunning { stream(guardAudio, alertID: alertID) }
    }

    private func stream(_ guardAudio: AudioGuard, alertID: UUID) {
        guardAudio.beginEvidenceStream(alertID: alertID) { [weak self] chunk, sequence in
            self?.receive(chunk, sequence: sequence, alertID: alertID)
        }
    }

    private func receive(_ chunk: Data, sequence: Int, alertID: UUID) {
        guard let forward = gates[alertID]?.receive(chunk, sequence: sequence) else { return }
        (vault as? LiveEvidenceAudioSink)?.appendLiveAudio(forward.data, alertID: alertID, sequence: forward.sequence)
    }

    func commit(alertID: UUID, serverAlertID: String?, mode: GuardMode) async {
        guard capturingAlertID == nil else { return }
        capturingAlertID = alertID
        let prebuffer = prebuffers.removeValue(forKey: alertID)
        try? await vault.startCapture(alertID: alertID, serverAlertID: serverAlertID, prebuffer: prebuffer)
        var gate = gates[alertID] ?? EvidenceChunkGate()
        let held = gate.open()
        gates[alertID] = gate
        if let sink = vault as? LiveEvidenceAudioSink {
            for chunk in held { sink.appendLiveAudio(chunk.data, alertID: alertID, sequence: chunk.sequence) }
        }
        await startMicIfNeeded(alertID: alertID, mode: mode)
    }

    /// Evidence needs the mic even in modes that don't listen by default (e.g. Walk). This can
    /// fail from the background, so `resume` tries again when the app opens.
    private func startMicIfNeeded(alertID: UUID, mode: GuardMode) async {
        guard let guardAudio = audio as? AudioGuard else { return }
        if !guardAudio.isRunning { try? await guardAudio.start(mode: mode, safeWord: nil) }
        if guardAudio.isRunning, guardAudio.evidenceAlertID != alertID { stream(guardAudio, alertID: alertID) }
    }

    func resume(mode: GuardMode) async {
        guard let capturingAlertID else { return }
        await startMicIfNeeded(alertID: capturingAlertID, mode: mode)
    }

    func stop(alertID: UUID) {
        prebuffers.removeValue(forKey: alertID)
        gates.removeValue(forKey: alertID)
        (audio as? AudioGuard)?.endEvidenceStream()
        guard capturingAlertID == alertID else { return }
        capturingAlertID = nil
        vault.stopCapture()
    }
}

/// Haptics the ladder plays. Check-ins get one quiet tap (SPEC 6.3); alerts stay silent so
/// nobody nearby notices.
@MainActor
protocol EngineHaptics: AnyObject {
    func checkIn()
    func cancelled()
}

@MainActor
final class SystemEngineHaptics: EngineHaptics {
    private let notification = UINotificationFeedbackGenerator()
    private let impact = UIImpactFeedbackGenerator(style: .soft)

    func checkIn() {
        notification.prepare()
        notification.notificationOccurred(.warning)
    }

    func cancelled() {
        impact.impactOccurred(intensity: 0.5)
    }
}

@MainActor
final class SilentEngineHaptics: EngineHaptics {
    func checkIn() {}
    func cancelled() {}
}
