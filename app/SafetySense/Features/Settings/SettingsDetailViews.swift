import SwiftUI

/// Shared look for Settings sub-pages.
private extension View {
    func settingsListStyle(_ title: String) -> some View {
        scrollContentBackground(.hidden)
            .background(SSColor.background)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: Check-in intervals

struct CheckInIntervalsView: View {
    @Environment(AppModel.self) private var model
    static let choices: [TimeInterval] = [10, 15, 20, 30, 45, 60, 90].map { $0 * 60 }

    var body: some View {
        @Bindable var model = model
        List {
            Section {
                ForEach(GuardMode.guardModes) { mode in
                    Picker(selection: binding(for: mode)) {
                        ForEach(Self.choices, id: \.self) { secs in
                            Text(label(secs, isDefault: secs == mode.defaultCheckInInterval)).tag(secs)
                        }
                    } label: {
                        Label(mode.displayName, systemImage: mode.systemImage)
                    }
                }
            } footer: {
                Text("How often SafetySense asks \u{201C}You okay?\u{201D} during a session. You have 45 seconds to answer before your contacts are told.")
            }
            .listRowBackground(SSColor.surface)

            Section {
                Toggle("Listen during Walk Home", isOn: $model.settings.listenDuringWalk)
                Toggle("Drink-check reminders on Night Out", isOn: $model.settings.drinkCheckPrompts)
            } footer: {
                Text("Drink checks are a gentle nudge to keep an eye on your drink. SafetySense can't detect drugging.")
            }
            .listRowBackground(SSColor.surface)
        }
        .settingsListStyle("Check-ins")
    }

    private func binding(for mode: GuardMode) -> Binding<TimeInterval> {
        Binding(get: { model.settings.checkInInterval(for: mode) },
                set: { new in
                    model.settings.checkInIntervalOverrides[mode] = new == mode.defaultCheckInInterval ? nil : new
                })
    }

    private func label(_ secs: TimeInterval, isDefault: Bool) -> String {
        "Every \(Int(secs / 60)) min" + (isDefault ? " (default)" : "")
    }
}

// MARK: Who gets help first

struct DispatchPoliciesView: View {
    @Environment(AppModel.self) private var model

    private var modes: [GuardMode] { [.everyday] + GuardMode.guardModes }

    var body: some View {
        @Bindable var model = model
        List {
            Section {
                Picker(selection: $model.settings.dispatchPolicies.manualSOS) {
                    ForEach(DispatchPolicy.allCases) { Text($0.displayName).tag($0) }
                } label: {
                    Label("Manual SOS", systemImage: "sos")
                }
                Text(model.settings.dispatchPolicies.manualSOS.explanation)
                    .font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
            } header: {
                Text("When you trigger it yourself")
            } footer: {
                Text("Hold-to-SOS, the Action Button, the Lock Screen control, Siri and your safe word.")
            }
            .listRowBackground(SSColor.surface)

            Section {
                ForEach(modes) { mode in
                    Picker(selection: policyBinding(mode)) {
                        ForEach(DispatchPolicy.allCases) { Text($0.displayName).tag($0) }
                    } label: {
                        Label(mode.displayName, systemImage: mode.systemImage)
                    }
                }
            } header: {
                Text("When SafetySense notices something")
            } footer: {
                Text("Contacts first: your people hear first, and dispatch is asked to help if you don't cancel within 90 seconds or a contact taps \u{201C}Send help.\u{201D} Dispatch right away: both at once. Dispatch calls you before sending anyone.")
            }
            .listRowBackground(SSColor.surface)

            Section {
                Button("Restore defaults") { model.settings.dispatchPolicies = .default }
                    .disabled(model.settings.dispatchPolicies == .default)
            }
            .listRowBackground(SSColor.surface)
        }
        .settingsListStyle("Who gets help first")
        .sensoryFeedback(.selection, trigger: model.settings.dispatchPolicies)
    }

    private func policyBinding(_ mode: GuardMode) -> Binding<DispatchPolicy> {
        Binding(get: { model.settings.dispatchPolicies.policy(for: mode) },
                set: { model.settings.dispatchPolicies.perMode[mode] = $0 })
    }
}

// MARK: PINs

/// Change the safety PIN or set / change / remove the duress PIN. Requires the current safety PIN.
struct PINSettingsView: View {
    @Environment(AppModel.self) private var model
    @State private var flow: Flow?
    @State private var hasSafety = false
    @State private var hasDuress = false
    @State private var savedTick = 0

    enum Flow: String, Identifiable {
        case changeSafety, setDuress, removeDuress
        var id: String { rawValue }
    }

    var body: some View {
        List {
            Section {
                Button { flow = .changeSafety } label: {
                    row("Safety PIN", hasSafety ? "Set · cancels an alert" : "Not set", icon: "lock.fill", set: hasSafety,
                        action: hasSafety ? "Change" : "Create")
                }
                Button { flow = .setDuress } label: {
                    row("Duress PIN", hasDuress ? "Set · looks like a cancel, help still comes" : "Not set", icon: "lock.trianglebadge.exclamationmark",
                        set: hasDuress, action: hasDuress ? "Change" : "Create")
                }
                .disabled(!hasSafety)
                if hasDuress {
                    Button("Remove duress PIN", role: .destructive) { flow = .removeDuress }
                }
                if hasSafety {
                    Button("Forgot your PIN?") { Task { await resetForgottenPINs() } }
                }
            } footer: {
                Text("PINs are saved only as salted hashes in your iPhone's Keychain. SafetySense can't show them to you, so pick ones you'll remember.")
            }
            .listRowBackground(SSColor.surface)

            Section {
                PINExplainerAnimation().padding(.vertical, SSSpacing.sm)
            } header: {
                Text("How they work")
            }
            .listRowBackground(SSColor.surface)
        }
        .settingsListStyle("PINs")
        .onAppear(perform: refresh)
        .sensoryFeedback(.success, trigger: savedTick)
        .sheet(item: $flow, onDismiss: refresh) { f in
            PINChangeSheet(flow: f) { savedTick += 1 }
        }
    }

    private func refresh() {
        hasSafety = model.store.hasSafetyPIN
        hasDuress = model.store.hasDuressPIN
    }

    /// Settings' row value: On, Not set, Safety only or Duress only.
    static func summary(safety: Bool, duress: Bool) -> String {
        switch (safety, duress) {
        case (true, true): "On"
        case (true, false): "Safety only"
        case (false, true): "Duress only"
        case (false, false): "Not set"
        }
    }

    /// Face ID or the iPhone passcode clears both PINs, then asks for a new safety PIN. Settings
    /// is out of reach during a session or alert, so this can't be used to stop one.
    private func resetForgottenPINs() async {
        switch await DeviceAuth.authenticateOwner(reason: "Reset your SafetySense PINs") {
        case .success, .unavailable:
            model.store.setSafetyPIN(nil)
            model.store.setDuressPIN(nil)
            refresh()
            flow = .changeSafety
        case .failed:
            break
        }
    }

    private func row(_ title: String, _ detail: String, icon: String, set: Bool, action: String) -> some View {
        HStack(spacing: SSSpacing.sm) {
            Image(systemName: icon).foregroundStyle(set ? SSColor.calm : SSColor.inkMuted).frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).foregroundStyle(SSColor.ink)
                Text(detail).font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
            }
            Spacer()
            Text(action).font(SSFont.callout.weight(.semibold)).foregroundStyle(SSColor.accent)
        }
        .frame(minHeight: 44)
    }
}

