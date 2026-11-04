import AppIntents

/// "Hey Siri, tell SafetySense I'm okay." Answers a check-in without opening the app.
/// It never cancels an alert: that always takes the Safety PIN in the app.
struct ImOkayIntent: AppIntent {
    static let title: LocalizedStringResource = "I'm Okay"
    static let description = IntentDescription("Answers a SafetySense check-in so it knows you're safe.")
    static var openAppWhenRun: Bool { false }
    static var authenticationPolicy: IntentAuthenticationPolicy { .requiresAuthentication }

    init() {}

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let handled = SharedCommandBridge.submit(SharedCommand(kind: .checkInOkay, source: .siri))
        return .result(dialog: handled ? "Thanks. SafetySense knows you're okay." : "Got it. SafetySense will update when it opens.")
    }
}
