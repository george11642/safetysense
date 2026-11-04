import SwiftUI

// MARK: 7. Safety PIN + duress PIN

struct PINStepView: View {
    @Environment(AppModel.self) private var model
    var next: () -> Void

    enum Phase: Equatable { case explain, safety, duress, done }
    @State private var phase: Phase = .explain

    var body: some View {
        Group {
            switch phase {
            case .explain: explainPage
            case .safety: safetyPage
            case .duress: duressPage
            case .done: donePage
            }
        }
        .transition(.opacity)
        .animation(.smooth, value: phase)
        .sensoryFeedback(.success, trigger: phase) { (_: Phase, new: Phase) -> Bool in new == .done || new == .duress }
    }

    private var explainPage: some View {
        OnboardingPage(eyebrow: "Step 7", title: "Two PINs",
                       subtitle: "Your safety PIN cancels an alert. Your duress PIN looks exactly like cancelling, but quietly sends help anyway, in case someone makes you cancel.") {
            PINExplainerAnimation()
            Card {
                VStack(alignment: .leading, spacing: SSSpacing.xs) {
                    Label("Keep them different and easy for you to remember.", systemImage: "brain.head.profile")
                    Label("They're stored only as scrambled hashes in your iPhone's Keychain.", systemImage: "lock")
                }
                .font(SSFont.callout)
                .labelStyle(TipLabelStyle())
            }
        } footer: {
            PrimaryButton(model.store.hasSafetyPIN ? "Change my PINs" : "Create my safety PIN", systemImage: "lock.fill") {
                phase = .safety
            }
            if model.store.hasSafetyPIN {
                PrimaryButton("Keep my current PINs", role: .quiet, action: next)
            }
        }
    }

    private var safetyPage: some View {
        pinPage(eyebrow: "Safety PIN") {
            PINCreator(title: "Create your safety PIN", subtitle: "You'll enter it to cancel an alert or end a session.",
                       tint: SSColor.calm,
                       validate: { PINRules.validateSafety($0, store: model.store) }) { pin in
                model.store.setSafetyPIN(pin)
                phase = .duress
            }
        }
    }

    private var duressPage: some View {
        pinPage(eyebrow: "Duress PIN", showsSkip: true) {
            PINCreator(title: "Create a duress PIN", subtitle: "Different from your safety PIN. Use it only if someone is making you cancel.",
                       tint: SSColor.accent,
                       validate: { PINRules.validateDuress($0, store: model.store) }) { pin in
                model.store.setDuressPIN(pin)
                phase = .done
            }
        }
    }

    private var donePage: some View {
        let hasDuress = model.store.hasDuressPIN
        return OnboardingPage(eyebrow: "Step 7", title: "PINs set") {
            SetupRow(systemImage: "lock.fill", title: "Safety PIN", detail: "Cancels an alert.", done: true) { EmptyView() }
            SetupRow(systemImage: "lock.trianglebadge.exclamationmark", title: "Duress PIN",
                     detail: hasDuress ? "Looks like a cancel. Help still comes." : "Not set. You can add one in Settings.",
                     done: hasDuress, tint: SSColor.warn) { EmptyView() }
        } footer: {
            PrimaryButton("Continue", systemImage: "arrow.right", action: next)
        }
    }

    private func pinPage<Content: View>(eyebrow: String, showsSkip: Bool = false, @ViewBuilder content: () -> Content) -> some View {
        VStack(spacing: SSSpacing.lg) {
            HStack {
                Text(eyebrow).ssEyebrow(SSColor.accent)
                Spacer()
                if showsSkip {
                    Button("Skip for now") { phase = .done }
                        .font(SSFont.callout.weight(.semibold))
                        .foregroundStyle(SSColor.inkMuted)
                        .frame(minHeight: 44)
                }
            }
            Spacer(minLength: 0)
            content()
            Spacer(minLength: 0)
        }
        .padding(.horizontal, SSSpacing.gutter)
        .padding(.bottom, SSSpacing.md)
    }
}

// MARK: 8. Responder profile (optional)

struct ResponderStepView: View {
    var next: () -> Void

    var body: some View {
        OnboardingPage(eyebrow: "Step 8 · Optional", title: "Help responders find you",
                       subtitle: "If an alert reaches professional dispatch, this helps them recognize you and care for you. Fill in as much or as little as you like.") {
            ResponderProfileForm()
        } footer: {
            PrimaryButton("Continue", systemImage: "arrow.right", action: next)
        }
    }
}

// MARK: 9. Practice drill

struct DrillStepView: View {
    @Environment(AppModel.self) private var model
    var finish: () -> Void

    enum Phase: Equatable { case ready, running, result, finished }
    @State private var phase: Phase = .ready
    @State private var record: AlertRecord?
    @State private var events: [AlertEvent] = []
    @State private var failed = false

