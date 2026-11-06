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
        // Read first: the command moves a check-in back to guarding.
        let level = SystemBridge.escalation?.level
        let handled = SharedCommandBridge.submit(SharedCommand(kind: .checkInOkay, source: .siri))
        return .result(dialog: IntentDialog(stringLiteral: Self.reply(level: level, handled: handled)))
    }

    /// Only a check-in can be answered this way, so that's the only time it may sound settled.
    /// Thanking someone during an alert would tell them it stopped while it runs on to dispatch.
    static func reply(level: EscalationLevel?, handled: Bool) -> String {
        guard handled, let level else { return "Got it. SafetySense will update when it opens." }
        switch level {
        case .checkIn: return "Thanks. SafetySense knows you're okay."
        case .alert, .dispatch: return "That didn't cancel your alert. Open SafetySense and enter your PIN."
        case .guarding: return "There's no check-in to answer right now. If an alert is running, open SafetySense and enter your PIN."
        }
    }
}
