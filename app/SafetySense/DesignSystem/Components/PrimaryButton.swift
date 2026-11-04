import SwiftUI

enum SSButtonRole: Sendable { case accent, calm, danger, secondary, quiet }

/// Full-width, 56 pt tall, big-target button. Used for every primary action.
struct PrimaryButton: View {
    let title: String
    var systemImage: String?
    var role: SSButtonRole = .accent
    var isLoading = false
    let action: () -> Void

    init(_ title: String, systemImage: String? = nil, role: SSButtonRole = .accent,
         isLoading: Bool = false, action: @escaping () -> Void) {
        self.title = title
        self.systemImage = systemImage
        self.role = role
        self.isLoading = isLoading
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: SSSpacing.xs) {
                if isLoading {
                    ProgressView().tint(foreground)
                } else if let systemImage {
                    Image(systemName: systemImage)
                }
                Text(title)
            }
            .font(SSFont.headline)
            .frame(maxWidth: .infinity, minHeight: 56)
        }
        .buttonStyle(SSFillButtonStyle(fill: fill, foreground: foreground, stroke: stroke))
        .disabled(isLoading)
        .accessibilityLabel(title)
    }

    private var fill: Color {
        switch role {
        case .accent: SSColor.accent
        case .calm: SSColor.calm
        case .danger: SSColor.danger
        case .secondary: SSColor.surface
        case .quiet: .clear
        }
    }

    private var foreground: Color {
        switch role {
        case .accent, .calm, .danger: SSColor.onFill
        case .secondary: SSColor.ink
        case .quiet: SSColor.inkMuted
        }
    }

    private var stroke: Color? { role == .secondary ? SSColor.line : nil }
}

struct SSFillButtonStyle: ButtonStyle {
    var fill: Color
    var foreground: Color
    var stroke: Color?
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        // Disabled buttons stay opaque (they often sit over scrolling content) and go muted.
        configuration.label
            .foregroundStyle(isEnabled ? foreground : SSColor.inkMuted)
            .background(isEnabled || fill == .clear ? fill : SSColor.surface,
                        in: RoundedRectangle(cornerRadius: SSRadius.button, style: .continuous))
            .overlay {
                if let stroke {
                    RoundedRectangle(cornerRadius: SSRadius.button, style: .continuous).stroke(stroke, lineWidth: 1)
                }
            }
            .opacity(configuration.isPressed ? 0.85 : 1)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.snappy(duration: 0.15), value: configuration.isPressed)
    }
}

#Preview {
    VStack(spacing: SSSpacing.sm) {
        PrimaryButton("Start Guard", systemImage: "shield.lefthalf.filled") {}
        PrimaryButton("I'm okay", role: .calm) {}
        PrimaryButton("Send help now", systemImage: "exclamationmark.triangle.fill", role: .danger) {}
        PrimaryButton("Practice drill", role: .secondary) {}
        PrimaryButton("Not now", role: .quiet) {}
        PrimaryButton("Sending…", isLoading: true) {}
    }
    .padding()
    .background(SSColor.background)
}
