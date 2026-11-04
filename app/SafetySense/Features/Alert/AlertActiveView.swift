import MapKit
import SwiftUI

/// Alert active (SPEC 9.6, level 3): live map, contacts' responses polled from `alert/status`,
/// dispatch status (always labelled "simulated" when it is), the evidence indicator and
/// "I'm safe now".
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

    private var alert: AlertRecord? { model.services.escalation.activeAlert ?? model.currentAlert }
    private var events: [AlertEvent] { AlertPresentation.merge(alert?.events ?? [], remoteEvents) }
    private var dispatch: DispatchInfo? { remoteDispatch ?? alert?.dispatch }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SSSpacing.md) {
                header
                map
                EvidenceIndicator(isCapturing: capturing, since: alert?.startedAt ?? .now)
                dispatchCard
                responsesCard
                timelineCard
                actions
            }
            .padding(.top, SSSpacing.sm)
            .padding(.bottom, SSSpacing.xl)
        }
        .scrollIndicators(.hidden)
        .ssScreen()
        .sensoryFeedback(.success, trigger: newResponse)
        .task(id: alert?.id) { await run() }
        .sheet(isPresented: $showPIN) {
            PINEntrySheet(title: "I'm safe now",
                          message: "Enter your safety PIN. The monitoring center may still call to confirm you're okay.",
                          tint: SSColor.calm,
                          verify: { await model.cancelAlert(pin: $0) },
                          onResult: { _ in
                              // Same path for the safety and duress PINs.
                              Task { await model.finishAfterAlert() }
                          })
        }
    }

    // MARK: Sections

    private var header: some View {
        VStack(alignment: .leading, spacing: SSSpacing.xs) {
            HStack {
                StatusPill(text: "Dispatch active", tint: SSColor.danger, pulsing: true)
                Spacer()
                if let started = alert?.startedAt {
                    Text(started, style: .timer).font(SSFont.mono(13, weight: .semibold)).foregroundStyle(SSColor.inkMuted)
                        .accessibilityLabel("Alert running")
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
                    let notified = alert?.notified ?? []
                    if notified.isEmpty {
                        Text("Reaching \(NameList.join(model.contacts.map(\.firstName)))…")
                            .font(SSFont.callout).foregroundStyle(SSColor.inkMuted)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    ForEach(notified, id: \.self) { c in NotifiedContactRow(contact: c, events: events) }
                }
            }
        }
    }

    private var timelineCard: some View {
        VStack(alignment: .leading, spacing: SSSpacing.sm) {
            SectionHeader("What's happening", subtitle: pollSubtitle)
            Card {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(Array(events.reversed().enumerated()), id: \.element.id) { index, event in
                        let (icon, tint) = AlertPresentation.icon(for: event)
                        HStack(alignment: .top, spacing: SSSpacing.sm) {
                            VStack(spacing: 0) {
                                Image(systemName: icon)
                                    .font(.footnote.weight(.semibold))
                                    .foregroundStyle(tint)
                                    .frame(width: 28, height: 28)
                                    .background(tint.opacity(0.16), in: Circle())
                                if index < events.count - 1 {
                                    Rectangle().fill(SSColor.line).frame(width: 2).frame(minHeight: 14)
                                }
                            }
                            .accessibilityHidden(true)
                            Text(eventText(event)).font(SSFont.body)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.top, 4)
                            Text(event.at, format: .dateTime.hour().minute().second())
                                .font(SSFont.mono(12)).foregroundStyle(SSColor.inkMuted)
                                .padding(.top, 6)
                        }
                        .accessibilityElement(children: .combine)
                        .transition(.move(edge: .top).combined(with: .opacity))
                    }
                }
                .animation(.smooth, value: events.count)
            }
        }
    }

    private var pollSubtitle: String? {
        if pollFailed { return "Reconnecting… your contacts are still being reached." }
        guard let lastPoll else { return nil }
        return "Updated \(lastPoll.formatted(.dateTime.hour().minute().second()))"
    }

    /// Every contact came back "dry_run": the server logged the alert but called and texted nobody.
    private var isTestAlert: Bool {
        let notified = alert?.notified ?? []
        return !notified.isEmpty && notified.allSatisfy { $0.status == "dry_run" || $0.status == "test" }
    }

    private func eventText(_ event: AlertEvent) -> String {
        switch event.action {
        case "notified": isTestAlert ? "Test alert: your contacts were not contacted" : "Your contacts were called and texted"
        case "call_placed": isTestAlert ? "Test call logged, nobody was called" : "Automated calls placed to your contacts"
        case "text_sent": isTestAlert ? "Test text logged, nothing was sent" : "Texts sent with your live link"
        case "alert_started": "Alert started"
        case "dispatched", "escalated": "Professional dispatch started"
        default: event.displayText
        }
    }

    private var actions: some View {
        VStack(spacing: SSSpacing.sm) {
            PrimaryButton("I'm safe now", systemImage: "checkmark.shield", role: .calm) { showPIN = true }
            if let url = PhoneLink.url("911") {
                Link(destination: url) {
                    Label("Call 911", systemImage: "phone.fill")
                        .font(SSFont.headline)
                        .frame(maxWidth: .infinity, minHeight: 56)
                        .foregroundStyle(SSColor.danger)
                        .background(SSColor.dangerSoft, in: RoundedRectangle(cornerRadius: SSRadius.button, style: .continuous))
                }
            }
        }
        .padding(.top, SSSpacing.xs)
    }

    // MARK: Live updates

    /// Polls `alert/status` every 4 s and the location every 2 s while the screen is up.
    private func run() async {
        if let alert { await model.ensureEvidenceCapture(for: alert) }
        var tick = 0
        while !Task.isCancelled {
            capturing = model.services.vault.isCapturing
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
