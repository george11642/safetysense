import SwiftUI

/// The list of trusted contacts with add / edit / remove / primary / intro-text / test actions.
/// Used by the onboarding contacts step and the Contacts tab.
struct TrustedContactsEditor: View {
    @Environment(AppModel.self) private var model

    /// Onboarding emphasizes the intro text; the tab emphasizes testing.
    var context: Context = .tab

    enum Context { case onboarding, tab }

    @State private var editing: TrustedContact?
    @State private var addingManually = false
    @State private var pendingRemoval: TrustedContact?
    @State private var message: ContactMessageDraft?
    @State private var notice: String?
    @State private var addedTick = 0

    var body: some View {
        VStack(alignment: .leading, spacing: SSSpacing.sm) {
            HStack {
                Text("\(model.contacts.count) of \(TrustedContact.maxCount)").ssEyebrow()
                Spacer()
                CapacityDots(count: model.contacts.count)
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(model.contacts.count) of \(TrustedContact.maxCount) contacts added")

            ForEach(model.contacts) { contact in
                ContactCard(contact: contact, context: context,
                            onIntro: { message = draft(contact, .intro) },
                            onTest: { message = draft(contact, .test) },
                            onEdit: { editing = contact },
                            onPrimary: { withAnimation(.smooth) { model.makePrimary(contact) } },
                            onRemove: { pendingRemoval = contact })
                    .transition(.asymmetric(insertion: .scale(scale: 0.96).combined(with: .opacity),
                                            removal: .opacity))
            }

            if model.contacts.isEmpty {
                EmptyContactsCard()
            }

            if let notice {
                Label(notice, systemImage: "info.circle")
                    .font(SSFont.caption).foregroundStyle(SSColor.warn)
                    .transition(.opacity)
            }

            if model.canAddContact {
                HStack(spacing: SSSpacing.sm) {
                    addButton("From Contacts", systemImage: "person.crop.circle.badge.plus") { pickFromContacts() }
                    addButton("Type a number", systemImage: "keyboard") { addingManually = true }
                }
                .padding(.top, SSSpacing.xxs)
            }
        }
        .animation(.smooth, value: model.contacts)
        .animation(.smooth, value: notice)
        .sensoryFeedback(.success, trigger: addedTick)
        .sheet(isPresented: $addingManually) {
            ContactEditorSheet(existing: nil) { _ in addedTick += 1 }
        }
        .sheet(item: $editing) { c in ContactEditorSheet(existing: c) }
        .contactMessageSheet($message) { sent in
            if sent.kind == .test { model.markTested(sent.contact) }
        }
        .confirmationDialog(removalTitle, isPresented: removalBinding, titleVisibility: .visible) {
            Button("Remove", role: .destructive) {
                if let c = pendingRemoval { withAnimation(.smooth) { model.removeContact(c) } }
                pendingRemoval = nil
            }
            Button("Keep", role: .cancel) { pendingRemoval = nil }
        } message: {
            Text("They won't be called or texted if an alert starts.")
        }
    }

    private var removalTitle: String { "Remove \(pendingRemoval?.firstName ?? "this person")?" }

    private var removalBinding: Binding<Bool> {
        Binding(get: { pendingRemoval != nil }, set: { if !$0 { pendingRemoval = nil } })
    }

    private func draft(_ c: TrustedContact, _ kind: ContactMessageDraft.Kind) -> ContactMessageDraft {
        ContactMessageDraft(contact: c, kind: kind,
                            body: kind == .intro ? ContactMessage.intro(to: c, from: model.profile, delivery: model.alertDelivery)
                                                 : ContactMessage.test(to: c, from: model.profile, delivery: model.alertDelivery))
    }

    private func pickFromContacts() {
        ContactPickerPresenter.shared.present(allowsMultiple: true) { picked in
            guard !picked.isEmpty else { return }
            let before = model.contacts.count
            withAnimation(.smooth) { notice = model.addPickedContacts(picked) }
            if model.contacts.count > before { addedTick += 1 }
        }
    }

    private func addButton(_ title: String, systemImage: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: SSSpacing.xs) {
                Image(systemName: systemImage).font(.title3).frame(height: 26)
                Text(title).font(SSFont.callout.weight(.semibold)).multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity, minHeight: 76)
            .foregroundStyle(SSColor.accent)
            .background(SSColor.accentSoft, in: RoundedRectangle(cornerRadius: SSRadius.card, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: SSRadius.card, style: .continuous)
                .strokeBorder(SSColor.accent.opacity(0.4), style: StrokeStyle(lineWidth: 1, dash: [5, 4])))
        }
        .buttonStyle(.plain)
    }
}

