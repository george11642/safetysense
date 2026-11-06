import SwiftUI

/// "Sealed until an alert fires" (O2, O2r): who can read the sealed details, and what they say.
struct SealedDetailsSheet: View {
    let session: GuardSession
    let contactNames: [String]
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: SSSpacing.sm) {
            Text(content.eyebrow).ssEyebrow(SSColor.accent)
            Text("Sealed until an alert fires").font(SSFont.title)
            Text("During a normal \(content.noun), \(Self.names(contactNames)) can't read this. It's encrypted on SafetySense's server, which holds the key. If an alert fires, it appears on their live link:")
                .font(SSFont.callout).foregroundStyle(SSColor.inkMuted)
                .fixedSize(horizontal: false, vertical: true)
            VStack(alignment: .leading, spacing: 2) {
                Text(content.title).font(SSFont.headline)
                Text(content.detail).font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(SSSpacing.sm)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(SSColor.accentSoft, in: RoundedRectangle(cornerRadius: SSRadius.small, style: .continuous))
            PrimaryButton("Got it", systemImage: "checkmark") { dismiss() }
                .padding(.top, SSSpacing.xxs)
        }
        .padding(SSSpacing.gutter)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(SSColor.background.ignoresSafeArea())
        .foregroundStyle(SSColor.ink)
        .presentationDetents([.height(372), .large])
        .presentationDragIndicator(.visible)
    }

    private static func names(_ names: [String]) -> String {
        switch names.count {
        case 0: "your contacts"
        case 1: names[0]
        case 2: "\(names[0]) or \(names[1])"
        default: names.dropLast().joined(separator: ", ") + " or " + names[names.count - 1]
        }
    }

    private var content: (eyebrow: String, noun: String, title: String, detail: String) {
        if let ride = session.ride {
            return ("Ride details · sealed", "ride", GuardCopy.rideTitle(ride, includesService: true),
                    (ride.driverName.isEmpty ? "" : "Driver: \(ride.driverName). ") + "Sealed on the server until an alert fires.")
        }
        let date = session.sealedDate
        var detail: [String] = []
        if let venue = date?.venueName, !venue.isEmpty { detail.append("At \(venue).") }
        if date?.photoFileName != nil { detail.append("Their photo stays encrypted on this phone.") }
        if date?.photoFileName == nil { detail.append("Sealed on the server until an alert fires.") }
        return ("Date details · sealed", "date", date?.matchName ?? "", detail.joined(separator: " "))
    }
}

/// Guard screen copy that differs by mode. Plain functions so tests can pin them.
enum GuardCopy {
    /// `Silver Camry · BXR 482`, with the service in front on the sealed sheet.
    static func rideTitle(_ ride: RideDetails, includesService: Bool = false) -> String {
        var parts: [String] = includesService ? [ride.service.displayName] : []
        if let car = ride.carDescription, !car.isEmpty { parts.append(car) }
        parts.append(ride.plate)
        return parts.joined(separator: " · ")
    }

    static func rideDetail(_ ride: RideDetails) -> String {
        (ride.driverName.isEmpty ? "" : "Driver: \(ride.driverName). ") + "Your people see this only if an alert fires."
    }

    static func dateDetail(_ date: SealedDateDetails) -> String {
        let name = date.matchName.isEmpty ? "Their details" : "\(date.matchName)."
        let photo = date.photoFileName == nil ? "" : " Their photo stays encrypted on this phone."
        return "\(name)\(photo)\nOpened for your contacts only if an alert fires."
    }

    static func nextCheckInLabels(_ mode: GuardMode?) -> (title: String, remaining: String) {
        switch mode {
        case .walk, .ride: ("Arrival check", "In")
        case .date: ("Next check-in", "In")
        default: ("Next check-in", "Time left")
        }
    }

    static func quietLine(_ mode: GuardMode?) -> String {
        mode == .nightOut ? EscalationLevel.guarding.statusLine : "Guarding quietly. Nothing is being saved."
    }

    static func endTitle(_ mode: GuardMode?) -> String {
        switch mode {
        case .walk: "I made it · End Guard"
        case .ride: "I've arrived · End Guard"
        case .date: "End Date guard"
        default: "End Guard"
        }
    }
}

#Preview {
    Color.clear.sheet(isPresented: .constant(true)) {
        SealedDetailsSheet(session: SampleData.session(mode: .ride), contactNames: ["Maya", "Jordan", "Sam"])
    }
}
