import SwiftUI

/// Manual add / edit for one trusted contact.
struct ContactEditorSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    /// nil = adding a new person.
    let existing: TrustedContact?
    var onSaved: (TrustedContact) -> Void = { _ in }

    @State private var name = ""
    @State private var phone = ""
    @State private var relationship = ""
    @State private var error: String?
    @State private var saveTick = 0
    @FocusState private var focus: Field?

    private enum Field { case name, phone, relationship }

    private let relationshipSuggestions = ["Roommate", "Friend", "Partner", "Parent", "Sibling", "RA"]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: SSSpacing.lg) {
                    Text(existing == nil
                         ? "Pick someone who'll pick up at 2 a.m. They don't need the app."
                         : "Changes are sent to SafetySense's server so alerts reach the right number.")
                        .font(SSFont.callout).foregroundStyle(SSColor.inkMuted)

                    field("Name") {
                        TextField("Maya Chen", text: $name)
                            .textContentType(.name)
                            .textInputAutocapitalization(.words)
                            .submitLabel(.next)
                            .focused($focus, equals: .name)
                            .onSubmit { focus = .phone }
                    }

                    field("Mobile number") {
                        TextField("(505) 555-0123", text: $phone)
                            .keyboardType(.phonePad)
                            .textContentType(.telephoneNumber)
                            .focused($focus, equals: .phone)
                            .onChange(of: phone) { _, new in
                                let formatted = PhoneNumber.formatAsTyped(new)
                                if formatted != new { phone = formatted }
                            }
                    }

                    VStack(alignment: .leading, spacing: SSSpacing.xs) {
                        field("Relationship (optional)") {
                            TextField("Roommate", text: $relationship)
                                .textInputAutocapitalization(.words)
                                .focused($focus, equals: .relationship)
                        }
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: SSSpacing.xs) {
                                ForEach(relationshipSuggestions, id: \.self) { s in
                                    Chip(title: s, isSelected: relationship == s) { relationship = s }
                                }
                            }
                        }
                    }

                    if let error {
                        Label(error, systemImage: "exclamationmark.circle")
                            .font(SSFont.callout).foregroundStyle(SSColor.warn)
                            .transition(.opacity.combined(with: .move(edge: .top)))
                    }

                    PrimaryButton(existing == nil ? "Add contact" : "Save changes", systemImage: "checkmark") { save() }
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || phone.isEmpty)
                        .opacity(name.trimmingCharacters(in: .whitespaces).isEmpty || phone.isEmpty ? 0.5 : 1)
                }
                .padding(.vertical, SSSpacing.md)
                .animation(.smooth, value: error)
            }
            .scrollDismissesKeyboard(.interactively)
            .ssScreen()
            .navigationTitle(existing == nil ? "Add someone" : "Edit contact")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            }
            .sensoryFeedback(.error, trigger: error) { _, new in new != nil }
            .sensoryFeedback(.success, trigger: saveTick)
        }
        .onAppear {
            if let existing {
                name = existing.name
                phone = PhoneNumber.display(existing.phone)
                relationship = existing.relationship ?? ""
            } else {
                focus = .name
            }
        }
    }

    private func field<Content: View>(_ label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: SSSpacing.xs) {
            Text(label).ssEyebrow()
            content()
                .font(SSFont.body)
                .padding(.horizontal, SSSpacing.md)
                .frame(minHeight: 52)
                .background(SSColor.surface, in: RoundedRectangle(cornerRadius: SSRadius.small, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: SSRadius.small, style: .continuous).stroke(SSColor.line))
                .accessibilityLabel(label)
        }
    }

    private func save() {
        if var c = existing {
            c.name = name
            c.phone = phone
            c.relationship = relationship
            if let e = model.updateContact(c) { error = e.message; return }
            saveTick += 1
            onSaved(c)
            dismiss()
        } else {
            switch model.addContact(name: name, phone: phone, relationship: relationship) {
            case .success(let c):
                saveTick += 1
                onSaved(c)
                dismiss()
            case .failure(let e):
                error = e.message
            }
        }
    }
}

#Preview("Add") {
    ContactEditorSheet(existing: nil).environment(AppModel.preview()).preferredColorScheme(.dark)
}

#Preview("Edit") {
    ContactEditorSheet(existing: SampleData.contacts[0]).environment(AppModel.preview()).preferredColorScheme(.dark)
}
