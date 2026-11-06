import Foundation

/// Whether an alert from this build really reaches anyone. Every surface that could otherwise
/// promise help reads its words from here, so a tester in real danger is never told help is
/// coming when nothing was sent. TestFlight is always `.test`: real calls need a Debug build.
enum AlertDelivery: Sendable, Equatable {
    /// Calls, texts and dispatch really go out.
    case real
    /// The live server records everything, marked `dry_run`. Nobody is contacted.
    case test
    /// Mock services. Nothing leaves the phone.
    case demo

    static func resolve(flavor: ServiceContainer.Flavor, allowRealCalls: Bool, cleanScreenshots: Bool = false) -> AlertDelivery {
        if cleanScreenshots { return .real }
        if flavor == .demo { return .demo }
        return allowRealCalls ? .real : .test
    }

    /// `-ssCleanShots 1` keeps the real wording for screenshots (Debug only, never in a Release build).
    nonisolated static func current(flavor: ServiceContainer.Flavor) -> AlertDelivery {
        resolve(flavor: flavor, allowRealCalls: BackendRuntimeOptions.current().allowRealCalls,
                cleanScreenshots: LaunchOptions.qaArguments.contains("-ssCleanShots"))
    }

    var isReal: Bool { self == .real }

    private var word: String { self == .demo ? "Demo" : "Test" }

    /// The banner on Home, Guard, the countdown and Alert active. Nil when alerts are real.
    var bannerText: String? {
        switch self {
        case .real: nil
        case .test: "Test build: nobody is contacted. In danger? Call 911."
        case .demo: "Demo: nothing is sent. In danger? Call 911."
        }
    }

    /// The short version on the Live Activity.
    var liveActivityNote: String? {
        switch self {
        case .real: nil
        case .test: "Test build. Nobody is contacted."
        case .demo: "Demo. Nothing is sent."
        }
    }

    // MARK: Alert countdown

    var countdownPill: String { isReal ? "Alert" : "\(word) alert" }
    var countdownHeadline: String { isReal ? "Your people are being told" : "\(word) alert: nobody is being told" }
    var ringCaption: String { isReal ? "to dispatch" : "\(word.lowercased()) timer" }
    var ringAccessibilityLabel: String {
        isReal ? "Time until professional help is sent" : "\(word) timer. No help will be sent."
    }

    func reaching(_ names: String) -> String {
        isReal ? "Calling and texting \(names)…" : "\(word) only: \(names) won't be called or texted."
    }

    var sendHelpTitle: String { isReal ? "Send help now" : "\(word) dispatch" }
    var sendHelpConfirmTitle: String { isReal ? "Send professional help now?" : "Run a \(word.lowercased()) dispatch?" }
    var sendHelpConfirmMessage: String {
        isReal ? "The monitoring center will call you, then send police to your location."
               : "This build can't send anyone. If you need help, call 911."
    }
    var forgotPINHint: String {
        isReal ? "Forgot it? Tell the monitoring center you're okay when they call."
               : "Forgot it? Tap Call 911 if you need help. Nobody will call you in this build."
    }

    // MARK: Alert active

    var dispatchPill: String { isReal ? "Dispatch active" : "\(word) dispatch" }
    var dispatchHeadline: String { isReal ? "Help is on the way" : "This is a \(word.lowercased()). No help is being sent" }
    var dispatchDetail: String {
        isReal ? "You're not alone. Stay where you are if it's safe, or move somewhere public."
               : "Nobody has been contacted. If you need help, call 911."
    }
    /// Nil when nobody can call, since waiting for that call would be the wrong thing to do.
    var dispatchCallNote: String? {
        isReal ? "Answer if they call. They'll confirm you're okay before sending police." : nil
    }
    func stillReaching(_ names: String) -> String { isReal ? "Reaching \(names)…" : reaching(names) }
    var reconnecting: String {
        isReal ? "Reconnecting… your contacts are still being reached." : "Reconnecting…"
    }
    var mapLabel: String { isReal ? "Shared live with your contacts" : "\(word) only: not sent to your contacts" }
    var pinPrompt: String {
        isReal ? "Enter your safety PIN. The monitoring center may still call to confirm you're okay."
               : "Enter your safety PIN to end this \(word.lowercased())."
    }

    /// A simulated dispatch, which is what a `dry_run` alert gets back from the server.
    var simulatedDispatchNote: String {
        self == .test ? "Test only: no real responders are contacted." : "Demo mode: no real responders are contacted."
    }

    /// Who was reached. A build that contacts nobody shows nobody as reached, whatever the record says.
    func shown(_ notified: [NotifiedContact]) -> [NotifiedContact] {
        guard self == .demo else { return notified }
        return notified.map { var contact = $0; contact.status = "dry_run"; return contact }
    }

    func shown(_ events: [AlertEvent]) -> [AlertEvent] { self == .demo ? [] : events }

    // MARK: VoiceOver and the Live Activity

    func spokenAlert(_ level: EscalationLevel) -> String? {
        switch level {
        case .alert: isReal ? "Alert. Your people are being told." : "\(word) alert. Nobody is being told."
        case .dispatch: isReal ? "Help is on the way." : "\(word) dispatch. No help is being sent. If you need help, call 911."
        case .guarding, .checkIn: nil
        }
    }

    /// The Live Activity's status line and lock-screen alert at each level.
    func statusLine(_ level: EscalationLevel) -> String {
        guard !isReal else { return level.statusLine }
        switch level {
        case .guarding, .checkIn: return level.statusLine
        case .alert: return "\(word) alert. Nobody is being told."
        case .dispatch: return "\(word) only. No help is being sent."
        }
    }

    func alertTitle(_ level: EscalationLevel) -> String {
        switch level {
        case .guarding: "Guarding"
        case .checkIn: "You okay?"
        case .alert: isReal ? "Telling your people" : "\(word) alert"
        case .dispatch: isReal ? "Help is on the way" : "\(word) dispatch"
        }
    }

    func alertBody(_ level: EscalationLevel) -> String {
        switch level {
        case .alert where isReal: "Open SafetySense to cancel with your PIN."
        case .alert: "Nobody was contacted. If you need help, call 911."
        case .dispatch where isReal: "Stay somewhere safe if you can. Call 911 if you're able."
        case .dispatch: "No help is being sent. If you need help, call 911."
        default: ""
        }
    }
}
