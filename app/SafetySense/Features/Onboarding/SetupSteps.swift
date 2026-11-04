import SwiftUI
import UIKit

// MARK: 4. Trusted contacts (required: at least one)

struct ContactsStepView: View {
    @Environment(AppModel.self) private var model
    var next: () -> Void

    var body: some View {
        OnboardingPage(eyebrow: "Step 4 · Required", title: "Who should we call?",
                       subtitle: "Choose 1 to \(TrustedContact.maxCount) people. They don't need the app. Send each one the intro text so a call from SafetySense isn't a surprise.") {
            TrustedContactsEditor(context: .onboarding)
        } footer: {
            PrimaryButton(model.contacts.isEmpty ? "Add at least one person" : "Continue", systemImage: "arrow.right", action: next)
                .disabled(model.contacts.isEmpty)
                .opacity(model.contacts.isEmpty ? 0.5 : 1)
                .animation(.smooth, value: model.contacts.isEmpty)
        }
    }
}

// MARK: 5. Triggers

struct TriggersStepView: View {
    @Environment(AppModel.self) private var model
    var next: () -> Void

    @State private var sheet: TriggerSheet?
    /// Mirrors the Keychain value, which isn't observable.
    @State private var safeWord: String?

    enum TriggerSheet: String, Identifiable {
        case actionButton, lockScreen, safeWord
        var id: String { rawValue }
    }

    var body: some View {
        OnboardingPage(eyebrow: "Step 5", title: "Ways to start an alert",
                       subtitle: "Set up the ones that fit you. Each one works without opening the app.") {
            VStack(spacing: SSSpacing.sm) {
                trigger(.actionButton, icon: "button.vertical.left.press", title: "Action Button",
                        detail: "Press and hold the button on the side of your iPhone.",
                        done: model.settings.hasSetUpActionButton)
                trigger(.lockScreen, icon: "lock.iphone", title: "Lock Screen control",
                        detail: "One tap on the Lock Screen, no unlocking.",
                        done: model.settings.hasAddedControl)
                trigger(.safeWord, icon: "waveform", title: "Safe word",
                        detail: safeWord.map { "\u{201C}\($0)\u{201D} is set. Say it during a Guard session." }
                            ?? "Say it out loud during a Guard session. Record it 3 times.",
                        done: safeWord != nil)
            }
            Card {
                Label("You can also say \u{201C}Hey Siri, SafetySense alert.\u{201D} Nothing to set up.", systemImage: "mic.badge.plus")
                    .font(SSFont.callout)
            }
        } footer: {
            PrimaryButton("Continue", systemImage: "arrow.right", action: next)
        }
        .onAppear { safeWord = model.store.safeWord }
        .sheet(item: $sheet, onDismiss: { safeWord = model.store.safeWord }) { which in
            NavigationStack {
                ScrollView {
                    VStack(alignment: .leading, spacing: SSSpacing.lg) {
                        switch which {
                        case .actionButton:
                            ActionButtonGuide { model.settings.hasSetUpActionButton = true; sheet = nil }
                        case .lockScreen:
                            LockScreenControlGuide { model.settings.hasAddedControl = true; sheet = nil }
                        case .safeWord:
                            SafeWordSetupView {
                                Task {
                                    try? await Task.sleep(for: .seconds(1.2))
                                    sheet = nil
                                }
                            }
                        }
                    }
                    .padding(.vertical, SSSpacing.md)
                }
                .ssScreen()
                .navigationTitle(title(for: which))
                .navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { sheet = nil } } }
            }
            .presentationBackground(SSColor.background)
        }
    }

    private func title(for s: TriggerSheet) -> String {
        switch s {
        case .actionButton: "Action Button"
        case .lockScreen: "Lock Screen control"
        case .safeWord: "Safe word"
        }
    }

    private func trigger(_ s: TriggerSheet, icon: String, title: String, detail: String, done: Bool) -> some View {
        Button { sheet = s } label: {
            SetupRow(systemImage: icon, title: title, detail: detail, done: done) {
                Text(done ? "Done" : "Set up")
                    .font(SSFont.callout.weight(.semibold))
                    .foregroundStyle(done ? SSColor.calm : SSColor.accent)
            }
        }
        .buttonStyle(.plain)
        .accessibilityHint(done ? "Set up. Tap to review." : "Opens setup steps")
    }
}

// MARK: 6. Permissions (each with a reason)

