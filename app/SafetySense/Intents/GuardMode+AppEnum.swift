import AppIntents

/// Lets Siri and Shortcuts pick a Guard mode ("Start Night Out with SafetySense").
extension GuardMode: AppEnum {
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Guard mode"
    static let caseDisplayRepresentations: [GuardMode: DisplayRepresentation] = [
        .everyday: DisplayRepresentation(title: "Everyday", subtitle: "SOS ready, no listening",
                                         image: .init(systemName: "shield")),
        .walk: DisplayRepresentation(title: "Walk Home", subtitle: "Someone watches you get home",
                                     image: .init(systemName: "figure.walk")),
        .nightOut: DisplayRepresentation(title: "Night Out", subtitle: "Listens for trouble",
                                         image: .init(systemName: "moon.stars")),
        .date: DisplayRepresentation(title: "Date", subtitle: "Their details stay sealed",
                                     image: .init(systemName: "heart")),
        .ride: DisplayRepresentation(title: "Ride", subtitle: "Logs the car, watches the route",
                                     image: .init(systemName: "car")),
    ]
}
