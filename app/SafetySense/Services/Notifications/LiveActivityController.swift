import ActivityKit
import Foundation
import os

/// Runs the Guard Live Activity (Lock Screen + Dynamic Island) for a session.
///
/// - Starts calm (teal, "Guarding") with the next check-in countdown.
/// - On a check-in it lights the screen with an alert ("You okay?") and shows I'm okay / Need help
///   buttons (`CheckInOkayIntent` / `CheckInNeedHelpIntent`, which run in the app's process).
/// - During an alert it shows the countdown to dispatch, then "Help is on the way".
/// - A contact's confirmed response replaces the status line ("Maya is on the way.").
/// It also mirrors "guarding" for the Guard control and refreshes the controls.
@MainActor
final class LiveActivityController: LiveActivityControllerProtocol {
    private var activity: Activity<GuardActivityAttributes>?
    private var currentLevel = 0
    private var levelStartedAt = Date.now
    private var nextCheckInAt: Date?
    /// What should be showing, kept so the activity can be requested again if it's gone.
    private var wanted: GuardActivityAttributes?
    private var lastState: GuardActivityAttributes.ContentState?
    private let log = Logger(subsystem: "com.georgeteifel.SafetySense", category: "live-activity")

    init() {
        // Adopt an activity left over from a previous launch of the same session.
        activity = Activity<GuardActivityAttributes>.activities.first { $0.activityState == .active }
        if let state = activity?.content.state {
            currentLevel = state.level
            levelStartedAt = state.levelStartedAt
            nextCheckInAt = state.nextCheckInAt
        }
    }

    var isActive: Bool {
        guard let activity else { return false }
        return activity.activityState == .active || activity.activityState == .stale
    }

    func start(session: GuardSession) async {
        WidgetMirror.setGuardActive(true)
        currentLevel = 0
        levelStartedAt = .now
        nextCheckInAt = session.nextCheckInAt
        let state = GuardActivityAttributes.ContentState(level: 0, statusText: EscalationLevel.guarding.statusLine,
                                                         nextCheckInAt: session.nextCheckInAt,
                                                         levelStartedAt: levelStartedAt, deadline: nil)

        if let activity, activity.attributes.startedAt == session.startedAt {
            await Self.push(activity.id, content(for: state), alert: nil)
            return
        }
        await endAll()
        wanted = GuardActivityAttributes(modeRawValue: session.mode.rawValue,
                                         modeDisplayName: session.mode.displayName,
                                         startedAt: session.startedAt)
        lastState = state
        request()
    }

    func startForAlert() async {
        guard !isActive else { return }
        let session = GuardSession(mode: .everyday)
        wanted = GuardActivityAttributes(modeRawValue: session.mode.rawValue, modeDisplayName: "Alert",
                                         startedAt: session.startedAt)
        currentLevel = 0
        levelStartedAt = .now
        lastState = GuardActivityAttributes.ContentState(level: 2, statusText: EscalationLevel.alert.statusLine,
                                                         levelStartedAt: levelStartedAt)
        request()
    }

    func refresh() async {
        guard !isActive, wanted != nil else { return }
        request()
    }

    /// iOS only allows this in the foreground or from a `LiveActivityIntent`, so a failure here
    /// is expected; `refresh()` tries again when the app opens.
    private func request() {
        guard let wanted, let lastState else { return }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            log.notice("Live Activities are turned off for SafetySense")
            return
        }
        do {
            activity = try Activity.request(attributes: wanted, content: content(for: lastState), pushType: nil)
        } catch {
            log.error("Couldn't start the Live Activity")
        }
    }

    func update(level: EscalationLevel, statusText: String, nextCheckInAt: Date?, deadline: Date?) async {
        let rose = level.rawValue > currentLevel
        if level.rawValue != currentLevel {
            currentLevel = level.rawValue
            levelStartedAt = .now
        }
        self.nextCheckInAt = nextCheckInAt
        let state = GuardActivityAttributes.ContentState(level: level.rawValue, statusText: statusText,
                                                         nextCheckInAt: self.nextCheckInAt,
                                                         levelStartedAt: levelStartedAt, deadline: deadline)
        lastState = state
        guard let activity else { return }
        await Self.push(activity.id, content(for: state), alert: rose ? Self.alertConfiguration(for: level) : nil)
    }

    func end() async {
        WidgetMirror.setGuardActive(false)
        wanted = nil
        lastState = nil
        await endAll()
        activity = nil
        currentLevel = 0
    }

    // MARK: Helpers

    private func content(for state: GuardActivityAttributes.ContentState) -> ActivityContent<GuardActivityAttributes.ContentState> {
        // Stale a little after the step's deadline so the system can show it's out of date if
        // the app stops updating it; the higher the level, the higher it ranks.
        let stale = (state.deadline ?? state.nextCheckInAt).map { $0.addingTimeInterval(5 * 60) }
        let relevance: Double = switch state.level {
        case 0: 50
        case 1: 90
        default: 100
        }
        return ActivityContent(state: state, staleDate: stale, relevanceScore: relevance)
    }

    /// `Activity` isn't Sendable, so updates look it up by id off the main actor.
    private nonisolated static func push(_ id: String,
                                         _ content: ActivityContent<GuardActivityAttributes.ContentState>,
                                         alert: AlertConfiguration?) async {
        guard let running = Activity<GuardActivityAttributes>.activities.first(where: { $0.id == id }) else { return }
        if let alert {
            await running.update(content, alertConfiguration: alert)
        } else {
            await running.update(content)
        }
    }

    private static func alertConfiguration(for level: EscalationLevel) -> AlertConfiguration? {
        switch level {
        case .guarding:
            nil
        case .checkIn:
            AlertConfiguration(title: "You okay?", body: "Tap I'm okay, or Need help if you're not.", sound: .default)
        case .alert:
            AlertConfiguration(title: "Telling your people", body: "Open SafetySense to cancel with your PIN.", sound: .default)
        case .dispatch:
            AlertConfiguration(title: "Help is on the way", body: "Stay somewhere safe if you can. Call 911 if you're able.", sound: .default)
        }
    }

    private func endAll() async {
        let final = GuardActivityAttributes.ContentState(level: 0, statusText: "Session ended")
        for running in Activity<GuardActivityAttributes>.activities {
            await running.end(ActivityContent(state: final, staleDate: nil), dismissalPolicy: .immediate)
        }
    }
}
