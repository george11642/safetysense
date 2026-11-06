import SwiftUI

/// One short confirmation at the top of the screen: "Checked in", a contact's response.
struct AppToast: Identifiable, Equatable, Sendable {
    enum Style: Sendable { case calm }

    let id = UUID()
    var title: String
    var detail: String?
    var systemImage = "checkmark.circle.fill"

    /// `Next check-in in 20 minutes.` for Night Out, `Next check-in at 2:30 PM.` for Date, and
    /// Walk and Ride stay on until you arrive.
    static func checkedIn(mode: GuardMode, next: Date?, now: Date = .now) -> AppToast {
        let detail: String?
        switch mode {
        case .walk, .ride:
            detail = "Guard stays on until you arrive."
        case .date:
            detail = next.map { "Next check-in at \($0.formatted(date: .omitted, time: .shortened))." }
        case .nightOut, .everyday:
            detail = next.map { date in
                let minutes = max(1, Int((date.timeIntervalSince(now) / 60).rounded()))
                return "Next check-in in \(minutes) \(minutes == 1 ? "minute" : "minutes")."
            }
        }
        return AppToast(title: "Checked in. Glad you're okay.", detail: detail)
    }

    /// Contacts have no pronouns on file, so this stays neutral rather than guessing.
    static func response(who: String, action: String) -> AppToast {
        let name = who.split(separator: " ").first.map(String.init) ?? who
        return action == "called_911"
            ? AppToast(title: "\(name) called 911.", detail: "It's noted on your alert timeline.", systemImage: "phone.badge.checkmark")
            : AppToast(title: "\(name) is on the way.", detail: "This update is on your alert timeline.", systemImage: "figure.walk")
    }
}

/// Teal banner under the status bar. It waits until the app is on screen before timing out, so a
/// check-in answered from the Lock Screen is still there when the app opens.
private struct TopToastHost: ViewModifier {
    @Environment(AppModel.self) private var model
    @Environment(\.scenePhase) private var scenePhase

    func body(content: Content) -> some View {
        content
            .overlay(alignment: .top) {
                if let toast = model.toast {
                    banner(toast)
                        .transition(.move(edge: .top).combined(with: .opacity))
                        .task(id: "\(toast.id)\(scenePhase == .active)") {
                            guard scenePhase == .active else { return }
                            AccessibilityNotification.Announcement([toast.title, toast.detail].compactMap(\.self).joined(separator: " ")).post()
                            try? await Task.sleep(for: .seconds(4))
                            guard !Task.isCancelled, model.toast?.id == toast.id else { return }
                            withAnimation(.smooth) { model.toast = nil }
                        }
                }
            }
            .animation(.smooth, value: model.toast)
            .sensoryFeedback(.success, trigger: model.toast?.id) { _, new in new != nil }
    }

    private func banner(_ toast: AppToast) -> some View {
        HStack(spacing: SSSpacing.sm) {
            Image(systemName: toast.systemImage).font(.title3).foregroundStyle(SSColor.calm)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 1) {
                Text(toast.title).font(SSFont.headline).foregroundStyle(SSColor.ink)
                if let detail = toast.detail {
                    Text(detail).font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, SSSpacing.md)
        .padding(.vertical, SSSpacing.sm)
        .background(SSColor.surface, in: RoundedRectangle(cornerRadius: SSRadius.card, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: SSRadius.card, style: .continuous).stroke(SSColor.calm.opacity(0.6), lineWidth: 1))
        .padding(.horizontal, SSSpacing.sm)
        .padding(.top, SSSpacing.xxs)
        .onTapGesture { withAnimation(.smooth) { model.toast = nil } }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isStaticText)
    }
}

extension View {
    /// Shows `AppModel.toast` above this screen.
    func topToastHost() -> some View { modifier(TopToastHost()) }
}

/// One calm line about something that needs attention, with an optional action.
struct NoticeCard: View {
    let text: String
    var systemImage = "exclamationmark.triangle"
    var tint: Color = SSColor.warn
    var actionTitle: String?
    var action: () -> Void = {}

    var body: some View {
        Card(padding: SSSpacing.sm, tint: tint) {
            HStack(alignment: .center, spacing: SSSpacing.sm) {
                Image(systemName: systemImage).foregroundStyle(tint).accessibilityHidden(true)
                Text(text).font(SSFont.callout).foregroundStyle(SSColor.ink)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if let actionTitle {
                    Button(actionTitle, action: action)
                        .font(SSFont.callout.weight(.semibold))
                        .foregroundStyle(SSColor.accent)
                        .frame(minHeight: 44)
                }
            }
        }
    }
}

/// Opens this app's page in iOS Settings, where a denied permission can be turned back on.
struct PermissionNotices: View {
    let issues: [GuardPermissionIssue]
    @Environment(\.openURL) private var openURL

    var body: some View {
        ForEach(issues) { issue in
            NoticeCard(text: issue.message, systemImage: issue.systemImage, actionTitle: "Settings") {
                if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
            }
        }
    }
}

#Preview {
    VStack(spacing: 12) {
        NoticeCard(text: "Couldn't reach SafetySense's server yet. We'll keep trying.")
        PermissionNotices(issues: [.microphone, .location])
    }
    .padding()
    .frame(maxHeight: .infinity)
    .background(SSColor.background)
    .foregroundStyle(SSColor.ink)
    .environment(AppModel.preview())
}
