import Foundation

/// Contact editing rules shared by onboarding and the Contacts tab (1–5 people, one primary,
/// US numbers only, no duplicates). Kept as an `AppModel` extension so both screens agree.
@MainActor
extension AppModel {
    enum ContactChangeError: Error, Equatable {
        case full, invalidPhone, duplicate, missingName

        var message: String {
            switch self {
            case .full: "You can add up to \(TrustedContact.maxCount) people."
            case .invalidPhone: "That doesn't look like a US phone number. SafetySense can only call US numbers for now."
            case .duplicate: "That number is already on your list."
            case .missingName: "Add a name so you know who this is."
            }
        }
    }

    var canAddContact: Bool { contacts.count < TrustedContact.maxCount }

    /// Adds a contact. The first person added becomes primary.
    @discardableResult
    func addContact(name: String, phone: String, relationship: String? = nil) -> Result<TrustedContact, ContactChangeError> {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else { return .failure(.missingName) }
        guard canAddContact else { return .failure(.full) }
        guard let e164 = PhoneNumber.normalizedUS(phone) else { return .failure(.invalidPhone) }
        guard !contacts.contains(where: { $0.phone == e164 }) else { return .failure(.duplicate) }
        let rel = relationship?.trimmingCharacters(in: .whitespacesAndNewlines)
        let contact = TrustedContact(name: trimmedName, phone: e164,
                                     relationship: rel?.isEmpty == false ? rel : nil,
                                     isPrimary: contacts.isEmpty)
        contacts.append(contact)
        contactsDidChange()
        return .success(contact)
    }

    /// Adds people from the system picker, skipping duplicates and non-US numbers.
    /// Returns a short, calm summary of anything that was skipped (nil when all were added).
    func addPickedContacts(_ picked: [PickedContact]) -> String? {
        var skipped: [String] = []
        for p in picked {
            if case .failure(let error) = addContact(name: p.name, phone: p.phone) {
                skipped.append(error == .full ? "\(p.name) (list is full)"
                               : error == .duplicate ? "\(p.name) (already added)" : "\(p.name) (not a US number)")
            }
        }
        return skipped.isEmpty ? nil : "Not added: " + skipped.joined(separator: ", ") + "."
    }

    func updateContact(_ updated: TrustedContact) -> ContactChangeError? {
        guard let index = contacts.firstIndex(where: { $0.id == updated.id }) else { return nil }
        let trimmedName = updated.name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else { return .missingName }
        guard let e164 = PhoneNumber.normalizedUS(updated.phone) else { return .invalidPhone }
        guard !contacts.contains(where: { $0.phone == e164 && $0.id != updated.id }) else { return .duplicate }
        var c = updated
        c.name = trimmedName
        c.phone = e164
        if let rel = c.relationship?.trimmingCharacters(in: .whitespacesAndNewlines) { c.relationship = rel.isEmpty ? nil : rel }
        contacts[index] = c
        contactsDidChange()
        return nil
    }

    func removeContact(_ contact: TrustedContact) {
        contacts.removeAll { $0.id == contact.id }
        if !contacts.isEmpty, !contacts.contains(where: \.isPrimary) { contacts[0].isPrimary = true }
        contactsDidChange()
    }

    func makePrimary(_ contact: TrustedContact) {
        contacts = contacts.map { var c = $0; c.isPrimary = (c.id == contact.id); return c }
        // Primary goes first: they're called first.
        contacts.sort { $0.isPrimary && !$1.isPrimary }
        contactsDidChange()
    }

    func markTested(_ contact: TrustedContact) {
        guard let index = contacts.firstIndex(where: { $0.id == contact.id }) else { return }
        contacts[index].lastTestedAt = .now
    }

    /// Pushes the list to the server once the device is registered (after onboarding).
    private func contactsDidChange() {
        guard hasCompletedOnboarding else { return }
        Task { await syncRegistration() }
    }
}