    var body: some View {
        switch phase {
        case .ready, .running:
            OnboardingPage(eyebrow: "Step 9", title: "Try a practice drill",
                           subtitle: "We'll send a TEST alert through SafetySense's server, exactly like a real one, except nobody is called and dispatch is never involved.") {
                DrillDiagram(running: phase == .running)
                Card {
                    VStack(alignment: .leading, spacing: SSSpacing.xs) {
                        Label("Marked TEST from start to finish", systemImage: "testtube.2")
                        Label("No calls, texts or dispatch", systemImage: "phone.down")
                        Label("Takes about five seconds", systemImage: "timer")
                    }
                    .font(SSFont.callout)
                    .labelStyle(TipLabelStyle())
                }
            } footer: {
                PrimaryButton(phase == .running ? "Sending TEST alert…" : "Run the drill", systemImage: "play.fill",
                              isLoading: phase == .running) {
                    Task { await runDrill() }
                }
                PrimaryButton("Skip for now", role: .quiet) { phase = .finished }
                    .disabled(phase == .running)
            }
            .transition(.opacity)
        case .result:
            OnboardingPage(eyebrow: "Drill complete", title: failed ? "We couldn't reach the server" : "It works",
                           subtitle: failed ? "Your setup is saved on your phone. You can run the drill again from Settings once you're online."
                                            : "Here's what happened on the server. In a real alert, these people would be called and texted.") {
                if let record, !failed { DrillResultCard(record: record, events: events) }
            } footer: {
                PrimaryButton("Finish", systemImage: "arrow.right") {
                    endDrillOnServer()
                    phase = .finished
                }
                if failed {
                    PrimaryButton("Try again", role: .secondary) { Task { await runDrill() } }
                }
            }
            .transition(.opacity)
        case .finished:
            YoureSetView(finish: finish).transition(.scale(scale: 0.96).combined(with: .opacity))
        }
    }

    /// Closes the TEST alert on the server once the person is done looking at it, so the
    /// watchdog never escalates the drill into a (simulated) dispatch and the contact page
    /// reads "marked safe" instead of "help requested".
    private func endDrillOnServer() {
        guard let id = record?.serverAlertID else { return }
        let backend = model.services.backend
        Task { _ = try? await backend.cancelAlert(AlertCancelRequest(alertId: id, duress: false)) }
    }

    private func runDrill() async {
        endDrillOnServer()
        withAnimation(.smooth) { phase = .running }
        failed = false
        let started = Date.now
        if model.store.deviceCredentials == nil { await model.syncRegistration() }
        model.lastDrill = nil
        await model.runDrill()
        // Give the escalation controller a moment to report the drill record.
        var waited = 0
        while model.lastDrill == nil, waited < 30 {
            try? await Task.sleep(for: .milliseconds(100))
            waited += 1
        }
        let drill = model.lastDrill
        record = drill
        failed = drill?.serverAlertID == nil
        events = []
        if let id = drill?.serverAlertID,
           let status = try? await model.services.backend.alertStatus(AlertStatusRequest(alertId: id)) {
            events = status.events.map {
                AlertEvent(who: $0.who, action: $0.action, at: BackendCoding.date(from: $0.at) ?? .now)
            }
        }
        // Let the animation finish even on a fast network.
        let elapsed = Date.now.timeIntervalSince(started)
        if elapsed < 2.4 { try? await Task.sleep(for: .seconds(2.4 - elapsed)) }
        withAnimation(.smooth) { phase = .result }
    }
}

/// You -> SafetySense -> your contacts, with a packet travelling along while running.
private struct DrillDiagram: View {
    var running: Bool

    var body: some View {
        TimelineView(.animation(paused: !running)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            let p = running ? (t / 1.6).truncatingRemainder(dividingBy: 1) : 0
            HStack(spacing: 0) {
                node("iphone", "You", active: running && p < 0.33)
                link(progress: running ? min(1, p * 2) : 0)
                node("shield.lefthalf.filled", "Server", active: running && p >= 0.33 && p < 0.66)
                link(progress: running ? max(0, p * 2 - 1) : 0)
                node("person.2.fill", "Contacts", active: running && p >= 0.66)
            }
        }
        .padding(.vertical, SSSpacing.md)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(running ? "Sending a test alert from your phone to the SafetySense server" : "Your phone, the SafetySense server, your contacts")
    }

    private func node(_ icon: String, _ label: String, active: Bool) -> some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .font(.title2.weight(.semibold))
                .foregroundStyle(active ? SSColor.onFill : SSColor.accent)
                .frame(width: 60, height: 60)
                .background(active ? SSColor.accent : SSColor.accentSoft, in: Circle())
                .scaleEffect(active ? 1.08 : 1)
                .animation(.spring(duration: 0.3), value: active)
            Text(label).font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
        }
    }

    private func link(progress: Double) -> some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(SSColor.line).frame(height: 3)
                Capsule().fill(SSColor.accent).frame(width: geo.size.width * progress, height: 3)
            }
            .frame(maxHeight: .infinity)
        }
        .frame(height: 60)
        .padding(.bottom, 22)
    }
}

