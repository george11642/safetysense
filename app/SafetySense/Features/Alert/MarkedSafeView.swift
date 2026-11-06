import SwiftUI

/// Marked safe (frames 13, 13e, 19, 19e): where every accepted PIN lands, from the countdown and
/// from Alert Active. The safety and duress PINs must look identical here: same words, same
/// timing, same haptic. Nothing below may read anything that differs between them.
struct MarkedSafeView: View {
    @Environment(AppModel.self) private var model
    @State private var clipCount = 0
    @State private var appeared = 0

    private var summary: MarkedSafeSummary? { model.markedSafe }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SSSpacing.lg) {
                HStack {
                    StatusPill(text: "Alert cancelled", tint: SSColor.calm)
                    Spacer()
                    if let endedAt = summary?.endedAt {
                        Text(endedAt, format: .dateTime.hour().minute()).font(SSFont.mono(12)).foregroundStyle(SSColor.inkMuted)
                    }
                }
                mark
                VStack(alignment: .leading, spacing: SSSpacing.xs) {
                    Text("You're marked safe.").font(SSFont.display)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityAddTraits(.isHeader)
                    Text(summary?.bodyText ?? "")
                        .font(SSFont.callout).foregroundStyle(SSColor.inkMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                careCard
            }
            .padding(.top, SSSpacing.sm)
            .padding(.bottom, SSSpacing.md)
        }
        .scrollIndicators(.hidden)
        .scrollBounceBehavior(.basedOnSize)
        .pinnedFooter {
            PrimaryButton("Find support", systemImage: "heart.fill") { model.leaveMarkedSafe(toSupport: true) }
            PrimaryButton("Back to home", role: .secondary) { model.leaveMarkedSafe(toSupport: false) }
        }
        .ssScreen()
        .background(backdrop)
        .sensoryFeedback(.success, trigger: appeared)
        .task {
            appeared += 1
            await watchClips()
        }
    }

    private var backdrop: some View {
        RadialGradient(colors: [SSColor.calm.opacity(0.14), .clear], center: .center, startRadius: 0, endRadius: 380)
            .ignoresSafeArea()
            .allowsHitTesting(false)
    }

    private var mark: some View {
        Image(systemName: "checkmark")
            .font(.system(size: 44, weight: .bold))
            .foregroundStyle(SSColor.calm)
            .frame(width: 132, height: 132)
            .background(SSColor.calmSoft, in: Circle())
            .overlay(Circle().stroke(SSColor.calm.opacity(0.6), lineWidth: 2))
            .frame(maxWidth: .infinity)
            .padding(.vertical, SSSpacing.xs)
            .accessibilityHidden(true)
    }

    private var careCard: some View {
        Card {
            VStack(alignment: .leading, spacing: SSSpacing.xs) {
                Text("Take a breath.").font(SSFont.headline)
                Text("Whatever happened, it isn't your fault. If you'd like to talk to someone, support is confidential, and what happens next is your call.")
                    .font(SSFont.callout).foregroundStyle(SSColor.inkMuted)
                    .fixedSize(horizontal: false, vertical: true)
                if let summary {
                    Text(summary.summaryLine(clipCount: clipCount))
                        .font(SSFont.mono(11, weight: .medium)).foregroundStyle(SSColor.accent)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, SSSpacing.xxs)
                }
            }
        }
    }

    /// The clip index is readable while the Vault is locked, so this never asks for Face ID.
    /// The last chunk can land just after the cancel, so it's read again for a few seconds.
    private func watchClips() async {
        guard let id = summary?.alertID else { return }
        for _ in 0..<6 {
            clipCount = model.services.vault.clips.filter { $0.alertID == id }.count
            try? await Task.sleep(for: .seconds(1))
        }
    }
}

#Preview("After dispatch") {
    let model = AppModel.preview(screen: .markedSafe)
    return MarkedSafeView().environment(model)
}
