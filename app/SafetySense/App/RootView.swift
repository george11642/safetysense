import SwiftUI

/// Onboarding vs. main tabs, plus the guard/alert overlay driven by escalation state.
struct RootView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        ZStack {
            SSColor.background.ignoresSafeArea()
            if let forced = model.forcedScreen {
                ScreenRouter.view(for: forced)
            } else if !model.hasCompletedOnboarding {
                OnboardingFlowView()
            } else {
                MainTabView()
                    .fullScreenCover(isPresented: overlayBinding) {
                        OverlayHost()
                    }
            }
        }
    }

    private var overlayBinding: Binding<Bool> {
        Binding(get: { model.overlay != .none }, set: { _ in })
    }
}

/// Switches between guard/check-in/alert screens without dismissing the cover.
struct OverlayHost: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        ZStack {
            SSColor.background.ignoresSafeArea()
            switch model.overlay {
            case .none, .guardActive: GuardActiveView()
            case .checkIn: CheckInView()
            case .alertCountdown: AlertCountdownView()
            case .alertActive: AlertActiveView()
            }
        }
        .animation(.smooth, value: model.overlay)
    }
}

#Preview("Root") {
    RootView().environment(AppModel.preview())
}