private struct PINChangeSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let flow: PINSettingsView.Flow
    var onSaved: () -> Void

    @State private var verified = false
    @State private var entry = ""
    @State private var verifyError: String?
    @State private var shake = 0

    var body: some View {
        NavigationStack {
            VStack(spacing: SSSpacing.lg) {
                Spacer(minLength: 0)
                if !verified && model.store.hasSafetyPIN {
                    VStack(spacing: SSSpacing.xs) {
                        Text("Enter your safety PIN").font(SSFont.title)
                        Text(verifyError ?? "To make changes, confirm it's you.")
                            .font(SSFont.callout).foregroundStyle(verifyError == nil ? SSColor.inkMuted : SSColor.warn)
                            .multilineTextAlignment(.center)
                    }
                    PINPad(pin: $entry, tint: SSColor.calm) { pin in verify(pin) }
                        .modifier(ShakeEffect(shakes: CGFloat(shake)))
                        .animation(.default, value: shake)
                } else {
                    switch flow {
                    case .changeSafety:
                        PINCreator(title: "New safety PIN", subtitle: "You'll enter it to cancel an alert.", tint: SSColor.calm,
                                   validate: { PINRules.validateSafety($0, store: model.store) }) { pin in
                            model.store.setSafetyPIN(pin)
                            done()
                        }
                    case .setDuress:
                        PINCreator(title: "New duress PIN", subtitle: "Different from your safety PIN.", tint: SSColor.accent,
                                   validate: { PINRules.validateDuress($0, store: model.store) }) { pin in
                            model.store.setDuressPIN(pin)
                            done()
                        }
                    case .removeDuress:
                        VStack(spacing: SSSpacing.md) {
                            Text("Remove your duress PIN?").font(SSFont.title)
                            Text("Only your safety PIN will cancel an alert.").font(SSFont.callout).foregroundStyle(SSColor.inkMuted)
                            PrimaryButton("Remove", role: .danger) {
                                model.store.setDuressPIN(nil)
                                done()
                            }
                        }
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, SSSpacing.gutter)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(SSColor.background)
            .foregroundStyle(SSColor.ink)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
            .sensoryFeedback(.error, trigger: shake)
            .animation(.smooth, value: verified)
        }
    }

    private func verify(_ pin: String) {
        // Only the real safety PIN unlocks changes. The message for any other PIN is the same.
        if model.store.verifyPIN(pin) == .valid {
            verifyError = nil
            verified = true
        } else {
            verifyError = "That PIN didn't work. Try again."
            shake += 1
        }
    }

    private func done() {
        onSaved()
        dismiss()
    }
}

// MARK: Safe word

struct SafeWordSettingsView: View {
    @Environment(AppModel.self) private var model

    /// A safe word only works once the speech model is on this iPhone.
    private var speechNote: String? {
        guard model.services.flavor == .live else { return nil }
        switch model.speechReadiness {
        case .ready: return "Speech recognition is ready on this iPhone."
        case .downloading: return "Getting speech recognition ready. The older recognizer covers your safe word until then."
        case .unavailable: return "Speech recognition isn't ready yet. SafetySense will try again next time it opens, and it still listens for sounds like a scream."
        case .unknown: return nil
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SSSpacing.lg) {
                SafeWordSetupView()
                if let speechNote {
                    Text(speechNote).font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(.vertical, SSSpacing.md)
        }
        .ssScreen()
        .navigationTitle("Safe word")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: You & campus

struct ProfileSettingsView: View {
    @Environment(AppModel.self) private var model
    @State private var name = ""
    @State private var phone = ""
    @State private var campus: Campus = .unm
    @State private var loaded = false

    var body: some View {
        List {
            Section {
                TextField("Name", text: $name).textContentType(.name)
                TextField("Mobile number", text: $phone)
                    .keyboardType(.phonePad)
                    .onChange(of: phone) { _, new in
                        let f = PhoneNumber.formatAsTyped(new)
                        if f != new { phone = f }
                    }
                Picker("Campus", selection: $campus) {
                    ForEach(Campus.allCases) { Text($0.displayName).tag($0) }
                }
            } footer: {
                Text("Your name goes in alerts to your contacts. Dispatch uses your number to call and check on you.")
            }
            .listRowBackground(SSColor.surface)

            Section {
                ForEach(CampusResources.all(for: campus)) { SafetyResourceRow(resource: $0) }
            } header: {
                Text("Your local numbers")
            }
            .listRowBackground(SSColor.surface)

            Section {
                NavigationLink("Responder profile") {
                    ScrollView { ResponderProfileForm().padding(.vertical, SSSpacing.md) }
                        .ssScreen()
                        .navigationTitle("Responder profile")
                        .navigationBarTitleDisplayMode(.inline)
                }
            } footer: {
                Text("Photo, description and medical notes, shared with dispatch only during an alert.")
            }
            .listRowBackground(SSColor.surface)
        }
        .settingsListStyle("You & campus")
        .onAppear {
            guard !loaded else { return }
            loaded = true
            name = model.profile?.name ?? ""
            phone = model.profile.map { PhoneNumber.display($0.phone) } ?? ""
            campus = model.profile?.campus ?? .unm
        }
        .onDisappear(perform: save)
    }

    private func save() {
        var p = model.profile ?? Profile()
        p.name = name.trimmingCharacters(in: .whitespacesAndNewlines)
        if let e164 = PhoneNumber.normalizedUS(phone) { p.phone = e164 } else if phone.isEmpty { p.phone = "" }
        p.campus = campus
        guard p != model.profile else { return }
        model.profile = p
    }
}

#Preview("Check-ins") { NavigationStack { CheckInIntervalsView() }.environment(AppModel.preview()).preferredColorScheme(.dark) }
#Preview("Dispatch") { NavigationStack { DispatchPoliciesView() }.environment(AppModel.preview()).preferredColorScheme(.dark) }
#Preview("PINs") { NavigationStack { PINSettingsView() }.environment(AppModel.preview()).preferredColorScheme(.dark) }
#Preview("Safe word") { NavigationStack { SafeWordSettingsView() }.environment(AppModel.preview()).preferredColorScheme(.dark) }
#Preview("Profile") { NavigationStack { ProfileSettingsView() }.environment(AppModel.preview()).preferredColorScheme(.dark) }
