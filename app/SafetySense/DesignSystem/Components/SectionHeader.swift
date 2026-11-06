import SwiftUI

/// Eyebrow + optional subtitle + optional trailing action, above a group of content.
struct SectionHeader<Trailing: View>: View {
    let title: String
    var subtitle: String?
    @ViewBuilder var trailing: Trailing

    init(_ title: String, subtitle: String? = nil, @ViewBuilder trailing: () -> Trailing = { EmptyView() }) {
        self.title = title
        self.subtitle = subtitle
        self.trailing = trailing()
    }

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title).ssEyebrow()
                if let subtitle { Text(subtitle).font(SSFont.callout).foregroundStyle(SSColor.inkMuted) }
            }
            Spacer()
            trailing.font(SSFont.callout.weight(.semibold)).foregroundStyle(SSColor.accent)
        }
        .accessibilityAddTraits(.isHeader)
    }
}

#Preview {
    VStack(spacing: 24) {
        SectionHeader("Trusted contacts", subtitle: "Your first contact gets a call. Everyone gets a live link.") { Button("Edit") {} }
        SectionHeader("Modes")
    }
    .padding()
    .background(SSColor.background)
}
