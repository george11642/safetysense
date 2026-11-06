import SwiftUI

/// Safety-PIN entry used to end a session or say "I'm safe now".
/// A duress PIN produces exactly the same visual result as the safety PIN; only the caller's
/// `onResult` sees the difference, and it must keep the UI identical.
struct PINEntrySheet: View {
    let title: String
    let message: String
    /// After three wrong tries. Says only what's true where this sheet is open, so there's no default.
    let forgotMessage: String
    var tint: Color = SSColor.accent
    /// Called with `.valid` or `.duress`. Invalid entries are handled here (shake + retry).
    let verify: (String) async -> PINVerification
    let onResult: (PINVerification) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var pin = ""
    @State private var attempts = 0
    @State private var wrong = 0
    @State private var isChecking = false

    var body: some View {
        ScrollView {
            VStack(spacing: SSSpacing.lg) {
                VStack(spacing: SSSpacing.xs) {
                    Text(title).font(SSFont.title).multilineTextAlignment(.center)
                    Text(attempts >= 3 ? forgotMessage
                         : attempts > 0 ? "That PIN didn't match. Take a breath and try again." : message)
                        .font(SSFont.callout)
                        .foregroundStyle(attempts > 0 ? SSColor.warn : SSColor.inkMuted)
                        .multilineTextAlignment(.center)
                        .contentTransition(.opacity)
                }
                .padding(.top, SSSpacing.lg)

                PINPad(pin: $pin, tint: tint) { entered in check(entered) }
                    .modifier(PINShake(shakes: CGFloat(wrong)))
                    .animation(.default, value: wrong)
                    .disabled(isChecking)

                PrimaryButton("Not now", role: .quiet) { dismiss() }
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, SSSpacing.gutter)
            .padding(.bottom, SSSpacing.xl)
        }
        // Center the pad in the sheet instead of leaving a large empty area below it.
        .defaultScrollAnchor(.center)
        .scrollBounceBehavior(.basedOnSize)
        .background(SSColor.background.ignoresSafeArea())
        .foregroundStyle(SSColor.ink)
        .sensoryFeedback(.error, trigger: wrong)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }

    private func check(_ entered: String) {
        isChecking = true
        Task {
            let result = await verify(entered)
            isChecking = false
            if result == .invalid {
                attempts += 1
                wrong += 1
            } else {
                onResult(result)
                dismiss()
            }
        }
    }
}

/// Horizontal shake for a wrong PIN.
struct PINShake: GeometryEffect {
    var shakes: CGFloat
    var animatableData: CGFloat {
        get { shakes }
        set { shakes = newValue }
    }

    func effectValue(size: CGSize) -> ProjectionTransform {
        ProjectionTransform(CGAffineTransform(translationX: 10 * sin(shakes * .pi * 4), y: 0))
    }
}

#Preview {
    PINEntrySheet(title: "End session", message: "Enter your safety PIN.", forgotMessage: "Still not matching.") { _ in .invalid } onResult: { _ in }
}
