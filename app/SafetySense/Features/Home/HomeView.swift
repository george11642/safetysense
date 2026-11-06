import SwiftUI

/// Home (SPEC 9.2): greeting, mode chips, the big Start Guard ring, contacts readiness,
/// the trigger checklist and campus quick-dial.
struct HomeView: View {
    @Environment(AppModel.self) private var model
    @State private var sheet: SetupSheet?
    @State private var isStarting = false
    @State private var startTap = 0
    @State private var readiness = ReadinessSnapshot()
    @State private var confirmDrill = false

    enum SetupSheet: String, Identifiable { case walk, date, ride, fakeCall; var id: String { rawValue } }

    /// Lives on the model: it survives a relaunch, and Marked safe can send you back to it.
    private var mode: GuardMode { model.homeMode }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SSSpacing.lg) {
                greeting
                notices
                modePicker
                startRing
                FakeCallEntryRow { sheet = .fakeCall }
                contactsCard
                checklist
                quickDial
                sosFooter
            }
            .padding(.top, SSSpacing.sm)
            .padding(.bottom, SSSpacing.xxl)
        }
        .scrollIndicators(.hidden)
        .testModeBanner()
        .ssScreen()
        .toolbar(.hidden, for: .navigationBar)
        .sensoryFeedback(.impact(weight: .medium), trigger: startTap)
        .sensoryFeedback(.selection, trigger: mode)
        .sheet(item: $sheet) { sheet in
            NavigationStack {
                switch sheet {
                case .walk: WalkHomeSetupView()
                case .date: DateModeSetupView()
                case .ride: RideModeSetupView()
                case .fakeCall: FakeCallSetupView()
                }
            }
            .presentationDragIndicator(.visible)
        }
        .confirmationDialog("Run a practice drill?", isPresented: $confirmDrill, titleVisibility: .visible) {
            Button("Run drill") { Task { await model.runDrill(); refreshReadiness() } }
            Button("Not now", role: .cancel) {}
        } message: {
            Text("A TEST alert goes through the server. Nobody is called or texted, and nothing is dispatched.")
        }
        .onAppear(perform: refreshReadiness)
    }

    // MARK: Greeting

    private var greeting: some View {
        VStack(alignment: .leading, spacing: SSSpacing.xxs) {
            Text("\(Self.greeting(for: .now)), \(model.profile?.firstName ?? "there")").ssEyebrow(SSColor.accent)
            Text("Where are you headed?")
                .font(SSFont.display)
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }

    static func greeting(for date: Date) -> String {
        switch Calendar.current.component(.hour, from: date) {
        case 5..<12: "Good morning"
        case 12..<17: "Good afternoon"
        default: "Good evening"
        }
    }

    // MARK: Notices

    /// What would make a Guard in this mode weaker than it looks, said before it starts.
    @ViewBuilder
    private var notices: some View {
        let issues = model.permissions.issues(listening: model.listens(in: mode))
        if model.banner != nil || !issues.isEmpty || !readiness.hasSafetyPIN || model.isMissingPhone {
            VStack(spacing: SSSpacing.xs) {
                if let banner = model.banner { NoticeCard(text: banner, systemImage: "wifi.exclamationmark") }
                PermissionNotices(issues: issues)
                if model.isMissingPhone {
                    NoticeCard(text: "Add your phone number so a dispatcher can call you back.", systemImage: "phone",
                               actionTitle: "Add") { model.selectedTab = .settings }
                }
                if !readiness.hasSafetyPIN {
                    NoticeCard(text: "Set a safety PIN so you can cancel an alert quickly.", systemImage: "lock.open",
                               actionTitle: "Set") { model.selectedTab = .settings }
                }
            }
        }
    }

    // MARK: Modes

    private var modePicker: some View {
        VStack(alignment: .leading, spacing: SSSpacing.sm) {
            HStack(spacing: SSSpacing.xs) {
                ForEach(GuardMode.guardModes) { m in
                    ModeTile(mode: m, isSelected: m == mode) {
                        withAnimation(.snappy) { model.homeMode = m }
                    }
                    .accessibilityHint(m.tagline)
                }
            }
            Text(mode.tagline)
                .font(SSFont.callout)
                .foregroundStyle(SSColor.inkMuted)
                .contentTransition(.opacity)
                .id(mode)
                .transition(.opacity)
        }
    }

    /// QA: `-ssHomeMode walk|night_out|date|ride` preselects a mode for screenshots.
    static var launchMode: GuardMode? {
        let args = LaunchOptions.qaArguments
        guard let i = args.firstIndex(of: "-ssHomeMode"), i + 1 < args.count else { return nil }
        return GuardMode(rawValue: args[i + 1].lowercased())
    }

    // MARK: Start ring

    private var startRing: some View {
        Button(action: start) {
            GlowRing(progress: 1, tint: SSColor.accent, lineWidth: 18) {
                VStack(spacing: SSSpacing.xs) {
                    if isStarting {
                        ProgressView().tint(SSColor.accent).controlSize(.large)
                    } else {
                        Image(systemName: mode.systemImage)
                            .font(.title2.weight(.semibold))
                            .foregroundStyle(SSColor.accent)
                            .contentTransition(.symbolEffect(.replace))
                    }
                    Text("Start\nGuard")
                        .font(.system(.title, design: .rounded).weight(.bold))
                        .multilineTextAlignment(.center)
                        .foregroundStyle(SSColor.ink)
                    Text(mode.displayName).ssEyebrow()
                }
                .padding(SSSpacing.lg)
            }
            .frame(width: 236, height: 236)
            .frame(maxWidth: .infinity)
            .contentShape(Circle())
        }
        .buttonStyle(RingPressStyle())
        .disabled(isStarting)
        .accessibilityLabel("Start Guard, \(mode.displayName)")
        .accessibilityHint(mode.tagline)
        .padding(.vertical, SSSpacing.xs)
    }

    private func start() {
        startTap += 1
        switch mode {
        case .walk: sheet = .walk
        case .date: sheet = .date
        case .ride: sheet = .ride
        case .nightOut, .everyday:
            isStarting = true
            Task {
                await model.startGuard(mode: mode)
                isStarting = false
            }
        }
    }

    // MARK: Contacts

    private var contactsCard: some View {
        VStack(alignment: .leading, spacing: SSSpacing.sm) {
            SectionHeader("Trusted contacts", subtitle: "Your first contact gets a call. Everyone gets a live link if you need help.") {
                Button("Edit") { model.selectedTab = .contacts }
                    .frame(minWidth: 44, minHeight: 44)
            }
            if model.contacts.isEmpty {
                Card {
                    VStack(alignment: .leading, spacing: SSSpacing.sm) {
                        Label("No one yet", systemImage: "person.crop.circle.badge.plus")
                            .font(SSFont.headline).foregroundStyle(SSColor.warn)
                        Text("Add at least one person you trust. SafetySense can't alert anyone without them.")
                            .font(SSFont.callout).foregroundStyle(SSColor.inkMuted)
                        PrimaryButton("Add a contact", systemImage: "plus", role: .secondary) { model.selectedTab = .contacts }
                    }
                }
            } else {
                Button { model.selectedTab = .contacts } label: {
                    Card { contactSummary }
                }
                .buttonStyle(.plain)
                .foregroundStyle(SSColor.ink)
                .accessibilityHint("Opens Trusted contacts")
            }
        }
    }

    private var contactSummary: some View {
        VStack(spacing: SSSpacing.sm) {
            HStack {
                HStack(spacing: -6) {
                    ForEach(model.contacts.prefix(5)) { c in
                        ContactAvatar(name: c.name, tint: c.isPrimary ? SSColor.accent : SSColor.calm)
                            .overlay(Circle().stroke(SSColor.surface, lineWidth: 2))
                    }
                }
                Spacer()
                Text("\(model.contacts.count) added")
                    .font(SSFont.headline).foregroundStyle(SSColor.calm)
            }
            ForEach(model.contacts) { c in
                InfoRow(title: c.name) {
                    Text(c.isPrimary ? "Called first" : (c.relationship ?? "Contact"))
                        .foregroundStyle(c.isPrimary ? SSColor.accent : SSColor.inkMuted)
                }
            }
        }
    }

    // MARK: Trigger checklist

    private var checklist: some View {
        let items = readiness.items(contactsCount: model.contacts.count, settings: model.settings, delivery: model.alertDelivery)
        let done = items.filter(\.isDone).count
        return VStack(alignment: .leading, spacing: SSSpacing.sm) {
            SectionHeader("Ways to get help", subtitle: "\(done) of \(items.count) set up") {
                EmptyView()
            }
            Card(padding: 0) {
                VStack(spacing: 0) {
                    ProgressView(value: Double(done), total: Double(items.count))
                        .tint(done == items.count ? SSColor.calm : SSColor.accent)
                        .padding(.horizontal, SSSpacing.md)
                        .padding(.top, SSSpacing.md)
                        .accessibilityLabel("\(done) of \(items.count) set up")
                    ForEach(items) { item in
                        Button { open(item) } label: {
                            HStack(spacing: SSSpacing.sm) {
                                Image(systemName: item.isDone ? "checkmark.circle.fill" : "circle")
                                    .font(.title3)
                                    .foregroundStyle(item.isDone ? SSColor.calm : SSColor.inkMuted)
                                    .contentTransition(.symbolEffect(.replace))
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(item.title).font(SSFont.body).foregroundStyle(SSColor.ink)
                                    Text(item.detail).font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
                                }
                                Spacer(minLength: SSSpacing.xs)
                                if !item.isDone {
                                    Text(item.cta).font(SSFont.callout.weight(.semibold)).foregroundStyle(SSColor.accent)
                                }
                            }
                            .padding(.horizontal, SSSpacing.md)
                            .padding(.vertical, SSSpacing.sm)
                            .frame(minHeight: 52)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(item.title), \(item.isDone ? "done" : "not set up")")
                        .accessibilityHint(item.isDone ? "" : item.cta)
                    }
                }
                .padding(.bottom, SSSpacing.xs)
            }
        }
    }

    private func open(_ item: ReadinessItem) {
        switch item.id {
        case .contacts: model.selectedTab = .contacts
        case .drill: confirmDrill = true
        default: model.selectedTab = .settings
        }
    }

    private func refreshReadiness() {
        readiness = ReadinessSnapshot(hasSafetyPIN: model.store.hasSafetyPIN,
                                      hasDuressPIN: model.store.hasDuressPIN,
                                      hasSafeWord: !(model.store.safeWord ?? "").isEmpty)
    }

    // MARK: Quick dial

    private var quickDial: some View {
        let campus = model.profile?.campus ?? .unm
        return VStack(alignment: .leading, spacing: SSSpacing.sm) {
            SectionHeader(campus == .other ? "Nearby help" : "\(campus.displayName) quick dial") {
                Button("All support") { model.selectedTab = .support }
                    .frame(minHeight: 44)
            }
            Card(padding: 0) {
                VStack(spacing: 0) {
                    ForEach(Array(SupportDirectory.quickDial(for: campus).enumerated()), id: \.element.id) { i, r in
                        if i > 0 { Divider().overlay(SSColor.line).padding(.leading, SSSpacing.md) }
                        ResourceRow(resource: r, tint: r.kind == .report ? SSColor.calm : SSColor.accent, showsDetail: false)
                    }
                }
            }
        }
    }

    private var sosFooter: some View {
        VStack(alignment: .leading, spacing: SSSpacing.sm) {
            HoldToSOSButton(title: "Hold 2 seconds for SOS") {
                model.triggerSOS(.manualSOS, reason: "SOS held on Home")
            }
            Text("SafetySense supplements 911. If you're in danger right now, call 911.")
                .font(SSFont.caption)
                .foregroundStyle(SSColor.inkMuted)
        }
    }
}

