import CryptoKit
import SwiftUI

/// Labeled text field styled for the dark brand surfaces.
struct SetupField: View {
    let label: String
    @Binding var text: String
    var prompt: String = ""
    var systemImage: String?
    var keyboard: UIKeyboardType = .default
    var capitalization: TextInputAutocapitalization = .words
    var contentType: UITextContentType?
    var monospaced = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).ssEyebrow()
            HStack(spacing: SSSpacing.sm) {
                if let systemImage {
                    Image(systemName: systemImage).foregroundStyle(SSColor.inkMuted).frame(width: 22)
                        .accessibilityHidden(true)
                }
                TextField(label, text: $text, prompt: Text(prompt).foregroundStyle(SSColor.inkMuted.opacity(0.7)))
                    .font(monospaced ? SSFont.mono(17, weight: .semibold) : SSFont.body)
                    .keyboardType(keyboard)
                    .textInputAutocapitalization(capitalization)
                    .autocorrectionDisabled(monospaced || keyboard == .URL)
                    .textContentType(contentType)
                    .foregroundStyle(SSColor.ink)
            }
            .padding(.horizontal, SSSpacing.md)
            .frame(minHeight: 52)
            .background(SSColor.surface, in: RoundedRectangle(cornerRadius: SSRadius.small, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: SSRadius.small, style: .continuous).stroke(SSColor.line, lineWidth: 1))
        }
    }
}

/// "Who sees this, and when" explainer used by the Date and Ride setups.
struct SealedExplainer: View {
    let title: String
    let points: [(String, String)]

    var body: some View {
        Card(tint: SSColor.accent) {
            VStack(alignment: .leading, spacing: SSSpacing.sm) {
                Label(title, systemImage: "lock.fill").font(SSFont.headline).foregroundStyle(SSColor.accent)
                ForEach(points, id: \.1) { icon, text in
                    HStack(alignment: .top, spacing: SSSpacing.sm) {
                        Image(systemName: icon).foregroundStyle(SSColor.accent).frame(width: 22).accessibilityHidden(true)
                        Text(text).font(SSFont.callout).foregroundStyle(SSColor.ink)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// Shared header for setup sheets.
struct SetupHeader: View {
    let mode: GuardMode
    let title: String
    let subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: SSSpacing.xs) {
            Label(mode.displayName, systemImage: mode.systemImage).ssEyebrow(SSColor.accent)
            Text(title).font(SSFont.display).fixedSize(horizontal: false, vertical: true)
            Text(subtitle).font(SSFont.callout).foregroundStyle(SSColor.inkMuted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }
}

/// Quick picks for "how long" in minutes.
struct MinuteChips: View {
    @Binding var minutes: Int
    var options: [Int] = [10, 15, 20, 30, 45]

    var body: some View {
        // Equal-width segments so every option fits on one row.
        HStack(spacing: SSSpacing.xs) {
            ForEach(options, id: \.self) { m in
                let selected = minutes == m
                Button { withAnimation(.snappy) { minutes = m } } label: {
                    Text("\(m) min")
                        .font(SSFont.callout.weight(.semibold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .foregroundStyle(selected ? SSColor.onFill : SSColor.ink)
                        .background(selected ? SSColor.accent : SSColor.surface, in: Capsule())
                        .overlay(Capsule().stroke(selected ? .clear : SSColor.line, lineWidth: 1))
                        .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selected ? .isSelected : [])
            }
        }
    }
}

/// Encrypts the match photo on the phone (AES-GCM, key in the Keychain). Only the file name
/// goes into `SealedDateDetails.photoFileName`; the image itself never leaves the device.
enum SealedPhotoStore {
    private static let account = "sealedPhotoKey"

    static var directory: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        return base.appending(path: "Sealed", directoryHint: .isDirectory)
    }

    static func save(_ imageData: Data, secrets: SecretStore = KeychainSecretStore()) throws -> String {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let name = "match-\(UUID().uuidString.prefix(8)).ssenc"
        let sealed = try AES.GCM.seal(imageData, using: key(secrets)).combined ?? Data()
        try sealed.write(to: directory.appending(path: name), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        return name
    }

    static func load(_ name: String, secrets: SecretStore = KeychainSecretStore()) -> Data? {
        guard let data = try? Data(contentsOf: directory.appending(path: name)),
              let box = try? AES.GCM.SealedBox(combined: data) else { return nil }
        return try? AES.GCM.open(box, using: key(secrets))
    }

    static func delete(_ name: String) {
        try? FileManager.default.removeItem(at: directory.appending(path: name))
    }

    private static func key(_ secrets: SecretStore) -> SymmetricKey {
        if let data = secrets.data(for: account), data.count == 32 { return SymmetricKey(data: data) }
        let key = SymmetricKey(size: .bits256)
        secrets.set(key.withUnsafeBytes { Data($0) }, for: account)
        return key
    }
}

/// Pins a setup screen's primary action above the home indicator, so the Start button is
/// always visible instead of buried at the end of the form. Apply before `.ssScreen()`.
struct PinnedFooter<Footer: View>: ViewModifier {
    @ViewBuilder var footer: Footer

    func body(content: Content) -> some View {
        content.safeAreaInset(edge: .bottom, spacing: 0) {
            VStack(spacing: SSSpacing.xs) { footer }
                .padding(.top, SSSpacing.sm)
                .padding(.bottom, SSSpacing.xs)
                .frame(maxWidth: .infinity)
                .background(alignment: .top) {
                    LinearGradient(stops: [.init(color: SSColor.background.opacity(0), location: 0),
                                           .init(color: SSColor.background, location: 0.2)],
                                   startPoint: .top, endPoint: .bottom)
                        .padding(.top, -SSSpacing.lg)
                        .padding(.horizontal, -SSSpacing.gutter)
                        .ignoresSafeArea(edges: .bottom)
                        .allowsHitTesting(false)
                }
        }
    }
}

extension View {
    func pinnedFooter<Footer: View>(@ViewBuilder _ footer: () -> Footer) -> some View {
        modifier(PinnedFooter(footer: footer))
    }
}
