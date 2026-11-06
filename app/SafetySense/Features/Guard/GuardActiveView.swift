import SwiftUI

/// Guard active (SPEC 9.3): calm status with elapsed time, next check-in, what's on,
/// a live explainable risk meter (or the sealed card on Date and Ride) and an End control
/// behind Face ID / PIN, all worded for the mode.
struct GuardActiveView: View {
    @Environment(AppModel.self) private var model
    @State private var assessment: RiskAssessment = .calm
    @State private var showPIN = false
    @State private var confirmEnd = false
    @State private var isEnding = false
    @State private var authFailed = 0
    @State private var showFakeCall = false
    @State private var showSealed = false
    @State private var headsUp: ContactMessageDraft?
    @State private var heartbeatFailing = false

    private var session: GuardSession? { model.currentSession }
    /// Night Out shows the sensor cells; Date, Walk and Ride use the smaller chips.
    private var usesSensorCells: Bool { session?.mode == .nightOut || session?.mode == .everyday }
    /// Date and Ride show their sealed card where the Risk card goes.
    private var hasSealedCard: Bool { session?.sealedDate != nil || session?.ride != nil }

    var body: some View {
        ScrollView {
            VStack(spacing: SSSpacing.lg) {
                topBar
                if let banner = model.banner { NoticeCard(text: banner, systemImage: "wifi.exclamationmark") }
                PermissionNotices(issues: model.sessionPermissionIssues)
                if !model.store.hasSafetyPIN { noPINNotice }
                elapsedRing
                if model.hasArrived { arrivalCard }
                nextCheckInCard
                if usesSensorCells { sensors } else { sensorChips }
                if hasSealedCard { sealedCard } else { Card { RiskMeterView(assessment: assessment) } }
                endButton
                HoldToSOSButton(title: "Hold if you need help") {
                    model.triggerSOS(.manualSOS, reason: "SOS held during \(session?.mode.displayName ?? "Guard")")
                }
                if session?.followerName != nil { followerCard }
                contactsCard
                FakeCallEntryRow { showFakeCall = true }
                if model.services.flavor == .demo { demoControls }
                Text(model.alertDelivery.closingTheAppNote)
                    .font(SSFont.caption)
                    .foregroundStyle(SSColor.inkMuted)
                    .multilineTextAlignment(.center)
            }
            .padding(.top, SSSpacing.sm)
            .padding(.bottom, SSSpacing.xl)
        }
        .scrollIndicators(.hidden)
        .testModeBanner()
        .ssScreen()
        .sensoryFeedback(.error, trigger: authFailed)
        .task { await pollRisk() }
        .onAppear(perform: presentHeadsUpIfAsked)
        .onChange(of: model.wantsHeadsUp) { _, _ in presentHeadsUpIfAsked() }
        .sheet(isPresented: $showPIN) {
            PINEntrySheet(title: "End Guard", message: "Enter your safety PIN to stop guarding.",
                          verify: { model.store.verifyPIN($0) },
                          onResult: { result in finishEnd(duress: result == .duress) })
        }
        .sheet(isPresented: $showFakeCall) {
            NavigationStack { FakeCallSetupView() }.presentationDragIndicator(.visible)
        }
        .sheet(isPresented: $showSealed) {
            if let session { SealedDetailsSheet(session: session, contactNames: model.contacts.map(\.firstName)) }
        }
        .contactMessageSheet($headsUp) { _ in model.currentSession?.followerNotified = true }
        .confirmationDialog("End this Guard session?", isPresented: $confirmEnd, titleVisibility: .visible) {
            Button("End Guard", role: .destructive) { finishEnd(duress: false) }
            Button("Keep guarding", role: .cancel) {}
        } message: {
            Text("Set a safety PIN in Settings so only you can end a session.")
        }
    }