// MARK: - Readiness

struct ReadinessItem: Identifiable, Equatable {
    enum ID: String { case contacts, safetyPIN, duressPIN, safeWord, actionButton, control, drill }
    let id: ID
    let title: String
    let detail: String
    let cta: String
    let isDone: Bool
}

/// Secret-backed flags read from the Keychain (not observable, so Home refreshes them on appear).
struct ReadinessSnapshot: Equatable {
    var hasSafetyPIN = false
    var hasDuressPIN = false
    var hasSafeWord = false

    func items(contactsCount: Int, settings: AppSettings, delivery: AlertDelivery) -> [ReadinessItem] {
        [
            ReadinessItem(id: .contacts, title: "Trusted contacts", detail: "1 to 5 people who get the call",
                          cta: "Add", isDone: contactsCount > 0),
            ReadinessItem(id: .safetyPIN, title: "Safety PIN", detail: "Cancels an alert that isn't needed",
                          cta: "Set", isDone: hasSafetyPIN),
            ReadinessItem(id: .duressPIN, title: "Duress PIN", detail: delivery.duressReadinessDetail,
                          cta: "Set", isDone: hasDuressPIN),
            ReadinessItem(id: .safeWord, title: "Safe word", detail: "Say it during Guard to start an alert",
                          cta: "Choose", isDone: hasSafeWord),
            ReadinessItem(id: .actionButton, title: "Action Button", detail: "Press and hold, no unlock needed",
                          cta: "Set up", isDone: settings.hasSetUpActionButton),
            ReadinessItem(id: .control, title: "Lock Screen control", detail: "One tap from Control Center",
                          cta: "Add", isDone: settings.hasAddedControl),
            ReadinessItem(id: .drill, title: "Practice drill", detail: "A TEST alert. Nobody is contacted",
                          cta: "Run", isDone: settings.hasCompletedDrill),
        ]
    }
}

/// Soft press for the big ring.
struct RingPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.95 : 1)
            .brightness(configuration.isPressed ? 0.06 : 0)
            .animation(.spring(response: 0.3, dampingFraction: 0.6), value: configuration.isPressed)
    }
}

#Preview("Home") { NavigationStack { HomeView() }.environment(AppModel.preview(screen: .home)) }

/// Equal-width mode selector tile: icon over label, so all four modes fit on one row.
private struct ModeTile: View {
    let mode: GuardMode
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Image(systemName: mode.systemImage)
                    .font(.system(size: 19, weight: .semibold))
                    .frame(height: 22)
                Text(mode.displayName)
                    .font(.system(.footnote, design: .rounded).weight(.semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity, minHeight: 68)
            .foregroundStyle(isSelected ? SSColor.onFill : SSColor.ink)
            .background(isSelected ? SSColor.accent : SSColor.surface,
                        in: RoundedRectangle(cornerRadius: SSRadius.small, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: SSRadius.small, style: .continuous)
                .stroke(isSelected ? .clear : SSColor.line, lineWidth: 1))
            .contentShape(RoundedRectangle(cornerRadius: SSRadius.small, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(mode.displayName)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}
