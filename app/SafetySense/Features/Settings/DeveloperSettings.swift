import SwiftUI

/// Developer switches, kept in App Group defaults so the app, the backend client and the
/// widget extension can all read them. Not part of `AppSettings` because they're not user preferences.
enum DeveloperSettings {
    /// Bool. Use demo services (mocks, simulated dispatch) on next launch. Read by `SafetySenseApp` (coordinator).
    static let demoModeKey = "ss.dev.demoMode"
    /// Bool, default false. When false, the live backend client must not place real Twilio calls/SMS:
    /// send `dry_run: true` for every alert (System Integration module).
    static let allowRealCallsKey = "ss.dev.allowRealCalls"
    /// Double. Timer multiplier for the demo escalation controller (1 = real 45 s / 90 s).
    static let demoTimeScaleKey = "ss.dev.demoTimeScale"

    /// Both are always false in a Release build, whatever is stored.
    nonisolated static var demoModeOnNextLaunch: Bool {
        !BuildFlags.isRelease && AppGroup.defaults.bool(forKey: demoModeKey)
    }
    nonisolated static var allowRealCalls: Bool {
        !BuildFlags.isRelease && AppGroup.defaults.bool(forKey: allowRealCallsKey)
    }

    nonisolated static func reset() {
        for key in [demoModeKey, allowRealCallsKey, demoTimeScaleKey] { AppGroup.defaults.removeObject(forKey: key) }
    }
}

#if DEBUG
/// Developer section: demo mode, scenario launcher and the real-calls safety switch.
struct DeveloperSettingsView: View {
    @Environment(AppModel.self) private var model
    @AppStorage(DeveloperSettings.demoModeKey, store: AppGroup.defaults) private var demoMode = false
    @AppStorage(DeveloperSettings.allowRealCallsKey, store: AppGroup.defaults) private var allowRealCalls = false
    @State private var confirmRealCalls = false

    var body: some View {
        List {
            Section {
                LabeledContent("Running now") {
                    StatusPill(text: model.services.flavor == .demo ? "Demo services" : "Live services",
                               tint: model.services.flavor == .demo ? SSColor.warn : SSColor.calm)
                }
                Toggle("Demo mode on next launch", isOn: $demoMode)
            } header: {
                Text("Mode")
            } footer: {
                Text("Demo mode uses no microphone and no network, and labels dispatch \u{201C}simulated.\u{201D} Relaunch the app to switch. You can also launch with -ssDemo 1.")
            }
            .listRowBackground(SSColor.surface)

            Section {
                NavigationLink {
                    DemoScenarioView()
                } label: {
                    Label("Demo scenarios", systemImage: "play.rectangle")
                }
            } footer: {
                Text("Walk through a scream, a missed check-in, the safe word, SOS and more, for demos and testing.")
            }
            .listRowBackground(SSColor.surface)

            Section {
                Toggle(isOn: Binding(get: { allowRealCalls }, set: { on in
                    if on { confirmRealCalls = true } else { allowRealCalls = false }
                })) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Allow real calls")
                        Text(allowRealCalls ? "Alerts can call and text your contacts." : "Alerts are sent as TEST. Nobody is called.")
                            .font(SSFont.caption).foregroundStyle(allowRealCalls ? SSColor.warn : SSColor.inkMuted)
                    }
                }
                .tint(SSColor.warn)
            } header: {
                Text("Safety switch")
            } footer: {
                Text("Off by default. Even when on, dispatch uses the Noonlight sandbox or a simulation, never live 911. On the Twilio trial, only verified numbers can be called.")
            }
            .listRowBackground(SSColor.surface)
        }
        .scrollContentBackground(.hidden)
        .background(SSColor.background)
        .navigationTitle("Developer")
        .alert("Allow real calls?", isPresented: $confirmRealCalls) {
            Button("Allow", role: .destructive) { allowRealCalls = true }
            Button("Keep off", role: .cancel) {}
        } message: {
            Text("Real alerts will phone and text your trusted contacts. Make sure they know you're testing.")
        }
    }
}

/// One-tap scenarios that drive the real escalation ladder through the service protocols.
struct DemoScenarioView: View {
    @Environment(AppModel.self) private var model
    @AppStorage(DeveloperSettings.demoTimeScaleKey, store: AppGroup.defaults) private var timeScale = 1.0
    @State private var running: Scenario?

    enum Scenario: String, CaseIterable, Identifiable {
        case scream, missedCheckIn, safeWord, sos, actionButton, phoneDark, contactSendsHelp, drill, endSession
        var id: String { rawValue }

        var title: String {
            switch self {
            case .scream: "Night Out: scream, then stillness"
            case .missedCheckIn: "Missed check-in"
            case .safeWord: "Safe word heard"
            case .sos: "In-app SOS"
            case .actionButton: "Action Button pressed"
            case .phoneDark: "Phone goes dark"
            case .contactSendsHelp: "A contact taps \u{201C}Send help\u{201D}"
            case .drill: "Practice drill (TEST)"
            case .endSession: "End the Guard session"
            }
        }

