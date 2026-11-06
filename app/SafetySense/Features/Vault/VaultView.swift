import SwiftUI
import UIKit

/// Evidence vault (SPEC 9.8): locked behind Face ID, lists encrypted clips with time,
/// duration and a short SHA-256, and lets the person share a copy with an advocate or delete.
/// Nothing leaves the phone unless they choose to share it.
struct VaultView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.scenePhase) private var scenePhase
    @State private var unlocked = false
    @State private var clips: [EvidenceClip] = []
    @State private var isUnlocking = false
    @State private var unlockFailed = 0
    @State private var pendingDelete: EvidenceClip?
    @State private var confirmDeleteAll = false
    @State private var export: VaultExport?
    @State private var exportingID: UUID?
    @State private var errorText: String?
    @State private var copied = 0

    private var vault: any EvidenceVaultProtocol { model.services.vault }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SSSpacing.lg) {
                header
                if unlocked { unlockedContent.transition(.opacity.combined(with: .move(edge: .bottom))) }
                else { lockedContent.transition(.opacity) }
            }
            .padding(.top, SSSpacing.md)
            .padding(.bottom, SSSpacing.xxl)
            .animation(.smooth, value: unlocked)
        }
        .ssScreen()
        .toolbar(.hidden, for: .navigationBar)
        .sensoryFeedback(.error, trigger: unlockFailed)
        .sensoryFeedback(.success, trigger: copied)
        .sensoryFeedback(.success, trigger: unlocked) { _, new in new }
        .onChange(of: scenePhase) { _, phase in if phase != .active { relock() } }
        .onDisappear(perform: relock)
        .sheet(item: $export) { item in
            VaultExportSheet(export: item)
        }
        .confirmationDialog("Delete this clip?", isPresented: Binding(get: { pendingDelete != nil },
                                                                     set: { if !$0 { pendingDelete = nil } }),
                            titleVisibility: .visible, presenting: pendingDelete) { clip in
            Button("Delete clip", role: .destructive) { delete(clip) }
            Button("Keep it", role: .cancel) {}
        } message: { clip in
            Text(clip.uploaded
                 ? "This removes it from your phone. A backed-up encrypted copy stays on the server until your retention period ends."
                 : "This removes it from your phone. It can't be undone.")
        }
        .confirmationDialog("Delete every clip?", isPresented: $confirmDeleteAll, titleVisibility: .visible) {
            Button("Delete all evidence", role: .destructive) {
                try? vault.deleteAll()
                refresh()
            }
            Button("Keep it", role: .cancel) {}
        } message: {
            Text("This can't be undone. You don't have to decide anything today.")
        }
    }

    // MARK: Header

    private var header: some View {
        VStack(alignment: .leading, spacing: SSSpacing.xs) {
            HStack {
                Text("Encrypted on this phone").ssEyebrow(SSColor.accent)
                Spacer()
                if unlocked {
                    Button { relock() } label: { Label("Lock", systemImage: "lock.fill") }
                        .font(SSFont.callout.weight(.semibold))
                        .frame(minHeight: 44)
                }
            }
            Text("Vault").font(SSFont.display)
            Text("Saved only during an alert. Only you can open it, and you choose if anyone else ever hears it.")
                .font(SSFont.callout).foregroundStyle(SSColor.inkMuted)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: Locked

    private var lockedContent: some View {
        VStack(spacing: SSSpacing.lg) {
            ZStack {
                Circle().fill(SSColor.accentSoft).frame(width: 140, height: 140)
                Image(systemName: unlockFailed > 0 ? "lock.trianglebadge.exclamationmark" : "lock.fill")
                    .font(.system(size: 54, weight: .semibold))
                    .foregroundStyle(SSColor.accent)
                    .contentTransition(.symbolEffect(.replace))
                    .symbolEffect(.bounce, value: unlockFailed)
            }
            .frame(maxWidth: .infinity)
            .padding(.top, SSSpacing.lg)
            .accessibilityHidden(true)

            VStack(spacing: SSSpacing.xs) {
                Text("Your Vault is locked").font(SSFont.title)
                Text(unlockFailed > 0 ? "That didn't work. Try again when you're ready." : "AES-256 encrypted. Each clip has a fingerprint so you can show it hasn't been changed.")
                    .font(SSFont.callout).foregroundStyle(SSColor.inkMuted)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)

            PrimaryButton(DeviceAuth.biometryName == "PIN" ? "Unlock with passcode" : "Unlock with \(DeviceAuth.biometryName)",
                          systemImage: DeviceAuth.biometryName == "PIN" ? "lock.open" : "faceid", isLoading: isUnlocking) {
                Task { await unlock() }
            }
        }
    }

    private func unlock() async {
        isUnlocking = true
        let ok = await vault.unlock(reason: "Open your evidence vault")
        isUnlocking = false
        if ok { refresh(); withAnimation(.smooth) { unlocked = true } } else { unlockFailed += 1 }
    }

    private func relock() {
        vault.lock()
        unlocked = false
    }

    private func refresh() { clips = model.vaultClips }

    // MARK: Unlocked

    private var groups: [(alertID: UUID, clips: [EvidenceClip])] {
        Dictionary(grouping: clips, by: \.alertID)
            .map { ($0.key, $0.value.sorted { $0.seq < $1.seq }) }
            .sorted { ($0.clips.first?.startedAt ?? .distantPast) > ($1.clips.first?.startedAt ?? .distantPast) }
    }

    @ViewBuilder
    private var unlockedContent: some View {
        if model.showsRecording {
            Card(tint: SSColor.danger) {
                Label("Recording encrypted evidence now", systemImage: "record.circle")
                    .font(SSFont.headline).foregroundStyle(SSColor.danger)
                    .symbolEffect(.pulse, options: .repeating)
            }
        }
        if let errorText {
            Card(tint: SSColor.warn) { Text(errorText).font(SSFont.callout) }
        }
        if clips.isEmpty {
            Card {
                VStack(alignment: .leading, spacing: SSSpacing.xs) {
                    Label("Nothing saved", systemImage: "tray").font(SSFont.headline)
                    Text("SafetySense only records once an alert starts. During a normal Guard session, audio stays in a 30-second memory buffer and is never saved.")
                        .font(SSFont.callout).foregroundStyle(SSColor.inkMuted)
                }
            }
        } else {
            Text("Only this iPhone can open these clips. A copy on the server shows what was recorded and when, but it can't be played without this iPhone.")
                .font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
                .fixedSize(horizontal: false, vertical: true)
            ForEach(groups, id: \.alertID) { group in
                VStack(alignment: .leading, spacing: SSSpacing.sm) {
                    SectionHeader(alertTitle(group.clips), subtitle: summary(group.clips))
                    Card(padding: 0) {
                        VStack(spacing: 0) {
                            ForEach(Array(group.clips.enumerated()), id: \.element.id) { index, clip in
                                if index > 0 { Divider().overlay(SSColor.line).padding(.leading, SSSpacing.md) }
                                clipRow(clip)
                            }
                        }
                    }
                    PrimaryButton("Share with an advocate", systemImage: "square.and.arrow.up", role: .secondary,
                                  isLoading: exportingID == group.alertID) {
                        Task { await prepareExport(group.clips, id: group.alertID) }
                    }
                }
            }
            Text("Advocates at LoboRESPECT or the Rape Crisis Center can help you decide what, if anything, to do with this. Sharing doesn't file a report.")
                .font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
            PrimaryButton("Delete all evidence", systemImage: "trash", role: .quiet) { confirmDeleteAll = true }
        }
    }

    private func clipRow(_ clip: EvidenceClip) -> some View {
        HStack(spacing: SSSpacing.sm) {
            Image(systemName: clip.kind == .audio ? "waveform" : "location")
                .font(.body.weight(.semibold))
                .foregroundStyle(SSColor.accent)
                .frame(width: 40, height: 40)
                .background(SSColor.accentSoft, in: RoundedRectangle(cornerRadius: SSRadius.small, style: .continuous))
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(clip.startedAt, format: .dateTime.hour().minute().second()).font(SSFont.headline)
                    Text(clip.duration.clockText).font(SSFont.mono(13)).foregroundStyle(SSColor.inkMuted)
                }
                Text("SHA-256 \(Self.shortHash(clip.sha256))")
                    .font(SSFont.mono(12)).foregroundStyle(SSColor.inkMuted)
                    .lineLimit(1)
                Label(clip.uploaded ? "Encrypted copy on the server" : "On this phone only",
                      systemImage: clip.uploaded ? "checkmark.icloud" : "iphone")
                    .font(SSFont.caption)
                    .foregroundStyle(clip.uploaded ? SSColor.calm : SSColor.inkMuted)
            }
            Spacer(minLength: 0)
            Menu {
                Button { Task { await prepareExport([clip], id: clip.id) } } label: {
                    Label("Share this clip", systemImage: "square.and.arrow.up")
                }
                Button {
                    UIPasteboard.general.string = clip.sha256
                    copied += 1
                } label: { Label("Copy full SHA-256", systemImage: "number") }
                Divider()
                Button(role: .destructive) { pendingDelete = clip } label: { Label("Delete", systemImage: "trash") }
            } label: {
                Image(systemName: "ellipsis.circle")
                    .font(.title3)
                    .foregroundStyle(SSColor.inkMuted)
                    .frame(width: 44, height: 44)
            }
            .accessibilityLabel("Options for clip at \(clip.startedAt.formatted(date: .omitted, time: .shortened))")
        }
        .padding(.horizontal, SSSpacing.md)
        .padding(.vertical, SSSpacing.sm)
        .accessibilityElement(children: .combine)
    }

    private func alertTitle(_ clips: [EvidenceClip]) -> String {
        clips.first.map { Self.alertTitle(startedAt: $0.startedAt) } ?? "Alert"
    }

    /// `Alert · Nov 4 at 2:11 PM`, or `Alert · today at 2:11 PM` the same day.
    static func alertTitle(startedAt: Date, now: Date = .now, calendar: Calendar = .current) -> String {
        let time = startedAt.formatted(date: .omitted, time: .shortened)
        if calendar.isDate(startedAt, inSameDayAs: now) { return "Alert · today at \(time)" }
        return "Alert · \(startedAt.formatted(.dateTime.month(.abbreviated).day())) at \(time)"
    }

    private func summary(_ clips: [EvidenceClip]) -> String {
        let total = clips.reduce(0) { $0 + $1.duration }
        return "\(clips.count) clip\(clips.count == 1 ? "" : "s") · \(total.clockText) total"
    }

    static func shortHash(_ hex: String) -> String {
        hex.count > 16 ? "\(hex.prefix(8))…\(hex.suffix(4))" : hex
    }

    // MARK: Actions

    private func delete(_ clip: EvidenceClip) {
        do { try vault.delete(clip) } catch { errorText = "Couldn't delete that clip. Try again." }
        withAnimation(.smooth) { refresh() }
    }

    private func prepareExport(_ clips: [EvidenceClip], id: UUID) async {
        exportingID = id
        defer { exportingID = nil }
        do {
            export = try await VaultExport.make(clips: clips, vault: vault)
            errorText = nil
        } catch {
            errorText = (error as? LocalizedError)?.errorDescription ?? "Couldn't prepare that export."
        }
    }
}

