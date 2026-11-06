import SwiftUI

/// Onboarding vs. main tabs, plus the guard/alert overlay driven by escalation state.
struct RootView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        ZStack {
            SSColor.background.ignoresSafeArea()
            if let forced = model.forcedScreen {
                ScreenRouter.view(for: forced).topToastHost()
            } else if !model.hasCompletedOnboarding {
                OnboardingFlowView()
            } else {
                MainTabView()
                    .fullScreenCover(isPresented: overlayBinding) {
                        OverlayHost()
                    }
            }
        }
        // Fake call (SPEC 7.7) rings in its own window above every cover and sheet.
        .onChange(of: model.fakeCall.phase) { _, _ in
            guard model.forcedScreen == nil else { return }
            FakeCallPresenter.update(model: model)
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
            case .none: EmptyView()   // The cover is on its way out.
            case .guardActive: GuardActiveView()
            case .checkIn: CheckInView()
            case .alertCountdown: AlertCountdownView()
            case .alertActive: AlertActiveView()
            case .markedSafe: MarkedSafeView()
            }
        }
        .topToastHost()
        .animation(.smooth, value: model.overlay)
        .onChange(of: model.overlay) { _, overlay in Self.announce(overlay) }
    }

    /// VoiceOver users hear the change, and focus moves to the new screen. A cancel by either
    /// PIN reads the same, so this says nothing a Marked safe screen wouldn't.
    private static func announce(_ overlay: GuardOverlay) {
        let text: String? = switch overlay {
        case .none, .guardActive: nil
        case .checkIn: "Check-in. You okay?"
        case .alertCountdown: "Alert. Your people are being told."
        case .alertActive: "Help is on the way."
        case .markedSafe: "You're marked safe."
        }
        guard let text else { return }
        AccessibilityNotification.ScreenChanged(text).post()
    }
}

#Preview("Root") {
    RootView().environment(AppModel.preview())
}
