import SwiftUI

/// The persistent "nobody is contacted" line, for screens that could otherwise look like help
/// is coming. It stays pinned while the screen scrolls. Hidden when alerts are real.
struct TestModeBanner: View {
    let text: String

    var body: some View {
        Label(text, systemImage: "testtube.2")
            .font(SSFont.caption.weight(.semibold))
            .foregroundStyle(SSColor.ink)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, SSSpacing.sm)
            .padding(.vertical, SSSpacing.xs)
            .background(SSColor.warn.opacity(0.22), in: RoundedRectangle(cornerRadius: SSRadius.small, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: SSRadius.small, style: .continuous).stroke(SSColor.warn.opacity(0.6), lineWidth: 1))
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(text)
    }
}

private struct TestModeBannerHost: ViewModifier {
    @Environment(AppModel.self) private var model

    func body(content: Content) -> some View {
        content.safeAreaInset(edge: .top, spacing: SSSpacing.xs) {
            if let text = model.alertDelivery.bannerText {
                TestModeBanner(text: text).padding(.top, SSSpacing.xxs)
            }
        }
    }
}

extension View {
    /// Apply before `.ssScreen()` so the banner sits inside the screen gutters.
    func testModeBanner() -> some View { modifier(TestModeBannerHost()) }
}

#Preview {
    VStack(spacing: 12) {
        TestModeBanner(text: AlertDelivery.test.bannerText ?? "")
        TestModeBanner(text: AlertDelivery.demo.bannerText ?? "")
    }
    .padding()
    .frame(maxHeight: .infinity)
    .background(SSColor.background)
}
