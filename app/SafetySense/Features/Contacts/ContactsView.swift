import SwiftUI

/// Contacts tab (SPEC 9.10): add, remove and test the people SafetySense calls.
struct ContactsView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SSSpacing.lg) {
                VStack(alignment: .leading, spacing: SSSpacing.xs) {
                    Text("Your people").ssEyebrow(SSColor.accent)
                    Text("Trusted contacts").font(SSFont.display)
                    Text("Up to \(TrustedContact.maxCount) people. They don't need the app. If an alert starts, your first contact gets a call, and everyone gets a text with a link to your live location.")
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

                NavigationLink { ContactPreviewView() } label: {
                    Card {
                        HStack(spacing: SSSpacing.sm) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("What your contacts see").font(SSFont.headline)
                                Text("See an example of the live link. Nothing is sent.")
                                    .font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
                            }
                            Spacer(minLength: 0)
                            Image(systemName: "chevron.right").font(.footnote.weight(.semibold))
                                .foregroundStyle(SSColor.inkMuted).accessibilityHidden(true)
                        }
                    }
                }
                .buttonStyle(.plain)
                .foregroundStyle(SSColor.ink)

                Text("SafetySense supplements 911. If you're in danger right now, call 911.")
                    .font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
            }
            .padding(.bottom, SSSpacing.xl)
        }
        .ssScreen()
        .toolbar(.hidden, for: .navigationBar)
    }
}

#Preview { NavigationStack { ContactsView() }.environment(AppModel.preview(screen: .contacts)) }
