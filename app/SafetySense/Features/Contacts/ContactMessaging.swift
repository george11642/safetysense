import MessageUI
import SwiftUI

/// Texts the user sends *themselves* from Messages (SafetySense never texts on their behalf here).
enum ContactMessage {
    /// SPEC 8.4: each contact gets a text explaining what SafetySense is and what to do if alerted.
    /// A build that contacts nobody says so, because this goes to a real person who'd count on it.
    static func intro(to contact: TrustedContact, from profile: Profile?, delivery: AlertDelivery) -> String {
        let me = profile.map(\.firstName).flatMap { $0.isEmpty ? nil : $0 } ?? "me"
        guard delivery.isReal else {
            return """
            Hi \(contact.firstName), I added you as a trusted contact in SafetySense, a safety app I'm testing. \
            This test version doesn't call or text anyone, so it won't reach you if I need help. – \(me)
            """
        }
        return """
        Hi \(contact.firstName), I added you as a trusted contact in SafetySense, a safety app I use when I'm out. \
        If I ever need help and can't reach my phone, SafetySense will call and text you with a link to my live location. \
        If that happens: open the link, please don't call or text my phone, and if you think I'm in danger, call 911. \
        You don't need to install anything. Thank you for having my back. – \(me)
        """
    }

    /// Walk Home: lets the person following along know what's happening.
    static func headsUp(destination: String, eta: Date, delivery: AlertDelivery) -> String {
        let place = destination.isEmpty ? "home" : "to \(destination)"
        let plan = "Heading \(place), should be there by \(eta.formatted(date: .omitted, time: .shortened))."
        return delivery.isReal ? "\(plan) SafetySense will let you know if I don't make it."
                               : "\(plan) The safety app I'm testing won't contact you, so check on me if you don't hear from me."
    }

    /// A practice message so the contact knows what an alert looks like. Clearly marked TEST.
    static func test(to contact: TrustedContact, from profile: Profile?, delivery: AlertDelivery) -> String {
        let me = profile.map(\.firstName).flatMap { $0.isEmpty ? nil : $0 } ?? "your friend"
        guard delivery.isReal else {
            return """
            TEST from SafetySense – nothing is wrong. This is a practice message from \(me). \
            This test version doesn't call or text anyone, so it can't alert you. No need to do anything now.
            """
        }
        return """
        TEST from SafetySense – nothing is wrong. This is a practice message from \(me). \
        If \(me) ever needs help, a real alert comes as a text with a live location link, and sometimes a call. \
        No need to do anything now.
        """
    }
}

/// Wraps `MFMessageComposeViewController`. Use only when `MessageComposer.canSendText` is true.
struct MessageComposer: UIViewControllerRepresentable {
    let recipients: [String]
    let body: String
    var onFinish: (_ sent: Bool) -> Void

    static var canSendText: Bool { MFMessageComposeViewController.canSendText() }

    func makeCoordinator() -> Coordinator { Coordinator(onFinish: onFinish) }

    func makeUIViewController(context: Context) -> MFMessageComposeViewController {
        let vc = MFMessageComposeViewController()
        vc.recipients = recipients
        vc.body = body
        vc.messageComposeDelegate = context.coordinator
        return vc
    }

    func updateUIViewController(_ uiViewController: MFMessageComposeViewController, context: Context) {}

    @MainActor
    final class Coordinator: NSObject, MFMessageComposeViewControllerDelegate {
        let onFinish: (Bool) -> Void
        init(onFinish: @escaping (Bool) -> Void) { self.onFinish = onFinish }

        nonisolated func messageComposeViewController(_ controller: MFMessageComposeViewController,
                                                      didFinishWith result: MessageComposeResult) {
            let sent = result == .sent
            MainActor.assumeIsolated {
                controller.dismiss(animated: true)
                onFinish(sent)
            }
        }
    }
}

/// What to send and to whom; drives `.contactMessageSheet`.
struct ContactMessageDraft: Identifiable {
    enum Kind { case intro, test, headsUp }
    let id = UUID()
    let contact: TrustedContact
    let kind: Kind
    let body: String
}

extension View {
    /// Presents Messages when the device can text; otherwise (Simulator, iPad) a share sheet
    /// with the same text so the user can send it any way they like.
    func contactMessageSheet(_ draft: Binding<ContactMessageDraft?>, onSent: @escaping (ContactMessageDraft) -> Void) -> some View {
        sheet(item: draft) { d in
            if MessageComposer.canSendText {
                MessageComposer(recipients: [d.contact.phone], body: d.body) { sent in
                    if sent { onSent(d) }
                    draft.wrappedValue = nil
                }
                .ignoresSafeArea()
            } else {
                MessageFallbackSheet(draft: d) { onSent(d) }
                    .presentationDetents([.medium, .large])
            }
        }
    }
}

/// Shown where Messages isn't available: preview of the text with a share button.
private struct MessageFallbackSheet: View {
    let draft: ContactMessageDraft
    var onShared: () -> Void
    @Environment(\.dismiss) private var dismiss

    private var title: String {
        switch draft.kind {
        case .intro: "Intro text"
        case .test: "Test message"
        case .headsUp: "Heads-up"
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: SSSpacing.md) {
                    Text(title).ssEyebrow(SSColor.accent)
                    Text("To \(draft.contact.name) · \(PhoneNumber.display(draft.contact.phone))")
                        .font(SSFont.headline)
                    Card {
                        Text(draft.body).font(SSFont.body).textSelection(.enabled)
                    }
                    Text("Messages isn't available on this device, so share the text another way.")
                        .font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
                    ShareLink(item: draft.body) {
                        Label("Share text", systemImage: "square.and.arrow.up")
                            .font(SSFont.headline)
                            .frame(maxWidth: .infinity, minHeight: 56)
                    }
                    .buttonStyle(SSFillButtonStyle(fill: SSColor.accent, foreground: SSColor.onFill))
                    .simultaneousGesture(TapGesture().onEnded { onShared() })
                }
                .padding(.vertical, SSSpacing.md)
            }
            .ssScreen()
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
    }
}

#Preview("Fallback") {
    let contact = SampleData.contacts[0]
    MessageFallbackSheet(draft: ContactMessageDraft(contact: contact, kind: .intro,
                                                    body: ContactMessage.intro(to: contact, from: SampleData.profile, delivery: .real))) {}
        .preferredColorScheme(.dark)
}
