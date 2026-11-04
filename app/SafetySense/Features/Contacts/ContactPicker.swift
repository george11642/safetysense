import Contacts
import ContactsUI
import SwiftUI
import UIKit

/// A person chosen from the system Contacts picker. The picker runs out of process, so
/// SafetySense never needs Contacts permission and only sees the people the user taps.
struct PickedContact: Sendable, Equatable {
    var name: String
    var phone: String
}

/// Presents `CNContactPickerViewController` from the key window. Presenting it inside a SwiftUI
/// `.sheet` makes it dismiss itself immediately, so it is presented with UIKit instead.
@MainActor
final class ContactPickerPresenter: NSObject, CNContactPickerDelegate {
    static let shared = ContactPickerPresenter()

    private var completion: (([PickedContact]) -> Void)?

    /// `allowsMultiple` lets the user tick several people at once (the onboarding step).
    func present(allowsMultiple: Bool, completion: @escaping ([PickedContact]) -> Void) {
        guard let presenter = Self.topViewController() else { completion([]); return }
        self.completion = completion
        let picker = CNContactPickerViewController()
        picker.delegate = self
        picker.displayedPropertyKeys = [CNContactPhoneNumbersKey]
        picker.predicateForEnablingContact = NSPredicate(format: "phoneNumbers.@count > 0")
        if !allowsMultiple {
            // Single person: if they have several numbers, let them pick which one.
            picker.predicateForSelectionOfContact = NSPredicate(format: "phoneNumbers.@count == 1")
        }
        presenter.present(picker, animated: true)
    }

    // MARK: CNContactPickerDelegate

    nonisolated func contactPickerDidCancel(_ picker: CNContactPickerViewController) {
        MainActor.assumeIsolated { finish([]) }
    }

    nonisolated func contactPicker(_ picker: CNContactPickerViewController, didSelect contact: CNContact) {
        let picked = Self.pick(from: contact, number: nil)
        MainActor.assumeIsolated { finish(picked.map { [$0] } ?? []) }
    }

    nonisolated func contactPicker(_ picker: CNContactPickerViewController, didSelect contacts: [CNContact]) {
        let picked = contacts.compactMap { Self.pick(from: $0, number: nil) }
        MainActor.assumeIsolated { finish(picked) }
    }

    nonisolated func contactPicker(_ picker: CNContactPickerViewController, didSelect contactProperty: CNContactProperty) {
        let number = (contactProperty.value as? CNPhoneNumber)?.stringValue
        let picked = Self.pick(from: contactProperty.contact, number: number)
        MainActor.assumeIsolated { finish(picked.map { [$0] } ?? []) }
    }

    private func finish(_ contacts: [PickedContact]) {
        let done = completion
        completion = nil
        done?(contacts)
    }

    /// Prefers the mobile / iPhone number when the person has several.
    nonisolated private static func pick(from contact: CNContact, number: String?) -> PickedContact? {
        let name = CNContactFormatter.string(from: contact, style: .fullName)
            ?? [contact.givenName, contact.familyName].filter { !$0.isEmpty }.joined(separator: " ")
        let preferred: [String] = [CNLabelPhoneNumberMobile, CNLabelPhoneNumberiPhone, CNLabelPhoneNumberMain]
        let numbers = contact.phoneNumbers
        let chosen = number
            ?? preferred.lazy.compactMap { label in numbers.first { $0.label == label }?.value.stringValue }.first
            ?? numbers.first?.value.stringValue
        guard let chosen else { return nil }
        return PickedContact(name: name.isEmpty ? "Contact" : name, phone: chosen)
    }

    private static func topViewController() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let window = scenes.flatMap(\.windows).first { $0.isKeyWindow } ?? scenes.first?.windows.first
        var top = window?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        return top
    }
}
