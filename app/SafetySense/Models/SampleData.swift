import Foundation

/// Sample data for previews, mocks, and `-ssScreen` QA launches. Fictional people only.
enum SampleData {
    static let profile = Profile(name: "Alex Rivera", phone: "+15055550100", campus: .unm,
                                 physicalDescription: "5'6\", dark curly hair, green jacket",
                                 medicalNotes: "Asthma (inhaler in bag)", allergies: "Penicillin")

    static let contacts: [TrustedContact] = [
        TrustedContact(name: "Maya Chen", phone: "+15055550111", relationship: "Roommate", isPrimary: true),
        TrustedContact(name: "Jordan Lee", phone: "+15055550122", relationship: "Friend"),
        TrustedContact(name: "Sam Rivera", phone: "+15055550133", relationship: "Sibling"),
    ]

    static let dateDetails = SealedDateDetails(matchName: "Chris", profileLink: "https://example.com/profile/chris",
                                               datingApp: "Hinge", venueName: "Coffee shop on Central",
                                               venueAddress: "Central Ave SE, Albuquerque", notes: "First date")

    static let rideDetails = RideDetails(service: .uber, driverName: "Pat", plate: "NM ABC-123",
                                         carDescription: "Silver Camry", destinationName: "Home")

    static func session(mode: GuardMode = .nightOut, startedMinutesAgo: Double = 38) -> GuardSession {
        GuardSession(serverSessionID: "demo-session", mode: mode,
                     startedAt: .now.addingTimeInterval(-startedMinutesAgo * 60),
                     sealedDate: mode == .date ? dateDetails : nil,
                     ride: mode == .ride ? rideDetails : nil)
    }

    static func alert(level: EscalationLevel = .alert, secondsAgo: Double = 20) -> AlertRecord {
        let start = Date.now.addingTimeInterval(-secondsAgo)
        return AlertRecord(serverAlertID: "demo-alert", shareURL: URL(string: "https://safetysense.example/a/demo"),
                           sessionID: "demo-session", level: level, trigger: .riskEngine,
                           reason: "Scream, then no movement", policy: .contactsFirst,
                           status: level == .dispatch ? .dispatched : .active,
                           startedAt: start, levelChangedAt: start,
                           notified: [
                               NotifiedContact(name: "Maya Chen", channel: .call, status: "ringing"),
                               NotifiedContact(name: "Jordan Lee", channel: .sms, status: "sent"),
                           ],
                           events: [
                               AlertEvent(who: "SafetySense", action: "notified", at: start),
                               AlertEvent(who: "Maya", action: "on_my_way", at: start.addingTimeInterval(12)),
                           ],
                           dispatch: level == .dispatch ? DispatchInfo(provider: .simulated, alarmID: "sim-1", status: "dispatcher calling you") : nil)
    }

    /// One alert's worth of consecutive 30 s clips, as the vault would record them.
    static let evidence: [EvidenceClip] = {
        let alertID = UUID()
        let start = Date.now.addingTimeInterval(-3 * 3600)
        let hashes = ["3f9a1c07e2b84d6a915c0e7f42d8b6a1c3e5f7092b4d6f8a1c3e5f7092b4d6e2",
                      "a71d4e9b03c62f85e1d07a9c4b36e2f8d15a7c09e3b64f2d8a1c5e7b9d03f6a4",
                      "c2e8f5a19d47b03e6f2a8c5d1e9b7f04a3c6e8d2b5f1a7c9e03d6b8f2a4c1e57"]
        return (0..<3).map { i in
            EvidenceClip(alertID: alertID, seq: i, startedAt: start.addingTimeInterval(Double(i * 30)),
                         duration: 30, sha256: hashes[i],
                         fileName: "clip-\(i).ssenc", byteCount: 480_000, uploaded: i < 2)
        }
    }()
}
