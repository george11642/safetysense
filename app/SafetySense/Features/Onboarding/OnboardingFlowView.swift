import SwiftUI

/// The 9-step onboarding (SPEC 8): welcome, promises, campus, contacts, triggers,
/// permissions, PINs, responder profile, practice drill. Every step except contacts can be skipped.
/// QA: `-ssScreen onboarding -ssOnboardingStep <name|0-8>` opens a specific step.
struct OnboardingFlowView: View {
    @Environment(AppModel.self) private var model
    @State private var step: OnboardingStep
    @State private var forward = true

    init(start: OnboardingStep? = nil) {
        _step = State(initialValue: start ?? OnboardingStep.fromLaunchArguments() ?? .welcome)
    }

    var body: some View {
        VStack(spacing: 0) {
            if step != .welcome {
                topBar
                    .padding(.horizontal, SSSpacing.gutter)
                    .padding(.top, SSSpacing.xs)
                    .padding(.bottom, SSSpacing.sm)
                    .transition(.opacity)
            }
            ZStack {
                stepView(step)
                    .id(step)
                    .transition(.asymmetric(
                        insertion: .move(edge: forward ? .trailing : .leading).combined(with: .opacity),
                        removal: .move(edge: forward ? .leading : .trailing).combined(with: .opacity)))
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .clipped()
        }
        .background(OnboardingBackdrop().ignoresSafeArea())
        .foregroundStyle(SSColor.ink)
        .sensoryFeedback(.impact(weight: .light), trigger: step)
    }

    private var topBar: some View {
        HStack(spacing: SSSpacing.sm) {
            Button {
                go(to: step.previous, forward: false)
            } label: {
                Image(systemName: "chevron.left")
                    .font(.body.weight(.semibold))
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .accessibilityLabel("Back")
            .foregroundStyle(SSColor.inkMuted)

            OnboardingProgressBar(step: step)

            Button("Skip") { skip() }
                .font(SSFont.callout.weight(.semibold))
                .foregroundStyle(SSColor.inkMuted)
                .frame(minWidth: 44, minHeight: 44)
                .opacity(step.isSkippable ? 1 : 0)
                .disabled(!step.isSkippable)
                .accessibilityHidden(!step.isSkippable)
                .accessibilityHint(step.skipTarget == nil ? "Finishes setup. You can do the rest later in Settings." : "Skips \(step.title).")
        }
    }

    @ViewBuilder
    private func stepView(_ step: OnboardingStep) -> some View {
        switch step {
        case .welcome: WelcomeStepView(next: advance)
        case .promises: PromisesStepView(next: advance)
        case .campus: CampusStepView(next: advance)
        case .contacts: ContactsStepView(next: advance)
        case .triggers: TriggersStepView(next: advance)
        case .permissions: PermissionsStepView(next: advance)
        case .pins: PINStepView(next: advance)
        case .responder: ResponderStepView(next: advance)
        case .drill: DrillStepView(finish: finish)
        }
    }

    private func advance() {
        if step == .drill { finish(); return }
        go(to: step.next, forward: true)
    }

    private func skip() {
        if let target = step.skipTarget { go(to: target, forward: true) } else { finish() }
    }

    private func go(to target: OnboardingStep?, forward: Bool) {
        guard let target else { return }
        // Contacts can't be skipped: going past it requires at least one person.
        if forward, step.rawValue < OnboardingStep.contacts.rawValue + 1,
           target.rawValue > OnboardingStep.contacts.rawValue, model.contacts.isEmpty {
            self.forward = true
            withAnimation(.smooth(duration: 0.45)) { step = .contacts }
            return
        }
        self.forward = forward
        withAnimation(.smooth(duration: 0.45)) { step = target }
    }

    private func finish() {
        if model.profile == nil { model.profile = Profile() }
        model.forcedScreen = nil
        withAnimation(.smooth) { model.completeOnboarding() }
    }
}

/// Soft night gradient with a faint pink glow that drifts.
private struct OnboardingBackdrop: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 15, paused: reduceMotion)) { context in
            let t = reduceMotion ? 0 : context.date.timeIntervalSinceReferenceDate
            ZStack {
                SSColor.background
                RadialGradient(colors: [SSColor.accent.opacity(0.12), .clear],
                               center: UnitPoint(x: 0.8 + 0.08 * sin(t / 5), y: 0.05 + 0.04 * cos(t / 7)),
                               startRadius: 0, endRadius: 420)
                RadialGradient(colors: [SSColor.calm.opacity(0.06), .clear],
                               center: UnitPoint(x: 0.1, y: 0.95), startRadius: 0, endRadius: 380)
            }
        }
    }
}

#Preview("Flow") {
    let model = AppModel.preview(screen: .onboarding)
    model.contacts = []
    return OnboardingFlowView().environment(model).preferredColorScheme(.dark)
}

#Preview("Contacts step") {
    OnboardingFlowView(start: .contacts).environment(AppModel.preview(screen: .onboarding)).preferredColorScheme(.dark)
}
