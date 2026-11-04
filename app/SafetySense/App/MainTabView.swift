import SwiftUI

struct MainTabView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        TabView(selection: $model.selectedTab) {
            ForEach(MainTab.allCases) { tab in
                Tab(tab.title, systemImage: tab.systemImage, value: tab) {
                    NavigationStack { content(for: tab) }
                }
            }
        }
    }

    @ViewBuilder
    private func content(for tab: MainTab) -> some View {
        switch tab {
        case .home: HomeView()
        case .contacts: ContactsView()
        case .vault: VaultView()
        case .support: SupportView()
        case .settings: SettingsView()
        }
    }
}

#Preview {
    MainTabView().environment(AppModel.preview())
}
