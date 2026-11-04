import SwiftUI

/// Rounded surface container.
struct Card<Content: View>: View {
    var padding: CGFloat = SSSpacing.md
    var tint: Color?
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(tint?.opacity(0.14) ?? SSColor.surface,
                        in: RoundedRectangle(cornerRadius: SSRadius.card, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: SSRadius.card, style: .continuous)
                .stroke(tint?.opacity(0.35) ?? SSColor.line.opacity(0.6), lineWidth: 1))
    }
}

#Preview {
    VStack(spacing: SSSpacing.sm) {
        Card {
            VStack(alignment: .leading, spacing: 6) {
                Text("Trusted contacts").ssEyebrow()
                Text("Maya, Jordan and Sam").font(SSFont.headline)
            }
        }
        Card(tint: SSColor.calm) { Text("Guarding quietly").font(SSFont.headline) }
    }
    .foregroundStyle(SSColor.ink)
    .padding()
    .background(SSColor.background)
}
