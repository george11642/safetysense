import SwiftUI

/// What iOS allows right now, what each permission does, and the way back to iOS Settings.
struct PermissionsSettingsView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openURL) private var openURL
    @Environment(\.scenePhase) private var scenePhase

    private var permissions: GuardPermissions { model.permissions }

    var body: some View {
        List {
            Section {
                row("Microphone", state: Self.label(permissions.microphone), isOn: permissions.microphone == .granted,
                    detail: "During a Guard session you start. Any alert also turns it on and records encrypted audio. Otherwise sound stays in a 30-second memory loop.",
                    icon: "mic.fill")
                row("Location", state: Self.label(permissions.location), isOn: permissions.location == .always,
                    detail: permissions.location == .whenInUse
                        ? model.alertDelivery.locationWhileUsingNote
                        : "Shared only during a session or an alert.",
                    icon: "location.fill")
                row("Notifications", state: Self.label(permissions.notifications), isOn: permissions.notifications == .granted,
                    detail: permissions.notificationDetail, icon: "bell.badge.fill")
                row("Motion", state: "On", isOn: true,
                    detail: "Notices a hard fall or a sudden impact during a Guard. iOS doesn't ask about this one.",
                    icon: "figure.fall")
            } footer: {
                Text("You can change any of these in iOS Settings. SafetySense keeps working with what you allow.")
            }
            .listRowBackground(SSColor.surface)

            Section {
                Button {
                    if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
                } label: {
                    Label("Open iOS Settings", systemImage: "gear")
                }
                .frame(minHeight: 44)
            }
            .listRowBackground(SSColor.surface)
        }
        .settingsListStyle("Permissions")
        .task { await model.refreshPermissions() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Task { await model.refreshPermissions() } }   // Back from iOS Settings.
        }
    }

    static func label(_ state: PermissionState) -> String {
        switch state {
        case .granted: "On"
        case .denied: "Off"
        case .notAsked: "Not asked"
        }
    }

    static func label(_ location: LocationAuthorization) -> String {
        switch location {
        case .always: "Always"
        case .whenInUse: "While Using"
        case .denied: "Off"
        case .notDetermined: "Not asked"
        }
    }

    private func row(_ title: String, state: String, isOn: Bool, detail: String, icon: String) -> some View {
        HStack(alignment: .top, spacing: SSSpacing.sm) {
            Image(systemName: icon).foregroundStyle(isOn ? SSColor.calm : SSColor.inkMuted).frame(width: 28)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text(title)
                    Spacer()
                    Text(state).foregroundStyle(isOn ? SSColor.calm : SSColor.warn)
                }
                Text(detail).font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.vertical, SSSpacing.xxs)
        .accessibilityElement(children: .combine)
    }
}

#Preview { NavigationStack { PermissionsSettingsView() }.environment(AppModel.preview()).preferredColorScheme(.dark) }
