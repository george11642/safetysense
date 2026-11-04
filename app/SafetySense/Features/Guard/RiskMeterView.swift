import SwiftUI

/// Live, explainable risk meter (SPEC 6.2). Shows the bucket, a fill bar against the alert
/// threshold, and the signals that contributed, strongest first, in plain words.
struct RiskMeterView: View {
    let assessment: RiskAssessment
    /// Score at which the engine raises an alert (balanced sensitivity). Used only to scale the bar.
    var alertScore: Double = 2.0

    private var fill: Double { min(1, max(0.03, assessment.score / alertScore)) }

    private var tint: Color {
        switch assessment.level {
        case .calm: SSColor.calm
        case .elevated: SSColor.warn
        case .high, .critical: SSColor.danger
        }
    }

    private var headline: String {
        switch assessment.level {
        case .calm: "Low"
        case .elevated: "Raised"
        case .high: "High"
        case .critical: "Alerting"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: SSSpacing.sm) {
            HStack(alignment: .firstTextBaseline) {
                Text("Risk").ssEyebrow()
                Spacer()
                Text(headline)
                    .font(SSFont.headline)
                    .foregroundStyle(tint)
                    .contentTransition(.numericText())
            }

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(SSColor.surfaceRaised)
                    Capsule()
                        .fill(LinearGradient(colors: [SSColor.calm, tint], startPoint: .leading, endPoint: .trailing))
                        .frame(width: geo.size.width * fill)
                    // Check-in threshold tick at 50 %.
                    Rectangle().fill(SSColor.inkMuted.opacity(0.5))
                        .frame(width: 2, height: 14)
                        .offset(x: geo.size.width * 0.5 - 1)
                }
            }
            .frame(height: 10)
            .animation(.smooth(duration: 0.8), value: fill)
            .accessibilityHidden(true)

            if assessment.contributors.isEmpty {
                Text("All quiet. Nothing has added up to a concern.")
                    .font(SSFont.callout).foregroundStyle(SSColor.inkMuted)
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(assessment.contributors.prefix(4)) { signal in
                        HStack(spacing: SSSpacing.xs) {
                            Image(systemName: signal.kind.source.systemImage)
                                .foregroundStyle(tint)
                                .frame(width: 20)
                                .accessibilityHidden(true)
                            Text(signal.kind.displayName).font(SSFont.callout.weight(.semibold))
                            if let c = signal.confidence {
                                Text("\(Int((c * 100).rounded()))%").font(SSFont.mono(12)).foregroundStyle(SSColor.inkMuted)
                            }
                            Spacer()
                            Text(signal.timestamp, style: .relative)
                                .font(SSFont.mono(12)).foregroundStyle(SSColor.inkMuted)
                                .lineLimit(1)
                        }
                        .accessibilityElement(children: .combine)
                    }
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }

            if let adj = assessment.secondOpinionAdjustment, adj != 0 {
                Label(adj > 0 ? "On-device AI thinks this sounds more serious" : "On-device AI thinks this sounds like fun, not trouble",
                      systemImage: "sparkles")
                    .font(SSFont.caption)
                    .foregroundStyle(SSColor.inkMuted)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Risk \(headline). \(assessment.explanation)")
        .animation(.smooth, value: assessment.contributors.count)
    }
}

#Preview {
    let now = Date.now
    VStack(spacing: 16) {
        Card { RiskMeterView(assessment: .calm) }
        Card {
            RiskMeterView(assessment: RiskAssessment(
                score: 1.3, level: .elevated,
                contributors: [
                    RiskSignal(kind: .shout, weight: 0.6, timestamp: now.addingTimeInterval(-40), confidence: 0.82),
                    RiskSignal(kind: .impact, weight: 0.7, timestamp: now.addingTimeInterval(-12)),
                ],
                explanation: "Shouting, impact", secondOpinionAdjustment: 0.1, evaluatedAt: now))
        }
    }
    .padding()
    .background(SSColor.background)
    .foregroundStyle(SSColor.ink)
}
