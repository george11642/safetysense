import Foundation

/// What started an alert. Raw values are the API spelling of `trigger`.
enum AlertTrigger: String, Codable, Sendable, CaseIterable {
    case riskEngine = "risk_engine"
    case missedCheckIn = "missed_check_in"
    case safeWord = "safe_word"
    case actionButton = "action_button"
    case manualSOS = "manual_sos"
    case heartbeatLost = "heartbeat_lost"
    case contact

    /// Triggers the user fires on purpose. These use the manual-SOS dispatch policy.
    var isManual: Bool {
        switch self {
        case .safeWord, .actionButton, .manualSOS: true
        default: false
        }
    }

    var displayName: String {
        switch self {
        case .riskEngine: "Signs of danger"
        case .missedCheckIn: "Missed check-in"
        case .safeWord: "Safe word"
        case .actionButton: "Action Button"
        case .manualSOS: "SOS"
        case .heartbeatLost: "Phone went dark"
        case .contact: "A contact asked for help"
        }
    }
}

enum AlertStatus: String, Codable, Sendable {
    case active, dispatched, cancelled, resolved
}

enum NotifyChannel: String, Codable, Sendable { case call, sms }

/// A contact notification result from `alert/create`.
struct NotifiedContact: Codable, Sendable, Equatable, Hashable {
    var name: String
    var channel: NotifyChannel
    /// Provider status, e.g. "queued", "ringing", "failed".
    var status: String
}

/// Timeline entry (from `alert/status` events or local actions).
struct AlertEvent: Codable, Sendable, Equatable, Identifiable, Hashable {
    var id: UUID = UUID()
    /// Who acted: a contact's name, "dispatch", "you", "SafetySense".
    var who: String
    /// e.g. "on_my_way", "called_911", "send_help", "notified", "dispatched".
    var action: String
    var at: Date

    var displayText: String {
        switch action {
        case "on_my_way": return "\(who) is on the way"
        case "called_911": return "\(who) called 911"
        case "send_help": return "\(who) asked for help to be sent"
        case "notified_by_call": return "Calling \(who)"
        case "notified_by_sms": return "Texted \(who) your live link"
        case "text_not_delivered": return "Text to \(who) not delivered"
        case "dispatch_requested": return "Professional help requested"
        case "cancelled": return "Alert cancelled"
        case "marked_safe": return "\(who) marked safe"
        case "no_contacts": return "No trusted contacts are set up"
        case "alert_resumed": return "Alert resumed"
        case "drill_started": return "Practice drill started"
        default: break
        }
        if who == "dispatch" {
            let simulated = action.hasPrefix("simulated_")
            if action.contains("calling") {
                return simulated ? "Simulated: monitoring center is calling you" : "Monitoring center is calling you"
            }
            let words = action.replacingOccurrences(of: "simulated_", with: "")
                .replacingOccurrences(of: "_", with: " ")
            let detail = words == "dispatch" || words.isEmpty ? "requested" : words
            return "\(simulated ? "Simulated dispatch" : "Monitoring center"): \(detail)"
        }
        if action.hasPrefix("test_") {
            // Drill rows, e.g. "test_call_dry_run": nobody was actually contacted.
            return "TEST: \(who) (\(action.contains("_sms_") ? "text" : "call"), not sent)"
        }
        return "\(who): \(action.replacingOccurrences(of: "_", with: " "))"
    }
}

enum DispatchProvider: String, Codable, Sendable {
    case noonlightSandbox = "noonlight_sandbox"
    case simulated
}

struct DispatchInfo: Codable, Sendable, Equatable {
    var provider: DispatchProvider
    var alarmID: String?
    var status: String

    /// Copy shown in the UI; always says "simulated" when the provider is simulated.
    var displayStatus: String {
        let words = status.replacingOccurrences(of: "simulated_", with: "")
            .replacingOccurrences(of: "_", with: " ")
        if provider == .simulated {
            // e.g. "simulated_dispatch" -> "Simulated dispatch requested"
            return words == "dispatch" || words.isEmpty ? "Simulated dispatch requested" : "Simulated dispatch: \(words)"
        }
        return "Dispatch: \(words)"
    }
}

/// Local record of one alert, merged from the backend responses.
struct AlertRecord: Codable, Sendable, Equatable, Identifiable {
    var id: UUID
    var serverAlertID: String?
    var shareURL: URL?
    var sessionID: String?
    var level: EscalationLevel
    var trigger: AlertTrigger
    var reason: String
    var policy: DispatchPolicy
    var status: AlertStatus
    var startedAt: Date
    var levelChangedAt: Date
    var notified: [NotifiedContact]
    var events: [AlertEvent]
    var dispatch: DispatchInfo?
    /// Practice drill: contacts get a message clearly marked TEST; never dispatches.
    var isDrill: Bool

    init(id: UUID = UUID(), serverAlertID: String? = nil, shareURL: URL? = nil, sessionID: String? = nil,
         level: EscalationLevel, trigger: AlertTrigger, reason: String, policy: DispatchPolicy,
         status: AlertStatus = .active, startedAt: Date = .now, levelChangedAt: Date = .now,
         notified: [NotifiedContact] = [], events: [AlertEvent] = [], dispatch: DispatchInfo? = nil,
         isDrill: Bool = false) {
        self.id = id
        self.serverAlertID = serverAlertID
        self.shareURL = shareURL
        self.sessionID = sessionID
        self.level = level
        self.trigger = trigger
        self.reason = reason
        self.policy = policy
        self.status = status
        self.startedAt = startedAt
        self.levelChangedAt = levelChangedAt
        self.notified = notified
        self.events = events
        self.dispatch = dispatch
        self.isDrill = isDrill
    }

    /// When an alert-level record auto-escalates to dispatch.
    var dispatchDeadline: Date? {
        guard level == .alert, let after = EscalationLevel.alert.autoEscalateAfter else { return nil }
        return levelChangedAt.addingTimeInterval(after)
    }
}
