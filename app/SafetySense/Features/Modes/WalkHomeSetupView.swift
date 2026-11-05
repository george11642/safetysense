import SwiftUI

/// Walk Home setup (SPEC 5): where you're going, how long it should take, and who's
/// following along. SafetySense checks in at your ETA; no answer alerts your contacts.
struct WalkHomeSetupView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var destination = ""
    @State private var destinationFix: LocationFix?
    @State private var minutes = 15
    @State private var followerID: UUID?
    @State private var listen = false
    @State private var textFollower = true
    @State private var isStarting = false
    @State private var started = 0

    private var follower: TrustedContact? {
        model.contacts.first { $0.id == followerID } ?? model.contacts.first { $0.isPrimary } ?? model.contacts.first
    }

    private var eta: Date { Date.now.addingTimeInterval(Double(minutes) * 60) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SSSpacing.lg) {
                SetupHeader(mode: .walk, title: "Walk with someone watching",
                            subtitle: "Tell SafetySense where you're headed. If you don't make it by your ETA, it checks on you.")

                DestinationField(label: "Going to", text: $destination, fix: $destinationFix, prompt: "Dorm, car, bus stop…",
                                 isSearchEnabled: model.services.flavor == .live)

                VStack(alignment: .leading, spacing: SSSpacing.sm) {
                    Text("About how long?").ssEyebrow()
                    MinuteChips(minutes: $minutes, options: [5, 10, 15, 20, 30])
                    Text("Arrival check at \(eta.formatted(date: .omitted, time: .shortened)).")
                        .font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
                        .contentTransition(.numericText())
                }

                followerPicker

                Card {
                    VStack(alignment: .leading, spacing: SSSpacing.sm) {
                        Toggle(isOn: $listen) {
                            VStack(alignment: .leading, spacing: 2) {
                                Label("Listen on the way", systemImage: "mic")
                                    .font(SSFont.body)
                                Text("Notices a scream or your safe word. Audio stays on your phone.")
                                    .font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
                            }
                        }
                        .tint(SSColor.accent)
                        if follower != nil {
                            Divider().overlay(SSColor.line)
                            Toggle(isOn: $textFollower) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Label("Text \(follower?.firstName ?? "them") a heads-up", systemImage: "message")
                                        .font(SSFont.body)
                                    Text("Opens Messages with a note you can edit and send.")
                                        .font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
                                }
                            }
                            .tint(SSColor.accent)
                        }
                    }
                }

            }
            .padding(.top, SSSpacing.md)
            .padding(.bottom, SSSpacing.lg)
        }
        .scrollDismissesKeyboard(.interactively)
        .pinnedFooter {
            PrimaryButton("Start walking", systemImage: "figure.walk", isLoading: isStarting) { start() }
            Text("If you don't arrive, \(NameList.join(model.contacts.map(\.firstName))) get your live location.")
                .font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
                .multilineTextAlignment(.center)
        }
        .ssScreen()
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(SSColor.background, for: .navigationBar)
        .toolbarBackgroundVisibility(.visible, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
        }
        .sensoryFeedback(.success, trigger: started)
        .onAppear {
            listen = model.settings.listenDuringWalk
            if followerID == nil { followerID = follower?.id }
        }
    }

    private var followerPicker: some View {
        VStack(alignment: .leading, spacing: SSSpacing.sm) {
            Text("Who's following along").ssEyebrow()
            if model.contacts.isEmpty {
                Card {
                    VStack(alignment: .leading, spacing: SSSpacing.xs) {
                        Text("Add a trusted contact first so someone can be alerted.")
                            .font(SSFont.callout).foregroundStyle(SSColor.inkMuted)
                        PrimaryButton("Add a contact", systemImage: "plus", role: .secondary) {
                            dismiss()
                            model.selectedTab = .contacts
                        }
                    }
                }
            } else {
                Card(padding: 0) {
                    VStack(spacing: 0) {
                        ForEach(Array(model.contacts.enumerated()), id: \.element.id) { i, c in
                            if i > 0 { Divider().overlay(SSColor.line).padding(.leading, 64) }
                            Button {
                                withAnimation(.snappy) { followerID = c.id }
                            } label: {
                                HStack(spacing: SSSpacing.sm) {
                                    ContactAvatar(name: c.name, tint: follower?.id == c.id ? SSColor.accent : SSColor.inkMuted)
                                    VStack(alignment: .leading, spacing: 1) {
                                        Text(c.name).font(SSFont.headline).foregroundStyle(SSColor.ink)
                                        if let r = c.relationship { Text(r).font(SSFont.caption).foregroundStyle(SSColor.inkMuted) }
                                    }
                                    Spacer()
                                    Image(systemName: follower?.id == c.id ? "checkmark.circle.fill" : "circle")
                                        .font(.title3)
                                        .foregroundStyle(follower?.id == c.id ? SSColor.accent : SSColor.inkMuted)
                                        .contentTransition(.symbolEffect(.replace))
                                }
                                .padding(.horizontal, SSSpacing.md)
                                .padding(.vertical, SSSpacing.sm)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .accessibilityAddTraits(follower?.id == c.id ? [.isSelected] : [])
                        }
                    }
                }
            }
        }
    }

    private func start() {
        isStarting = true
        if model.settings.listenDuringWalk != listen { model.settings.listenDuringWalk = listen }
        let checkAfter = Double(minutes + 2) * 60
        let place = destination.trimmingCharacters(in: .whitespaces)
        let heads = follower
        let picked = destinationFix
        let canSearch = model.services.flavor == .live
        Task {
            var target: GuardDestination?
            if !place.isEmpty {
                var fix = picked
                if fix == nil, canSearch { fix = await DestinationSearch.fix(forText: place) }
                target = GuardDestination(name: place, fix: fix)
            }
            await model.startGuard(mode: .walk, destination: target, arrivalCheckAfter: checkAfter)
            isStarting = false
            started += 1
            if textFollower, let heads, let url = Self.headsUpURL(to: heads, destination: place, eta: eta) {
                openURL(url)
            }
            dismiss()
        }
    }

    static func headsUpURL(to contact: TrustedContact, destination: String, eta: Date) -> URL? {
        let place = destination.isEmpty ? "home" : destination
        let body = "Walking to \(place) now, should be there by \(eta.formatted(date: .omitted, time: .shortened)). SafetySense will let you know if I don't make it."
        var components = URLComponents()
        components.scheme = "sms"
        components.path = contact.phone
        components.queryItems = [URLQueryItem(name: "body", value: body)]
        return components.url
    }
}

#Preview { NavigationStack { WalkHomeSetupView() }.environment(AppModel.preview()) }
