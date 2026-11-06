import SwiftUI

// MARK: 1. Welcome

struct WelcomeStepView: View {
    @Environment(AppModel.self) private var model
    var next: () -> Void
    @State private var appeared = false

    var body: some View {
        VStack(spacing: 0) {
            Spacer(minLength: SSSpacing.lg)
            ShieldHero(size: 220)
                .scaleEffect(appeared ? 1 : 0.85)
                .opacity(appeared ? 1 : 0)
            Spacer(minLength: SSSpacing.lg)
            VStack(alignment: .leading, spacing: SSSpacing.sm) {
                Text("SafetySense").ssEyebrow(SSColor.accent)
                Text(model.alertDelivery.welcomeHeadline)
                    .font(SSFont.hero)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)
                Text("Setup takes about three minutes. You can skip anything except choosing who to call.")
                    .font(SSFont.callout).foregroundStyle(SSColor.inkMuted)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .offset(y: appeared ? 0 : 16)
            .opacity(appeared ? 1 : 0)
            Spacer(minLength: SSSpacing.lg)
            PrimaryButton("Get started", systemImage: "arrow.right", action: next)
            Text("SafetySense is not a replacement for 911. If you're in danger now, call 911.")
                .font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
                .padding(.top, SSSpacing.sm)
                .padding(.bottom, SSSpacing.sm)
        }
        .padding(.horizontal, SSSpacing.gutter)
        .onAppear { withAnimation(.smooth(duration: 0.9)) { appeared = true } }
    }
}

// MARK: 2. Three promises

struct PromisesStepView: View {
    @Environment(AppModel.self) private var model
    var next: () -> Void
    @State private var page = 0
    @ScaledMetric(relativeTo: .body) private var cardHeight: CGFloat = 400

    struct Promise: Identifiable {
        let id: Int
        let icon: String
        let title: String
        let body: String
        let tint: Color
    }

    static func promises(delivery: AlertDelivery) -> [Promise] { [
        Promise(id: 0, icon: "ear", title: "SafetySense listens during a Guard, or in an alert.",
                body: "Listening happens during a Guard session you start, like a night out or a walk home. Any alert also turns the microphone on to record encrypted evidence, even if listening was off. When it's over, the microphone is off.",
                tint: SSColor.calm),
        Promise(id: 1, icon: "lock.shield", title: "No audio is saved unless something's wrong.",
                body: "Sound is checked on your iPhone in a 30-second memory loop and then forgotten. Only if an alert starts is it encrypted and kept as evidence, and only you can unlock it.",
                tint: SSColor.accent),
        Promise(id: 2, icon: "phone.and.waveform", title: delivery.helpPromiseTitle,
                body: delivery.helpPromiseBody,
                tint: SSColor.warn),
    ] }

    private var promises: [Promise] { Self.promises(delivery: model.alertDelivery) }