// MARK: - Export

/// A temporary, decrypted copy for sharing plus a manifest of hashes. Deleted when the sheet closes.
struct VaultExport: Identifiable {
    let id = UUID()
    let folder: URL
    let files: [URL]

    static let folderPrefix = "SafetySense-Export-"

    /// Decrypted copies left behind when the app died before the share sheet closed.
    static func sweepLeftovers(in directory: URL = FileManager.default.temporaryDirectory) {
        let items = (try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)) ?? []
        for item in items where item.lastPathComponent.hasPrefix(folderPrefix) { try? FileManager.default.removeItem(at: item) }
    }

    @MainActor
    static func make(clips: [EvidenceClip], vault: any EvidenceVaultProtocol) async throws -> VaultExport {
        let folder = FileManager.default.temporaryDirectory.appending(path: "\(folderPrefix)\(UUID().uuidString.prefix(6))")
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        var files: [URL] = []
        var manifest = """
        SafetySense evidence export
        Exported: \(Date.now.formatted(.iso8601))
        Each clip was AES-256-GCM encrypted on the phone when it was recorded. The SHA-256 below is
        of that encrypted file, recorded at the time, so a copy kept on the server can be matched to it.

        """
        for clip in clips.sorted(by: { $0.seq < $1.seq }) {
            let audio = try await vault.decrypt(clip)
            let stamp = clip.startedAt.formatted(.iso8601.year().month().day().time(includingFractionalSeconds: false))
                .replacingOccurrences(of: ":", with: "-")
            if !audio.isEmpty {
                let url = folder.appending(path: "clip-\(clip.seq)-\(stamp).\(fileExtension(for: audio))")
                try audio.write(to: url, options: [.atomic, .completeFileProtection])
                files.append(url)
            }
            manifest += "\nClip \(clip.seq)  start \(clip.startedAt.formatted(.iso8601))  length \(Int(clip.duration))s  sha256 \(clip.sha256)"
        }
        let manifestURL = folder.appending(path: "manifest.txt")
        try Data(manifest.utf8).write(to: manifestURL, options: [.atomic, .completeFileProtection])
        files.append(manifestURL)
        return VaultExport(folder: folder, files: files)
    }

    private static func fileExtension(for data: Data) -> String {
        let head = data.prefix(4)
        if head == Data("RIFF".utf8) { return "wav" }
        if head == Data("caff".utf8) { return "caf" }
        return "bin"
    }

    func cleanUp() { try? FileManager.default.removeItem(at: folder) }
}

