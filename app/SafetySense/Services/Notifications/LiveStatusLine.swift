import Foundation

/// The one short status line on the Live Activity.
enum LiveStatusLine {
    static func text(level: EscalationLevel, alert: AlertRecord?, ladderStatus: String,
                     listening: ListeningState?) -> String {
        if level >= .alert, let response = latestResponse(in: alert?.events ?? []) { return response }
        if level == .guarding, listening == .paused { return "Listening paused. Open SafetySense to resume." }
        return ladderStatus
    }

    /// A confirmed response from a trusted contact's live link ("Maya is on her way").
    static func latestResponse(in events: [AlertEvent]) -> String? {
        let latest = events.filter { $0.action == "on_my_way" || $0.action == "called_911" }
            .max { $0.at < $1.at }
        guard let latest else { return nil }
        let name = latest.who.split(separator: " ").first.map(String.init) ?? latest.who
        return latest.action == "on_my_way" ? "\(name) is on the way." : "\(name) called 911."
    }
}
