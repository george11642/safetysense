import SwiftUI

/// Circular countdown ring. Use `RingTimer(deadline:total:)` for live countdowns
/// (check-in 45 s, alert → dispatch 90 s) or `RingTimer(progress:)` for static states.
struct RingTimer: View {
    private enum Source { case progress(Double, String?), deadline(Date, TimeInterval) }
    private let source: Source
    var tint: Color = SSColor.warn
    var lineWidth: CGFloat = 14
    var caption: String?

    init(progress: Double, label: String? = nil, tint: Color = SSColor.warn, lineWidth: CGFloat = 14, caption: String? = nil) {
        self.source = .progress(progress, label)
        self.tint = tint
        self.lineWidth = lineWidth
        self.caption = caption
    }

    init(deadline: Date, total: TimeInterval, tint: Color = SSColor.warn, lineWidth: CGFloat = 14, caption: String? = nil) {
        self.source = .deadline(deadline, total)
        self.tint = tint
        self.lineWidth = lineWidth
        self.caption = caption
    }

    var body: some View {
        switch source {
        case .progress(let p, let label):
            ring(progress: p, label: label)
        case .deadline(let deadline, let total):
            TimelineView(.periodic(from: .now, by: 0.25)) { context in
                let remaining = max(0, deadline.timeIntervalSince(context.date))
                let seconds = Int(remaining.rounded(.up))
                ring(progress: total > 0 ? remaining / total : 0, label: "\(seconds)")
                    .accessibilityValue("\(seconds) \(seconds == 1 ? "second" : "seconds")")
            }
        }
    }

    private func ring(progress: Double, label: String?) -> some View {
        ZStack {
            // Inset by half the stroke so the ring stays inside its frame (no clipping in scroll views).
            Circle().inset(by: lineWidth / 2).stroke(tint.opacity(0.18), lineWidth: lineWidth)
            Circle().inset(by: lineWidth / 2)
                .trim(from: 0, to: max(0, min(1, progress)))
                .stroke(tint, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(.linear(duration: 0.25), value: progress)
            VStack(spacing: 2) {
                if let label {
                    Text(label).font(SSFont.timer).foregroundStyle(SSColor.ink).contentTransition(.numericText())
                        .lineLimit(1).minimumScaleFactor(0.5)
                }
                if let caption { Text(caption).ssEyebrow().lineLimit(1).minimumScaleFactor(0.7) }
            }
            .padding(.horizontal, lineWidth + 10)
        }
        .accessibilityElement(children: .combine)
    }
}

#Preview {
    HStack(spacing: 24) {
        RingTimer(deadline: .now.addingTimeInterval(45), total: 45, caption: "seconds").frame(width: 160, height: 160)
        RingTimer(progress: 0.4, label: "36", tint: SSColor.danger).frame(width: 120, height: 120)
    }
    .padding()
    .background(SSColor.background)
}
