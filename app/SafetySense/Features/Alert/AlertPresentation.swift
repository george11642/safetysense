import SwiftUI

/// Plain-language labels for provider statuses and contact responses.
enum AlertPresentation {
    struct Status {
        let text: String
        let tint: Color
        let systemImage: String
    }

    /// Twilio-style statuses ("queued", "ringing", "in-progress", "completed", "failed:21608", "test").
    static func notified(_ contact: NotifiedContact) -> Status {
        let raw = contact.status.lowercased()
        let isCall = contact.channel == .call
        if raw.hasPrefix("failed") || raw == "busy" || raw == "no-answer" || raw == "undelivered" || raw == "canceled" {
            return Status(text: isCall ? "Couldn't reach" : "Text didn't send", tint: SSColor.warn,
                          systemImage: "exclamationmark.circle")
        }
        switch raw {
        case "test": return Status(text: "Test sent", tint: SSColor.inkMuted, systemImage: "checkmark.circle")
        // The server's status when "Allow real calls" is off: nobody was contacted.
        case "dry_run": return Status(text: "Test · not sent", tint: SSColor.inkMuted, systemImage: "testtube.2")
        case "ringing", "initiated": return Status(text: "Calling…", tint: SSColor.warn, systemImage: "phone.arrow.up.right")
        case "in-progress", "answered": return Status(text: "Answered", tint: SSColor.calm, systemImage: "phone.fill")
        case "completed": return Status(text: isCall ? "Call ended" : "Delivered", tint: SSColor.calm, systemImage: "checkmark.circle.fill")
        case "sent": return Status(text: "Text sent", tint: SSColor.calm, systemImage: "checkmark.circle")
        case "delivered": return Status(text: "Text delivered", tint: SSColor.calm, systemImage: "checkmark.circle.fill")
        default: return Status(text: isCall ? "Calling…" : "Sending text…", tint: isCall ? SSColor.warn : SSColor.inkMuted,
                               systemImage: isCall ? "phone" : "message")
        }
    }

    /// A contact's latest response from the share page, if any.
    static func response(for name: String, in events: [AlertEvent]) -> Status? {
        let first = name.split(separator: " ").first.map(String.init) ?? name
        let latest = events.filter { $0.who == name || $0.who == first }.sorted { $0.at < $1.at }.last
        switch latest?.action {
        case "on_my_way": return Status(text: "On the way", tint: SSColor.calm, systemImage: "figure.walk")
        case "called_911": return Status(text: "Called 911", tint: SSColor.calm, systemImage: "phone.badge.checkmark")
        case "send_help": return Status(text: "Asked for help", tint: SSColor.danger, systemImage: "light.beacon.max")
        default: return nil
        }
    }

    static func icon(for event: AlertEvent) -> (String, Color) {
        switch event.action {
        case "on_my_way": ("figure.walk", SSColor.calm)
        case "called_911": ("phone.badge.checkmark", SSColor.calm)
        case "send_help": ("light.beacon.max", SSColor.danger)
        case "dispatched", "escalated": ("shield.lefthalf.filled", SSColor.danger)
        case "notified", "alert_started": ("bell.badge", SSColor.accent)
        case "cancelled": ("xmark.circle", SSColor.inkMuted)
        case "notified_by_call": ("phone.arrow.up.right", SSColor.accent)
        case "notified_by_sms": ("message", SSColor.accent)
        case "dispatch_requested": ("shield.lefthalf.filled", SSColor.danger)
        default: event.who == "dispatch" ? ("shield.lefthalf.filled", SSColor.danger) : ("circle.fill", SSColor.inkMuted)
        }
    }

    /// Merges server events into local ones, dropping duplicates (same who/action within 2 s).
    /// "Alert started" is always first, and at the same instant contacts follow it.
    static func merge(_ local: [AlertEvent], _ remote: [AlertEvent]) -> [AlertEvent] {
        var out = local
        for e in remote where !out.contains(where: { $0.who == e.who && $0.action == e.action && abs($0.at.timeIntervalSince(e.at)) < 2 }) {
            out.append(e)
        }
        return out.sorted { a, b in
            let aFirst = a.action == "alert_started", bFirst = b.action == "alert_started"
            if aFirst != bFirst { return aFirst }
            if a.at != b.at { return a.at < b.at }
            return order(a) < order(b)
        }
    }

