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
        case "ringing", "initiated": return Status(text: "Calling…", tint: SSColor.accent, systemImage: "phone.arrow.up.right")
        case "in-progress", "answered": return Status(text: "Answered", tint: SSColor.calm, systemImage: "phone.fill")
        case "completed": return Status(text: isCall ? "Call ended" : "Delivered", tint: SSColor.calm, systemImage: "checkmark.circle.fill")
        case "sent": return Status(text: "Text sent", tint: SSColor.calm, systemImage: "checkmark.circle")
        case "delivered": return Status(text: "Text delivered", tint: SSColor.calm, systemImage: "checkmark.circle.fill")
        default: return Status(text: isCall ? "Calling…" : "Sending text…", tint: SSColor.inkMuted,
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
    static func merge(_ local: [AlertEvent], _ remote: [AlertEvent]) -> [AlertEvent] {
        var out = local
        for e in remote where !out.contains(where: { $0.who == e.who && $0.action == e.action && abs($0.at.timeIntervalSince(e.at)) < 2 }) {
            out.append(e)
        }
        return out.sorted { $0.at < $1.at }
    }
}

/// One notified contact with channel, provider status and (if any) their response.
struct NotifiedContactRow: View {
    let contact: NotifiedContact
    var events: [AlertEvent] = []

    var body: some View {
        let status = AlertPresentation.response(for: contact.name, in: events) ?? AlertPresentation.notified(contact)
        HStack(spacing: SSSpacing.sm) {
            ContactAvatar(name: contact.name, tint: status.tint, size: 34)
            VStack(alignment: .leading, spacing: 1) {
                Text(contact.name).font(SSFont.headline)
                Label(contact.channel == .call ? "Phone call" : "Text message",
                      systemImage: contact.channel == .call ? "phone" : "message")
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

/// "Evidence encrypted · 2:41" chip with a live clock and a breathing red dot.
struct EvidenceIndicator: View {
    let isCapturing: Bool
    let since: Date

    @State private var pulse = false

    var body: some View {
        HStack(spacing: SSSpacing.xs) {
            Circle()
                .fill(isCapturing ? SSColor.danger : SSColor.inkMuted)
                .frame(width: 8, height: 8)
                .opacity(isCapturing && pulse ? 0.3 : 1)
            if isCapturing {
                HStack(spacing: 0) {
                    Text("Evidence encrypted · ")
                    Text(timerInterval: since...Date.distantFuture, countsDown: false).monospacedDigit()
                }
                .font(SSFont.mono(12, weight: .semibold))
                .lineLimit(1)
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
    /// Makes sure encrypted capture is running for a real (non-drill) alert. Idempotent:
    /// if the escalation controller already started capture this does nothing.
    func ensureEvidenceCapture(for alert: AlertRecord) async {
        guard !alert.isDrill, alert.status == .active || alert.status == .dispatched,
              !services.vault.isCapturing else { return }
        try? await services.vault.startCapture(alertID: alert.id, serverAlertID: alert.serverAlertID,
                                               prebuffer: services.audio.snapshotRecentAudio())
    }
}

#Preview {
    VStack(spacing: 12) {
        Card {
            VStack {
                NotifiedContactRow(contact: NotifiedContact(name: "Maya Chen", channel: .call, status: "ringing"),
                                   events: [AlertEvent(who: "Maya", action: "on_my_way", at: .now)])
                NotifiedContactRow(contact: NotifiedContact(name: "Jordan Lee", channel: .sms, status: "queued"))
                NotifiedContactRow(contact: NotifiedContact(name: "Sam Rivera", channel: .call, status: "failed:21608"))
            }
        }
        EvidenceIndicator(isCapturing: true, since: .now.addingTimeInterval(-161))
        EvidenceIndicator(isCapturing: false, since: .now)
    }
    .padding()
    .background(SSColor.background)
    .foregroundStyle(SSColor.ink)
}
