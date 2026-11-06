import SwiftUI

// Small building blocks shared by the Screens module (Home, Guard, Alert, Support, Vault, Modes).
// They sit on top of the DesignSystem components and use only SSColor / SSFont / SSSpacing tokens.

// MARK: - Glow ring

/// The big conic ring from the visual identity (Home "Start Guard", Guard "elapsed").
/// `progress` 0...1 fills clockwise from 12 o'clock over a soft tinted disc.
struct GlowRing<Center: View>: View {
    var progress: Double
    var tint: Color
    var lineWidth: CGFloat = 16
    var glows = true
    @ViewBuilder var center: Center

    @State private var breathe = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            Circle()
                .fill(RadialGradient(colors: [tint.opacity(0.22), tint.opacity(0.06)],
                                     center: .center, startRadius: 0, endRadius: 160))
                .padding(lineWidth / 2)
            Circle().stroke(SSColor.surfaceRaised, lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: max(0.001, min(1, progress)))
                .stroke(tint, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .shadow(color: glows ? tint.opacity(breathe ? 0.65 : 0.25) : .clear, radius: breathe ? 18 : 8)
                .animation(.smooth(duration: 0.6), value: progress)
            center
        }
        .onAppear {
            guard glows, !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 2.4).repeatForever(autoreverses: true)) { breathe = true }
        }
    }
}

// MARK: - Rows

/// A label / value row inside a Card.
struct InfoRow<Trailing: View>: View {
    let title: String
    var systemImage: String?
    var tint: Color = SSColor.inkMuted
    @ViewBuilder var trailing: Trailing

    var body: some View {
        HStack(spacing: SSSpacing.sm) {
            if let systemImage {
                Image(systemName: systemImage)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(tint)
                    .frame(width: 26)
                    .accessibilityHidden(true)
            }
            Text(title).font(SSFont.body).foregroundStyle(SSColor.ink)
            Spacer(minLength: SSSpacing.xs)
            trailing
                .font(SSFont.callout.weight(.semibold))
                .multilineTextAlignment(.trailing)
        }
        .frame(minHeight: 32)
        .accessibilityElement(children: .combine)
    }
}

/// Small mono capsule used for sensor states and badges ("MIC · ON-DEVICE").
struct TagChip: View {
    let text: String
    var systemImage: String?
    var isOn = true
    var tint: Color = SSColor.calm

    var body: some View {
        HStack(spacing: 5) {
            if let systemImage { Image(systemName: systemImage).imageScale(.small) }
            Text(text)
        }
        .font(SSFont.mono(12, weight: .semibold))
        .textCase(.uppercase)
        .lineLimit(1)
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .foregroundStyle(isOn ? tint : SSColor.inkMuted)
        .background((isOn ? tint.opacity(0.16) : SSColor.surfaceRaised), in: Capsule())
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(text), \(isOn ? "on" : "off")")
    }
}

/// Wrapping horizontal layout for chips.
struct FlowRow: Layout {
    var spacing: CGFloat = SSSpacing.xs

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0, widest: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > 0, x + size.width > maxWidth {
                y += rowHeight + spacing
                x = 0
                rowHeight = 0
            }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
            widest = max(widest, x - spacing)
        }
        return CGSize(width: min(widest, maxWidth), height: y + rowHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, rowHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > bounds.minX, x + size.width > bounds.maxX {
                y += rowHeight + spacing
                x = bounds.minX
                rowHeight = 0
            }
            view.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}

/// Initials avatar for a trusted contact.
struct ContactAvatar: View {
    let name: String
    var tint: Color = SSColor.accent
    var size: CGFloat = 36

    var body: some View {
        Text(initials)
            .font(.system(size: size * 0.38, weight: .semibold, design: .rounded))
            .foregroundStyle(tint)
            .frame(width: size, height: size)
            .background(tint.opacity(0.16), in: Circle())
            .accessibilityHidden(true)
    }

    private var initials: String {
        let parts = name.split(separator: " ").prefix(2)
        return parts.compactMap(\.first).map(String.init).joined().uppercased()
    }
}

// MARK: - Phone links

enum PhoneLink {
    /// `tel:` URL for a display number like "505-277-2241" or "1-800-656-4673".
    static func url(_ number: String) -> URL? {
        let digits = number.filter(\.isNumber)
        return URL(string: "tel:\(digits)")
    }
}

/// Friendly names for the people who'll be alerted ("Maya and Jordan", "Maya, Jordan and Sam").
enum NameList {
    static func join(_ names: [String]) -> String {
        switch names.count {
        case 0: return "your contacts"
        case 1: return names[0]
        case 2: return "\(names[0]) and \(names[1])"
        default: return names.dropLast().joined(separator: ", ") + " and " + names[names.count - 1]
        }
    }
}

extension RiskSignalKind.Source {
    var systemImage: String {
        switch self {
        case .audio: "waveform"
        case .speech: "quote.bubble"
        case .motion: "figure.fall"
        case .location: "location"
        case .responsiveness: "hand.raised"
        case .server: "antenna.radiowaves.left.and.right.slash"
        case .ai: "sparkles"
        }
    }
}

extension TimeInterval {
    /// "1:42" or "12:05:09".
    var clockText: String {
        let total = Int(max(0, self))
        let h = total / 3600, m = (total % 3600) / 60, s = total % 60
        return h > 0 ? String(format: "%d:%02d:%02d", h, m, s) : String(format: "%d:%02d", m, s)
    }
}

#Preview("Screen kit") {
    ScrollView {
        VStack(spacing: SSSpacing.lg) {
            GlowRing(progress: 0.72, tint: SSColor.calm) {
                VStack { Text("1:42").font(SSFont.timer); Text("elapsed").ssEyebrow() }
            }
            .frame(width: 220, height: 220)
            Card {
                VStack(spacing: SSSpacing.xs) {
                    InfoRow(title: "Next check-in", systemImage: "clock") { Text("12:10 AM") }
                    InfoRow(title: "Trusted contacts", systemImage: "person.2") { Text("3 added").foregroundStyle(SSColor.calm) }
                }
            }
            FlowRow {
                TagChip(text: "Mic · on-device", systemImage: "mic.fill")
                TagChip(text: "Location", systemImage: "location.fill")
                TagChip(text: "Motion", systemImage: "figure.walk.motion", isOn: false)
            }
            HStack { ContactAvatar(name: "Maya Chen"); ContactAvatar(name: "Jordan Lee", tint: SSColor.calm) }
        }
        .padding()
    }
    .background(SSColor.background)
    .foregroundStyle(SSColor.ink)
}