struct PermissionsStepView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openURL) private var openURL
    var next: () -> Void

    enum Permission: String, CaseIterable, Identifiable {
        case microphone, location, notifications, motion
        var id: String { rawValue }

        var title: String {
            switch self {
            case .microphone: "Microphone"
            case .location: "Location, Always"
            case .notifications: "Time-Sensitive notifications"
            case .motion: "Motion & Fitness"
            }
        }

        var reason: String {
            switch self {
            case .microphone: "Only during a Guard session you start, to notice a scream or your safe word. Sound stays on your iPhone."
            case .location: "So help can find you, even when your phone is locked. Shared only during a session or an alert."
            case .notifications: "So a \u{201C}You okay?\u{201D} check-in reaches you, even in a Focus mode."
            case .motion: "To notice a hard fall or a sudden impact while you're guarded."
            }
        }

        var icon: String {
            switch self {
            case .microphone: "mic.fill"
            case .location: "location.fill"
            case .notifications: "bell.badge.fill"
            case .motion: "figure.fall"
            }
        }
    }

    enum Status: Equatable { case notAsked, asking, granted, declined }

    @State private var status: [Permission: Status] = [:]

    var body: some View {
        OnboardingPage(eyebrow: "Step 6", title: "What SafetySense needs, and why",
                       subtitle: "iOS will ask you for each one. Say no to anything; you can change it later in Settings.") {
            VStack(spacing: SSSpacing.sm) {
                ForEach(Permission.allCases) { p in row(p) }
            }
            if status.values.contains(.declined) {
                Button {
                    if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
                } label: {
                    Label("Open iOS Settings", systemImage: "gear").font(SSFont.callout.weight(.semibold))
                        .frame(minHeight: 44)
                }
                .foregroundStyle(SSColor.accent)
            }
        } footer: {
            PrimaryButton(allAnswered ? "Continue" : "Allow all", systemImage: allAnswered ? "arrow.right" : "checkmark.shield") {
                if allAnswered { next() } else { Task { await askAll() } }
            }
            if !allAnswered {
                PrimaryButton("Not now", role: .quiet, action: next)
            }
        }
        .onAppear(perform: refresh)
    }

    private var allAnswered: Bool {
        Permission.allCases.allSatisfy { [.granted, .declined].contains(status[$0] ?? .notAsked) }
    }

    private func row(_ p: Permission) -> some View {
        let s = status[p] ?? .notAsked
        return SetupRow(systemImage: p.icon, title: p.title, detail: p.reason, done: s == .granted) {
            switch s {
            case .notAsked:
                Button("Allow") { Task { await ask(p) } }
                    .font(SSFont.callout.weight(.semibold))
                    .foregroundStyle(SSColor.accent)
                    .frame(minWidth: 44, minHeight: 44)
                    .accessibilityLabel("Allow \(p.title)")
            case .asking:
                ProgressView().tint(SSColor.accent)
            case .granted:
                Text("On").font(SSFont.callout.weight(.semibold)).foregroundStyle(SSColor.calm)
            case .declined:
                Text("Off").font(SSFont.callout.weight(.semibold)).foregroundStyle(SSColor.inkMuted)
            }
        }
        .sensoryFeedback(.success, trigger: s) { _, new in new == .granted }
    }

    private func refresh() {
        switch model.services.location.authorization {
        case .always: status[.location] = .granted
        case .denied: status[.location] = .declined
        default: break
        }
    }

    private func askAll() async {
        for p in Permission.allCases where (status[p] ?? .notAsked) == .notAsked {
            await ask(p)
        }
    }

    private func ask(_ p: Permission) async {
        status[p] = .asking
        let services = model.services
        let granted: Bool
        switch p {
        case .microphone:
            granted = await services.audio.requestPermission()
        case .location:
            // iOS needs "While Using" before it will offer "Always".
            let first = await services.location.requestWhenInUse()
            if first == .denied {
                granted = false
            } else {
                let result = await services.location.requestAlways()
                granted = result == .always || result == .whenInUse
            }
        case .notifications:
            granted = await services.notifications.requestAuthorization()
        case .motion:
            granted = await services.motion.requestPermission()
        }
        withAnimation(.smooth) { status[p] = granted ? .granted : .declined }
    }
}

#Preview("Contacts") {
    ContactsStepView {}.background(SSColor.background).foregroundStyle(SSColor.ink)
        .environment(AppModel.preview()).preferredColorScheme(.dark)
}

#Preview("Triggers") {
    TriggersStepView {}.background(SSColor.background).foregroundStyle(SSColor.ink)
        .environment(AppModel.preview()).preferredColorScheme(.dark)
}

#Preview("Permissions") {
    PermissionsStepView {}.background(SSColor.background).foregroundStyle(SSColor.ink)
        .environment(AppModel.preview()).preferredColorScheme(.dark)
}
