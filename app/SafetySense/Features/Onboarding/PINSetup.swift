import SwiftUI

/// Enter a new 4-digit PIN twice. `validate` returns a calm error message to reject one
/// (for example a duress PIN that matches the safety PIN). Used by onboarding and Settings.
struct PINCreator: View {
    let title: String
    let subtitle: String
    var tint: Color = SSColor.accent
    var validate: (String) -> String? = { _ in nil }
    var onCreated: (String) -> Void

    @State private var entry = ""
    @State private var first: String?
    @State private var error: String?
    @State private var shake = 0

    var body: some View {
        VStack(spacing: SSSpacing.lg) {
            VStack(spacing: SSSpacing.xs) {
                Text(first == nil ? title : "Enter it again").font(SSFont.title)
                    .contentTransition(.opacity)
                Text(error ?? (first == nil ? subtitle : "Just to be sure."))
                    .font(SSFont.callout)
                    .foregroundStyle(error == nil ? SSColor.inkMuted : SSColor.warn)
                    .multilineTextAlignment(.center)
                    .frame(minHeight: 44, alignment: .top)
            }
            .frame(maxWidth: .infinity)
            .animation(.smooth, value: first)
            PINPad(pin: $entry, tint: tint) { pin in handle(pin) }
                .modifier(ShakeEffect(shakes: CGFloat(shake)))
                .animation(.default, value: shake)
        }
        .sensoryFeedback(.error, trigger: shake)
        .sensoryFeedback(.impact(weight: .light), trigger: entry.count)
    }

    private func handle(_ pin: String) {
        if let first {
            if pin == first {
                error = nil
                onCreated(pin)
            } else {
                self.first = nil
                fail("Those didn't match. Let's start again.")
            }
            return
        }
        if let message = validate(pin) {
            fail(message)
        } else {
            error = nil
            first = pin
        }
    }

    private func fail(_ message: String) {
        error = message
        shake += 1
    }
}

struct ShakeEffect: GeometryEffect {
    var shakes: CGFloat
    var animatableData: CGFloat {
        get { shakes }
        set { shakes = newValue }
    }

    func effectValue(size: CGSize) -> ProjectionTransform {
        ProjectionTransform(CGAffineTransform(translationX: 10 * sin(shakes * .pi * 4), y: 0))
    }
}

/// Shared PIN rules. A weak PIN is allowed with a warning-free nudge only where it matters.
enum PINRules {
    static func weakness(_ pin: String) -> String? {
        let digits = pin.compactMap(\.wholeNumberValue)
        guard digits.count == 4 else { return nil }
        if Set(digits).count == 1 { return "Repeated digits are easy to guess. Pick something less obvious." }
        let ascending = zip(digits, digits.dropFirst()).allSatisfy { $1 == $0 + 1 }
        let descending = zip(digits, digits.dropFirst()).allSatisfy { $1 == $0 - 1 }
        if ascending || descending { return "Straight runs like 1234 are easy to guess. Pick something less obvious." }
        return nil
    }

    /// Validation for a new safety PIN against the stored duress PIN.
    @MainActor
    static func validateSafety(_ pin: String, store: SettingsStore) -> String? {
        if let weak = weakness(pin) { return weak }
        if store.hasDuressPIN, store.verifyPIN(pin) == .duress { return "That's your duress PIN. Your safety PIN needs to be different." }
        return nil
    }

    /// Validation for a new duress PIN against the stored safety PIN.
    @MainActor
    static func validateDuress(_ pin: String, store: SettingsStore) -> String? {
        if let weak = weakness(pin) { return weak }
        if store.verifyPIN(pin) == .valid { return "That's your safety PIN. Your duress PIN needs to be different." }
        return nil
    }
}

/// ~10 second looping explainer (SPEC 8.7): the same pad, two outcomes.
/// Left: safety PIN -> alert cancelled. Right: duress PIN -> looks cancelled, and `delivery` says
/// what really happens next.
struct PINExplainerAnimation: View {
    var delivery: AlertDelivery
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.periodic(from: .now, by: 0.1)) { context in
            let t = reduceMotion ? 9.0 : context.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 10)
            HStack(alignment: .top, spacing: SSSpacing.sm) {
                lane(title: "Safety PIN", tint: SSColor.calm, t: t, start: 0.4, duress: false)
                lane(title: "Duress PIN", tint: SSColor.accent, t: t, start: 5.2, duress: true)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(delivery.duressAnimationLabel)
    }

    private func lane(title: String, tint: Color, t: Double, start: Double, duress: Bool) -> some View {
        let dots = max(0, min(4, Int((t - start) / 0.45)))
        let resolved = t >= start + 2.0
        let secret = duress && t >= start + 3.0
        let dim = !duress && t >= 5.0 && !reduceMotion
        return VStack(spacing: SSSpacing.sm) {
            Text(title).ssEyebrow(tint)
            ZStack {
                RoundedRectangle(cornerRadius: 18, style: .continuous).fill(SSColor.surface)
                VStack(spacing: 10) {
                    if resolved {
                        Image(systemName: "checkmark.circle.fill").font(.system(size: 30)).foregroundStyle(SSColor.calm)
                            .transition(.scale.combined(with: .opacity))
                        Text("Alert cancelled").font(SSFont.callout.weight(.semibold))
                    } else {
                        HStack(spacing: 8) {
                            ForEach(0..<4, id: \.self) { i in
                                Circle().fill(i < dots ? SSColor.ink : .clear)
                                    .overlay(Circle().stroke(SSColor.inkMuted, lineWidth: 1.2))
                                    .frame(width: 10, height: 10)
                            }
                        }
                        Text("Enter PIN").font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
                    }
                }
                .animation(.smooth, value: resolved)
            }
            .frame(height: 120)
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(tint.opacity(0.5)))

            HStack(spacing: 6) {
                Image(systemName: duress ? "antenna.radiowaves.left.and.right" : "moon.zzz")
                    .symbolEffect(.variableColor.iterative, options: .repeating, isActive: secret)
                Text(duress ? (secret ? delivery.duressResultLabel : "Behind the scenes…") : "Everything stops")
            }
            .font(SSFont.caption.weight(.semibold))
            .foregroundStyle(duress ? (secret ? SSColor.accent : SSColor.inkMuted) : SSColor.inkMuted)
            .opacity(resolved ? 1 : 0.4)
            .animation(.smooth, value: secret)
        }
        .frame(maxWidth: .infinity)
        .opacity(dim ? 0.55 : 1)
        .animation(.smooth, value: dim)
    }
}

#Preview("Creator") {
    PINCreator(title: "Create your safety PIN", subtitle: "You'll use it to cancel an alert.") { _ in }
        .padding().frame(maxHeight: .infinity).background(SSColor.background).foregroundStyle(SSColor.ink)
        .preferredColorScheme(.dark)
}

#Preview("Explainer") {
    PINExplainerAnimation(delivery: .real).padding().background(SSColor.background).foregroundStyle(SSColor.ink)
        .preferredColorScheme(.dark)
}
