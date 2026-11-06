import Foundation

/// Every screen reachable with `-ssScreen <name>` for QA and screenshots.
enum AppScreen: String, CaseIterable, Sendable {
    case onboarding
    case home
    case guardActive = "guard"
    case checkIn = "checkin"
    case alertCountdown = "countdown"
    case alertActive = "alert"
    case markedSafe = "markedsafe"
    case contactPreview = "contactpreview"
    case support
    case vault
    case contacts
    case settings
    case dateSetup = "date"
    case rideSetup = "ride"
    case walkSetup = "walk"
    case fakeCallSetup = "fakecall"
    case fakeCallIncoming = "fakecallincoming"
    case fakeCallActive = "fakecallactive"

    /// Tab screens select a tab; the rest are shown full screen.
    var tab: MainTab? {
        switch self {
        case .home: .home
        case .contacts: .contacts
        case .vault: .vault
        case .support: .support
        case .settings: .settings
        default: nil
        }
    }

    init?(argument: String) {
        let lowered = argument.lowercased()
        let aliases: [String: AppScreen] = [
            "guardactive": .guardActive, "check-in": .checkIn, "alertcountdown": .alertCountdown,
            "alertactive": .alertActive, "datesetup": .dateSetup, "ridesetup": .rideSetup, "walksetup": .walkSetup,
            "fake-call": .fakeCallSetup, "fakecallsetup": .fakeCallSetup, "fakecallringing": .fakeCallIncoming,
            "fakecallincall": .fakeCallActive,
        ]
        if let s = AppScreen(rawValue: lowered) ?? aliases[lowered] { self = s } else { return nil }
    }
}

/// Whether this is a Release build. TestFlight has no developer row, launch arguments or QA PIN.
enum BuildFlags {
    #if DEBUG
    nonisolated static let isRelease = false
    #else
    nonisolated static let isRelease = true
    #endif
}

/// Launch arguments (Debug builds only):
/// - `-ssScreen <name>`: open straight to a screen with sample data (implies an isolated store).
/// - `-ssGuardMode walk|night_out|date|ride`: the sample Guard's mode for `guard`, `checkin`,
///   `countdown`, `alert` and `markedsafe`. `-ssPreDispatch` shows the pre-dispatch Marked safe.
/// - `-ssNoPIN`: alert screens show the no-PIN fallback.
/// - `-ssDemo 1`: use demo/mock services (no mic, no network, simulated dispatch).
/// - `-ssSkipOnboarding 1`: mark onboarding done, seeding sample profile/contacts if empty and
///   safety PIN 2580 if none is set (QA only).
/// - `-ssReset 1`: wipe persisted state on launch.
/// - `-ssCleanShots 1`: real alert wording with no test banner, for screenshots of the design.
/// - `-ssScenario nightOut`: start a Night Out guard and play `DemoScenarioPlayer` through the
///   same signal path the sensors use (works with live or demo services).
/// - `-ssScenarioSpeed 0.5`: scenario time scale (1 = real time).
struct LaunchOptions: Sendable, Equatable {
    var screen: AppScreen?
    var demo = false
    var skipOnboarding = false
    var reset = false
    var scenario: String?
    var scenarioSpeed: Double = 1

    init(screen: AppScreen? = nil, demo: Bool = false, skipOnboarding: Bool = false, reset: Bool = false) {
        self.screen = screen
        self.demo = demo
        self.skipOnboarding = skipOnboarding
        self.reset = reset
    }

    init(arguments: [String]) {
        self.init()
        func value(_ flag: String) -> String? {
            guard let i = arguments.firstIndex(of: flag), i + 1 < arguments.count else { return nil }
            return arguments[i + 1]
        }
        func bool(_ flag: String) -> Bool {
            guard let v = value(flag)?.lowercased() else { return false }
            return ["1", "yes", "true"].contains(v)
        }
        screen = value("-ssScreen").flatMap(AppScreen.init(argument:))
        demo = bool("-ssDemo")
        skipOnboarding = bool("-ssSkipOnboarding")
        reset = bool("-ssReset")
        scenario = value("-ssScenario")
        scenarioSpeed = value("-ssScenarioSpeed").flatMap(Double.init).map { min(max($0, 0.05), 4) } ?? 1
    }

    /// Launch arguments, which only Debug builds honor. A TestFlight build ignores all of them.
    static var qaArguments: [String] {
        BuildFlags.isRelease ? [] : ProcessInfo.processInfo.arguments
    }

    static var current: LaunchOptions { LaunchOptions(arguments: qaArguments) }

    /// True when the app is only hosting the unit-test bundle.
    static var isUnitTestHost: Bool { ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil }

    /// QA screens and unit tests never touch the real persisted store.
    var usesEphemeralStore: Bool { screen != nil || Self.isUnitTestHost }
}
