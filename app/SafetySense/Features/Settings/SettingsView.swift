import SwiftUI

/// Settings tab (SPEC 9.11): sensitivity, check-ins, safe word, PINs, who gets help first,
/// discreet icon, data retention, delete everything, and a developer section.
struct SettingsView: View {
    @Environment(AppModel.self) private var model

    @State private var discreetIcon = false
    @State private var iconError: String?
    @State private var confirmErase = false
    @State private var erasePINPrompt = false
    @State private var erasing = false
    @State private var drillRunning = false
    @State private var drillNote: String?
    @State private var safeWordSet = false

    static let retentionChoices = [7, 14, 30, 90, 365]

    var body: some View {
        @Bindable var model = model
        List {
            // Same eyebrow + display title header as the other tabs.
            VStack(alignment: .leading, spacing: SSSpacing.xs) {
                Text("Private to this iPhone").ssEyebrow(SSColor.accent)
                Text("Settings").font(SSFont.display).accessibilityAddTraits(.isHeader)
            }
            .padding(.top, SSSpacing.md)
            .listRowInsets(EdgeInsets(top: 0, leading: SSSpacing.gutter - 16, bottom: 0, trailing: 0))
            .listRowBackground(Color.clear)
            .listRowSeparator(.hidden)

            Section {
                NavigationLink { ProfileSettingsView() } label: {
                    HStack(spacing: SSSpacing.sm) {
                        Initials(name: model.profile?.name ?? "", highlighted: true, size: 40)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(model.profile.map(\.name).flatMap { $0.isEmpty ? nil : $0 } ?? "Your profile").font(SSFont.headline)
                            Text("\(model.profile?.campus.displayName ?? "No campus") · responder profile")
                                .font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
                        }
                    }
                }
            }
            .listRowBackground(SSColor.surface)

            Section {
                VStack(alignment: .leading, spacing: SSSpacing.sm) {
                    Picker("Sensitivity", selection: $model.settings.sensitivity) {
                        ForEach(Sensitivity.allCases) { Text($0.displayName).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    Text(model.settings.sensitivity.explanation)
                        .font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
                        .contentTransition(.opacity)
                }
                .padding(.vertical, SSSpacing.xxs)
                NavigationLink { CheckInIntervalsView() } label: {
                    settingRow("Check-ins", value: checkInSummary, icon: "clock")
                }
                Toggle(isOn: $model.settings.useSecondOpinion) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("On-device AI second opinion")
                        Text("Helps tell friends joking from real distress. Never the only reason for an alert, never blocks an SOS.")
                            .font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
                    }
                }
            } header: {
                Text("Detection")
            }
            .listRowBackground(SSColor.surface)

            Section {
                NavigationLink { SafeWordSettingsView() } label: {
                    settingRow("Safe word", value: safeWordSet ? "Set" : "Not set", icon: "waveform")
                }
                NavigationLink {
                    guide { ActionButtonGuide { model.settings.hasSetUpActionButton = true } }
                        .navigationTitle("Action Button")
                } label: {
                    settingRow("Action Button", value: model.settings.hasSetUpActionButton ? "Set up" : "Not set up",
                               icon: "button.vertical.left.press")
                }
                NavigationLink {
                    guide { LockScreenControlGuide { model.settings.hasAddedControl = true } }
                        .navigationTitle("Lock Screen control")
                } label: {
                    settingRow("Lock Screen control", value: model.settings.hasAddedControl ? "Added" : "Not added", icon: "lock.iphone")
                }
            } header: {
                Text("Triggers")
            }
            .listRowBackground(SSColor.surface)

            Section {
                NavigationLink { DispatchPoliciesView() } label: {
                    settingRow("Who gets help first", value: model.settings.dispatchPolicies == .default ? "Default" : "Custom",
                               icon: "arrow.triangle.branch")
                }
            } footer: {
                Text("By default, your contacts hear first and a manual SOS goes straight to dispatch. Change it for each mode.")
            }
            .listRowBackground(SSColor.surface)

            Section {
                NavigationLink { PINSettingsView() } label: {
                    settingRow("Safety & duress PINs", value: model.store.hasSafetyPIN ? "Set" : "Not set", icon: "lock")
                }
                Toggle(isOn: $discreetIcon) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Discreet app icon")
                        Text(iconError ?? "Shows a plain \u{201C}Daylight\u{201D} sun icon on your Home Screen.")
                            .font(SSFont.caption).foregroundStyle(iconError == nil ? SSColor.inkMuted : SSColor.warn)
                    }
                }
                .disabled(!IconSwitcher.isSupported)
            } header: {
                Text("Privacy & security")
            }
            .listRowBackground(SSColor.surface)

            Section {
                Picker(selection: $model.settings.retentionDays) {
                    ForEach(Self.retentionChoices, id: \.self) { d in Text(retentionLabel(d)).tag(d) }
                } label: {
                    Label("Keep data for", systemImage: "calendar.badge.clock")
                }
                Button(role: .destructive) { confirmErase = true } label: {
                    HStack {
                        Label("Delete everything", systemImage: "trash")
                        Spacer()
                        if erasing { ProgressView() }
                    }
                }
                .disabled(erasing)
            } header: {
                Text("Your data")
            } footer: {
                Text("Evidence on this iPhone is deleted automatically after this many days. Location is kept only during a session or alert. Evidence is encrypted, and only you can unlock it. Delete everything removes your profile, contacts, PINs, safe word and evidence from this iPhone, and erases this iPhone's alerts, locations and uploaded evidence on the SafetySense server.")
            }
            .listRowBackground(SSColor.surface)

            Section {
                Button {
                    Task { await runDrill() }
                } label: {
                    HStack {
                        Label("Run a practice drill", systemImage: "testtube.2")
                        Spacer()
                        if drillRunning { ProgressView() }
                    }
                }
                .disabled(drillRunning || model.escalationLevel != .guarding)
                if let drillNote {
                    Text(drillNote).font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
                }
            } footer: {
                Text("Sends a TEST alert through the server. Nobody is called and dispatch is never involved.")
            }
            .listRowBackground(SSColor.surface)

            Section {
                #if DEBUG
                NavigationLink { DeveloperSettingsView() } label: {
                    settingRow("Developer", value: model.services.flavor == .demo ? "Demo" : "Live", icon: "hammer")
                }
                #endif
            } footer: {
                VStack(alignment: .leading, spacing: SSSpacing.xs) {
                    Text("SafetySense supplements 911 and never replaces it. If you're in danger right now, call 911.")
                    Text("Version \(Self.version)").font(SSFont.mono(11))
                }
                .padding(.top, SSSpacing.xs)
            }
            .listRowBackground(SSColor.surface)
        }
        .scrollContentBackground(.hidden)
        .background(SSColor.background)
        .navigationTitle("Settings")
        .toolbar(.hidden, for: .navigationBar)
        .overlay(alignment: .top) { StatusBarScrim() }
        .animation(.smooth, value: model.settings.sensitivity)
        .sensoryFeedback(.selection, trigger: model.settings.sensitivity)
        .onAppear {
            discreetIcon = model.settings.discreetIcon
            safeWordSet = model.store.safeWord != nil
        }
        .onChange(of: discreetIcon) { _, on in
            guard on != model.settings.discreetIcon else { return }
            Task {
                if await IconSwitcher.apply(discreet: on) {
                    iconError = nil
                    model.settings.discreetIcon = on
                } else {
                    iconError = "iOS didn't allow the icon change. Try again in a moment."
                    discreetIcon = model.settings.discreetIcon
                }
            }
        }
        .confirmationDialog("Delete everything?", isPresented: $confirmErase, titleVisibility: .visible) {
            Button("Delete everything", role: .destructive) {
                if model.store.hasSafetyPIN { erasePINPrompt = true } else { Task { await erase() } }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This ends any session and permanently removes your profile, contacts, PINs, safe word and saved evidence from this iPhone, and erases this iPhone's data on the SafetySense server. It can't be undone.")
        }
        .sheet(isPresented: $erasePINPrompt) {
            ErasePINSheet { Task { await erase() } }
        }
    }

    // MARK: Helpers

    static var version: String {
        let info = Bundle.main.infoDictionary
        let v = info?["CFBundleShortVersionString"] as? String ?? "1.0"
        let b = info?["CFBundleVersion"] as? String ?? "1"
        return "\(v) (\(b))"
    }

    private var checkInSummary: String {
        model.settings.checkInIntervalOverrides.isEmpty ? "Default" : "Custom"
    }

    private func retentionLabel(_ days: Int) -> String {
        switch days {
        case 365: "1 year"
        case 30: "30 days"
        default: "\(days) days"
        }
    }

    private func settingRow(_ title: String, value: String, icon: String) -> some View {
        HStack {
            Label(title, systemImage: icon)
            Spacer()
            Text(value).foregroundStyle(SSColor.inkMuted)
        }
        .accessibilityElement(children: .combine)
    }

    private func guide<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SSSpacing.lg) { content() }
                .padding(.vertical, SSSpacing.md)
        }
        .ssScreen()
        .navigationBarTitleDisplayMode(.inline)
    }

    private func runDrill() async {
        drillRunning = true
        drillNote = nil
        if model.store.deviceCredentials == nil { await model.syncRegistration() }
        model.lastDrill = nil
        await model.runDrill()
        var waited = 0
        while model.lastDrill == nil, waited < 30 {
            try? await Task.sleep(for: .milliseconds(100))
            waited += 1
        }
        if let drill = model.lastDrill, drill.serverAlertID != nil {
            let names = drill.notified.map(\.name).joined(separator: ", ")
            drillNote = names.isEmpty ? "TEST alert reached the server." : "TEST alert reached the server. It would have notified \(names)."
        } else {
            drillNote = "Couldn't reach the server. Your settings are still saved on this iPhone."
        }
        drillRunning = false
    }

    private func erase() async {
        erasing = true
        _ = await IconSwitcher.apply(discreet: false)
        ResponderPhotoStore.deleteAll()
        DeveloperSettings.reset()
        await model.eraseEverything()
        erasing = false
    }
}

