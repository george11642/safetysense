import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

// OWNER: System Integration module. Lock Screen + Dynamic Island for a Guard session.
// Levels: 0 guarding (teal), 1 check-in (amber, with I'm okay / Need help), 2 alert (red,
// countdown to dispatch), 3 dispatch (red, "Help is on the way").

struct GuardLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: GuardActivityAttributes.self) { context in
            LockScreenGuardView(attributes: context.attributes, state: context.state, isStale: context.isStale)
                .activityBackgroundTint(BrandPalette.night)
                .activitySystemActionForegroundColor(BrandPalette.ink)
                .widgetURL(DeepLink.forLevel(context.state.level).url)
        } dynamicIsland: { context in
            let style = GuardLevelStyle(state: context.state, testNote: context.attributes.testNote)
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    ShieldBadge(style: style, size: 40)
                        .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    TrailingTimer(attributes: context.attributes, state: context.state, style: style)
                        .font(.title3.weight(.semibold).monospacedDigit())
                        .frame(maxWidth: 90, alignment: .trailing)
                        .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.center) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(style.title)
                            .font(.headline)
                            .foregroundStyle(BrandPalette.ink)
                        Text("SafetySense · \(context.attributes.modeDisplayName)")
                            .font(.caption)
                            .foregroundStyle(BrandPalette.muted)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .accessibilityElement(children: .combine)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(context.state.statusText)
                            .font(.subheadline)
                            .foregroundStyle(BrandPalette.muted)
                            .lineLimit(2)
                        LevelDetail(attributes: context.attributes, state: context.state, style: style, compact: true)
                        TestNote(text: context.attributes.testNote)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 4)
                }
            } compactLeading: {
                Image(systemName: style.symbol)
                    .foregroundStyle(style.tint)
                    .accessibilityLabel("SafetySense \(style.title)")
            } compactTrailing: {
                TrailingTimer(attributes: context.attributes, state: context.state, style: style)
                    .font(.caption.weight(.semibold).monospacedDigit())
                    .frame(maxWidth: 48)
            } minimal: {
                Image(systemName: style.symbol)
                    .foregroundStyle(style.tint)
                    .accessibilityLabel("SafetySense \(style.title)")
            }
            .keylineTint(style.tint)
            .widgetURL(DeepLink.forLevel(context.state.level).url)
        }
    }
}

// MARK: - Level styling

/// Copy, color and symbol for each escalation level (calm, never alarming in level 0).
struct GuardLevelStyle {
    let level: Int
    /// Set when this build contacts nobody, so nothing here promises help.
    var testNote: String?
    /// The status line says dispatch hasn't answered, so the title can't say help is coming.
    var unconfirmed = false

    private var isTest: Bool { testNote != nil }

    var tint: Color {
        switch level {
        case 0: BrandPalette.calmTeal
        case 1: BrandPalette.warnAmber
        default: BrandPalette.danger
        }
    }

    init(level: Int, testNote: String? = nil, unconfirmed: Bool = false) {
        self.level = level
        self.testNote = testNote
        self.unconfirmed = unconfirmed
    }

    init(state: GuardActivityAttributes.ContentState, testNote: String?) {
        self.init(level: state.level, testNote: testNote,
                  unconfirmed: state.statusText == GuardActivityAttributes.unconfirmedDispatchStatus)
    }

    var title: String {
        switch level {
        case 0: "Guarding"
        case 1: "You okay?"
        case 2: isTest ? "Test alert" : "Telling your people"
        default: isTest ? "Test dispatch" : unconfirmed ? "Reaching dispatch" : "Help is on the way"
        }
    }

    var symbol: String {
        switch level {
        case 0: "shield.lefthalf.filled"
        case 1: "hand.wave.fill"
        case 2: "person.2.wave.2.fill"
        default: "light.beacon.max.fill"
        }
    }
}

// MARK: - Lock Screen

private struct LockScreenGuardView: View {
    let attributes: GuardActivityAttributes
    let state: GuardActivityAttributes.ContentState
    let isStale: Bool