    var body: some View {
        OnboardingPage(eyebrow: OnboardingStep.promises.label, title: "Three promises") {
            TabView(selection: $page) {
                ForEach(promises) { p in
                    PromiseCard(promise: p, isCurrent: page == p.id).tag(p.id).padding(.horizontal, 2)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .frame(height: min(cardHeight, 640))
            HStack(spacing: 8) {
                ForEach(promises) { p in
                    Capsule().fill(page == p.id ? SSColor.accent : SSColor.line)
                        .frame(width: page == p.id ? 22 : 8, height: 8)
                }
            }
            .frame(maxWidth: .infinity)
            .animation(.spring(duration: 0.35), value: page)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Promise \(page + 1) of 3")
        } footer: {
            PrimaryButton(page < promises.count - 1 ? "Next" : "Sounds good", systemImage: "arrow.right") {
                if page < promises.count - 1 { withAnimation(.smooth) { page += 1 } } else { next() }
            }
        }
        .sensoryFeedback(.selection, trigger: page)
    }
}

private struct PromiseCard: View {
    let promise: PromisesStepView.Promise
    let isCurrent: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: SSSpacing.lg) {
            // Hero: the icon inside soft concentric rings, so the card's upper half reads as an
            // illustration rather than empty space.
            Image(systemName: promise.icon)
                .font(.system(size: 50, weight: .semibold))
                .foregroundStyle(promise.tint)
                .frame(width: 104, height: 104)
                .background(promise.tint.opacity(0.16), in: Circle())
                .background {
                    // Decorative rings sit behind the icon without affecting layout.
                    ZStack {
                        Circle()
                            .fill(RadialGradient(colors: [promise.tint.opacity(0.26), promise.tint.opacity(0)],
                                                 center: .center, startRadius: 4, endRadius: 100))
                            .frame(width: 200, height: 200)
                        ForEach(0..<3, id: \.self) { i in
                            Circle()
                                .stroke(promise.tint.opacity(0.24 - Double(i) * 0.07), lineWidth: 1)
                                .frame(width: 150 + CGFloat(i) * 56, height: 150 + CGFloat(i) * 56)
                        }
                    }
                    .allowsHitTesting(false)
                }
                .symbolEffect(.bounce, value: isCurrent)
                .frame(maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
            .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: SSSpacing.sm) {
                Text(promise.title).font(SSFont.title).fixedSize(horizontal: false, vertical: true)
                Text(promise.body).font(SSFont.body).foregroundStyle(SSColor.inkMuted).fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(SSSpacing.lg)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(SSColor.surface, in: RoundedRectangle(cornerRadius: SSRadius.card, style: .continuous))
        .clipShape(RoundedRectangle(cornerRadius: SSRadius.card, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: SSRadius.card, style: .continuous).stroke(promise.tint.opacity(0.35)))
        .scaleEffect(isCurrent ? 1 : 0.94)
        .animation(.smooth, value: isCurrent)
        .accessibilityElement(children: .combine)
    }
}

// MARK: 3. Campus

struct CampusStepView: View {
    @Environment(AppModel.self) private var model
    var next: () -> Void

    @State private var name = ""
    @State private var phone = ""
    @State private var campus: Campus?
    @FocusState private var focus: Field?

    private enum Field { case name, phone }

    var body: some View {
        OnboardingPage(eyebrow: OnboardingStep.campus.label, title: "About you",
                       subtitle: model.alertDelivery.aboutYouSubtitle) {
            VStack(alignment: .leading, spacing: SSSpacing.md) {
                labeled("First name") {
                    TextField("Alex", text: $name)
                        .textContentType(.givenName)
                        .textInputAutocapitalization(.words)
                        .submitLabel(.next)
                        .focused($focus, equals: .name)
                        .onSubmit { focus = .phone }
                }
                labeled("Your mobile number") {
                    TextField("(505) 555-0123", text: $phone)
                        .keyboardType(.phonePad)
                        .textContentType(.telephoneNumber)
                        .focused($focus, equals: .phone)
                        .onChange(of: phone) { _, new in
                            let f = PhoneNumber.formatAsTyped(new)
                            if f != new { phone = f }
                        }
                }
                if !phone.isEmpty, PhoneNumber.normalizedUS(phone) == nil, phone.filter(\.isNumber).count >= 10 {
                    Text("SafetySense works with US numbers for now.").font(SSFont.caption).foregroundStyle(SSColor.warn)
                }
            }

            VStack(alignment: .leading, spacing: SSSpacing.sm) {
                Text("Your campus").ssEyebrow()
                HStack(spacing: SSSpacing.sm) {
                    ForEach(Campus.allCases) { c in campusCard(c) }
                }
            }

            if let campus {
                VStack(alignment: .leading, spacing: SSSpacing.xs) {
                    Text("Loaded for \(campus == .other ? "Albuquerque" : campus.displayName)").ssEyebrow(SSColor.calm)
                    Card {
                        VStack(spacing: 0) {
                            ForEach(Array(CampusResources.all(for: campus).enumerated()), id: \.element.id) { i, r in
                                SafetyResourceRow(resource: r)
                                if i < CampusResources.all(for: campus).count - 1 { Divider().overlay(SSColor.line) }
                            }
                        }
                    }
                    .id(campus)
                    .transition(.opacity.combined(with: .offset(y: 12)))
                    Text("These live in the Support tab too. Nothing is required of you.")
                        .font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
                }
            }
        } footer: {
            PrimaryButton("Continue", systemImage: "arrow.right") {
                save()
                next()
            }
        }
        .animation(.smooth, value: campus)
        .sensoryFeedback(.selection, trigger: campus)
        .onAppear {
            if let p = model.profile {
                name = p.firstName
                phone = p.phone.isEmpty ? "" : PhoneNumber.display(p.phone)
                if !p.name.isEmpty || !p.phone.isEmpty { campus = p.campus }
            }
        }
        .onDisappear(perform: save)
    }

    private func campusCard(_ c: Campus) -> some View {
        let selected = campus == c
        return Button {
            campus = c
            save()
        } label: {
            VStack(spacing: 6) {
                Image(systemName: c == .other ? "mappin.and.ellipse" : "graduationcap.fill").font(.title3)
                Text(c.displayName).font(SSFont.headline)
            }
            .frame(maxWidth: .infinity, minHeight: 84)
            .foregroundStyle(selected ? SSColor.onFill : SSColor.ink)
            .background(selected ? SSColor.accent : SSColor.surface, in: RoundedRectangle(cornerRadius: SSRadius.card, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: SSRadius.card, style: .continuous).stroke(selected ? .clear : SSColor.line))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(c == .other ? "Other or not a student" : c.displayName)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private func labeled<Content: View>(_ label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: SSSpacing.xs) {
            Text(label).ssEyebrow()
            content()
                .font(SSFont.body)
                .padding(.horizontal, SSSpacing.md)
                .frame(minHeight: 52)
                .background(SSColor.surface, in: RoundedRectangle(cornerRadius: SSRadius.small, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: SSRadius.small, style: .continuous).stroke(SSColor.line))
                .accessibilityLabel(label)
        }
    }

    private func save() {
        var p = model.profile ?? Profile()
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        // Keep a previously entered last name if the first name didn't change.
        if trimmed != p.firstName { p.name = trimmed }
        p.phone = PhoneNumber.normalizedUS(phone) ?? ""
        if let campus { p.campus = campus }
        if p != model.profile { model.profile = p }
    }
}

#Preview("Welcome") {
    WelcomeStepView {}.environment(AppModel.preview()).background(SSColor.background).foregroundStyle(SSColor.ink).preferredColorScheme(.dark)
}

#Preview("Promises") {
    PromisesStepView {}.background(SSColor.background).foregroundStyle(SSColor.ink).preferredColorScheme(.dark)
}

#Preview("Campus") {
    CampusStepView {}.background(SSColor.background).foregroundStyle(SSColor.ink)
        .environment(AppModel.preview(screen: .onboarding)).preferredColorScheme(.dark)
}
