import SwiftUI

/// Check-in prompt (SPEC 9.4, ladder level 1): "You okay?" with a 45 s ring.
/// A quiet haptic on arrival, a gentle nudge every 15 s, and a firmer one in the last 10 s.
struct CheckInView: View {
    @Environment(AppModel.self) private var model
    @State private var fallbackDeadline = Date.now.addingTimeInterval(45)
    @State private var nudge = 0
    @State private var urgentNudge = 0
    @State private var answered = 0
    @State private var appeared = false

    private var total: TimeInterval { EscalationLevel.checkIn.autoEscalateAfter ?? 45 }
    private var deadline: Date { model.services.escalation.stepDeadline ?? fallbackDeadline }

    var body: some View {
        ScrollView {
            VStack(spacing: SSSpacing.lg) {
                StatusPill(text: "Check-in", tint: SSColor.warn, pulsing: true)
                    .frame(maxWidth: .infinity, alignment: .leading)

                VStack(spacing: SSSpacing.xs) {
                    Text(reasonLine).font(SSFont.callout).foregroundStyle(SSColor.inkMuted)
                        .multilineTextAlignment(.center)
                    Text("You okay?")
                        .font(SSFont.hero)
                        .scaleEffect(appeared ? 1 : 0.9)
                        .opacity(appeared ? 1 : 0)
                }
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(.isHeader)

                RingTimer(deadline: deadline, total: total, tint: SSColor.warn, lineWidth: 16, caption: "seconds to respond")
                    .frame(width: 220, height: 220)
                    .padding(.vertical, SSSpacing.xs)
                    .accessibilityLabel("Time left to respond")

                VStack(spacing: SSSpacing.sm) {
                    PrimaryButton("I'm okay", systemImage: "checkmark", role: .calm) {
                        answered += 1
                        model.respondToCheckIn(okay: true)
                    }
                    PrimaryButton("I need help", systemImage: "exclamationmark.triangle.fill", role: .danger) {
                        answered += 1
                        model.respondToCheckIn(okay: false)
                    }
                }

                Text("If you don't answer, \(NameList.join(model.contacts.map(\.firstName))) will be alerted with your live location.")
                    .font(SSFont.callout)
                    .foregroundStyle(SSColor.inkMuted)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.top, SSSpacing.sm)
            .padding(.bottom, SSSpacing.xl)
        }
        .scrollIndicators(.hidden)
        .ssScreen()
        .sensoryFeedback(.warning, trigger: nudge)
        .sensoryFeedback(.impact(weight: .heavy, intensity: 1), trigger: urgentNudge)
        .sensoryFeedback(.success, trigger: answered)
        .task { await haptics() }
        .onAppear {
            withAnimation(.spring(response: 0.5, dampingFraction: 0.7)) { appeared = true }
        }
    }

    private var reasonLine: String {
        let cause = model.services.escalation.checkInCause ?? .scheduled
        return cause.line(mode: model.currentSession?.mode)
    }

    private func haptics() async {
        nudge += 1
        var lastNudge = Date.now
        while !Task.isCancelled {
            try? await Task.sleep(for: .seconds(1))
            let remaining = deadline.timeIntervalSinceNow
            if remaining <= 0 { break }
            if remaining <= 10 {
                urgentNudge += 1
                try? await Task.sleep(for: .seconds(1))
            } else if Date.now.timeIntervalSince(lastNudge) >= 15 {
                nudge += 1
                lastNudge = .now
            }
        }
    }
}

#Preview { CheckInView().environment(AppModel.preview(screen: .checkIn)) }
