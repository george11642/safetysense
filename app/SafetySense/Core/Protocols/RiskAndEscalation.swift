import Foundation
import Observation

/// Deterministic, explainable rules engine (SPEC 6.2). Each signal adds weighted points that
/// decay over time; weights depend on mode and time of day; sensitivity scales thresholds.
@MainActor
protocol RiskEngineProtocol: AnyObject {
    var current: RiskAssessment { get }
    func configure(mode: GuardMode, sensitivity: Sensitivity)
    /// Adds a signal and returns the updated assessment.
    @discardableResult
    func ingest(_ signal: RiskSignal, at now: Date) -> RiskAssessment
    /// Re-evaluates decay without a new signal (call on a timer).
    func evaluate(at now: Date) -> RiskAssessment
    /// Applies a bounded second-opinion adjustment. Can never be the only reason to escalate.
    func applySecondOpinion(_ opinion: SecondOpinion, at now: Date) -> RiskAssessment
    func reset()
}

/// Bounded AI adjustment from Foundation Models (SPEC 6.2).
struct SecondOpinion: Codable, Sendable, Equatable {
    /// Clamped to `SecondOpinion.maxAdjustment` either way.
    var adjustment: Double
    var rationale: String

    static let maxAdjustment: Double = 0.25

    init(adjustment: Double, rationale: String) {
        self.adjustment = min(max(adjustment, -Self.maxAdjustment), Self.maxAdjustment)
        self.rationale = rationale
    }
}

/// On-device Foundation Models second opinion. Unavailable on phones without Apple Intelligence.
@MainActor
protocol SecondOpinionProtocol: AnyObject {
    var isAvailable: Bool { get }
    func evaluate(transcript: String, signals: [RiskSignal], mode: GuardMode) async -> SecondOpinion?
}

/// Result of checking a PIN against the stored safety / duress PIN hashes.
enum PINVerification: String, Sendable, Equatable {
    case valid, duress, invalid
}

/// The escalation ladder state machine (SPEC 6.3). Implementations must be `@Observable`
/// so views can read `level` / `activeAlert` directly through `AppModel.services.escalation`.
///
/// Rules it must keep:
/// - Level 1 (check-in) waits 45 s, then goes to 2.
/// - Level 2 (alert) waits 90 s with no valid cancel, then goes to 3 (contacts-first policy).
/// - Manual triggers start at the level from `DispatchPolicySettings.startingLevel`.
/// - "I need help" at a check-in starts at the mode's policy, not the manual SOS one.
/// - A duress PIN looks like a cancel in the UI but silently escalates to 3.
/// - The AI second opinion never blocks a manual SOS.
@MainActor
protocol EscalationControllerProtocol: AnyObject, Observable {
    var level: EscalationLevel { get }
    var activeAlert: AlertRecord? { get }
    /// Deadline for the current step (check-in answer window or alert->dispatch countdown).
    var stepDeadline: Date? { get }
    /// When the next scheduled check-in fires (nil when the mode has none or a step is active).
    var nextCheckInAt: Date? { get }
    /// Why the current check-in was raised (nil when no check-in is up).
    var checkInCause: CheckInCause? { get }
    /// Calm note when the server can't be reached during an alert (nil when all is well).
    var connectionNote: String? { get }
    /// Called whenever the level or alert changes (AppModel persists + updates the Live Activity).
    var onChange: (@MainActor (EscalationLevel, AlertRecord?) -> Void)? { get set }

    func begin(session: GuardSession, policies: DispatchPolicySettings)
    func handle(_ assessment: RiskAssessment)
    func scheduledCheckInDue()
    func respondToCheckIn(okay: Bool)
    func triggerManual(_ trigger: AlertTrigger, reason: String)
    /// A contact tapped "Send help" on the share page.
    func contactRequestedHelp(name: String)
    func cancel(with verification: PINVerification) async
    /// Practice drill: contacts get a TEST message, never dispatches.
    func startDrill() async
    func end()
}
