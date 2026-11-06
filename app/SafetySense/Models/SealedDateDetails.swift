import Foundation

/// Date-mode details (SPEC 5). Encrypted at rest, sent to the server as `sealed_details`,
/// and shown to contacts only while an alert is active.
struct SealedDateDetails: Codable, Sendable, Equatable {
    var matchName: String
    var profileLink: String?
    var datingApp: String?
    /// Empty when the person didn't say where.
    var venueName: String
    var venueAddress: String?
    var notes: String?
    /// Local file name of the match's photo, if the user added one.
    var photoFileName: String?
    /// When the user expects the date to end; drives a scheduled check-in.
    var expectedEnd: Date?

    init(matchName: String = "", profileLink: String? = nil, datingApp: String? = nil,
         venueName: String = "", venueAddress: String? = nil, notes: String? = nil,
         photoFileName: String? = nil, expectedEnd: Date? = nil) {
        self.matchName = matchName
        self.profileLink = profileLink
        self.datingApp = datingApp
        self.venueName = venueName
        self.venueAddress = venueAddress
        self.notes = notes
        self.photoFileName = photoFileName
        self.expectedEnd = expectedEnd
    }

    /// Plain-text summary used as the `sealed_details` string for `session/start`.
    var sealedSummary: String {
        var lines = ["Date with: \(matchName)"]
        if let datingApp, !datingApp.isEmpty { lines.append("Met on: \(datingApp)") }
        if let profileLink, !profileLink.isEmpty { lines.append("Profile: \(profileLink)") }
        let place = [venueName, venueAddress ?? ""].filter { !$0.isEmpty }.joined(separator: ", ")
        if !place.isEmpty { lines.append("Place: \(place)") }
        if let expectedEnd { lines.append("Expected to end: \(expectedEnd.formatted(date: .omitted, time: .shortened))") }
        if let notes, !notes.isEmpty { lines.append("Notes: \(notes)") }
        return lines.joined(separator: "\n")
    }
}
