import SwiftUI

/// Small status capsule ("Guarding", "Mic on"). `pulsing` adds a breathing dot for live states.
struct StatusPill: View {
    let text: String
    var systemImage: String?
    var tint: Color = SSColor.calm
    var pulsing = false

    @State private var pulse = false

    var body: some View {
        HStack(spacing: 6) {
            if let systemImage {
                Image(systemName: systemImage).imageScale(.small)
            } else {
                Circle().fill(tint).frame(width: 7, height: 7)
                    .opacity(pulsing && pulse ? 0.35 : 1)
            }
            Text(text)
        }
        .font(SSFont.mono(12, weight: .semibold))
        .textCase(.uppercase)
        .foregroundStyle(tint)
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(tint.opacity(0.14), in: Capsule())
        .onAppear {
            guard pulsing else { return }
            withAnimation(.easeInOut(duration: 1.2).repeatForever(autoreverses: true)) { pulse = true }
        }
        .accessibilityElement(children: .combine)
    }
}

#Preview {
    VStack(alignment: .leading) {
        StatusPill(text: "Guarding", pulsing: true)
        StatusPill(text: "Check-in", tint: SSColor.warn)
        StatusPill(text: "Alert", tint: SSColor.danger)
        StatusPill(text: "Mic on", systemImage: "mic.fill", tint: SSColor.accent)
    }
    .padding()
    .background(SSColor.background)
}
