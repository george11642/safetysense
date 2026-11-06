import SwiftUI

/// Alert countdown (SPEC 9.5, level 2 -> 3): who's been told, how long until professional
/// help is sent, and the PIN pad. Everything fits without scrolling on an iPhone 17e, with the
/// keys and the footer in reach: in a panic the 0 key can't depend on a scroll. A duress PIN
/// produces exactly the same screen change as the safety PIN; the server escalates silently.
struct AlertCountdownView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openURL) private var openURL
    @State private var pin = ""
    @State private var wrongPIN = 0
    @State private var attempts = 0
    @State private var isChecking = false
    @State private var fallbackDeadline = Date.now.addingTimeInterval(90)
    @State private var arrived = 0
    @State private var confirmSendNow = false
    @State private var confirmNoPINCancel = false
    @State private var authFailed = 0

    private var alert: AlertRecord? { model.services.escalation.activeAlert ?? model.currentAlert }
    private var total: TimeInterval { EscalationLevel.alert.autoEscalateAfter ?? 90 }
    private var delivery: AlertDelivery { model.alertDelivery }
    private var deadline: Date {
        model.services.escalation.stepDeadline ?? alert?.dispatchDeadline ?? fallbackDeadline
    }

    var body: some View {
        ScrollView {
            VStack(spacing: SSSpacing.sm) {
                header
                if let note = model.alertConnectionNote {
                    ServerFallbackCard(note: note)
                } else {
                    notifiedCard
                }
                pinSection
            }
            .padding(.top, SSSpacing.xs)
            .padding(.bottom, SSSpacing.xs)
        }
        .scrollIndicators(.hidden)
        .scrollBounceBehavior(.basedOnSize)
        // Pinned so both are always one tap away, whatever the screen size.
        .safeAreaInset(edge: .bottom, spacing: 0) { footerBar }
        .testModeBanner()
        .ssScreen()
        .sensoryFeedback(.warning, trigger: arrived)
        .sensoryFeedback(.error, trigger: wrongPIN)
        .sensoryFeedback(.error, trigger: authFailed)
        .onAppear { arrived += 1 }
        .task(id: alert?.id) { if let alert { await model.ensureEvidenceCapture(for: alert) } }
        .confirmationDialog(delivery.sendHelpConfirmTitle, isPresented: $confirmSendNow, titleVisibility: .visible) {
            Button(delivery.sendHelpTitle, role: .destructive) {
                model.services.escalation.contactRequestedHelp(name: "You")
            }
            Button("Keep the countdown", role: .cancel) {}
        } message: {
            Text(delivery.sendHelpConfirmMessage)
        }
        .confirmationDialog("Cancel this alert?", isPresented: $confirmNoPINCancel, titleVisibility: .visible) {
            Button("Cancel the alert", role: .destructive) { Task { await model.cancelAlertWithoutPIN() } }
            Button("Keep the alert", role: .cancel) {}
        } message: {
            Text("This iPhone has no safety PIN, Face ID or passcode set.")
        }
    }

    private var footerBar: some View {
        HStack(spacing: SSSpacing.xs) {
            PrimaryButton(delivery.sendHelpTitle, systemImage: "light.beacon.max", role: .danger) { confirmSendNow = true }
            Button { if let url = PhoneLink.url("911") { openURL(url) } } label: {
                Label("911", systemImage: "phone.fill")
                    .font(SSFont.headline)
                    .frame(minWidth: 96, minHeight: 56)
                    .foregroundStyle(SSColor.danger)
                    .background(SSColor.dangerSoft, in: RoundedRectangle(cornerRadius: SSRadius.button, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Call 911")
        }
        .padding(.top, SSSpacing.xs)
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
        VStack(alignment: .leading, spacing: SSSpacing.xs) {
            HStack {
                StatusPill(text: alert?.isDrill == true ? "Drill · test only" : delivery.countdownPill, tint: SSColor.danger, pulsing: true)
                Spacer()
                if let start = alert?.startedAt {
                    Text("Sent \(start, format: .dateTime.hour().minute())").ssEyebrow(SSColor.warn)
                }
            }
            HStack(alignment: .center, spacing: SSSpacing.md) {
                RingTimer(deadline: deadline, total: total, tint: SSColor.danger, lineWidth: 8, caption: delivery.ringCaption)
                    .frame(width: 120, height: 120)
                    .accessibilityLabel(delivery.ringAccessibilityLabel)
                VStack(alignment: .leading, spacing: SSSpacing.xxs) {
                    Text(delivery.countdownHeadline)
                        .font(SSFont.title)
                        .fixedSize(horizontal: false, vertical: true)
                    if let why = alert.flatMap(AlertPresentation.why) {
                        Text("Why: \(why)")
                            .font(SSFont.callout).foregroundStyle(SSColor.inkMuted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private var notifiedCard: some View {
        Card(padding: SSSpacing.sm) {
            VStack(alignment: .leading, spacing: SSSpacing.xxs) {
                Text("Notified").ssEyebrow()
                let people = AlertPresentation.people(delivery.shown(alert?.notified ?? []))
                if people.isEmpty {
                    HStack(spacing: SSSpacing.sm) {
                        if delivery.isReal { ProgressView().tint(SSColor.accent) }
                        Text(delivery.reaching(NameList.join(model.contacts.map(\.firstName))))
                            .font(SSFont.callout).foregroundStyle(SSColor.inkMuted)
                    }
                    .frame(minHeight: 44)
                } else {
                    let rows = AlertPresentation.countdownRows(people, events: delivery.shown(alert?.events ?? []))
                    ForEach(rows) { row in NotifiedGroupRow(row: row) }
                }
            }
            .animation(.smooth, value: alert?.notified)
        }
    }

    @ViewBuilder
    private var pinSection: some View {
        if model.store.hasSafetyPIN {
            VStack(spacing: SSSpacing.xs) {
                Text(attempts >= 3 ? delivery.forgotPINHint
                     : attempts > 0 ? "That PIN didn't match. Try again." : "Safe? Enter your PIN to cancel")
                    .font(SSFont.headline)
                    .foregroundStyle(attempts > 0 ? SSColor.warn : SSColor.ink)
                    .multilineTextAlignment(.center)
                    .contentTransition(.opacity)
                PINPad(pin: $pin, tint: SSColor.danger, compact: true) { entered in submit(entered) }
                    .modifier(PINShake(shakes: CGFloat(wrongPIN)))
                    .animation(.default, value: wrongPIN)
                    .disabled(isChecking)
            }
        } else {
            VStack(spacing: SSSpacing.sm) {
                Text("Safe? You haven't set a safety PIN, so confirm it's you to cancel.")
                    .font(SSFont.headline).multilineTextAlignment(.center)
                PrimaryButton("Cancel with \(DeviceAuth.biometryName == "PIN" ? "passcode" : DeviceAuth.biometryName)",
                              systemImage: "faceid", role: .calm) { cancelWithoutPIN() }
            }
            .padding(.top, SSSpacing.sm)
        }
    }

    private func submit(_ entered: String) {
        isChecking = true
        Task {
            // Valid and duress both go straight to Marked safe, identically.
            let result = await model.cancelAlert(pin: entered)
            isChecking = false
            if result == .invalid {
                attempts += 1
                wrongPIN += 1
            }
        }
    }

    private func cancelWithoutPIN() {
        Task {
            switch await DeviceAuth.authenticateOwner(reason: "Cancel this alert") {
            case .success: await model.cancelAlertWithoutPIN()
            case .failed: authFailed += 1
            case .unavailable: confirmNoPINCancel = true
            }
        }
    }
}

/// SafetySense's server can't be reached, so the phone's own Messages and Phone apps take over.
/// Nothing is sent without a tap in those apps.
struct ServerFallbackCard: View {
    let note: String
    @Environment(AppModel.self) private var model

    var body: some View {
        Card(padding: SSSpacing.sm, tint: SSColor.warn) {
            VStack(alignment: .leading, spacing: SSSpacing.xs) {
                Label(note, systemImage: "wifi.exclamationmark")
                    .font(SSFont.callout).foregroundStyle(SSColor.ink)
                    .fixedSize(horizontal: false, vertical: true)
                HStack(spacing: SSSpacing.xs) {
                    if let url = ContactFallback.textURL(to: model.contacts, from: model.profile, location: model.services.location.lastFix) {
                        fallbackLink("Text your people", systemImage: "message.fill", url: url)
                    }
                    if let primary = model.contacts.first(where: \.isPrimary) ?? model.contacts.first,
                       let url = PhoneLink.url(primary.phone) {
                        fallbackLink("Call \(primary.firstName)", systemImage: "phone.fill", url: url)
                    }
                }
            }
        }
    }

    private func fallbackLink(_ title: String, systemImage: String, url: URL) -> some View {
        Link(destination: url) {
            Label(title, systemImage: systemImage)
                .font(SSFont.callout.weight(.semibold))
                .lineLimit(1).minimumScaleFactor(0.8)
                .frame(maxWidth: .infinity, minHeight: 44)
                .foregroundStyle(SSColor.onFill)
                .background(SSColor.warn, in: RoundedRectangle(cornerRadius: SSRadius.small, style: .continuous))
        }
    }
}

#Preview { AlertCountdownView().environment(AppModel.preview(screen: .alertCountdown)) }
