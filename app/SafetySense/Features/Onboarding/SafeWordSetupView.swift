import SwiftUI

/// Choose a safe word and say it three times (SPEC 8.5). Used by onboarding and Settings.
/// The word is stored in the Keychain via `SettingsStore.safeWord`; audio is never kept.
struct SafeWordSetupView: View {
    @Environment(AppModel.self) private var model
    var onFinished: () -> Void = {}

    @State private var word = ""
    @State private var phase: Phase = .choose
    @State private var takes: [Bool] = []
    @State private var heard: String?
    @State private var problem: String?
    @State private var enroller: (any SafeWordEnrolling)?
    @FocusState private var fieldFocused: Bool

    private let requiredTakes = 3

    private enum Phase: Equatable { case choose, recording(listening: Bool), done }

    var body: some View {
        VStack(alignment: .leading, spacing: SSSpacing.lg) {
            switch phase {
            case .choose: chooseView.transition(.opacity.combined(with: .move(edge: .leading)))
            case .recording(let listening): recordingView(listening: listening).transition(.opacity.combined(with: .move(edge: .trailing)))
            case .done: doneView.transition(.scale(scale: 0.95).combined(with: .opacity))
            }
        }
        .animation(.smooth(duration: 0.35), value: phase)
        .animation(.smooth, value: takes)
        .sensoryFeedback(.success, trigger: takes.filter { $0 }.count)
        .sensoryFeedback(.warning, trigger: problem) { _, new in new != nil }
        .onAppear {
            if word.isEmpty, let saved = model.store.safeWord { word = saved }
            if enroller == nil { enroller = model.services.makeSafeWordEnroller() }
        }
    }

    // MARK: Choose