    var body: some View {
        let style = GuardLevelStyle(state: state, testNote: attributes.testNote)
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .center, spacing: 12) {
                ShieldBadge(style: style, size: 44)
                VStack(alignment: .leading, spacing: 2) {
                    Text(style.title)
                        .font(.headline)
                        .foregroundStyle(BrandPalette.ink)
                    Text(state.statusText)
                        .font(.subheadline)
                        .foregroundStyle(BrandPalette.muted)
                        .lineLimit(2)
                }
                .accessibilityElement(children: .combine)
                Spacer(minLength: 8)
                VStack(alignment: .trailing, spacing: 2) {
                    Text("SafetySense")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(BrandPalette.sandiaPink)
                    Text(attributes.modeDisplayName)
                        .font(.caption2)
                        .foregroundStyle(BrandPalette.muted)
                }
                .accessibilityElement(children: .combine)
            }
            LevelDetail(attributes: attributes, state: state, style: style, compact: false)
            TestNote(text: attributes.testNote)
            if isStale {
                Label("Open SafetySense to refresh", systemImage: "arrow.clockwise")
                    .font(.caption2)
                    .foregroundStyle(BrandPalette.muted)
            }
        }
        .padding(16)
    }
}

/// Says at every level that nobody is contacted, in builds where that's true.
private struct TestNote: View {
    let text: String?

    var body: some View {
        if let text {
            Label(text, systemImage: "testtube.2")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(BrandPalette.warnAmber)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
    }
}

/// What sits under the title for each level: next check-in, the answer buttons, or the
/// countdown to dispatch.
private struct LevelDetail: View {
    let attributes: GuardActivityAttributes
    let state: GuardActivityAttributes.ContentState
    let style: GuardLevelStyle
    let compact: Bool

    private var isTest: Bool { attributes.testNote != nil }

    var body: some View {
        switch state.level {
        case 0:
            HStack(spacing: 6) {
                Image(systemName: "clock")
                    .accessibilityHidden(true)
                if let next = state.nextCheckInAt, next > .now {
                    Text("\(attributes.checkInLabel) in \(Text(timerInterval: attributes.startedAt...next, countsDown: true).monospacedDigit())")
                } else {
                    Text("Guarding since \(Text(attributes.startedAt, style: .time))")
                }
            }
            .font(.caption)
            .foregroundStyle(BrandPalette.muted)
        case 1:
            VStack(alignment: .leading, spacing: 8) {
                if let deadline = state.deadline {
                    DeadlineBar(start: state.levelStartedAt, deadline: deadline, tint: style.tint,
                                label: isTest ? "Test: nobody is told" : "Your people are told if there's no answer")
                }
                CheckInButtons()
            }
        case 2:
            VStack(alignment: .leading, spacing: 6) {
                if let deadline = state.deadline {
                    DeadlineBar(start: state.levelStartedAt, deadline: deadline, tint: style.tint,
                                label: isTest ? "Test: no help is sent" : "Help is sent unless you cancel")
                }
                Text(isTest ? "If you need help, call 911."
                            : compact ? "Open SafetySense to cancel with your PIN."
                                      : "Open SafetySense to cancel with your Safety PIN. Your contacts have your live location.")
                    .font(.caption)
                    .foregroundStyle(BrandPalette.muted)
            }
        default:
            Text(isTest ? "If you need help, call 911." : "Stay somewhere safe if you can. If you're able to, call 911.")
                .font(.caption)
                .foregroundStyle(BrandPalette.ink)
        }
    }
}

/// Linear countdown that WidgetKit animates without app updates.
private struct DeadlineBar: View {
    let start: Date
    let deadline: Date
    let tint: Color
    let label: String

    var body: some View {
        let range = min(start, deadline)...max(start, deadline)
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(label)
                Spacer(minLength: 6)
                Text(timerInterval: range, countsDown: true)
                    .monospacedDigit()
                    .fontWeight(.semibold)
                    .foregroundStyle(tint)
            }
            .font(.caption)
            .foregroundStyle(BrandPalette.muted)
            ProgressView(timerInterval: range, countsDown: true) { EmptyView() } currentValueLabel: { EmptyView() }
                .progressViewStyle(.linear)
                .tint(tint)
                .accessibilityHidden(true)
        }
        .accessibilityElement(children: .combine)
    }
}