/// One contact: avatar initials, name, number, status and an actions menu.
struct ContactCard: View {
    let contact: TrustedContact
    var context: TrustedContactsEditor.Context = .tab
    var onIntro: () -> Void = {}
    var onTest: () -> Void = {}
    var onEdit: () -> Void = {}
    var onPrimary: () -> Void = {}
    var onRemove: () -> Void = {}

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: SSSpacing.sm) {
                row
                if context == .onboarding {
                    Divider().overlay(SSColor.line)
                    Button(action: onIntro) {
                        Label("Send \(contact.firstName) the intro text", systemImage: "text.bubble")
                            .font(SSFont.callout.weight(.semibold))
                            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                            .contentShape(Rectangle())
                            .foregroundStyle(SSColor.accent)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .accessibilityElement(children: .contain)
        .contextMenu {
            Button(action: onTest) { Label("Send a test message", systemImage: "checkmark.message") }
            Button(action: onEdit) { Label("Edit", systemImage: "pencil") }
            Button(role: .destructive, action: onRemove) { Label("Remove", systemImage: "trash") }
        }
    }

    private var row: some View {
        HStack(spacing: SSSpacing.sm) {
            Button(action: onEdit) {
                HStack(spacing: SSSpacing.sm) {
                    Initials(name: contact.name, highlighted: contact.isPrimary)
                    VStack(alignment: .leading, spacing: 3) {
                        HStack(spacing: SSSpacing.xs) {
                            Text(contact.name).font(SSFont.headline).lineLimit(1)
                            if contact.isPrimary { StatusPill(text: "First", tint: SSColor.accent).fixedSize().accessibilityLabel("Called first") }
                        }
                        Text(PhoneNumber.display(contact.phone))
                            .font(SSFont.mono(14)).foregroundStyle(SSColor.inkMuted)
                            .accessibilityLabel(PhoneNumber.spokenLabel(contact.phone))
                        if let detail {
                            Text(detail).font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
                        }
                    }
                    Spacer(minLength: 0)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .foregroundStyle(SSColor.ink)
            .accessibilityHint("Edit \(contact.firstName)")
            Menu {
                Button(action: onIntro) { Label("Send intro text", systemImage: "text.bubble") }
                Button(action: onTest) { Label("Send a test message", systemImage: "checkmark.message") }
                if !contact.isPrimary {
                    Button(action: onPrimary) { Label("Call first", systemImage: "star") }
                }
                Button(action: onEdit) { Label("Edit", systemImage: "pencil") }
                Button(role: .destructive, action: onRemove) { Label("Remove", systemImage: "trash") }
            } label: {
                Image(systemName: "ellipsis")
                    .font(.body.weight(.semibold))
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
                    .foregroundStyle(SSColor.inkMuted)
            }
            .accessibilityLabel("Actions for \(contact.name)")
        }
    }

    private var detail: String? {
        var parts: [String] = []
        if let r = contact.relationship { parts.append(r) }
        if let tested = contact.lastTestedAt {
            parts.append("Tested \(tested.formatted(.relative(presentation: .named)))")
        } else if context == .tab {
            parts.append("Not tested yet")
        }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }
}

struct Initials: View {
    let name: String
    var highlighted = false
    var size: CGFloat = 44

    var body: some View {
        let letters = name.split(separator: " ").prefix(2).compactMap(\.first).map(String.init).joined()
        Text(letters.isEmpty ? "?" : letters.uppercased())
            .font(.system(size: size * 0.38, weight: .semibold, design: .rounded))
            .foregroundStyle(highlighted ? SSColor.onFill : SSColor.ink)
            .frame(width: size, height: size)
            .background(highlighted ? SSColor.accent : SSColor.surfaceRaised, in: Circle())
            .accessibilityHidden(true)
    }
}

private struct CapacityDots: View {
    let count: Int
    var body: some View {
        HStack(spacing: 5) {
            ForEach(0..<TrustedContact.maxCount, id: \.self) { i in
                Capsule()
                    .fill(i < count ? SSColor.accent : SSColor.line)
                    .frame(width: i < count ? 18 : 8, height: 8)
            }
        }
        .animation(.spring(duration: 0.35, bounce: 0.3), value: count)
    }
}

private struct EmptyContactsCard: View {
    var body: some View {
        Card {
            HStack(alignment: .top, spacing: SSSpacing.sm) {
                Image(systemName: "person.2.wave.2")
                    .font(.title2).foregroundStyle(SSColor.accent)
                    .symbolEffect(.variableColor.iterative, options: .repeating)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Who should we call?").font(SSFont.headline)
                    Text("Add at least one person. If an alert starts, your first contact gets a call, and everyone gets a text with your live location.")
                        .font(SSFont.callout).foregroundStyle(SSColor.inkMuted)
                }
            }
        }
    }
}

#Preview("With contacts") {
    ScrollView { TrustedContactsEditor().padding() }
        .background(SSColor.background)
        .environment(AppModel.preview())
        .preferredColorScheme(.dark)
}

#Preview("Empty") {
    let model = AppModel.preview(screen: .onboarding)
    model.contacts = []
    return ScrollView { TrustedContactsEditor(context: .onboarding).padding() }
        .background(SSColor.background)
        .environment(model)
        .preferredColorScheme(.dark)
}
