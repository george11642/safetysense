import SwiftUI

/// Numbered how-to step that lights up when it's the current one in the animation.
private struct GuideStep: View {
    let number: Int
    let text: String
    let active: Bool

    var body: some View {
        HStack(alignment: .top, spacing: SSSpacing.sm) {
            Text("\(number)")
                .font(SSFont.mono(13, weight: .bold))
                .foregroundStyle(active ? SSColor.onFill : SSColor.inkMuted)
                .frame(width: 26, height: 26)
                .background(active ? SSColor.accent : SSColor.surfaceRaised, in: Circle())
            Text(text)
                .font(SSFont.callout)
                .foregroundStyle(active ? SSColor.ink : SSColor.inkMuted)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .animation(.smooth, value: active)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Step \(number). \(text)")
    }
}

/// Drives a looping step highlight. Stops when Reduce Motion is on.
private struct StepCycler {
    static func index(at date: Date, count: Int, seconds: Double = 2.6) -> Int {
        Int(date.timeIntervalSinceReferenceDate / seconds) % max(count, 1)
    }
}

// MARK: - Action Button

/// Step-by-step Action Button setup with an animated phone (SPEC 8.5).
struct ActionButtonGuide: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var onDone: () -> Void = {}

    static let steps = [
        "Open the Settings app and tap Action Button.",
        "Swipe through the options until you reach Shortcut.",
        "Tap Choose a Shortcut, then pick \u{201C}SafetySense Alert\u{201D}.",
        "Press and hold the Action Button. SafetySense starts your alert, even with the phone locked.",
    ]

    var body: some View {
        TimelineView(.periodic(from: .now, by: 0.05)) { context in
            let step = reduceMotion ? 3 : StepCycler.index(at: context.date, count: Self.steps.count)
            VStack(alignment: .leading, spacing: SSSpacing.lg) {
                ActionButtonPhone(step: step, date: context.date, animate: !reduceMotion)
                    .frame(height: 230)
                    .frame(maxWidth: .infinity)
                VStack(alignment: .leading, spacing: SSSpacing.sm) {
                    ForEach(Array(Self.steps.enumerated()), id: \.offset) { i, s in
                        GuideStep(number: i + 1, text: s, active: i == step)
                    }
                }
            }
        }
        Text("Works on iPhone 15 Pro and later, and iPhone 16e. On other iPhones, use the Lock Screen control or Siri: \u{201C}SafetySense alert.\u{201D}")
            .font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
        PrimaryButton("I've set it up", systemImage: "checkmark", role: .calm, action: onDone)
    }
}

/// Side view of an iPhone: the Action Button presses in and a hold ring fills on the last step.
private struct ActionButtonPhone: View {
    let step: Int
    let date: Date
    let animate: Bool

    var body: some View {
        let t = date.timeIntervalSinceReferenceDate
        let holdProgress = animate ? min(1, (t.truncatingRemainder(dividingBy: 2.6)) / 1.8) : 1
        let pressed = step == 3 && holdProgress < 1
        ZStack(alignment: .leading) {
            // Phone body
            RoundedRectangle(cornerRadius: 34, style: .continuous)
                .fill(SSColor.surface)
                .overlay(RoundedRectangle(cornerRadius: 34, style: .continuous).stroke(SSColor.line, lineWidth: 2))
                .frame(width: 130, height: 220)
                .overlay {
                    screen(holdProgress: holdProgress)
                        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
                        .padding(7)
                }
                .offset(x: 14)
            // Action Button on the upper left edge
            Capsule()
                .fill(step == 3 ? SSColor.accent : SSColor.inkMuted)
                .frame(width: pressed ? 5 : 8, height: 26)
                .offset(x: pressed ? 12 : 8, y: -62)
                .shadow(color: step == 3 ? SSColor.accent.opacity(0.8) : .clear, radius: 8)
            if step == 3 {
                Image(systemName: "hand.point.right.fill")
                    .font(.system(size: 26))
                    .foregroundStyle(SSColor.ink)
                    .offset(x: pressed ? -22 : -30, y: -62)
            }
        }
        .frame(width: 170, height: 230)
        .animation(.snappy(duration: 0.2), value: pressed)
        .accessibilityHidden(true)
    }

    @ViewBuilder
    private func screen(holdProgress: Double) -> some View {
        ZStack {
            SSColor.background
            switch step {
            case 0:
                VStack(spacing: 8) {
                    Image(systemName: "gearshape.fill").font(.system(size: 30)).foregroundStyle(SSColor.inkMuted)
                    row("Action Button", highlighted: true)
                    row("Camera", highlighted: false)
                    row("Display", highlighted: false)
                }
            case 1:
                VStack(spacing: 10) {
                    Image(systemName: "square.2.layers.3d.fill").font(.system(size: 36)).foregroundStyle(SSColor.accent)
                    Text("Shortcut").font(.system(size: 13, weight: .semibold, design: .rounded))
                    HStack(spacing: 4) {
                        ForEach(0..<5, id: \.self) { i in
                            Circle().fill(i == 3 ? SSColor.ink : SSColor.line).frame(width: 5, height: 5)
                        }
                    }
                }
            case 2:
                VStack(spacing: 8) {
                    row("SafetySense Alert", highlighted: true, icon: "shield.lefthalf.filled")
                    row("Flashlight", highlighted: false, icon: "flashlight.on.fill")
                    row("Voice Memo", highlighted: false, icon: "waveform")
                }
            default:
                ZStack {
                    Circle().stroke(SSColor.accent.opacity(0.2), lineWidth: 6)
                    Circle().trim(from: 0, to: holdProgress)
                        .stroke(SSColor.accent, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    Image(systemName: holdProgress >= 1 ? "checkmark" : "shield.lefthalf.filled")
                        .font(.system(size: 28, weight: .bold))
                        .foregroundStyle(SSColor.accent)
                        .contentTransition(.symbolEffect(.replace))
                }
                .frame(width: 74, height: 74)
            }
        }
        .animation(.smooth, value: step)
    }

    private func row(_ title: String, highlighted: Bool, icon: String? = nil) -> some View {
        HStack(spacing: 5) {
            if let icon { Image(systemName: icon).font(.system(size: 10)) }
            Text(title).font(.system(size: 10, weight: .medium, design: .rounded)).lineLimit(1)
            Spacer(minLength: 0)
        }
        .foregroundStyle(highlighted ? SSColor.onFill : SSColor.ink)
        .padding(.horizontal, 8)
        .frame(height: 24)
        .background(highlighted ? SSColor.accent : SSColor.surfaceRaised, in: RoundedRectangle(cornerRadius: 7))
        .padding(.horizontal, 10)
    }
}

// MARK: - Lock Screen control

/// How to add the "SafetySense Alert" control to the Lock Screen (SPEC 8.5).
struct LockScreenControlGuide: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    var onDone: () -> Void = {}

