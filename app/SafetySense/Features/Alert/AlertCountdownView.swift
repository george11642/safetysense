import SwiftUI

/// Alert countdown (SPEC 9.5, level 2 -> 3): who's been told, how long until professional
/// help is sent, and the PIN pad. A duress PIN produces exactly the same screen change as the
/// safety PIN; the server escalates silently.
struct AlertCountdownView: View {
    @Environment(AppModel.self) private var model
    @State private var pin = ""
    @State private var wrongPIN = 0
    @State private var attempts = 0
    @State private var isChecking = false
    @State private var fallbackDeadline = Date.now.addingTimeInterval(90)
    @State private var arrived = 0
    @State private var confirmSendNow = false
    @State private var cancelled = false

    private var alert: AlertRecord? { model.services.escalation.activeAlert ?? model.currentAlert }
    private var total: TimeInterval { EscalationLevel.alert.autoEscalateAfter ?? 90 }
    private var deadline: Date {
        model.services.escalation.stepDeadline ?? alert?.dispatchDeadline ?? fallbackDeadline
    }

    var body: some View {
        ScrollView {
            VStack(spacing: SSSpacing.sm) {
                header
                notifiedCard
                pinSection
                Text("SafetySense supplements 911. If you can, call 911 yourself.")
                    .font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
                    .multilineTextAlignment(.center)
            }
            .padding(.top, SSSpacing.sm)
            .padding(.bottom, SSSpacing.md)
        }
        .scrollIndicators(.hidden)
        .scrollBounceBehavior(.basedOnSize)
        // Pinned so it's always one tap away, whatever the screen size.
        .safeAreaInset(edge: .bottom, spacing: 0) { sendNowBar }
        .ssScreen()
        .overlay { if cancelled { cancelledToast } }
        .sensoryFeedback(.warning, trigger: arrived)
        .sensoryFeedback(.error, trigger: wrongPIN)
        .onAppear { arrived += 1 }
        .task(id: alert?.id) { if let alert { await model.ensureEvidenceCapture(for: alert) } }
        .confirmationDialog("Send professional help now?", isPresented: $confirmSendNow, titleVisibility: .visible) {
            Button("Send help now", role: .destructive) {
                model.services.escalation.contactRequestedHelp(name: "You")
            }
            Button("Keep the countdown", role: .cancel) {}
        } message: {
            Text("The monitoring center will call you, then send police to your location.")
        }
    }

    private var sendNowBar: some View {
        PrimaryButton("Send help now", systemImage: "light.beacon.max", role: .danger) { confirmSendNow = true }
            .padding(.top, SSSpacing.sm)
            .padding(.bottom, SSSpacing.xs)
            .background(alignment: .top) {
                LinearGradient(colors: [SSColor.background.opacity(0), SSColor.background],
                               startPoint: .top, endPoint: .init(x: 0.5, y: 0.35))
                    .padding(.top, -SSSpacing.lg)
                    .ignoresSafeArea(edges: .bottom)
                    .allowsHitTesting(false)
            }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: SSSpacing.sm) {
            HStack {
                StatusPill(text: alert?.isDrill == true ? "Drill · test only" : "Alert", tint: SSColor.danger, pulsing: true)
                Spacer()
                if let start = alert?.startedAt {
                    Text("Sent \(start, format: .dateTime.hour().minute())").ssEyebrow(SSColor.warn)
                }
            }
            HStack(alignment: .center, spacing: SSSpacing.md) {
                RingTimer(deadline: deadline, total: total, tint: SSColor.danger, lineWidth: 8, caption: "to dispatch")
                    .frame(width: 128, height: 128)
                    .accessibilityLabel("Time until professional help is sent")
                VStack(alignment: .leading, spacing: SSSpacing.xxs) {
                    Text("Your people are being told")
                        .font(SSFont.title)
                        .fixedSize(horizontal: false, vertical: true)
                    if let reason = alert?.reason, !reason.isEmpty {
                        Text("Why: \(reason)")
                            .font(SSFont.callout).foregroundStyle(SSColor.inkMuted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private var notifiedCard: some View {
        Card {
            VStack(alignment: .leading, spacing: SSSpacing.xs) {
                Text("Notified").ssEyebrow()
                let notified = alert?.notified ?? []
                if notified.isEmpty {
                    HStack(spacing: SSSpacing.sm) {
                        ProgressView().tint(SSColor.accent)
                        Text("Calling and texting \(NameList.join(model.contacts.map(\.firstName)))…")
                            .font(SSFont.callout).foregroundStyle(SSColor.inkMuted)
                    }
                    .frame(minHeight: 44)
                } else {
                    ForEach(notified, id: \.self) { c in
                        NotifiedContactRow(contact: c, events: alert?.events ?? [])
                    }
                }
            }
            .animation(.smooth, value: alert?.notified)
        }
    }

    private var pinSection: some View {
        VStack(spacing: SSSpacing.xs) {
            Text(attempts > 0 ? "That PIN didn't match. Try again." : "Safe? Enter your PIN to cancel")
                .font(SSFont.headline)
                .foregroundStyle(attempts > 0 ? SSColor.warn : SSColor.ink)
                .contentTransition(.opacity)
            if model.services.flavor == .demo, !model.store.hasSafetyPIN {
                Text("Demo build: set a safety PIN in Settings to try cancelling.")
                    .font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
                    .multilineTextAlignment(.center)
            }
            PINPad(pin: $pin, tint: SSColor.danger, compact: true) { entered in submit(entered) }
                .modifier(PINShake(shakes: CGFloat(wrongPIN)))
                .animation(.default, value: wrongPIN)
                .disabled(isChecking || cancelled)
        }
    }

    private func submit(_ entered: String) {
        isChecking = true
        Task {
            let result = await model.cancelAlert(pin: entered)
            isChecking = false
            switch result {
            case .invalid:
                attempts += 1
                wrongPIN += 1
            case .valid, .duress:
                // Identical on purpose.
                withAnimation(.smooth) { cancelled = true }
            }
        }
    }

    private var cancelledToast: some View {
        VStack(spacing: SSSpacing.sm) {
            Image(systemName: "checkmark.circle.fill").font(.system(size: 56)).foregroundStyle(SSColor.calm)
            Text("Alert cancelled").font(SSFont.title)
            Text("Glad you're okay. SafetySense is still guarding.")
                .font(SSFont.callout).foregroundStyle(SSColor.inkMuted).multilineTextAlignment(.center)
        }
        .padding(SSSpacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(SSColor.background.opacity(0.96).ignoresSafeArea())
        .transition(.opacity)
        .sensoryFeedback(.success, trigger: cancelled)
        .accessibilityAddTraits(.isModal)
    }
}

#Preview { AlertCountdownView().environment(AppModel.preview(screen: .alertCountdown)) }
