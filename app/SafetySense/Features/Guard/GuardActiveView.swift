import SwiftUI

/// Guard active (SPEC 9.3): calm status with elapsed time, next check-in, what's on,
/// a live explainable risk meter and an End session control behind Face ID / PIN.
struct GuardActiveView: View {
    @Environment(AppModel.self) private var model
    @State private var assessment: RiskAssessment = .calm
    @State private var showPIN = false
    @State private var confirmEnd = false
    @State private var isEnding = false
    @State private var authFailed = 0
    @State private var biometry = "Face ID"
    @State private var showFakeCall = false

    private var session: GuardSession? { model.currentSession }

    var body: some View {
        ScrollView {
            VStack(spacing: SSSpacing.lg) {
                topBar
                elapsedRing
                if model.hasArrived { arrivalCard }
                nextCheckInCard
                sensors
                Card { RiskMeterView(assessment: assessment) }
                if let sealed = sealedSummary { sealedCard(sealed) }
                contactsCard
                FakeCallEntryRow { showFakeCall = true }
                if model.services.flavor == .demo { demoControls }
                actions
            }
            .padding(.top, SSSpacing.sm)
            .padding(.bottom, SSSpacing.xl)
        }
        .scrollIndicators(.hidden)
        .ssScreen()
        .sensoryFeedback(.error, trigger: authFailed)
        .task { await pollRisk() }
        .onAppear { biometry = DeviceAuth.biometryName }
        .sheet(isPresented: $showPIN) {
            PINEntrySheet(title: "End session", message: "Enter your safety PIN to stop guarding.",
                          verify: { model.store.verifyPIN($0) },
                          onResult: { result in finishEnd(duress: result == .duress) })
        }
        .sheet(isPresented: $showFakeCall) {
            NavigationStack { FakeCallSetupView() }.presentationDragIndicator(.visible)
        }
        .confirmationDialog("End this Guard session?", isPresented: $confirmEnd, titleVisibility: .visible) {
            Button("End session", role: .destructive) { finishEnd(duress: false) }
            Button("Keep guarding", role: .cancel) {}
        } message: {
            Text("Set a safety PIN in Settings so only you can end a session.")
        }
    }

    // MARK: Header

    private var topBar: some View {
        HStack {
            StatusPill(text: "Guarding", tint: SSColor.calm, pulsing: true)
            Spacer()
            Label(session?.mode.displayName ?? "Guard", systemImage: session?.mode.systemImage ?? "shield")
                .font(SSFont.callout.weight(.semibold))
                .foregroundStyle(SSColor.inkMuted)
        }
    }