    static let steps = [
        "Touch and hold the Lock Screen, then tap Customize and choose Lock Screen.",
        "Tap the minus on one of the two buttons at the bottom to remove it.",
        "Tap the empty spot, search for SafetySense, and choose \u{201C}SafetySense Alert\u{201D}.",
        "Tap Done. One tap on the shield starts an alert without unlocking.",
    ]

    var body: some View {
        TimelineView(.periodic(from: .now, by: 0.1)) { context in
            let step = reduceMotion ? 3 : StepCycler.index(at: context.date, count: Self.steps.count)
            VStack(alignment: .leading, spacing: SSSpacing.lg) {
                LockScreenMock(step: step)
                    .frame(height: 230)
                    .frame(maxWidth: .infinity)
                VStack(alignment: .leading, spacing: SSSpacing.sm) {
                    ForEach(Array(Self.steps.enumerated()), id: \.offset) { i, s in
                        GuideStep(number: i + 1, text: s, active: i == step)
                    }
                }
            }
        }
        Text("You can also add it to Control Center the same way: swipe down from the top right, tap +, then Add a Control.")
            .font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
        PrimaryButton("I've added it", systemImage: "checkmark", role: .calm, action: onDone)
    }
}

private struct LockScreenMock: View {
    let step: Int

    var body: some View {
        RoundedRectangle(cornerRadius: 30, style: .continuous)
            .fill(LinearGradient(colors: [SSColor.surfaceRaised, SSColor.background], startPoint: .top, endPoint: .bottom))
            .overlay(RoundedRectangle(cornerRadius: 30, style: .continuous).stroke(SSColor.line, lineWidth: 2))
            .frame(width: 124, height: 220)
            .overlay(alignment: .top) {
                VStack(spacing: 2) {
                    Text("Wed").font(.system(size: 9, weight: .semibold, design: .rounded)).foregroundStyle(SSColor.inkMuted)
                    Text("10:42").font(.system(size: 30, weight: .semibold, design: .rounded)).foregroundStyle(SSColor.ink)
                    if step == 0 {
                        Text("Customize")
                            .font(.system(size: 9, weight: .semibold)).foregroundStyle(SSColor.onFill)
                            .padding(.horizontal, 8).padding(.vertical, 3)
                            .background(SSColor.accent, in: Capsule())
                            .transition(.scale.combined(with: .opacity))
                    }
                }
                .padding(.top, 22)
            }
            .overlay(alignment: .bottom) {
                HStack {
                    control(left: true)
                    Spacer()
                    Circle().fill(SSColor.surface).frame(width: 30, height: 30)
                        .overlay(Image(systemName: "camera.fill").font(.system(size: 12)).foregroundStyle(SSColor.ink))
                }
                .padding(.horizontal, 14)
                .padding(.bottom, 16)
            }
            .scaleEffect(step == 0 ? 0.96 : 1)
            .animation(.smooth, value: step)
            .accessibilityHidden(true)
    }

    @ViewBuilder
    private func control(left: Bool) -> some View {
        ZStack(alignment: .topLeading) {
            Circle()
                .fill(step >= 2 ? SSColor.accent : SSColor.surface)
                .frame(width: 30, height: 30)
                .overlay {
                    Image(systemName: step >= 2 ? "shield.lefthalf.filled" : (step == 1 ? "minus" : "flashlight.off.fill"))
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(step >= 2 ? SSColor.onFill : SSColor.ink)
                        .contentTransition(.symbolEffect(.replace))
                }
                .overlay {
                    if step == 3 {
                        Circle().stroke(SSColor.accent.opacity(0.5), lineWidth: 2).scaleEffect(1.35)
                    }
                }
            if step == 1 {
                Circle().fill(SSColor.danger).frame(width: 11, height: 11)
                    .overlay(Image(systemName: "minus").font(.system(size: 7, weight: .black)).foregroundStyle(.white))
                    .offset(x: -3, y: -3)
                    .transition(.scale)
            }
        }
    }
}

#Preview("Action Button") {
    ScrollView { VStack(alignment: .leading, spacing: 16) { ActionButtonGuide() }.padding() }
        .background(SSColor.background).foregroundStyle(SSColor.ink).preferredColorScheme(.dark)
}

#Preview("Lock Screen") {
    ScrollView { VStack(alignment: .leading, spacing: 16) { LockScreenControlGuide() }.padding() }
        .background(SSColor.background).foregroundStyle(SSColor.ink).preferredColorScheme(.dark)
}
