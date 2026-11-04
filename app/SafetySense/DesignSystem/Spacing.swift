import SwiftUI

enum SSSpacing {
    static let xxs: CGFloat = 4
    static let xs: CGFloat = 8
    static let sm: CGFloat = 12
    static let md: CGFloat = 16
    static let lg: CGFloat = 24
    static let xl: CGFloat = 32
    static let xxl: CGFloat = 48
    /// Standard screen side gutter.
    static let gutter: CGFloat = 20
}

enum SSRadius {
    static let small: CGFloat = 12
    static let card: CGFloat = 22
    static let button: CGFloat = 20
    static let pill: CGFloat = 999
}

extension View {
    /// Standard screen background + gutters for scrolling content.
    func ssScreen() -> some View {
        self
            .padding(.horizontal, SSSpacing.gutter)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(SSColor.background.ignoresSafeArea())
            .foregroundStyle(SSColor.ink)
            .overlay(alignment: .top) { StatusBarScrim() }
    }
}

/// Fades scrolled content out under the status bar / Dynamic Island so text never collides with
/// the clock on screens that hide the navigation bar.
struct StatusBarScrim: View {
    var body: some View {
        GeometryReader { geo in
            let top = geo.safeAreaInsets.top
            LinearGradient(stops: [.init(color: SSColor.background, location: 0),
                                   .init(color: SSColor.background, location: 0.7),
                                   .init(color: SSColor.background.opacity(0), location: 1)],
                           startPoint: .top, endPoint: .bottom)
                .frame(width: geo.size.width, height: top + 14)
                .offset(y: -top)
        }
        .frame(height: 0)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}
