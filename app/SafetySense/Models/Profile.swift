import Foundation

enum Campus: String, Codable, Sendable, CaseIterable, Identifiable {
    case unm, cnm, other
    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .unm: "UNM"
        case .cnm: "CNM"
        case .other: "Other"
        }
    }
}

/// The user. `name`, `phone`, `campus` go to the backend at `register`; the responder fields
/// stay on device until an alert shares them with dispatch.
struct Profile: Codable, Sendable, Equatable {
    var name: String
    var phone: String
    var campus: Campus
    /// Optional responder profile (SPEC 8.8). Shared with dispatch only during an alert.
    var physicalDescription: String?
    var medicalNotes: String?
    var allergies: String?
    var photoFileName: String?

    init(name: String = "", phone: String = "", campus: Campus = .unm,
         physicalDescription: String? = nil, medicalNotes: String? = nil,
         allergies: String? = nil, photoFileName: String? = nil) {
        self.name = name
        self.phone = phone
        self.campus = campus
        self.physicalDescription = physicalDescription
        self.medicalNotes = medicalNotes
        self.allergies = allergies
        self.photoFileName = photoFileName
    }

    var firstName: String {
        name.split(separator: " ").first.map(String.init) ?? name
    }
}