private struct DrillResultCard: View {
    let record: AlertRecord
    let events: [AlertEvent]

    /// Server rows for a drill are always dry runs: say so instead of "call placed".
    static func drillText(_ e: AlertEvent) -> String {
        switch e.action {
        case "call_placed": "TEST call logged, nobody was called"
        case "text_sent": "TEST text logged, nothing was sent"
        default: e.displayText
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: SSSpacing.md) {
            Card(tint: SSColor.calm) {
                HStack(spacing: SSSpacing.sm) {
                    Image(systemName: "checkmark.circle.fill").font(.title).foregroundStyle(SSColor.calm)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("TEST alert received").font(SSFont.headline)
                        Text("Server reference \(record.serverAlertID?.prefix(8) ?? "")").font(SSFont.mono(12)).foregroundStyle(SSColor.inkMuted)
                    }
                }
            }
            if !record.notified.isEmpty {
                SectionHeader("Would be notified")
                Card {
                    VStack(spacing: SSSpacing.sm) {
                        ForEach(record.notified, id: \.self) { n in
                            HStack {
                                Image(systemName: n.channel == .call ? "phone.fill" : "message.fill")
                                    .foregroundStyle(SSColor.accent).frame(width: 24)
                                Text(n.name).font(SSFont.callout.weight(.semibold))
                                Spacer()
                                StatusPill(text: "Test · not sent", tint: SSColor.inkMuted)
                            }
                            .accessibilityElement(children: .combine)
                        }
                    }
                }
            }
            if !events.isEmpty {
                SectionHeader("Server timeline")
                Card {
                    VStack(alignment: .leading, spacing: SSSpacing.xs) {
                        ForEach(events) { e in
                            HStack(alignment: .firstTextBaseline) {
                                Text(e.at.formatted(date: .omitted, time: .standard)).font(SSFont.mono(12)).foregroundStyle(SSColor.inkMuted)
                                Text(Self.drillText(e)).font(SSFont.callout)
                            }
                        }
                    }
                }
            }
            if let url = record.shareURL {
                Link(destination: url) {
                    Label("See what your contacts would see", systemImage: "safari")
                        .font(SSFont.callout.weight(.semibold))
                        .frame(minHeight: 44)
                }
                .foregroundStyle(SSColor.accent)
            }
        }
    }
}

/// "You're set." finale.
private struct YoureSetView: View {
    @Environment(AppModel.self) private var model
    var finish: () -> Void
    @State private var appeared = false

    var body: some View {
        VStack(spacing: SSSpacing.lg) {
            Spacer()
            ShieldHero(size: 200, celebrating: appeared)
            VStack(spacing: SSSpacing.sm) {
                Text("You're set.").font(SSFont.hero).accessibilityAddTraits(.isHeader)
                Text(summary)
                    .font(SSFont.callout).foregroundStyle(SSColor.inkMuted).multilineTextAlignment(.center)
            }
            .opacity(appeared ? 1 : 0)
            .offset(y: appeared ? 0 : 12)
            Spacer()
            PrimaryButton("Go to SafetySense", systemImage: "shield.lefthalf.filled", action: finish)
            Text("SafetySense supplements 911. If you're in danger right now, call 911.")
                .font(SSFont.caption).foregroundStyle(SSColor.inkMuted).multilineTextAlignment(.center)
                .padding(.bottom, SSSpacing.sm)
        }
        .padding(.horizontal, SSSpacing.gutter)
        .frame(maxWidth: .infinity)
        .sensoryFeedback(.success, trigger: appeared)
        .onAppear { withAnimation(.smooth(duration: 0.8).delay(0.2)) { appeared = true } }
    }

    private var summary: String {
        let names = model.contacts.map(\.firstName)
        let who = switch names.count {
        case 0: "your contacts"
        case 1: names[0]
        case 2: "\(names[0]) and \(names[1])"
        default: "\(names.dropLast().joined(separator: ", ")) and \(names.last!)"
        }
        return "Start a Guard session when you head out. If something's wrong and you can't reach your phone, \(who) will hear from SafetySense."
    }
}

#Preview("PIN") {
    PINStepView {}.background(SSColor.background).foregroundStyle(SSColor.ink)
        .environment(AppModel.preview(screen: .onboarding)).preferredColorScheme(.dark)
}

#Preview("Responder") {
    ResponderStepView {}.background(SSColor.background).foregroundStyle(SSColor.ink)
        .environment(AppModel.preview(screen: .onboarding)).preferredColorScheme(.dark)
}

#Preview("Drill") {
    DrillStepView {}.background(SSColor.background).foregroundStyle(SSColor.ink)
        .environment(AppModel.preview(screen: .onboarding)).preferredColorScheme(.dark)
}