    private static func order(_ event: AlertEvent) -> Int {
        contactedActions.contains(event.action) ? 1 : 2
    }

    /// Every way the phone and server say "contacts were reached". One row on the timeline.
    private static let contactedActions: Set<String> = ["notified", "notified_by_call", "notified_by_sms",
                                                        "call_placed", "text_sent"]
    /// Provider bookkeeping that means nothing to the person it's happening to.
    private static let hiddenActions: Set<String> = ["call_status", "alert_resumed"]
    /// Steps the phone and server both log. Their clocks differ, so these show once.
    private static let singleActions: Set<String> = ["alert_started", "dispatch_requested"]

    /// Timeline rows, oldest first.
    static func timeline(_ events: [AlertEvent], isTest: Bool) -> [TimelineRow] {
        var rows: [TimelineRow] = []
        var shown: Set<String> = []
        for event in events where !hiddenActions.contains(event.action) {
            let isContacted = contactedActions.contains(event.action)
            let key = isContacted ? "contacted" : event.action
            if isContacted || singleActions.contains(event.action) {
                guard shown.insert(key).inserted else { continue }
            }
            let (icon, tint) = icon(for: event)
            let text = isContacted
                ? (isTest ? "Test alert: your contacts were not contacted" : "Your contacts were called and texted")
                : timelineText(event)
            rows.append(TimelineRow(id: event.id, text: text, systemImage: icon, tint: tint, at: event.at))
        }
        return rows
    }

    private static func timelineText(_ event: AlertEvent) -> String {
        switch event.action {
        case "alert_started": "Alert started"
        case "dispatched", "escalated": "Professional dispatch started"
        default: event.displayText
        }
    }

    /// `Maya gets a call and your live location. Jordan and Sam get it by text.`
    static func whoHears(_ contacts: [TrustedContact], delivery: AlertDelivery) -> String {
        guard let first = contacts.first(where: \.isPrimary) ?? contacts.first else { return "Add a trusted contact so someone hears from you." }
        guard delivery.isReal else { return delivery.reaching(NameList.join(contacts.map(\.firstName))) }
        let others = contacts.filter { $0.id != first.id }.map(\.firstName)
        let lead = "\(first.firstName) gets a call and your live location."
        guard !others.isEmpty else { return lead }
        return "\(lead) \(NameList.join(others)) \(others.count == 1 ? "gets" : "get") it by text."
    }

    /// "Help is on the way" needs proof: the server has the alert and dispatch has answered, with
    /// no connection problem since. Until then the screen must not promise it.
    static func dispatchConfirmed(alert: AlertRecord?, dispatch: DispatchInfo?, connectionNote: String?) -> Bool {
        alert?.serverAlertID != nil && dispatch != nil && connectionNote == nil
    }

    /// Every contact came back "dry_run": the server logged the alert but called and texted nobody.
    static func isTest(_ alert: AlertRecord?) -> Bool {
        let notified = alert?.notified ?? []
        return !notified.isEmpty && notified.allSatisfy { $0.status == "dry_run" || $0.status == "test" }
    }

    /// The "Why" line on the countdown, in the person's own terms.
    static func why(_ alert: AlertRecord) -> String? {
        switch alert.reason {
        case "": nil
        case "No answer to a check-in": "No answer to your check-in"
        case "Asked for help at a check-in": "You tapped \u{201C}I need help\u{201D}"
        default: alert.reason
        }
    }

    // MARK: People

    /// One person's call and text, merged: the server reports them as separate rows.
    struct Person: Hashable, Identifiable {
        var name: String
        var call: NotifiedContact?
        var text: NotifiedContact?
        var id: String { name }

        var firstName: String { name.split(separator: " ").first.map(String.init) ?? name }

        var channels: String {
            switch (call != nil, text != nil) {
            case (true, true): "Call + text"
            case (true, false): "Phone call"
            default: "Text message"
            }
        }

        var channelImage: String { call != nil ? "phone" : "message" }

