import SwiftUI

/// Numeric PIN entry. Calls `onComplete` once `length` digits are entered, then clears.
/// Never reveals digits. The duress PIN uses the exact same pad, so it's indistinguishable.
struct PINPad: View {
    @Binding var pin: String
    var length = 4
    var tint: Color = SSColor.accent
    /// Slightly smaller keys so the whole pad fits on screen with content above it (alert countdown).
    var compact = false
    var onComplete: (String) -> Void = { _ in }

    private let keys: [[String]] = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["", "0", "⌫"]]

    var body: some View {
        VStack(spacing: compact ? SSSpacing.sm : SSSpacing.lg) {
            HStack(spacing: SSSpacing.md) {
                ForEach(0..<length, id: \.self) { i in
                    Circle()
                        .fill(i < pin.count ? tint : .clear)
                        .overlay(Circle().stroke(i < pin.count ? tint : SSColor.inkMuted, lineWidth: 1.5))
                        .frame(width: 14, height: 14)
                }
            }
            .accessibilityLabel("\(pin.count) of \(length) digits entered")

            VStack(spacing: compact ? 8 : SSSpacing.sm) {
                ForEach(keys, id: \.self) { row in
                    HStack(spacing: compact ? 28 : SSSpacing.lg) {
                        ForEach(row, id: \.self) { key in keyButton(key) }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func keyButton(_ key: String) -> some View {
        if key.isEmpty {
            Color.clear.frame(width: keySize, height: keySize)
        } else {
            Button {
                tap(key)
            } label: {
                Group {
                    if key == "⌫" { Image(systemName: "delete.left") } else { Text(key) }
                }
                .font(.system(size: 28, weight: .medium, design: .rounded))
                .foregroundStyle(SSColor.ink)
                .frame(width: keySize, height: keySize)
                .background(key == "⌫" ? .clear : SSColor.surface, in: Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(key == "⌫" ? "Delete" : key)
        }
    }

    private var keySize: CGFloat { compact ? 62 : 72 }

    private func tap(_ key: String) {
        if key == "⌫" {
            if !pin.isEmpty { pin.removeLast() }
            return
        }
        guard pin.count < length else { return }
        pin.append(key)
        if pin.count == length {
            let entered = pin
            onComplete(entered)
            pin = ""
        }
    }
}

#Preview {
    @Previewable @State var pin = "12"
    PINPad(pin: $pin)
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(SSColor.background)
}
