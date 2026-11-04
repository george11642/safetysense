import SwiftUI

/// Maps `-ssScreen` names to views. Non-tab screens render standalone with sample data.
enum ScreenRouter {
    @MainActor @ViewBuilder
    static func view(for screen: AppScreen) -> some View {
        switch screen {
        case .onboarding: OnboardingFlowView()
        case .home, .contacts, .vault, .support, .settings: MainTabView()
        case .guardActive: GuardActiveView()
        case .checkIn: CheckInView()
        case .alertCountdown: AlertCountdownView()
        case .alertActive: AlertActiveView()
        case .dateSetup: NavigationStack { DateModeSetupView() }
        case .rideSetup: NavigationStack { RideModeSetupView() }
        case .walkSetup: NavigationStack { WalkHomeSetupView() }
        case .fakeCallSetup: NavigationStack { FakeCallSetupView() }
        case .fakeCallIncoming, .fakeCallActive: FakeCallScreen()
        }
    }
}