        var detail: String {
            switch self {
            case .scream: "Starts Night Out, then a scream and a long stillness reach the risk engine."
            case .missedCheckIn: "Starts Night Out and asks \u{201C}You okay?\u{201D} Don't answer for 45 s."
            case .safeWord: "Starts Night Out, then the safe word is heard."
            case .sos: "Manual SOS. Uses your Manual SOS dispatch setting."
            case .actionButton: "Same path as the Action Button intent."
            case .phoneDark: "The server stops hearing heartbeats."
            case .contactSendsHelp: "Needs an alert in progress. Moves it to dispatch."
            case .drill: "Runs a dry-run alert. Nobody is contacted."
            case .endSession: "Stops sensors and ends the session."
            }
        }

        var icon: String {
            switch self {
            case .scream: "waveform.badge.exclamationmark"
            case .missedCheckIn: "clock.badge.questionmark"
            case .safeWord: "text.bubble"
            case .sos: "sos"
            case .actionButton: "button.vertical.left.press"
            case .phoneDark: "iphone.slash"
            case .contactSendsHelp: "person.wave.2"
            case .drill: "testtube.2"
            case .endSession: "stop.circle"
            }
        }

        /// Scenarios that can create a real alert.
        var createsAlert: Bool { ![.drill, .endSession].contains(self) }
    }

    private var isDemo: Bool { model.services.flavor == .demo }

    var body: some View {
        List {
            if !isDemo {
                Section {
                    Label("These scenarios create real alerts on live services. Turn on Demo mode and relaunch to use them.",
                          systemImage: "exclamationmark.triangle")
                        .font(SSFont.callout).foregroundStyle(SSColor.warn)
                }
                .listRowBackground(SSColor.warnSoft)
            }
            Section {
                LabeledContent("Ladder") {
                    StatusPill(text: model.escalationLevel.displayName, tint: SSColor.level(model.escalationLevel),
                               pulsing: model.escalationLevel != .guarding)
                }
                LabeledContent("Session", value: model.currentSession?.mode.displayName ?? "None")
                if let escalation = model.services.escalation as? MockEscalationController {
                    Picker("Timers", selection: $timeScale) {
                        Text("Real (45 s / 90 s)").tag(1.0)
                        Text("10x faster").tag(0.1)
                    }
                    .onChange(of: timeScale, initial: true) { _, scale in escalation.timeScale = scale }
                }
            } header: {
                Text("Status")
            }
            .listRowBackground(SSColor.surface)

            Section {
                ForEach(Scenario.allCases) { s in
                    Button { Task { await run(s) } } label: {
                        HStack(spacing: SSSpacing.sm) {
                            Image(systemName: s.icon).foregroundStyle(SSColor.accent).frame(width: 28)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(s.title).font(SSFont.callout.weight(.semibold)).foregroundStyle(SSColor.ink)
                                Text(s.detail).font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
                            }
                            Spacer()
                            if running == s { ProgressView() }
                        }
                        .frame(minHeight: 44)
                    }
                    .disabled(!enabled(s))
                    .opacity(enabled(s) ? 1 : 0.45)
                }
            } header: {
                Text("Scenarios")
            } footer: {
                Text("Cancel any alert with your safety PIN. Dispatch in demo mode is always labelled \u{201C}simulated.\u{201D}")
            }
            .listRowBackground(SSColor.surface)
        }
        .scrollContentBackground(.hidden)
        .background(SSColor.background)
        .navigationTitle("Demo scenarios")
        .sensoryFeedback(.impact, trigger: running) { _, new in new != nil }
    }

    private func enabled(_ s: Scenario) -> Bool {
        if running != nil { return false }
        if s.createsAlert && !isDemo { return false }
        switch s {
        case .contactSendsHelp: return model.escalationLevel == .alert
        case .endSession: return model.isGuarding
        default: return true
        }
    }

    private func run(_ s: Scenario) async {
        running = s
        defer { running = nil }
        switch s {
        case .scream:
            await ensureGuarding()
            inject(.scream, weight: 1.4, detail: "Scream (demo)")
            try? await Task.sleep(for: .seconds(1.5))
            inject(.prolongedStillness, weight: 1.0, detail: "No movement (demo)")
        case .missedCheckIn:
            await ensureGuarding()
            model.services.escalation.scheduledCheckInDue()
        case .safeWord:
            await ensureGuarding()
            inject(.safeWord, weight: 3, detail: "Safe word (demo)")
        case .sos:
            model.triggerSOS(.manualSOS, reason: "SOS (demo)")
        case .actionButton:
            model.triggerSOS(.actionButton, reason: "Action Button (demo)")
        case .phoneDark:
            await ensureGuarding()
            inject(.heartbeatLost, weight: 3, detail: "No heartbeat (demo)")
        case .contactSendsHelp:
            model.services.escalation.contactRequestedHelp(name: model.contacts.first?.firstName ?? "Maya")
        case .drill:
            await model.runDrill()
        case .endSession:
            await model.endGuard()
        }
    }

    private func ensureGuarding() async {
        if !model.isGuarding {
            await model.startGuard(mode: .nightOut)
            try? await Task.sleep(for: .seconds(1.2))
        }
    }

    /// Sends a signal down the same path the sensors use.
    private func inject(_ kind: RiskSignalKind, weight: Double, detail: String) {
        model.services.audio.onSignal?(RiskSignal(kind: kind, weight: weight, detail: detail, confidence: 0.9))
    }
}

#Preview("Developer") {
    NavigationStack { DeveloperSettingsView() }.environment(AppModel.preview()).preferredColorScheme(.dark)
}

#Preview("Scenarios") {
    NavigationStack { DemoScenarioView() }.environment(AppModel.preview()).preferredColorScheme(.dark)
}
#endif
