import AppIntents

/// "SafetySense fake call" (Siri, Shortcuts, Action Button, Back Tap). Opens SafetySense so the
/// full-screen call can ring; with a delay you have time to lock the phone and put it away.
/// It never contacts anyone.
struct FakeCallIntent: AppIntent {
    static let title: LocalizedStringResource = "Fake Call"
    static let description = IntentDescription("Rings your phone with a believable incoming call so you can leave a situation without explaining.")
    static var openAppWhenRun: Bool { true }

    @Parameter(title: "Caller", default: "Mom")
    var callerName: String

    @Parameter(title: "Rings", default: .tenSeconds)
    var delay: FakeCallDelayOption

    static var parameterSummary: some ParameterSummary {
        Summary("Fake call from \(\.$callerName) \(\.$delay)")
    }

    init() {}

    init(callerName: String, delay: FakeCallDelayOption) {
        self.callerName = callerName
        self.delay = delay
    }

    @MainActor
    func perform() async throws -> some IntentResult {
        SharedCommandBridge.submit(SharedCommand(kind: .fakeCall, source: .shortcut,
                                                 callerName: callerName, delaySeconds: delay.seconds))
        return .result()
    }
}

/// The setup screen's delay presets, for Shortcuts.
enum FakeCallDelayOption: String, AppEnum {
    case now, tenSeconds, thirtySeconds, oneMinute

    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Ring delay"
    static let caseDisplayRepresentations: [FakeCallDelayOption: DisplayRepresentation] = [
        .now: "right away",
        .tenSeconds: "in 10 seconds",
        .thirtySeconds: "in 30 seconds",
        .oneMinute: "in 1 minute",
    ]

    var seconds: Double {
        switch self {
        case .now: FakeCallDelay.now.seconds
        case .tenSeconds: FakeCallDelay.tenSeconds.seconds
        case .thirtySeconds: FakeCallDelay.thirtySeconds.seconds
        case .oneMinute: FakeCallDelay.oneMinute.seconds
        }
    }
}