    private var elapsedRing: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            let start = session?.startedAt ?? context.date
            let elapsed = context.date.timeIntervalSince(start)
            GlowRing(progress: checkInProgress(at: context.date), tint: SSColor.calm, lineWidth: 16) {
                VStack(spacing: 4) {
                    Text(elapsed.clockText)
                        .font(SSFont.timer)
                        .contentTransition(.numericText(countsDown: false))
                        .minimumScaleFactor(0.6)
                        .lineLimit(1)
                    Text("elapsed").ssEyebrow()
                }
                .padding(SSSpacing.lg)
            }
            .frame(width: 220, height: 220)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Guarding for \(Duration.seconds(elapsed).formatted(.units(allowed: [.hours, .minutes], width: .wide)))")
        }
        .padding(.vertical, SSSpacing.xs)
    }

    /// Ring fills toward the next scheduled check-in; full when there's no schedule.
    private func checkInProgress(at now: Date) -> Double {
        guard let session, let next = session.nextCheckInAt, session.checkInInterval > 0 else { return 1 }
        let remaining = next.timeIntervalSince(now)
        return 1 - max(0, min(1, remaining / session.checkInInterval))
    }

    private var nextCheckInCard: some View {
        Card {
            VStack(spacing: SSSpacing.xs) {
                if let next = session?.nextCheckInAt {
                    InfoRow(title: session?.usesArrivalCheck == true ? "Arrival check" : "Next check-in", systemImage: "clock") {
                        Text(next, format: .dateTime.hour().minute())
                    }
                    InfoRow(title: session?.usesArrivalCheck == true ? "In" : "Time left", systemImage: "hourglass") {
                        Text(next, style: .relative).foregroundStyle(SSColor.inkMuted)
                    }
                } else {
                    InfoRow(title: "Check-ins", systemImage: "clock") {
                        Text("Only if something seems wrong").foregroundStyle(SSColor.inkMuted)
                    }
                }
                Text(EscalationLevel.guarding.statusLine)
                    .font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private var arrivalCard: some View {
        Card(tint: SSColor.calm) {
            Label(session?.destinationName.map { "You've reached \($0)." } ?? "Looks like you're there.",
                  systemImage: "mappin.circle.fill")
                .font(SSFont.headline)
                .foregroundStyle(SSColor.calm)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    /// What the Mic cell says, from what the microphone is really doing.
    private var micState: String {
        switch model.listening {
        case .interrupted: "Paused"
        case .paused: "Stopped"
        default: "On-device"
        }
    }

    private var sensors: some View {
        let listening = session?.listening == true
        let micWorking = model.listening == nil || model.listening == .listening
        let motion = session?.mode.usesMotion == true
        let linked = session?.serverSessionID != nil
        return Card(padding: SSSpacing.sm) {
            HStack(spacing: 0) {
                SensorCell(title: "Mic", state: listening ? micState : "Off",
                           systemImage: listening && micWorking ? "mic.fill" : "mic.slash", isOn: listening,
                           tint: micWorking ? SSColor.accent : SSColor.warn)
                SensorCell(title: "Location", state: "On", systemImage: "location.fill", isOn: true)
                SensorCell(title: "Motion", state: motion ? "On" : "Off", systemImage: "figure.walk.motion", isOn: motion)
                SensorCell(title: "Server", state: linked ? "Linked" : "Offline", systemImage: "waveform.path.ecg", isOn: linked)
            }
        }
    }

    private var sealedSummary: (icon: String, title: String, detail: String)? {
        if let d = session?.sealedDate {
            return ("lock.fill", "Date details sealed", "\(d.matchName) at \(d.venueName). Opened for your contacts only if an alert fires.")
        }
        if let r = session?.ride {
            return ("lock.fill", "Ride logged", "\(r.service.displayName) · \(r.plate). Shared only if an alert fires.")
        }
        return nil
    }

    private func sealedCard(_ s: (icon: String, title: String, detail: String)) -> some View {
        Card(tint: SSColor.accent) {
            HStack(alignment: .top, spacing: SSSpacing.sm) {
                Image(systemName: s.icon).foregroundStyle(SSColor.accent).accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(s.title).font(SSFont.headline)
                    Text(s.detail).font(SSFont.callout).foregroundStyle(SSColor.inkMuted)
                }
            }
            .accessibilityElement(children: .combine)
        }
    }

    private var contactsCard: some View {
        Card {
            HStack(alignment: .top, spacing: SSSpacing.sm) {
                Image(systemName: "person.2.fill")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(SSColor.accent)
                    .frame(width: 26)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text("If you need help").font(SSFont.headline)
                    Text("\(NameList.join(model.contacts.map(\.firstName))) \(model.contacts.count == 1 ? "gets" : "get") a call and your live location.")
                        .font(SSFont.callout).foregroundStyle(SSColor.inkMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 0)
            }
            .accessibilityElement(children: .combine)
        }
    }

    // MARK: Demo

    private var demoControls: some View {
        Card(tint: SSColor.warn) {
            VStack(alignment: .leading, spacing: SSSpacing.sm) {
                Text("Demo build · simulate a signal").ssEyebrow(SSColor.warn)
                FlowRow(spacing: SSSpacing.xs) {
                    demoChip("Shout", .shout, weight: 0.6)
                    demoChip("Scream", .scream, weight: 1.2)
                    demoChip("Impact", .impact, weight: 0.8)
                    demoChip("Stillness", .prolongedStillness, weight: 0.7)
                    demoChip("Safe word", .safeWord, weight: 3)
                    Chip(title: "Check in now", systemImage: "bell", tint: SSColor.warn) {
                        model.services.escalation.scheduledCheckInDue()
                    }
                }
            }
        }
    }

    private func demoChip(_ title: String, _ kind: RiskSignalKind, weight: Double) -> some View {
        Chip(title: title, systemImage: kind.source.systemImage, tint: SSColor.warn) {
            let signal = RiskSignal(kind: kind, weight: weight, detail: "Simulated in demo", confidence: 0.9)
            let result = model.services.risk.ingest(signal, at: .now)
            withAnimation(.smooth) { assessment = result }
            model.services.escalation.handle(result)
        }
    }

    // MARK: Actions

    private var actions: some View {
        VStack(spacing: SSSpacing.sm) {
            HoldToSOSButton(title: "Hold if you need help") {
                model.triggerSOS(.manualSOS, reason: "SOS held during \(session?.mode.displayName ?? "Guard")")
            }
            switch session?.mode {
            case .walk:
                PrimaryButton("I made it · End Guard", systemImage: "checkmark", role: .calm, isLoading: isEnding) {
                    Task { await requestEnd() }
                }
            case .ride:
                PrimaryButton("I've arrived · End Guard", systemImage: "checkmark", role: .calm, isLoading: isEnding) {
                    Task { await requestEnd() }
                }
            default:
                PrimaryButton("End session · \(biometry)", systemImage: biometry == "PIN" ? "lock" : "faceid", role: .secondary, isLoading: isEnding) {
                    Task { await requestEnd() }
                }
            }
        }
    }

    private func requestEnd() async {
        switch await DeviceAuth.authenticate(reason: "End your Guard session") {
        case .success:
            finishEnd(duress: false)
        case .failed:
            authFailed += 1
            if model.store.hasSafetyPIN { showPIN = true }
        case .unavailable:
            if model.store.hasSafetyPIN { showPIN = true } else { confirmEnd = true }
        }
    }

    /// Normal and duress ends look the same. Duress also raises a silent dispatch alert.
    private func finishEnd(duress: Bool) {
        if duress { SilentDuress.fire(model: model) }
        isEnding = true
        Task {
            await model.endGuard()
            isEnding = false
        }
    }

    // MARK: Risk polling

    /// Re-reads the decaying score every 2 s so the meter settles back down on its own.
    private func pollRisk() async {
        while !Task.isCancelled {
            let next = model.services.risk.evaluate(at: .now)
            if next.level != assessment.level || abs(next.score - assessment.score) > 0.01
                || next.contributors.map(\.id) != assessment.contributors.map(\.id) {
                withAnimation(.smooth) { assessment = next }
            }
            try? await Task.sleep(for: .seconds(2))
        }
    }
}

#Preview("Guard active") { GuardActiveView().environment(AppModel.preview(screen: .guardActive)) }
#Preview("Guard · date") {
    let model = AppModel.preview(screen: .guardActive)
    model.currentSession = SampleData.session(mode: .date, startedMinutesAgo: 12)
    return GuardActiveView().environment(model)
}

/// One column of the Guard screen's "what's on" strip: icon, name, state.
private struct SensorCell: View {
    let title: String
    let state: String
    let systemImage: String
    let isOn: Bool
    var tint: Color = SSColor.calm

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: systemImage)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(isOn ? tint : SSColor.inkMuted)
                .frame(width: 36, height: 36)
                .background((isOn ? tint.opacity(0.16) : SSColor.surfaceRaised), in: Circle())
            Text(title).font(SSFont.caption.weight(.semibold)).foregroundStyle(SSColor.ink)
            Text(state).font(SSFont.mono(11, weight: .medium)).textCase(.uppercase)
                .foregroundStyle(isOn ? tint : SSColor.inkMuted)
                .lineLimit(1).minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title), \(state)")
    }
}
