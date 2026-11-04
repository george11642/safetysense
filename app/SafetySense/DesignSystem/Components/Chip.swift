import SwiftUI

/// Selectable pill (mode chips, filters).
struct Chip: View {
    let title: String
    var systemImage: String?
    var isSelected = false
    var tint: Color = SSColor.accent
    var action: () -> Void = {}

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if let systemImage { Image(systemName: systemImage).imageScale(.small) }
                Text(title)
            }
            .font(SSFont.callout.weight(.semibold))
            .padding(.horizontal, 14)
            .frame(minHeight: 40)
            .foregroundStyle(isSelected ? SSColor.onFill : SSColor.ink)
            .background(isSelected ? tint : SSColor.surface, in: Capsule())
            .overlay(Capsule().stroke(isSelected ? .clear : SSColor.line, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

#Preview {
    HStack {
        Chip(title: "Night Out", systemImage: "moon.stars", isSelected: true)
        Chip(title: "Walk Home", systemImage: "figure.walk")
    }
    .padding()
    .background(SSColor.background)
}
