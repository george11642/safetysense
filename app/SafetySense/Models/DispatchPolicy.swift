import Foundation

/// Who gets help first when an alert fires (SPEC 15.2). Raw values are the API spelling.
enum DispatchPolicy: String, Codable, Sendable, CaseIterable, Identifiable {
    /// Alert contacts; dispatch after 90 s with no valid cancel or when a contact taps "Send help".
    case contactsFirst = "contacts_first"
    /// Contacts and professional dispatch at the same time.
    case dispatchImmediately = "dispatch_immediately"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .contactsFirst: "Contacts first"
        case .dispatchImmediately: "Dispatch right away"
        }
    }
}

/// Per-mode dispatch policy plus the manual-SOS policy. Defaults follow SPEC 15.2:
/// every mode alerts contacts first; a manual SOS goes straight to dispatch.
struct DispatchPolicySettings: Codable, Sendable, Equatable {
    var perMode: [GuardMode: DispatchPolicy]
    var manualSOS: DispatchPolicy

    static let `default` = DispatchPolicySettings(
        perMode: Dictionary(uniqueKeysWithValues: GuardMode.allCases.map { ($0, .contactsFirst) }),
        manualSOS: .dispatchImmediately
    )

    func policy(for mode: GuardMode) -> DispatchPolicy {
        perMode[mode] ?? .contactsFirst
    }

    /// Policy for a specific trigger in a mode. Manual triggers use `manualSOS`.
    func policy(for trigger: AlertTrigger, in mode: GuardMode) -> DispatchPolicy {
        trigger.isManual ? manualSOS : policy(for: mode)
    }

    /// Escalation level a trigger starts at.
    func startingLevel(for trigger: AlertTrigger, in mode: GuardMode) -> EscalationLevel {
        policy(for: trigger, in: mode) == .dispatchImmediately ? .dispatch : .alert
    }
}
