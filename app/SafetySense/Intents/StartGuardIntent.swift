import AppIntents

/// "Start SafetySense guard". Opens SafetySense, because a Guard session may need the
/// microphone and location prompts the first time, and the person should see it's on.
struct StartGuardIntent: AppIntent {
    static let title: LocalizedStringResource = "Start Guard"
    static let description = IntentDescription("Starts a SafetySense Guard session in the mode you choose.")
    static var openAppWhenRun: Bool { true }

    @Parameter(title: "Mode", default: .nightOut)
    var mode: GuardMode

    static var parameterSummary: some ParameterSummary {
        Summary("Start \(\.$mode) Guard")
    }

    init() {}

    init(mode: GuardMode) {
        self.mode = mode
    }

    @MainActor
    func perform() async throws -> some IntentResult {
        SharedCommandBridge.submit(SharedCommand(kind: .startGuard, source: .shortcut, mode: mode.rawValue))
        return .result()
    }
}
