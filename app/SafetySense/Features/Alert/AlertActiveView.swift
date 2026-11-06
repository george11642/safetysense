import MapKit
import SwiftUI

/// Alert active (SPEC 9.6, level 3): live map, contacts' responses polled from `alert/status`,
/// dispatch status (always labelled "simulated" when it is), the evidence indicator and
/// a fixed dock with "I'm safe now" and "Call 911".
struct AlertActiveView: View {
    @Environment(AppModel.self) private var model
    @State private var camera: MapCameraPosition = .automatic
    @State private var fix: LocationFix?
    @State private var remoteEvents: [AlertEvent] = []
    @State private var remoteDispatch: DispatchInfo?
    @State private var lastPoll: Date?
    @State private var pollFailed = false
    @State private var capturing = false
    @State private var showPIN = false
    @State private var newResponse = 0
    @State private var confirmNoPINCancel = false
    @State private var authFailed = 0

    private var alert: AlertRecord? { model.services.escalation.activeAlert ?? model.currentAlert }
    private var events: [AlertEvent] { AlertPresentation.merge(alert?.events ?? [], remoteEvents) }
    private var dispatch: DispatchInfo? { remoteDispatch ?? alert?.dispatch }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SSSpacing.md) {
                header
                if let note = model.alertConnectionNote { ServerFallbackCard(note: note) }
                if let banner = model.banner { NoticeCard(text: banner, systemImage: "wifi.exclamationmark") }
                map
                EvidenceIndicator(isCapturing: capturing)
                dispatchCard
                responsesCard
                timelineCard
                if model.services.flavor == .demo { demoControls }
            }
            .padding(.top, SSSpacing.sm)
            .padding(.bottom, SSSpacing.md)
        }
        .scrollIndicators(.hidden)
        // Fixed, side by side, so neither needs a scroll in an emergency.
        .safeAreaInset(edge: .bottom, spacing: 0) { safeDock }
        .ssScreen()
        .sensoryFeedback(.success, trigger: newResponse)
        .sensoryFeedback(.error, trigger: authFailed)
        .task(id: alert?.id) { await run() }
        .sheet(isPresented: $showPIN) {
            PINEntrySheet(title: "I'm safe now",
                          message: "Enter your safety PIN. The monitoring center may still call to confirm you're okay.",
                          tint: SSColor.calm,
                          // Safety and duress both land on Marked safe; the model handles it.
                          verify: { await model.cancelAlert(pin: $0) },
                          onResult: { _ in })
        }
        .confirmationDialog("Cancel this alert?", isPresented: $confirmNoPINCancel, titleVisibility: .visible) {
            Button("Cancel the alert", role: .destructive) { Task { await model.cancelAlertWithoutPIN() } }
            Button("Keep the alert", role: .cancel) {}
        } message: {
            Text("This iPhone has no safety PIN, Face ID or passcode set.")
        }
    }

    // MARK: Sections

    private var header: some View {
        VStack(alignment: .leading, spacing: SSSpacing.xs) {
            HStack {
                StatusPill(text: "Dispatch active", tint: SSColor.danger, pulsing: true)
                if let mode = model.currentSession?.mode, mode != .everyday {
                    TagChip(text: mode.displayName, isOn: false)
                }
                Spacer(minLength: SSSpacing.xs)
                TimelineView(.everyMinute) { context in
                    Text(MarkedSafeSummary.clock(context.date))
                        .font(SSFont.mono(13, weight: .semibold)).foregroundStyle(SSColor.inkMuted)
                }
            }
            Text("Help is on the way").font(SSFont.display)
            Text("You're not alone. Stay where you are if it's safe, or move somewhere public.")
                .font(SSFont.callout).foregroundStyle(SSColor.inkMuted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
    }

    private var map: some View {
        let current = fix ?? .unmCampus
        let coordinate = CLLocationCoordinate2D(latitude: current.latitude, longitude: current.longitude)
        return Map(position: $camera, interactionModes: [.pan, .zoom]) {
            MapCircle(center: coordinate, radius: max(15, current.accuracy))
                .foregroundStyle(SSColor.accent.opacity(0.18))
                .stroke(SSColor.accent.opacity(0.5), lineWidth: 1)
            Annotation("You", coordinate: coordinate, anchor: .center) {
                LocationPulse()
            }
        }
        .mapStyle(.standard(elevation: .flat, pointsOfInterest: .excludingAll))
        .mapControls { MapCompass() }
        .frame(height: 220)
        .clipShape(RoundedRectangle(cornerRadius: SSRadius.card, style: .continuous))
        .overlay(alignment: .topLeading) {
            Label(fix == nil ? "Finding your location…" : "Shared live with your contacts",
                  systemImage: "location.fill")
                .font(SSFont.caption.weight(.semibold))
                .padding(.horizontal, 10).padding(.vertical, 6)
                .background(.ultraThinMaterial, in: Capsule())
                .padding(SSSpacing.sm)
        }
        .overlay(RoundedRectangle(cornerRadius: SSRadius.card, style: .continuous).stroke(SSColor.line, lineWidth: 1))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(fix == nil ? "Map. Finding your location." : "Map showing your live location, shared with your contacts.")
    }

    private var dispatchCard: some View {
        Card(tint: SSColor.danger) {
            HStack(alignment: .top, spacing: SSSpacing.sm) {
                Image(systemName: "shield.lefthalf.filled")
                    .font(.title2)
                    .foregroundStyle(SSColor.danger)
                    .symbolEffect(.pulse, options: .repeating)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Monitoring center").font(SSFont.headline)
                    if let dispatch {
                        Text(dispatch.displayStatus.prefix(1).uppercased() + dispatch.displayStatus.dropFirst())
                            .font(SSFont.callout)
                        if dispatch.provider == .simulated {
                            Text("Demo mode: no real responders are contacted.")
                                .font(SSFont.caption).foregroundStyle(SSColor.warn)
                        } else {
                            Text("Noonlight sandbox: test dispatch, no real responders.")
                                .font(SSFont.caption).foregroundStyle(SSColor.warn)
                        }
                    } else {
                        Text("Connecting to dispatch…").font(SSFont.callout).foregroundStyle(SSColor.inkMuted)
                    }
                    Text("Answer if they call. They'll confirm you're okay before sending police.")
                        .font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .accessibilityElement(children: .combine)
        }
    }

    private var responsesCard: some View {
        VStack(alignment: .leading, spacing: SSSpacing.sm) {
            SectionHeader("Your people") {
                if let shareURL = alert?.shareURL {
                    ShareLink(item: shareURL) { Label("Share link", systemImage: "square.and.arrow.up") }
                        .frame(minHeight: 44)
                }
            }
            Card {
                VStack(spacing: SSSpacing.xs) {
                    let people = AlertPresentation.people(alert?.notified ?? [])
                    if people.isEmpty {
                        Text("Reaching \(NameList.join(model.contacts.map(\.firstName)))…")
                            .font(SSFont.callout).foregroundStyle(SSColor.inkMuted)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    ForEach(people) { person in NotifiedContactRow(person: person, events: events) }
                }
            }
        }
    }

    private var timelineCard: some View {
        let rows = Array(AlertPresentation.timeline(events, isTest: AlertPresentation.isTest(alert)).reversed())
        return VStack(alignment: .leading, spacing: SSSpacing.sm) {
            SectionHeader("What's happening", subtitle: pollSubtitle)
            Card {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                        HStack(alignment: .top, spacing: SSSpacing.sm) {
                            VStack(spacing: 0) {
                                Image(systemName: row.systemImage)
                                    .font(.footnote.weight(.semibold))
                                    .foregroundStyle(row.tint)
                                    .frame(width: 28, height: 28)
                                    .background(row.tint.opacity(0.16), in: Circle())
                                if index < rows.count - 1 {
                                    Rectangle().fill(SSColor.line).frame(width: 2).frame(minHeight: 14)
                                }
                            }
                            .accessibilityHidden(true)
                            Text(row.text).font(SSFont.body)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.top, 4)
                            Text(row.at, format: .dateTime.hour().minute().second())
                                .font(SSFont.mono(12)).foregroundStyle(SSColor.inkMuted)
                                .padding(.top, 6)
                        }
                        .accessibilityElement(children: .combine)
                        .transition(.move(edge: .top).combined(with: .opacity))
                    }
                }
                .animation(.smooth, value: rows.count)
            }
        }
    }

    private var pollSubtitle: String? {
        if pollFailed { return "Reconnecting… your contacts are still being reached." }
        guard let lastPoll else { return nil }
        return "Updated \(lastPoll.formatted(.dateTime.hour().minute().second()))"
    }

    private var safeDock: some View {
        HStack(spacing: SSSpacing.xs) {
            PrimaryButton("I'm safe now", systemImage: "checkmark", role: .calm) {
                if model.store.hasSafetyPIN { showPIN = true } else { cancelWithoutPIN() }
            }
            if let url = PhoneLink.url("911") {
                Link(destination: url) {
                    Text("Call 911")
                        .font(SSFont.headline)
                        .frame(maxWidth: .infinity, minHeight: 56)
                        .foregroundStyle(SSColor.onFill)
                        .background(SSColor.danger, in: RoundedRectangle(cornerRadius: SSRadius.button, style: .continuous))
                }
            }
        }
        .padding(.top, SSSpacing.sm)
        .padding(.bottom, SSSpacing.xs)
        .background(alignment: .top) {
            LinearGradient(stops: [.init(color: SSColor.background.opacity(0), location: 0),
                                   .init(color: SSColor.background, location: 0.3)],
                           startPoint: .top, endPoint: .bottom)
                .padding(.top, -SSSpacing.lg)
                .padding(.horizontal, -SSSpacing.gutter)
                .ignoresSafeArea(edges: .bottom)
                .allowsHitTesting(false)
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

    private var demoControls: some View {
        Card(tint: SSColor.warn) {
            VStack(alignment: .leading, spacing: SSSpacing.sm) {
                Text("Demo build · simulate a contact").ssEyebrow(SSColor.warn)
                FlowRow(spacing: SSSpacing.xs) {
                    Chip(title: "On the way", systemImage: "figure.walk", tint: SSColor.warn) { simulateResponse("on_my_way") }
                    Chip(title: "Called 911", systemImage: "phone", tint: SSColor.warn) { simulateResponse("called_911") }
                }
            }
        }
    }

    private func simulateResponse(_ action: String) {
        guard let alert, let name = model.contacts.first?.firstName else { return }
        withAnimation(.smooth) { remoteEvents.append(AlertEvent(who: name, action: action, at: .now)) }
        newResponse += 1
        model.noteResponses(alertID: alert.id, events: events)
    }

    // MARK: Live updates

    /// Polls `alert/status` every 4 s and the location every 2 s while the screen is up.
    private func run() async {
        if let alert { await model.ensureEvidenceCapture(for: alert) }
        var tick = 0
        while !Task.isCancelled {
            capturing = model.services.vault.isRecordingEvidence
            if let latest = model.services.location.lastFix, latest != fix {
                withAnimation(.smooth) {
                    fix = latest
                    camera = .region(MKCoordinateRegion(
                        center: CLLocationCoordinate2D(latitude: latest.latitude, longitude: latest.longitude),
                        latitudinalMeters: 700, longitudinalMeters: 700))
                }
            }
            if tick % 2 == 0 { await poll() }
            tick += 1
            try? await Task.sleep(for: .seconds(2))
        }
    }

    private func poll() async {
        guard let id = alert?.serverAlertID else { return }
        do {
            let status = try await model.services.backend.alertStatus(AlertStatusRequest(alertId: id))
            let incoming = status.events.map(\.model)
            let before = AlertPresentation.merge(alert?.events ?? [], remoteEvents)
            let after = AlertPresentation.merge(before, incoming)
            if after.count > before.count,
               after.contains(where: { ["on_my_way", "called_911"].contains($0.action) && !before.contains($0) }) {
                newResponse += 1
            }
            if let alert { model.noteResponses(alertID: alert.id, events: after) }
            withAnimation(.smooth) {
                remoteEvents = AlertPresentation.merge(remoteEvents, incoming)
                if let d = status.dispatch { remoteDispatch = d.model }
            }
            lastPoll = .now
            pollFailed = false
        } catch {
            // Sample / demo alerts aren't on the server; keep the local timeline.
            pollFailed = model.services.flavor == .live
        }
    }
}

/// Pulsing pink location dot (matches the share page and visual identity).
struct LocationPulse: View {
    @State private var animate = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            Circle().fill(SSColor.accent.opacity(0.3))
                .frame(width: 44, height: 44)
                .scaleEffect(animate ? 1.2 : 0.5)
                .opacity(animate ? 0 : 0.8)
            Circle().fill(SSColor.accent).frame(width: 16, height: 16)
                .overlay(Circle().stroke(.white, lineWidth: 2.5))
                .shadow(color: SSColor.accent.opacity(0.6), radius: 6)
        }
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeOut(duration: 1.6).repeatForever(autoreverses: false)) { animate = true }
        }
    }
}

#Preview { AlertActiveView().environment(AppModel.preview(screen: .alertActive)) }
