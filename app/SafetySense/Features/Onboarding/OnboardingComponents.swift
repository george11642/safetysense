import SwiftUI

/// The nine onboarding steps (SPEC 8). Every step is skippable except contacts.
enum OnboardingStep: Int, CaseIterable, Identifiable, Sendable {
    case welcome, promises, campus, contacts, triggers, permissions, pins, responder, drill

    var id: Int { rawValue }

    var title: String {
        switch self {
        case .welcome: "Welcome"
        case .promises: "Our promises"
        case .campus: "Your campus"
        case .contacts: "Trusted contacts"
        case .triggers: "Your triggers"
        case .permissions: "Permissions"
        case .pins: "Safety PIN"
        case .responder: "Responder profile"
        case .drill: "Practice drill"
        }
    }

    var isSkippable: Bool { self != .contacts && self != .welcome }

    var next: OnboardingStep? { OnboardingStep(rawValue: rawValue + 1) }
    var previous: OnboardingStep? { OnboardingStep(rawValue: rawValue - 1) }

    /// `-ssOnboardingStep <name|number>` for QA screenshots.
    static func fromLaunchArguments(_ arguments: [String] = LaunchOptions.qaArguments) -> OnboardingStep? {
        guard let i = arguments.firstIndex(of: "-ssOnboardingStep"), i + 1 < arguments.count else { return nil }
        let value = arguments[i + 1].lowercased()
        if let n = Int(value) { return OnboardingStep(rawValue: n) }
        return allCases.first { "\($0)" == value }
    }
}

/// Standard step layout: eyebrow, title, subtitle, scrolling content and a pinned footer.
struct OnboardingPage<Content: View, Footer: View>: View {
    let eyebrow: String
    let title: String
    var subtitle: String?
    @ViewBuilder var content: Content
    @ViewBuilder var footer: Footer

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: SSSpacing.lg) {
                    VStack(alignment: .leading, spacing: SSSpacing.xs) {
                        Text(eyebrow).ssEyebrow(SSColor.accent)
                        Text(title).font(SSFont.display).fixedSize(horizontal: false, vertical: true)
                            .accessibilityAddTraits(.isHeader)
                        if let subtitle {
                            Text(subtitle).font(SSFont.callout).foregroundStyle(SSColor.inkMuted)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    content
                }
                .padding(.top, SSSpacing.sm)
                .padding(.bottom, SSSpacing.lg)
            }
            .scrollDismissesKeyboard(.interactively)
            .scrollIndicators(.hidden)
            // Soft fade where content scrolls under the top bar and the pinned footer.
            .mask {
                VStack(spacing: 0) {
                    LinearGradient(colors: [.clear, .black], startPoint: .top, endPoint: .bottom).frame(height: 12)
                    Rectangle()
                    LinearGradient(colors: [.black, .clear], startPoint: .top, endPoint: .bottom).frame(height: 32)
                }
            }
            VStack(spacing: SSSpacing.xs) { footer }
                .padding(.top, SSSpacing.sm)
                .padding(.bottom, SSSpacing.sm)
        }
        .padding(.horizontal, SSSpacing.gutter)
    }
}

/// Segmented progress across the steps after Welcome.
struct OnboardingProgressBar: View {
    let step: OnboardingStep

    var body: some View {
        let steps = OnboardingStep.allCases.dropFirst()
        HStack(spacing: 4) {
            ForEach(steps) { s in
                Capsule()
                    .fill(s.rawValue <= step.rawValue ? SSColor.accent : SSColor.line)
                    .frame(height: 4)
                    .overlay {
                        if s == step {
                            Capsule().fill(SSColor.accent).blur(radius: 4).opacity(0.6)
                        }
                    }
            }
        }
        .animation(.smooth(duration: 0.4), value: step)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Step \(step.rawValue) of \(OnboardingStep.allCases.count - 1), \(step.title)")
    }
}

/// Shield with breathing pink and teal rings: the welcome hero and the "You're set" finale.
struct ShieldHero: View {
    var size: CGFloat = 200
    var celebrating = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.animation(paused: reduceMotion)) { context in
            let t = reduceMotion ? 0 : context.date.timeIntervalSinceReferenceDate
            ZStack {
                ForEach(0..<3, id: \.self) { i in
                    let phase = (t / 3.2 + Double(i) / 3).truncatingRemainder(dividingBy: 1)
                    Circle()
                        .stroke(i == 1 ? SSColor.calm.opacity(0.5) : SSColor.accent.opacity(0.55), lineWidth: 1.5)
                        .scaleEffect(0.45 + phase * 0.55)
                        .opacity(reduceMotion ? 0.35 : (1 - phase))
                }
                Circle()
                    .fill(RadialGradient(colors: [SSColor.accent.opacity(0.35), .clear], center: .center,
                                         startRadius: 0, endRadius: size * 0.4))
                    .scaleEffect(1 + 0.04 * sin(t * 1.6))
                Image(systemName: celebrating ? "checkmark.shield.fill" : "shield.lefthalf.filled")
                    .font(.system(size: size * 0.3, weight: .semibold))
                    .foregroundStyle(SSColor.accent)
                    .shadow(color: SSColor.accent.opacity(0.6), radius: 18)
                    .contentTransition(.symbolEffect(.replace))
            }
            .frame(width: size, height: size)
        }
        .accessibilityHidden(true)
    }
}

/// Row with a status mark used by triggers and permissions.
struct SetupRow<Trailing: View>: View {
    let systemImage: String
    let title: String
    let detail: String
    var done = false
    var tint: Color = SSColor.accent
    @ViewBuilder var trailing: Trailing

    var body: some View {
        Card {
            HStack(alignment: .center, spacing: SSSpacing.sm) {
                Image(systemName: done ? "checkmark" : systemImage)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(done ? SSColor.onFill : tint)
                    .frame(width: 40, height: 40)
                    .background(done ? SSColor.calm : tint.opacity(0.15), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .contentTransition(.symbolEffect(.replace))
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(SSFont.headline)
                    Text(detail).font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: SSSpacing.xs)
                trailing
            }
        }
        .animation(.smooth, value: done)
    }
}

#Preview("Progress + hero") {
    VStack(spacing: 40) {
        OnboardingProgressBar(step: .triggers)
        ShieldHero()
        SetupRow(systemImage: "mic", title: "Microphone", detail: "Only during Guard", done: true) { EmptyView() }
    }
    .padding()
    .frame(maxHeight: .infinity)
    .background(SSColor.background)
    .foregroundStyle(SSColor.ink)
    .preferredColorScheme(.dark)
}

/// List-row label with a fixed-width icon column so multi-line tips align.
struct TipLabelStyle: LabelStyle {
    var tint: Color = SSColor.accent

    func makeBody(configuration: Configuration) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: SSSpacing.sm) {
            configuration.icon
                .foregroundStyle(tint)
                .frame(width: 22)
            configuration.title
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
