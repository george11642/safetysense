import SwiftUI

/// Type scale. Display/titles use SF Pro Rounded semibold (the in-app stand-in for
/// Familjen Grotesk); utility labels use SF Mono. All sizes scale with Dynamic Type. The fixed
/// sizes below are scaled by hand, up to a cap, so timers and labels still fit their rings and pills.
enum SSFont {
    static let hero = Font.system(.largeTitle, design: .rounded).weight(.bold)
    static var display: Font { .system(size: scaled(34, upTo: 1.5), weight: .semibold, design: .rounded) }
    static let title = Font.system(.title2, design: .rounded).weight(.semibold)
    static let headline = Font.system(.headline, design: .rounded).weight(.semibold)
    static let body = Font.system(.body)
    static let callout = Font.system(.callout)
    static let caption = Font.system(.caption)
    /// Uppercase eyebrow labels ("GUARD ACTIVE").
    static let eyebrow = Font.system(.caption, design: .monospaced).weight(.semibold)
    /// Big numerals for timers.
    static var timer: Font { .system(size: scaled(44, upTo: 1.3), weight: .semibold, design: .rounded).monospacedDigit() }

    static func mono(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .system(size: scaled(size, upTo: 1.6), weight: weight, design: .monospaced)
    }

    /// `size` at the person's text size, at most `cap` times larger.
    static func scaled(_ size: CGFloat, upTo cap: CGFloat) -> CGFloat {
        min(UIFontMetrics.default.scaledValue(for: size), size * cap)
    }
}

extension View {
    /// Mono, uppercase, tracked, muted: the "eyebrow" label style from the visual identity.
    func ssEyebrow(_ color: Color = SSColor.inkMuted) -> some View {
        font(SSFont.eyebrow).textCase(.uppercase).tracking(1.1).foregroundStyle(color)
    }
}

#Preview("Type scale") {
    VStack(alignment: .leading, spacing: 12) {
        Text("Guard active").ssEyebrow()
        Text("Calls for help").font(SSFont.hero)
        Text("Display 34").font(SSFont.display)
        Text("Title").font(SSFont.title)
        Text("Headline").font(SSFont.headline)
        Text("Body copy is calm and plain.").font(SSFont.body)
        Text("00:45").font(SSFont.timer)
    }
    .foregroundStyle(SSColor.ink)
    .padding()
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .background(SSColor.background)
}
