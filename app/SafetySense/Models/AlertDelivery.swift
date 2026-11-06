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

    // MARK: Before an alert

    private var noAnswerResult: String { "a \(word.lowercased()) alert starts. Nobody is contacted." }

    /// Under the check-in. `names` are who'd be alerted.
    func noAnswerNote(_ names: String) -> String {
        isReal ? "If you don't answer, \(names) will be alerted with your live location."
               : "If you don't answer, \(noAnswerResult)"
    }

    var checkInNotificationBody: String {
        isReal ? "Are you okay? If we don't hear from you, SafetySense will let your people know."
               : "Are you okay? This is a \(word.lowercased()) build, so nobody is contacted. If you need help, call 911."
    }

    var closingTheAppNote: String {
        let note = "Leave SafetySense running. Closing it from the app switcher stops check-ins"
        return isReal ? "\(note), and your contacts are alerted a few minutes later."
                      : "\(note). Nobody is contacted in this \(word.lowercased()) build."
    }

    var dateEndCheckNote: String {
        let note = "One more check at that time, on top of your regular check-ins."
        return isReal ? "\(note) No answer in 45 seconds alerts your contacts."
                      : "\(note) With no answer in 45 seconds, \(noAnswerResult)"
    }

    var dateSetupSubtitle: String {
        isReal ? "Enjoy your date. If something goes wrong, your people will know who you were with and where."
               : "Enjoy your date. Nobody is contacted in this \(word.lowercased()) build. If you need help, call 911."
    }

    var dateAlertPoint: String {
        isReal ? "If an alert fires, your contacts see them on your live link while the alert is active."
               : "If a \(word.lowercased()) alert fires, your contacts aren't sent the live link."
    }

    func walkFooter(_ names: String, count: Int) -> String {
        isReal ? "If you don't arrive, \(names) \(count == 1 ? "is" : "are") alerted."
               : "If you don't arrive, \(noAnswerResult)"
    }

    func rideFooter(arrival: String, names: String, count: Int) -> String {
        isReal ? "Arrival check at \(arrival). \(names) \(count == 1 ? "gets" : "get") the plate only if an alert fires."
               : "Arrival check at \(arrival). In this \(word.lowercased()) build, nobody is sent the plate."
    }

    /// Onboarding's third promise.
    var helpPromiseBody: String {
        let start = "If you don't answer a check-in, say your safe word, or your phone goes dark,"
        return isReal ? "\(start) SafetySense calls your people, then professional dispatch."
                      : "\(start) SafetySense starts a \(word.lowercased()) alert. This build contacts nobody, so if you need help, call 911."
    }

    // MARK: The duress PIN

    var twoPINsSubtitle: String {
        let start = "Your safety PIN cancels an alert. Your duress PIN looks exactly like cancelling"
        return isReal ? "\(start), but quietly sends help anyway, in case someone makes you cancel."
                      : "\(start), in case someone makes you cancel. This \(word.lowercased()) build contacts nobody, so if you need help, call 911."
    }

    var duressResultLabel: String { isReal ? "Help still on the way" : "Nobody is contacted" }

    var duressAnimationLabel: String {
        let start = "Animation. Entering your safety PIN cancels an alert. Entering your duress PIN looks exactly the same on screen"
        return isReal ? "\(start), but help is still sent quietly." : "\(start). In this \(word.lowercased()) build, nobody is contacted."
    }

    var duressReadinessDetail: String {
        isReal ? "Looks like a cancel, quietly sends help" : "Looks like a cancel. Nobody is contacted"
    }

    var duressSetDetail: String {
        isReal ? "Set · looks like a cancel, help still comes" : "Set · looks like a cancel, nobody is contacted"
    }

    // MARK: Settings footers

    var checkInSettingsFooter: String {
        let window = isReal ? "You have 45 seconds to answer before your contacts are told."
                            : "You have 45 seconds to answer before a \(word.lowercased()) alert starts. Nobody is contacted."
        return "How often SafetySense asks \u{201C}You okay?\u{201D} during a session. \(window) Walk Home and Ride check once, at the time you should have arrived, and whenever you stop somewhere unexpected."
    }

    var policySummaryFooter: String {
        isReal ? "By default, your contacts hear first and a manual SOS goes straight to dispatch. Change it for each mode."
               : "Set who hears first in each mode. This \(word.lowercased()) build contacts nobody and sends no dispatch, so if you need help, call 911."
    }

    var policyDetailFooter: String {
        isReal ? "Contacts first: your people hear first, and dispatch is asked to help if you don't cancel within 90 seconds or a contact taps \u{201C}Send help.\u{201D} Dispatch right away: both at once. Dispatch calls you before sending anyone."
               : "This is how a real build would work. Contacts first: your people, then dispatch after 90 seconds. Dispatch right away: both at once. This \(word.lowercased()) build contacts nobody, so if you need help, call 911."
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