    private var noPINNotice: some View {
        NoticeCard(text: "No safety PIN yet. Face ID or your passcode will cancel an alert instead.",
                   systemImage: "lock.open")
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

    /// The test banner takes the height the ring gives back, so the End button stays on screen.
    private var ringSize: CGFloat { model.alertDelivery.bannerText == nil ? 220 : 190 }

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
            .frame(width: ringSize, height: ringSize)
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
        let labels = GuardCopy.nextCheckInLabels(session?.mode)
        return Card {
            VStack(spacing: SSSpacing.xs) {
                if let next = session?.nextCheckInAt {
                    InfoRow(title: labels.title, systemImage: "clock") {
                        Text(next, format: .dateTime.hour().minute())
                    }
                    InfoRow(title: labels.remaining, systemImage: "hourglass") {
                        Text(next, style: .relative).foregroundStyle(SSColor.inkMuted)
                    }
                } else {
                    InfoRow(title: "Check-ins", systemImage: "clock") {
                        Text("Only if something seems wrong").foregroundStyle(SSColor.inkMuted)
                    }
                }
                Text(GuardCopy.quietLine(session?.mode))
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

    /// What the microphone is really doing, from the audio guard and iOS.
    private var micState: (text: String, isOn: Bool, tint: Color) {
        guard session?.listening == true else { return ("Off", false, SSColor.accent) }
        if model.permissions.microphone == .denied { return ("No access", false, SSColor.warn) }
        switch model.listening {
        case .interrupted: return ("Paused", true, SSColor.warn)
        case .paused: return ("Stopped", true, SSColor.warn)
        case .listening, nil: return ("On-device", true, SSColor.accent)
        }
    }

    private var locationOn: Bool { model.permissions.location != .denied }
    private var motionOn: Bool { session?.mode.usesMotion == true }
    private var linked: Bool { session?.serverSessionID != nil && !heartbeatFailing }
    private var heartbeatState: String {
        guard session?.serverSessionID != nil else { return "Offline" }
        return heartbeatFailing ? "Retrying" : "Linked"
    }

    private var sensors: some View {
        let mic = micState
        return Card(padding: SSSpacing.sm) {
            HStack(spacing: 0) {
                SensorCell(title: "Mic", state: mic.text,
                           systemImage: mic.isOn && mic.tint == SSColor.accent ? "mic.fill" : "mic.slash",
                           isOn: mic.isOn, tint: mic.tint)
                SensorCell(title: "Location", state: locationOn ? "On" : "No access",
                           systemImage: locationOn ? "location.fill" : "location.slash", isOn: locationOn,
                           tint: locationOn ? SSColor.calm : SSColor.warn)
                SensorCell(title: "Motion", state: motionOn ? "On" : "Off", systemImage: "figure.walk.motion", isOn: motionOn)
                SensorCell(title: "Server", state: heartbeatState, systemImage: "waveform.path.ecg", isOn: linked)
            }
        }
    }

    private var sensorChips: some View {
        let mic = micState
        return FlowRow(spacing: SSSpacing.xs) {
            TagChip(text: "Mic · \(mic.text)", systemImage: mic.isOn ? "mic.fill" : "mic.slash", isOn: mic.isOn, tint: mic.tint)
            TagChip(text: locationOn ? "Location" : "Location · no access",
                    systemImage: locationOn ? "location.fill" : "location.slash", isOn: true,
                    tint: locationOn ? SSColor.calm : SSColor.warn)
            TagChip(text: "Motion", systemImage: "figure.walk.motion", isOn: motionOn)
            TagChip(text: linked ? "Heartbeat" : "Heartbeat · \(heartbeatState)", systemImage: "waveform.path.ecg", isOn: linked)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private var sealedCard: some View {
        Button { showSealed = true } label: {
            if let ride = session?.ride {
                Card {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Ride · \(ride.service.displayName)").ssEyebrow()
                        Text(GuardCopy.rideTitle(ride)).font(SSFont.headline)
                        Text(GuardCopy.rideDetail(ride)).font(SSFont.callout).foregroundStyle(SSColor.inkMuted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .multilineTextAlignment(.leading)
                }
            } else if let date = session?.sealedDate {
                Card(tint: SSColor.accent) {
                    VStack(alignment: .leading, spacing: 2) {
                        Label("Date details sealed", systemImage: "lock.fill").font(SSFont.headline)
                        Text(GuardCopy.dateDetail(date)).font(SSFont.callout).foregroundStyle(SSColor.inkMuted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .multilineTextAlignment(.leading)
                }
            }
        }
        .buttonStyle(.plain)
        .foregroundStyle(SSColor.ink)
        .accessibilityHint("Shows who can read these details")
    }

    /// Only says someone's following once the heads-up text went out: nobody gets a live view
    /// before an alert, so the screen mustn't suggest more than that.
    @ViewBuilder
    private var followerCard: some View {
        if let name = session?.followerName {
            if session?.followerNotified == true {
                Card {
                    Label("\(name) is following along", systemImage: "figure.walk")
                        .font(SSFont.headline).foregroundStyle(SSColor.calm)
                }
            } else {
                Button(action: draftHeadsUp) {
                    Card {
                        HStack(spacing: SSSpacing.sm) {
                            Label("Text \(name) a heads-up", systemImage: "message").font(SSFont.headline)
                            Spacer(minLength: 0)
                            Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(SSColor.inkMuted)
                                .accessibilityHidden(true)
                        }
                    }
                }
                .buttonStyle(.plain)
                .foregroundStyle(SSColor.ink)
            }
        }
    }

    private func presentHeadsUpIfAsked() {
        guard model.wantsHeadsUp else { return }
        model.wantsHeadsUp = false
        draftHeadsUp()
    }

    private func draftHeadsUp() {
        guard let session, let contact = model.contacts.first(where: { $0.id == session.followerID }) else { return }
        headsUp = ContactMessageDraft(contact: contact, kind: .headsUp,
                                      body: ContactMessage.headsUp(destination: session.destinationName ?? "",
                                                                   eta: session.nextCheckInAt ?? .now,
                                                                   delivery: model.alertDelivery))
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
                    Text(AlertPresentation.whoHears(model.contacts, delivery: model.alertDelivery))
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

    private var endButton: some View {
        let arrives = session?.usesArrivalCheck == true
        return PrimaryButton(GuardCopy.endTitle(session?.mode), systemImage: arrives ? "checkmark" : nil,
                             role: arrives ? .calm : .secondary, isLoading: isEnding) {
            Task { await requestEnd() }
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
        isEnding = true
        Task {
            if duress { await model.endGuardUnderDuress() } else { await model.endGuard() }
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
            let failing = model.services.heartbeat.isFailing
            if failing != heartbeatFailing { heartbeatFailing = failing }
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
#Preview("Guard · ride") {
    let model = AppModel.preview(screen: .guardActive)
    model.currentSession = SampleData.session(mode: .ride, startedMinutesAgo: 12)
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
