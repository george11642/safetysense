import SwiftUI

@main
struct SafetySenseApp: App {
    @State private var model: AppModel
    @Environment(\.scenePhase) private var scenePhase

    init() {
        if !LaunchOptions.isUnitTestHost { StorageMigration.run() }
        let launch = LaunchOptions.current
        // One fixed, wiped-on-launch suite for QA screens so repeated launches don't leave a
        // preferences file behind each time.
        let store: SettingsStore = launch.usesEphemeralStore ? .ephemeral(name: "ss.ephemeral.qa") : SettingsStore()
        if launch.reset, !LaunchOptions.isUnitTestHost { store.eraseAll() }
        // QA screens pin sample data on the all-mock container. `-ssDemo 1` (or Developer Settings >
        // "Demo mode on next launch") runs the real rules engine and ladder on simulated sensors
        // with the mock backend. Everything else is live: real HTTP backend (dry-run unless
        // "Allow real calls" is on), encrypted vault, and real sensors on device.
        let services: ServiceContainer
        if launch.screen != nil || LaunchOptions.isUnitTestHost {
            // Unit tests host the app: never reach the network or real sensors from there.
            services = .demo()
        } else if launch.demo || DeveloperSettings.demoModeOnNextLaunch {
            services = .demoEngine()
        } else {
            services = .live()
        }
        let model = AppModel(services: services, store: store, launch: launch)
        if let screen = launch.screen {
            model.applySample(for: screen)
        } else if launch.skipOnboarding {
            if model.profile == nil { model.profile = SampleData.profile }
            if model.contacts.isEmpty { model.contacts = SampleData.contacts }
            #if DEBUG
            // QA only: a known safety PIN so a skipped-onboarding run can still cancel an alert.
            if !store.hasSafetyPIN { store.setSafetyPIN("2580") }
            #endif
            model.hasCompletedOnboarding = true
        }
        _model = State(initialValue: model)
        // Not `.task` on a view: an intent can launch the app in the background, with no scene.
        if !LaunchOptions.isUnitTestHost { Task { await model.onLaunch() } }
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
                .preferredColorScheme(.dark)
                .tint(SSColor.accent)
                .onOpenURL { url in if let link = DeepLink(url: url) { model.open(link) } }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { model.appBecameActive() }
        }
    }
}
