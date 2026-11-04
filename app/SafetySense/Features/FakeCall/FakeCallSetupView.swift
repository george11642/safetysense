import SwiftUI

/// Fake call setup (SPEC 7.7): who's "calling", when, and what they say.
struct FakeCallSetupView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var config = FakeCallPreferences.load()
    @State private var scheduledTap = 0

    private static let quickNames = ["Mom", "Dad", "Roommate", "Sam"]
    private var scheduler: FakeCallScheduler { model.fakeCall }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SSSpacing.lg) {
                header
                if scheduler.isScheduled { scheduledCard }
                callerSection
                delaySection
                scriptSection
                optionsCard
            }
            .padding(.top, SSSpacing.md)
            .padding(.bottom, SSSpacing.lg)
        }
        .scrollDismissesKeyboard(.interactively)
        .pinnedFooter {
            PrimaryButton(config.delay == 0 ? "Ring now" : "Ring \(FakeCallDelay.nearest(to: config.delay).spokenLabel)",
                          systemImage: "phone.arrow.down.left") { schedule() }
            Text("It looks like a normal call. Nothing is sent to anyone.")
                .font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
                .multilineTextAlignment(.center)
        }
        .ssScreen()
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(SSColor.background, for: .navigationBar)
        .toolbarBackgroundVisibility(.visible, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } }
        }
        .sensoryFeedback(.success, trigger: scheduledTap)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: SSSpacing.xs) {
            Label("Fake call", systemImage: "phone.arrow.down.left").ssEyebrow(SSColor.accent)
            Text("A reason to leave").font(SSFont.display).fixedSize(horizontal: false, vertical: true)
            Text("Your phone rings like a real call, so you can step away without explaining. You don't owe anyone a reason.")
                .font(SSFont.callout).foregroundStyle(SSColor.inkMuted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }

    private var scheduledCard: some View {
        Card(tint: SSColor.calm) {
            HStack(spacing: SSSpacing.sm) {
                Image(systemName: "phone.badge.waveform").foregroundStyle(SSColor.calm).accessibilityHidden(true)
                TimelineView(.periodic(from: .now, by: 1)) { context in
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(scheduler.config.displayName) calls in \(Int(scheduler.secondsRemaining(at: context.date) ?? 0)) s")
                            .font(SSFont.headline).monospacedDigit()
                        Text("Lock your phone if you like. It still rings.")
                            .font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
                    }
                }
                Spacer(minLength: SSSpacing.xs)
                Button("Cancel") { scheduler.cancelScheduled() }
                    .font(SSFont.callout.weight(.semibold))
                    .foregroundStyle(SSColor.calm)
                    .frame(minWidth: 44, minHeight: 44)
            }
        }
    }

    private var callerSection: some View {
        VStack(alignment: .leading, spacing: SSSpacing.sm) {
            SetupField(label: "Caller name", text: $config.callerName, prompt: FakeCallConfig.defaultCallerName,
                       systemImage: "person.crop.circle")
            FlowRow(spacing: SSSpacing.xs) {
                ForEach(Self.quickNames, id: \.self) { name in
                    Chip(title: name, isSelected: config.displayName == name) {
                        withAnimation(.snappy) { config.callerName = name }
                    }
                }
            }
        }
    }

    private var delaySection: some View {
        VStack(alignment: .leading, spacing: SSSpacing.sm) {
            Text("Rings").ssEyebrow()
            HStack(spacing: SSSpacing.xs) {
                ForEach(FakeCallDelay.allCases) { d in
                    let selected = FakeCallDelay.nearest(to: config.delay) == d
                    Button { withAnimation(.snappy) { config.delay = d.seconds } } label: {
                        Text(d.label)
                            .font(SSFont.callout.weight(.semibold))
                            .lineLimit(1)
                            .frame(maxWidth: .infinity, minHeight: 44)
                            .foregroundStyle(selected ? SSColor.onFill : SSColor.ink)
                            .background(selected ? SSColor.accent : SSColor.surface, in: Capsule())
                            .overlay(Capsule().stroke(selected ? .clear : SSColor.line, lineWidth: 1))
                            .contentShape(Capsule())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Ring \(d.spokenLabel)")
                    .accessibilityAddTraits(selected ? .isSelected : [])
                }
            }
        }
    }

    private var scriptSection: some View {
        VStack(alignment: .leading, spacing: SSSpacing.sm) {
            Text("When you answer").ssEyebrow()
            Card(padding: 0) {
                VStack(spacing: 0) {
                    ForEach(Array(FakeCallScript.allCases.enumerated()), id: \.element) { i, script in
                        if i > 0 { Divider().overlay(SSColor.line).padding(.leading, 52) }
                        Button { withAnimation(.snappy) { config.script = script } } label: {
                            HStack(spacing: SSSpacing.sm) {
                                Image(systemName: config.script == script ? "checkmark.circle.fill" : "circle")
                                    .font(.title3)
                                    .foregroundStyle(config.script == script ? SSColor.accent : SSColor.inkMuted)
                                    .contentTransition(.symbolEffect(.replace))
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(script.title).font(SSFont.body).foregroundStyle(SSColor.ink)
                                    Text(script.summary).font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                                Spacer(minLength: 0)
                            }
                            .padding(.horizontal, SSSpacing.md)
                            .padding(.vertical, SSSpacing.sm)
                            .frame(minHeight: 52)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(config.script == script ? .isSelected : [])
                    }
                }
            }
            Text("A voice on your phone says the lines, with pauses for you to reply.")
                .font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
        }
    }

    private var optionsCard: some View {
        Card {
            VStack(alignment: .leading, spacing: SSSpacing.sm) {
                Toggle(isOn: $config.alsoStartWalkGuard) {
                    VStack(alignment: .leading, spacing: 2) {
                        Label("Start Walk Home when you answer", systemImage: "figure.walk").font(SSFont.body)
                        Text(model.isGuarding ? "You're already guarding, so this stays as it is."
                                              : "Someone you trust can follow you while you leave.")
                            .font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
                    }
                }
                .tint(SSColor.accent)
                .disabled(model.isGuarding)
                Divider().overlay(SSColor.line)
                VStack(alignment: .leading, spacing: SSSpacing.xs) {
                    Text("Answer with").font(SSFont.body)
                    Picker("Answer with", selection: $config.answerStyle) {
                        ForEach(FakeCallAnswerStyle.allCases) { Text($0.title).tag($0) }
                    }
                    .pickerStyle(.segmented)
                }
            }
        }
    }

    private func schedule() {
        var c = config
        c.callerName = c.displayName
        if model.isGuarding { c.alsoStartWalkGuard = false }
        FakeCallPreferences.save(c)
        scheduledTap += 1
        scheduler.schedule(c)
        dismiss()
    }
}

/// Home / Guard entry row: one tap opens the setup sheet; shows the countdown when scheduled.
struct FakeCallEntryRow: View {
    @Environment(AppModel.self) private var model
    let action: () -> Void

    var body: some View {
        let scheduler = model.fakeCall
        Button(action: action) {
            HStack(spacing: SSSpacing.sm) {
                Image(systemName: "phone.arrow.down.left")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(SSColor.accent)
                    .frame(width: 36, height: 36)
                    .background(SSColor.accentSoft, in: Circle())
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Fake call").font(SSFont.headline).foregroundStyle(SSColor.ink)
                    if scheduler.isScheduled {
                        TimelineView(.periodic(from: .now, by: 1)) { context in
                            Text("\(scheduler.config.displayName) calls in \(Int(scheduler.secondsRemaining(at: context.date) ?? 0)) s")
                                .font(SSFont.caption).foregroundStyle(SSColor.calm).monospacedDigit()
                        }
                    } else {
                        Text("A believable call, so you can leave without explaining")
                            .font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                Spacer(minLength: SSSpacing.xs)
                Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(SSColor.inkMuted)
                    .accessibilityHidden(true)
            }
            .padding(SSSpacing.md)
            .frame(minHeight: 64)
            .background(SSColor.surface, in: RoundedRectangle(cornerRadius: SSRadius.card, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: SSRadius.card, style: .continuous).stroke(SSColor.line.opacity(0.6), lineWidth: 1))
            .contentShape(RoundedRectangle(cornerRadius: SSRadius.card, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityHint("Sets up an incoming call")
    }
}

#Preview("Fake call setup") {
    NavigationStack { FakeCallSetupView() }.environment(AppModel.preview(screen: .fakeCallSetup))
}
