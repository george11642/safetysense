import SwiftUI

/// Aftercare (SPEC 9.9). Trauma-informed: nothing here is required, nothing is assumed,
/// and every option says plainly what it does and doesn't set in motion.
struct SupportView: View {
    @Environment(AppModel.self) private var model

    private var campus: Campus { model.profile?.campus ?? .unm }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SSSpacing.lg) {
                header

                section(number: "1", title: "Talk to someone now",
                        subtitle: "Confidential. An advocate listens and explains your options. Calling doesn't start a report.",
                        icon: "bubble.left.and.text.bubble.right", tint: SSColor.accent,
                        resources: SupportDirectory.advocates(for: campus) + [SupportDirectory.lifeline988])

                section(number: "2", title: "Medical care",
                        subtitle: "A SANE exam is confidential and you don't need a police report. Evidence can be collected and kept while you decide.",
                        icon: "cross.case", tint: SSColor.calm,
                        resources: SupportDirectory.medical)

                section(number: "3", title: "Reporting options",
                        subtitle: "Only if and when you choose. You can talk to an advocate first, and you can stop at any point.",
                        icon: "doc.text", tint: SSColor.warn,
                        resources: SupportDirectory.reporting(for: campus))

                keepPrivate

                footer
            }
            .padding(.top, SSSpacing.md)
            .padding(.bottom, SSSpacing.xxl)
        }
        .ssScreen()
        .toolbar(.hidden, for: .navigationBar)
    }

    // MARK: Sections

    private var header: some View {
        VStack(alignment: .leading, spacing: SSSpacing.xs) {
            Text("You're safe here. Take your time.").ssEyebrow(SSColor.accent)
            Text("Support").font(SSFont.display)
            Text("Whatever happened, it isn't your fault. You get to decide what happens next, including nothing at all.")
                .font(SSFont.body)
                .foregroundStyle(SSColor.inkMuted)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func section(number: String, title: String, subtitle: String, icon: String, tint: Color,
                         resources: [SupportResource]) -> some View {
        VStack(alignment: .leading, spacing: SSSpacing.sm) {
            HStack(alignment: .top, spacing: SSSpacing.sm) {
                Image(systemName: icon)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(tint)
                    .frame(width: 44, height: 44)
                    .background(tint.opacity(0.14), in: RoundedRectangle(cornerRadius: SSRadius.small, style: .continuous))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 4) {
                    Text(title).font(SSFont.title)
                    Text(subtitle).font(SSFont.callout).foregroundStyle(SSColor.inkMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isHeader)

            Card(padding: 0) {
                VStack(spacing: 0) {
                    ForEach(Array(resources.enumerated()), id: \.element.id) { index, resource in
                        if index > 0 { Divider().overlay(SSColor.line).padding(.leading, SSSpacing.md) }
                        ResourceRow(resource: resource, tint: tint)
                    }
                }
            }
        }
    }

    private var keepPrivate: some View {
        VStack(alignment: .leading, spacing: SSSpacing.sm) {
            HStack(alignment: .top, spacing: SSSpacing.sm) {
                Image(systemName: "lock.shield")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(SSColor.inkMuted)
                    .frame(width: 44, height: 44)
                    .background(SSColor.surfaceRaised, in: RoundedRectangle(cornerRadius: SSRadius.small, style: .continuous))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Keep it private").font(SSFont.title)
                    Text("That's a real choice too. Anything SafetySense recorded stays encrypted in your Vault, and only you can open it. You can share it later, or delete it.")
                        .font(SSFont.callout).foregroundStyle(SSColor.inkMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isHeader)
            PrimaryButton("Open my Vault", systemImage: "lock.doc", role: .secondary) {
                model.selectedTab = .vault
            }
        }
    }

    private var footer: some View {
        VStack(alignment: .leading, spacing: SSSpacing.sm) {
            Link(destination: PhoneLink.url("911")!) {
                Label("In danger right now? Call 911", systemImage: "phone.fill")
                    .font(SSFont.headline)
                    .frame(maxWidth: .infinity, minHeight: 56)
                    .foregroundStyle(SSColor.onFill)
                    .background(SSColor.danger, in: RoundedRectangle(cornerRadius: SSRadius.button, style: .continuous))
            }
            .accessibilityHint("Calls 911")
            Text("SafetySense supplements 911 and never replaces it. Numbers checked \(SupportDirectory.verifiedOn).")
                .font(SSFont.caption)
                .foregroundStyle(SSColor.inkMuted)
        }
    }
}

/// One tappable phone resource. Tapping the row calls; the chevron reveals what to expect.
struct ResourceRow: View {
    let resource: SupportResource
    var tint: Color = SSColor.accent
    var showsDetail = true

    var body: some View {
        HStack(alignment: .center, spacing: SSSpacing.sm) {
            VStack(alignment: .leading, spacing: 3) {
                Text(resource.name).font(SSFont.headline).foregroundStyle(SSColor.ink)
                    .fixedSize(horizontal: false, vertical: true)
                if showsDetail {
                    Text(resource.detail).font(SSFont.callout).foregroundStyle(SSColor.inkMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                HStack(spacing: SSSpacing.xs) {
                    Text(resource.phone).font(SSFont.mono(14, weight: .semibold)).foregroundStyle(SSColor.ink.opacity(0.9))
                    if resource.isAllHours {
                        Text("24/7").font(SSFont.mono(11, weight: .bold)).foregroundStyle(tint)
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(tint.opacity(0.16), in: Capsule())
                    }
                }
                .padding(.top, 1)
            }
            Spacer(minLength: SSSpacing.xs)
            if let url = PhoneLink.url(resource.phone) {
                Link(destination: url) {
                    Image(systemName: "phone.fill")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(SSColor.onFill)
                        .frame(width: 48, height: 48)
                        .background(tint, in: Circle())
                }
                .accessibilityLabel("Call \(resource.name)")
                .accessibilityHint(resource.phone)
            }
        }
        .padding(SSSpacing.md)
        .accessibilityElement(children: .contain)
    }
}

#Preview("Support") { NavigationStack { SupportView() }.environment(AppModel.preview(screen: .support)) }