        /// Their response on top, then the call, which stays "Couldn't reach" even if a text got
        /// out: a sent text doesn't mean they know. The channel line still says both.
        func status(events: [AlertEvent]) -> Status {
            if let response = AlertPresentation.response(for: name, in: events) { return response }
            if let call { return AlertPresentation.notified(call) }
            return text.map(AlertPresentation.notified) ?? Status(text: "Sending…", tint: SSColor.inkMuted, systemImage: "message")
        }
    }

    static func people(_ notified: [NotifiedContact]) -> [Person] {
        var out: [Person] = []
        for contact in notified {
            let index = out.firstIndex { $0.name == contact.name } ?? {
                out.append(Person(name: contact.name))
                return out.count - 1
            }()
            if contact.channel == .call { out[index].call = contact } else { out[index].text = contact }
        }
        return out
    }

    /// A row on the countdown: the person being called, then everyone else as one line, so a
    /// full list of five still leaves the PIN pad on screen.
    struct GroupRow: Identifiable {
        var id: String { title }
        var title: String
        var subtitle: String
        var channelImage: String
        var avatars: [String]
        var status: Status
    }

    static func countdownRows(_ people: [Person], events: [AlertEvent]) -> [GroupRow] {
        guard let lead = people.first(where: { $0.call != nil }) ?? people.first else { return [] }
        var rows = [GroupRow(title: lead.name, subtitle: lead.channels, channelImage: lead.channelImage,
                             avatars: [lead.name], status: lead.status(events: events))]
        let others = people.filter { $0.name != lead.name }
        guard !others.isEmpty else { return rows }
        rows.append(GroupRow(title: groupTitle(others),
                             subtitle: others.count == 1 ? others[0].channels : "Text messages",
                             channelImage: "message", avatars: others.prefix(2).map(\.name),
                             status: groupStatus(others, events: events)))
        return rows
    }

    private static func groupTitle(_ people: [Person]) -> String {
        let names = people.map(\.firstName)
        switch names.count {
        case 1: return people[0].name
        case 2: return "\(names[0]) & \(names[1])"
        case 3: return "\(names[0]), \(names[1]) & \(names[2])"
        default: return "\(names[0]), \(names[1]) & \(names.count - 2) more"
        }
    }

    private static func groupStatus(_ people: [Person], events: [AlertEvent]) -> Status {
        let statuses = people.map { $0.status(events: events) }
        let failed = statuses.filter { $0.text == "Text didn't send" || $0.text == "Couldn't reach" }
        if failed.count == statuses.count { return statuses[0] }
        if !failed.isEmpty {
            return Status(text: "Some didn't send", tint: SSColor.warn, systemImage: "exclamationmark.circle")
        }
        return statuses.first { $0.tint != SSColor.inkMuted } ?? statuses[0]
    }
}

/// One line on the alert timeline.
struct TimelineRow: Identifiable {
    let id: UUID
    let text: String
    let systemImage: String
    let tint: Color
    let at: Date
}

/// Messages and Phone as a way out when SafetySense's server can't be reached.
enum ContactFallback {
    /// A draft to every contact. Nothing goes out until the person taps Send in Messages.
    static func textURL(to contacts: [TrustedContact], from profile: Profile?, location: LocationFix?) -> URL? {
        guard !contacts.isEmpty else { return nil }
        var body = "I need help."
        if let name = profile?.firstName, !name.isEmpty { body = "It's \(name). I need help." }
        if let location { body += " I'm here: https://maps.apple.com/?ll=\(location.latitude),\(location.longitude)" }
        var components = URLComponents()
        components.scheme = "sms"
        components.path = "/open"
        components.queryItems = [URLQueryItem(name: "addresses", value: contacts.map(\.phone).joined(separator: ",")),
                                 URLQueryItem(name: "body", value: body)]
        return components.url
    }
}

/// One contact with their channels, provider status and (if any) their response.
struct NotifiedContactRow: View {
    let person: AlertPresentation.Person
    var events: [AlertEvent] = []

    var body: some View {
        let status = person.status(events: events)
        HStack(spacing: SSSpacing.sm) {
            ContactAvatar(name: person.name, tint: status.tint, size: 34)
            VStack(alignment: .leading, spacing: 1) {
                Text(person.name).font(SSFont.headline)
                Label(person.channels, systemImage: person.channelImage)
                    .font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
            }
            Spacer(minLength: SSSpacing.xs)
            Label(status.text, systemImage: status.systemImage)
                .font(SSFont.callout.weight(.semibold))
                .foregroundStyle(status.tint)
                .contentTransition(.opacity)
        }
        .frame(minHeight: 44)
        .accessibilityElement(children: .combine)
    }
}

