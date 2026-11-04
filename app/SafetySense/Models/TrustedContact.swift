import Foundation

/// Someone who gets a call/text with a live link when an alert fires. 1–5 per user.
struct TrustedContact: Codable, Sendable, Equatable, Identifiable, Hashable {
    var id: UUID
    var name: String
    /// E.164, e.g. "+15055550123".
    var phone: String
    var relationship: String?
    var isPrimary: Bool
    var lastTestedAt: Date?

    init(id: UUID = UUID(), name: String, phone: String, relationship: String? = nil,
         isPrimary: Bool = false, lastTestedAt: Date? = nil) {
        self.id = id
        self.name = name
        self.phone = phone
        self.relationship = relationship
        self.isPrimary = isPrimary
        self.lastTestedAt = lastTestedAt
    }

    var firstName: String { name.split(separator: " ").first.map(String.init) ?? name }

    static let maxCount = 5
}
