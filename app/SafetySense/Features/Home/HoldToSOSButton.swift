import SwiftUI

/// Press-and-hold SOS (SPEC 7.5). Holding for `duration` seconds fills the bar, gives a firm
/// haptic and fires `action`. Letting go early cancels with no side effect, so a pocket tap
/// can't start an alert. VoiceOver users get a regular activate action instead.
struct HoldToSOSButton: View {
    var title = "Hold if you need help"
    var duration: Double = 2
    let action: () -> Void

    @State private var progress: Double = 0
    @State private var isHolding = false
    @State private var fired = 0
    @State private var ticks = 0
    @State private var holdTask: Task<Void, Never>?

    var body: some View {
        ZStack(alignment: .leading) {
            RoundedRectangle(cornerRadius: SSRadius.button, style: .continuous)
                .fill(SSColor.dangerSoft)
            GeometryReader { geo in
                RoundedRectangle(cornerRadius: SSRadius.button, style: .continuous)
                    .fill(SSColor.danger)
                    .frame(width: geo.size.width * progress)
            }
            HStack(spacing: SSSpacing.xs) {
                Image(systemName: "hand.raised.fill")
                    .font(.body.weight(.bold))
                Text(isHolding ? "Keep holding…" : title)
                    .font(SSFont.headline)
                    .contentTransition(.opacity)
            }
            .foregroundStyle(progress > 0.5 ? SSColor.onFill : SSColor.danger)
            .frame(maxWidth: .infinity)
        }
        .frame(height: 60)
        .overlay(RoundedRectangle(cornerRadius: SSRadius.button, style: .continuous)
            .stroke(SSColor.danger.opacity(0.5), lineWidth: 1))
        .contentShape(RoundedRectangle(cornerRadius: SSRadius.button))
        .scaleEffect(isHolding ? 0.98 : 1)
        .animation(.snappy(duration: 0.2), value: isHolding)
        .onLongPressGesture(minimumDuration: duration, maximumDistance: 40) {
            complete()
        } onPressingChanged: { pressing in
            pressing ? begin() : reset()
        }
        .sensoryFeedback(.impact(weight: .light), trigger: ticks)
        .sensoryFeedback(.impact(weight: .heavy, intensity: 1), trigger: fired)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("SOS")
        .accessibilityHint("Starts an alert right away.")
        .accessibilityAddTraits(.isButton)
        .accessibilityAction { action() }
    }

    private func begin() {
        isHolding = true
        holdTask?.cancel()
        let steps = 40
        holdTask = Task { @MainActor in
            for step in 1...steps {
                try? await Task.sleep(for: .seconds(duration / Double(steps)))
                guard !Task.isCancelled else { return }
                withAnimation(.linear(duration: duration / Double(steps))) { progress = Double(step) / Double(steps) }
                if step % 10 == 0 { ticks += 1 }
            }
        }
    }

    private func complete() {
        holdTask?.cancel()
        progress = 1
        fired += 1
        action()
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(600))
            reset()
        }
    }

    private func reset() {
        holdTask?.cancel()
        isHolding = false
        withAnimation(.smooth(duration: 0.3)) { progress = 0 }
    }
}

#Preview {
    VStack { HoldToSOSButton {} }
        .padding()
        .frame(maxHeight: .infinity)
        .background(SSColor.background)
}
