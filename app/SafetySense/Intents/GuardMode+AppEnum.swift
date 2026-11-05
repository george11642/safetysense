import AppIntents

/// Lets Siri and Shortcuts pick a Guard mode ("Start Night Out with SafetySense"). These are the
/// modes Home offers: Everyday is the passive default, not a session you start.
enum GuardModeOption: String, AppEnum {
    case walk, nightOut, date, ride

    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Guard mode"
    static let caseDisplayRepresentations: [GuardModeOption: DisplayRepresentation] = [
        .walk: DisplayRepresentation(title: "Walk Home", subtitle: "Someone watches you get home",
                                     image: .init(systemName: "figure.walk")),
        .nightOut: DisplayRepresentation(title: "Night Out", subtitle: "Listens for trouble",
                                         image: .init(systemName: "moon.stars")),
        .date: DisplayRepresentation(title: "Date", subtitle: "Their details stay sealed",
                                     image: .init(systemName: "heart")),
        .ride: DisplayRepresentation(title: "Ride", subtitle: "Logs the car, watches the route",
                                     image: .init(systemName: "car")),
    ]

    var mode: GuardMode {
        switch self {
        case .walk: .walk
        case .nightOut: .nightOut
        case .date: .date
        case .ride: .ride
        }
    }
}