private struct CheckInButtons: View {
    var body: some View {
        HStack(spacing: 10) {
            Button(intent: CheckInOkayIntent()) {
                Label("I'm okay", systemImage: "checkmark")
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity, minHeight: 36)
            }
            .tint(BrandPalette.calmTeal)
            .accessibilityHint("Tells SafetySense you're safe")

            Button(intent: CheckInNeedHelpIntent()) {
                Label("Need help", systemImage: "exclamationmark.shield")
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity, minHeight: 36)
            }
            .tint(BrandPalette.danger)
            .accessibilityHint("Starts the alert to your trusted contacts")
        }
        .buttonStyle(.borderedProminent)
        .buttonBorderShape(.capsule)
        .foregroundStyle(BrandPalette.night)
    }
}

/// Countdown for the current step, else time to the next check-in, else elapsed time.
private struct TrailingTimer: View {
    let attributes: GuardActivityAttributes
    let state: GuardActivityAttributes.ContentState
    let style: GuardLevelStyle

    var body: some View {
        if let deadline = state.deadline, state.level >= 1, deadline > .now {
            Text(timerInterval: min(state.levelStartedAt, deadline)...deadline, countsDown: true)
                .foregroundStyle(style.tint)
                .multilineTextAlignment(.trailing)
                .accessibilityLabel("Time left")
        } else if state.level == 0, let next = state.nextCheckInAt, next > .now {
            Text(timerInterval: attributes.startedAt...next, countsDown: true)
                .foregroundStyle(BrandPalette.muted)
                .multilineTextAlignment(.trailing)
                .accessibilityLabel(attributes.checkInLabel)
        } else {
            Text(attributes.startedAt, style: .timer)
                .foregroundStyle(state.level == 0 ? BrandPalette.muted : style.tint)
                .multilineTextAlignment(.trailing)
                .accessibilityLabel("Time since start")
        }
    }
}

private struct ShieldBadge: View {
    let style: GuardLevelStyle
    let size: CGFloat

    var body: some View {
        ZStack {
            Circle().fill(style.tint.opacity(0.18))
            Circle().strokeBorder(style.tint.opacity(0.55), lineWidth: 1.5)
            Image(systemName: style.symbol)
                .font(.system(size: size * 0.42, weight: .semibold))
                .foregroundStyle(style.tint)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

// MARK: - Previews

extension GuardActivityAttributes {
    fileprivate static let preview = GuardActivityAttributes(modeRawValue: "night_out", modeDisplayName: "Night Out",
                                                             startedAt: .now.addingTimeInterval(-1800))
}

extension GuardActivityAttributes.ContentState {
    fileprivate static let guarding = Self(level: 0, statusText: "Nothing is saved unless something seems wrong.",
                                           nextCheckInAt: .now.addingTimeInterval(900))
    fileprivate static let checkIn = Self(level: 1, statusText: "Checking on you.",
                                          levelStartedAt: .now, deadline: .now.addingTimeInterval(45))
    fileprivate static let alert = Self(level: 2, statusText: "Maya and Jordan are being called.",
                                        levelStartedAt: .now.addingTimeInterval(-20), deadline: .now.addingTimeInterval(70))
    fileprivate static let dispatch = Self(level: 3, statusText: "Maya is on her way. Simulated dispatch notified.",
                                           levelStartedAt: .now.addingTimeInterval(-120))
}

#Preview("Lock Screen", as: .content, using: GuardActivityAttributes.preview) {
    GuardLiveActivity()
} contentStates: {
    GuardActivityAttributes.ContentState.guarding
    GuardActivityAttributes.ContentState.checkIn
    GuardActivityAttributes.ContentState.alert
    GuardActivityAttributes.ContentState.dispatch
}

#Preview("Island expanded", as: .dynamicIsland(.expanded), using: GuardActivityAttributes.preview) {
    GuardLiveActivity()
} contentStates: {
    GuardActivityAttributes.ContentState.guarding
    GuardActivityAttributes.ContentState.checkIn
    GuardActivityAttributes.ContentState.alert
}

#Preview("Island compact", as: .dynamicIsland(.compact), using: GuardActivityAttributes.preview) {
    GuardLiveActivity()
} contentStates: {
    GuardActivityAttributes.ContentState.guarding
    GuardActivityAttributes.ContentState.checkIn
}

#Preview("Island minimal", as: .dynamicIsland(.minimal), using: GuardActivityAttributes.preview) {
    GuardLiveActivity()
} contentStates: {
    GuardActivityAttributes.ContentState.guarding
    GuardActivityAttributes.ContentState.dispatch
}
