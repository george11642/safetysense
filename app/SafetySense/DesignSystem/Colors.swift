import SwiftUI

/// Color tokens from the SafetySense visual identity (docs/safetysense-spec.html, app palette).
/// The app is dark-only by design: calm at night, readable in a bar, discreet in a pocket.
enum SSColor {
    static let background = BrandPalette.night
    static let surface = BrandPalette.card
    static let surfaceRaised = BrandPalette.cardRaised
    static let line = BrandPalette.line
    static let ink = BrandPalette.ink
    static let inkMuted = BrandPalette.muted
    static let accent = BrandPalette.sandiaPink
    static let accentSoft = BrandPalette.sandiaPink.opacity(0.16)
    static let calm = BrandPalette.calmTeal
    static let calmSoft = BrandPalette.calmTeal.opacity(0.16)
    static let warn = BrandPalette.warnAmber
    static let warnSoft = BrandPalette.warnAmber.opacity(0.16)
    static let danger = BrandPalette.danger
    static let dangerSoft = BrandPalette.danger.opacity(0.16)
    /// Text on accent/calm/warn/danger fills.
    static let onFill = BrandPalette.night

    /// Tint for each escalation level: teal → amber → coral → coral.
    static func level(_ level: EscalationLevel) -> Color {
        switch level {
        case .guarding: calm
        case .checkIn: warn
        case .alert, .dispatch: danger
        }
    }
}

#Preview("Palette") {
    let swatches: [(String, Color)] = [
        ("background", SSColor.background), ("surface", SSColor.surface), ("raised", SSColor.surfaceRaised),
        ("ink", SSColor.ink), ("muted", SSColor.inkMuted), ("accent", SSColor.accent),
        ("calm", SSColor.calm), ("warn", SSColor.warn), ("danger", SSColor.danger),
    ]
    return ScrollView {
        VStack(alignment: .leading, spacing: SSSpacing.sm) {
            ForEach(swatches, id: \.0) { name, color in
                HStack {
                    RoundedRectangle(cornerRadius: 10).fill(color).frame(width: 56, height: 36)
                        .overlay(RoundedRectangle(cornerRadius: 10).stroke(SSColor.line))
                    Text(name).font(SSFont.mono(14)).foregroundStyle(SSColor.ink)
                }
            }
        }.padding()
    }
    .background(SSColor.background)
}
