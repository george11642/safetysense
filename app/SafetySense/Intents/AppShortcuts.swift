import AppIntents

// OWNER: System Integration module. Siri phrases, Spotlight and the Action Button list.
// "SafetySense Alert" is the shortcut to pick for the Action Button (Settings > Action Button >
// Shortcut > SafetySense). Every phrase must contain the app name (an App Intents rule).
struct SafetySenseShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: StartAlertIntent(source: .siri),
            phrases: [
                "\(.applicationName) alert",
                "Start \(.applicationName) alert",
                "Start a \(.applicationName) alert",
                "Get help with \(.applicationName)",
            ],
            shortTitle: "SafetySense Alert",
            systemImageName: "shield.lefthalf.filled"
        )
        AppShortcut(
            intent: StartGuardIntent(),
            phrases: [
                "Start \(.applicationName) guard",
                "Start \(.applicationName) Guard session",
                "Start \(\.$mode) with \(.applicationName)",
                "Guard my \(\.$mode) with \(.applicationName)",
            ],
            shortTitle: "Start Guard",
            systemImageName: "shield.checkered"
        )
        AppShortcut(
            intent: FakeCallIntent(),
            phrases: [
                "\(.applicationName) fake call",
                "Start a \(.applicationName) fake call",
                "Call me with \(.applicationName)",
            ],
            shortTitle: "Fake Call",
            systemImageName: "phone.arrow.down.left"
        )
        AppShortcut(
            intent: ImOkayIntent(),
            phrases: [
                "Tell \(.applicationName) I'm okay",
                "\(.applicationName) I'm okay",
                "I'm okay \(.applicationName)",
            ],
            shortTitle: "I'm Okay",
            systemImageName: "checkmark.shield"
        )
    }

    static let shortcutTileColor: ShortcutTileColor = .pink
}