    private var chooseView: some View {
        VStack(alignment: .leading, spacing: SSSpacing.md) {
            Text("Pick a word or short phrase you'd never say by accident, but could say calmly. Saying it during a Guard session starts an alert right away.")
                .font(SSFont.callout).foregroundStyle(SSColor.inkMuted)
            TextField("e.g. blue umbrella", text: $word)
                .font(SSFont.title)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.done)
                .focused($fieldFocused)
                .padding(.horizontal, SSSpacing.md)
                .frame(minHeight: 60)
                .background(SSColor.surface, in: RoundedRectangle(cornerRadius: SSRadius.small, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: SSRadius.small, style: .continuous)
                    .stroke(fieldFocused ? SSColor.accent : SSColor.line))
                .accessibilityLabel("Safe word")
            if let advice = SafeWordMatcher.advice(for: word) {
                Label(advice, systemImage: "lightbulb").font(SSFont.caption).foregroundStyle(SSColor.warn)
            }
            HStack(spacing: SSSpacing.xs) {
                ForEach(["blue umbrella", "pineapple pizza", "call grandma"], id: \.self) { s in
                    Chip(title: s, isSelected: word == s) { word = s }
                }
            }
            PrimaryButton("Record it 3 times", systemImage: "mic") {
                fieldFocused = false
                takes = []
                problem = nil
                phase = .recording(listening: false)
            }
            .disabled(trimmed.isEmpty)
            .opacity(trimmed.isEmpty ? 0.5 : 1)
            Text("Stays on your iPhone. Only the word is saved, never your voice.")
                .font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
        }
    }

    // MARK: Record

    private func recordingView(listening: Bool) -> some View {
        VStack(spacing: SSSpacing.lg) {
            Text("Say \u{201C}\(trimmed)\u{201D}")
                .font(SSFont.title).multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
            MicOrb(listening: listening)
                .frame(height: 150)
            HStack(spacing: SSSpacing.sm) {
                ForEach(0..<requiredTakes, id: \.self) { i in
                    let done = i < takes.filter { $0 }.count
                    Image(systemName: done ? "checkmark.circle.fill" : "circle")
                        .font(.title2)
                        .foregroundStyle(done ? SSColor.calm : SSColor.line)
                        .symbolEffect(.bounce, value: done)
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(takes.filter { $0 }.count) of \(requiredTakes) recordings done")

            Group {
                if let problem {
                    Text(problem).foregroundStyle(SSColor.warn)
                } else if let heard, !heard.isEmpty {
                    Text("Heard: \u{201C}\(heard)\u{201D}").foregroundStyle(SSColor.inkMuted)
                } else {
                    Text(listening ? "Listening…" : "Tap the button, then say it at a normal volume.").foregroundStyle(SSColor.inkMuted)
                }
            }
            .font(SSFont.callout)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity, minHeight: 44)

            PrimaryButton(listening ? "Listening…" : "Record \(takes.filter { $0 }.count + 1) of \(requiredTakes)",
                          systemImage: "mic.fill", isLoading: listening) {
                Task { await recordTake() }
            }
            HStack {
                Button("Change word") { phase = .choose }
                Spacer()
                if problem != nil {
                    Button("Save without recording") { save() }
                }
            }
            .font(SSFont.callout.weight(.semibold))
            .foregroundStyle(SSColor.inkMuted)
            .frame(minHeight: 44)
        }
    }

    // MARK: Done

    private var doneView: some View {
        VStack(alignment: .leading, spacing: SSSpacing.md) {
            Card(tint: SSColor.calm) {
                HStack(spacing: SSSpacing.sm) {
                    Image(systemName: "checkmark.seal.fill").font(.title).foregroundStyle(SSColor.calm)
                        .symbolEffect(.bounce, value: phase)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Safe word saved").font(SSFont.headline)
                        Text("\u{201C}\(trimmed)\u{201D} starts an alert during any Guard session that's listening.")
                            .font(SSFont.callout).foregroundStyle(SSColor.inkMuted)
                    }
                }
            }
            Button("Choose a different word") {
                takes = []
                phase = .choose
            }
            .font(SSFont.callout.weight(.semibold))
            .foregroundStyle(SSColor.accent)
            .frame(minHeight: 44)
        }
    }

    // MARK: Actions

    private var trimmed: String { word.trimmingCharacters(in: .whitespacesAndNewlines) }

    private func recordTake() async {
        guard let enroller else { return }
        problem = nil
        heard = nil
        guard await enroller.requestPermission() else {
            problem = SafeWordEnrollerError.notAuthorized.errorDescription
            return
        }
        phase = .recording(listening: true)
        do {
            let text = try await enroller.listen(seconds: 4, expecting: trimmed)
            heard = text
            let ok = SafeWordMatcher.matches(transcript: text, word: trimmed)
            takes.append(ok)
            if !ok {
                problem = text.isEmpty ? "We didn't catch anything. Try a little louder, or move somewhere quieter."
                    : "That sounded different. Try once more, clearly and at your normal pace."
            }
        } catch {
            problem = (error as? LocalizedError)?.errorDescription ?? "Recording didn't work this time."
        }
        if takes.filter({ $0 }).count >= requiredTakes {
            save()
        } else {
            phase = .recording(listening: false)
        }
    }

    private func save() {
        model.store.safeWord = trimmed
        problem = nil
        phase = .done
        onFinished()
    }
}

/// Breathing microphone orb; rings expand while listening.
struct MicOrb: View {
    var listening: Bool

    var body: some View {
        TimelineView(.animation(paused: !listening)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            ZStack {
                ForEach(0..<3, id: \.self) { i in
                    let phase = (t * 0.6 + Double(i) / 3).truncatingRemainder(dividingBy: 1)
                    Circle()
                        .stroke(SSColor.accent.opacity(listening ? (1 - phase) * 0.6 : 0), lineWidth: 2)
                        .scaleEffect(0.55 + phase * 0.45)
                }
                Circle()
                    .fill(listening ? SSColor.accent : SSColor.accentSoft)
                    .frame(width: 84, height: 84)
                    .scaleEffect(listening ? 1 + 0.05 * sin(t * 6) : 1)
                Image(systemName: "mic.fill")
                    .font(.system(size: 32, weight: .semibold))
                    .foregroundStyle(listening ? SSColor.onFill : SSColor.accent)
            }
        }
        .accessibilityHidden(true)
    }
}

#Preview {
    ScrollView { SafeWordSetupView().padding() }
        .background(SSColor.background)
        .foregroundStyle(SSColor.ink)
        .environment(AppModel.preview())
        .preferredColorScheme(.dark)
}