/// Confirms "Delete everything" with the safety PIN so someone else holding the phone can't wipe evidence.
private struct ErasePINSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    var onConfirmed: () -> Void
    @State private var entry = ""
    @State private var error: String?
    @State private var shake = 0

    var body: some View {
        NavigationStack {
            VStack(spacing: SSSpacing.lg) {
                Spacer(minLength: 0)
                VStack(spacing: SSSpacing.xs) {
                    Text("Enter your safety PIN").font(SSFont.title)
                    Text(error ?? "To delete everything, confirm it's you.")
                        .font(SSFont.callout).foregroundStyle(error == nil ? SSColor.inkMuted : SSColor.warn)
                }
                PINPad(pin: $entry, tint: SSColor.danger) { pin in
                    if model.store.verifyPIN(pin) == .invalid {
                        error = "That PIN didn't work. Try again."
                        shake += 1
                    } else {
                        dismiss()
                        onConfirmed()
                    }
                }
                .modifier(ShakeEffect(shakes: CGFloat(shake)))
                .animation(.default, value: shake)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, SSSpacing.gutter)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(SSColor.background)
            .foregroundStyle(SSColor.ink)
            .sensoryFeedback(.error, trigger: shake)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        }
    }
}

#Preview { NavigationStack { SettingsView() }.environment(AppModel.preview(screen: .settings)) }