/// The countdown's compact row: one person, or a group on one line.
struct NotifiedGroupRow: View {
    let row: AlertPresentation.GroupRow

    var body: some View {
        HStack(spacing: SSSpacing.sm) {
            HStack(spacing: -8) {
                ForEach(row.avatars, id: \.self) { name in
                    ContactAvatar(name: name, tint: row.status.tint, size: row.avatars.count > 1 ? 26 : 34)
                        .background(SSColor.surface, in: Circle())
                }
            }
            .frame(minWidth: 34)
            VStack(alignment: .leading, spacing: 0) {
                Text(row.title).font(SSFont.headline).lineLimit(1).minimumScaleFactor(0.8)
                Label(row.subtitle, systemImage: row.channelImage)
                    .font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
            }
            Spacer(minLength: SSSpacing.xs)
            Text(row.status.text)
                .font(SSFont.callout.weight(.semibold))
                .foregroundStyle(row.status.tint)
                .lineLimit(1)
                .contentTransition(.opacity)
        }
        .frame(minHeight: 40)
        .accessibilityElement(children: .combine)
    }
}

/// "Evidence encrypted · 2:12" chip with the clock and a breathing red dot.
struct EvidenceIndicator: View {
    let isCapturing: Bool

    @State private var pulse = false

    var body: some View {
        HStack(spacing: SSSpacing.xs) {
            Circle()
                .fill(isCapturing ? SSColor.danger : SSColor.inkMuted)
                .frame(width: 8, height: 8)
                .opacity(isCapturing && pulse ? 0.3 : 1)
            if isCapturing {
                TimelineView(.everyMinute) { context in
                    Text("Evidence encrypted · \(MarkedSafeSummary.clock(context.date))")
                        .font(SSFont.mono(12, weight: .semibold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                }
            } else {
                Text("Evidence not recording").font(SSFont.mono(12, weight: .semibold))
            }
        }
        .textCase(.uppercase)
        .foregroundStyle(isCapturing ? SSColor.calm : SSColor.inkMuted)
        .padding(.horizontal, 12)
        .padding(.vertical, 7)
        .background((isCapturing ? SSColor.calmSoft : SSColor.surfaceRaised), in: Capsule())
        .onAppear {
            withAnimation(.easeInOut(duration: 1).repeatForever(autoreverses: true)) { pulse = true }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(isCapturing ? "Recording encrypted evidence" : "Evidence is not recording")
    }
}

extension AppModel {
    /// Keeps encrypted capture going for a real (non-drill) alert. The escalation controller owns
    /// it: evidence commits once the alert is live, so a PIN before that leaves nothing behind.
    /// Here that can only mean reopening the mic. The demo ladder has no evidence of its own.
    func ensureEvidenceCapture(for alert: AlertRecord) async {
        guard !alert.isDrill, alert.status == .active || alert.status == .dispatched else { return }
        if let escalation = services.escalation as? EscalationController {
            await escalation.resumeEvidence()
            return
        }
        guard !services.vault.isCapturing else { return }
        try? await services.vault.startCapture(alertID: alert.id, serverAlertID: alert.serverAlertID,
                                               prebuffer: services.audio.snapshotRecentAudio())
    }
}

#Preview {
    VStack(spacing: 12) {
        Card {
            VStack {
                ForEach(AlertPresentation.people([NotifiedContact(name: "Maya Chen", channel: .call, status: "ringing"),
                                                  NotifiedContact(name: "Maya Chen", channel: .sms, status: "sent"),
                                                  NotifiedContact(name: "Jordan Lee", channel: .sms, status: "queued"),
                                                  NotifiedContact(name: "Sam Rivera", channel: .call, status: "failed:21608")])) { person in
                    NotifiedContactRow(person: person, events: [AlertEvent(who: "Maya", action: "on_my_way", at: .now)])
                }
            }
        }
        EvidenceIndicator(isCapturing: true)
        EvidenceIndicator(isCapturing: false)
    }
    .padding()
    .background(SSColor.background)
    .foregroundStyle(SSColor.ink)
}
