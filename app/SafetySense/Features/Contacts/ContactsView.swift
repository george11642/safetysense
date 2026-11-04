import SwiftUI

/// Contacts tab (SPEC 9.10): add, remove and test the people SafetySense calls.
struct ContactsView: View {
    @Environment(AppModel.self) private var model
    @State private var showHowItWorks = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SSSpacing.lg) {
                VStack(alignment: .leading, spacing: SSSpacing.xs) {
                    Text("Your people").ssEyebrow(SSColor.accent)
                    Text("Trusted contacts").font(SSFont.display)
                    Text("Up to \(TrustedContact.maxCount) people. They don't need the app. If an alert starts, they get a call and a text with a link to your live location.")
                        .font(SSFont.callout).foregroundStyle(SSColor.inkMuted)
                }
                .padding(.top, SSSpacing.md)

                if model.contacts.isEmpty {
                    Card(tint: SSColor.warn) {
                        Label("Without a contact, an alert can only go to dispatch. Add someone you trust.",
                              systemImage: "exclamationmark.triangle")
                            .font(SSFont.callout)
                    }
                }

                TrustedContactsEditor(context: .tab)

                DisclosureGroup(isExpanded: $showHowItWorks) {
                    VStack(alignment: .leading, spacing: SSSpacing.sm) {
                        step("1", "Your first contact gets a phone call. Everyone gets a text with your live location.")
                        step("2", "On the link they can tap \u{201C}I'm on my way\u{201D}, \u{201C}I called 911\u{201D} or \u{201C}Send help\u{201D}.")
                        step("3", "With contacts first (the default), dispatch is asked to help if you don't cancel within 90 seconds or a contact taps \u{201C}Send help\u{201D}.")
                        Text("A test message is one you send yourself from Messages, so they know what to expect. No alert is created.")
                            .font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
                    }
                    .padding(.top, SSSpacing.sm)
                } label: {
                    Text("What your contacts see").font(SSFont.headline)
                }
                .tint(SSColor.inkMuted)
                .padding(SSSpacing.md)
                .background(SSColor.surface, in: RoundedRectangle(cornerRadius: SSRadius.card, style: .continuous))

                Text("SafetySense supplements 911. If you're in danger right now, call 911.")
                    .font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
            }
            .padding(.bottom, SSSpacing.xl)
        }
        .ssScreen()
        .toolbar(.hidden, for: .navigationBar)
    }

    private func step(_ n: String, _ text: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: SSSpacing.sm) {
            Text(n).font(SSFont.mono(13, weight: .semibold)).foregroundStyle(SSColor.accent)
                .frame(width: 22, height: 22).background(SSColor.accentSoft, in: Circle())
            Text(text).font(SSFont.callout)
        }
    }
}

#Preview { NavigationStack { ContactsView() }.environment(AppModel.preview(screen: .contacts)) }