struct VaultExportSheet: View {
    let export: VaultExport
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: SSSpacing.md) {
            Text("Ready to share").font(SSFont.title).padding(.top, SSSpacing.lg)
            Text("This is a decrypted copy, so send it only to someone you trust, like an advocate. It's removed from this phone's temporary storage when you close this.")
                .font(SSFont.callout).foregroundStyle(SSColor.inkMuted)
                .fixedSize(horizontal: false, vertical: true)
            Card {
                VStack(alignment: .leading, spacing: SSSpacing.xs) {
                    ForEach(export.files, id: \.self) { url in
                        Label(url.lastPathComponent, systemImage: url.pathExtension == "txt" ? "doc.text" : "waveform")
                            .font(SSFont.mono(13))
                            .lineLimit(1)
                    }
                }
            }
            ShareLink(items: export.files) {
                Label("Share…", systemImage: "square.and.arrow.up")
                    .font(SSFont.headline)
                    .frame(maxWidth: .infinity, minHeight: 56)
                    .foregroundStyle(SSColor.onFill)
                    .background(SSColor.accent, in: RoundedRectangle(cornerRadius: SSRadius.button, style: .continuous))
            }
            PrimaryButton("Done", role: .quiet) { dismiss() }
            Spacer()
        }
        .padding(.horizontal, SSSpacing.gutter)
        .background(SSColor.background.ignoresSafeArea())
        .foregroundStyle(SSColor.ink)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .onDisappear { export.cleanUp() }
    }
}

#Preview("Vault") { NavigationStack { VaultView() }.environment(AppModel.preview(screen: .vault)) }
