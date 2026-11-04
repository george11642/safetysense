import SwiftUI

/// Raw brand colors, shared by the app and widgets. The app uses the richer
/// `SSColor` tokens in DesignSystem; widgets use these directly.
public enum BrandPalette {
    public static let night = Color(hex: 0x14131F)      // app background
    public static let card = Color(hex: 0x211F31)       // cards / surfaces
    public static let cardRaised = Color(hex: 0x2B2940) // pressed / raised surfaces
    public static let line = Color(hex: 0x34324A)       // hairlines
    public static let ink = Color(hex: 0xF1EFF8)        // primary text
    public static let muted = Color(hex: 0xA19FB6)      // secondary text
    public static let sandiaPink = Color(hex: 0xEF7B9B) // accent
    public static let calmTeal = Color(hex: 0x5CC7B2)   // safe / guarding
    public static let warnAmber = Color(hex: 0xF0B55A)  // check-in
    public static let danger = Color(hex: 0xEF6A5C)     // alert / dispatch
}

public extension Color {
    /// `Color(hex: 0xEF7B9B)`
    init(hex: UInt32, opacity: Double = 1) {
        let r = Double((hex >> 16) & 0xFF) / 255
        let g = Double((hex >> 8) & 0xFF) / 255
        let b = Double(hex & 0xFF) / 255
        self.init(.sRGB, red: r, green: g, blue: b, opacity: opacity)
    }
}
