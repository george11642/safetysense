import PhotosUI
import SwiftUI
import UIKit

/// Stores the optional responder photo in Application Support with complete file protection.
/// Only the file name goes into `Profile.photoFileName`.
enum ResponderPhotoStore {
    private static var directory: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        return base.appendingPathComponent("Responder", isDirectory: true)
    }

    static func url(for fileName: String) -> URL { directory.appendingPathComponent(fileName) }

    static func load(_ fileName: String?) -> UIImage? {
        guard let fileName, let data = try? Data(contentsOf: url(for: fileName)) else { return nil }
        return UIImage(data: data)
    }

    /// Downscales to 1024 px and saves as JPEG. Returns the new file name.
    static func save(_ image: UIImage, replacing old: String?) throws -> String {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let maxSide: CGFloat = 1024
        let scale = min(1, maxSide / max(image.size.width, image.size.height))
        let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let resized = UIGraphicsImageRenderer(size: size).image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
        guard let data = resized.jpegData(compressionQuality: 0.8) else { throw CocoaError(.fileWriteUnknown) }
        let name = "photo-\(UUID().uuidString.prefix(8)).jpg"
        try data.write(to: url(for: name), options: [.atomic, .completeFileProtection])
        delete(old)
        return name
    }

    static func delete(_ fileName: String?) {
        guard let fileName else { return }
        try? FileManager.default.removeItem(at: url(for: fileName))
    }

    static func deleteAll() { try? FileManager.default.removeItem(at: directory) }
}

/// Optional responder profile (SPEC 8.8): photo, description, medical notes, allergies.
/// Shared with dispatch only during an alert.
struct ResponderProfileForm: View {
    @Environment(AppModel.self) private var model

    @State private var description = ""
    @State private var medical = ""
    @State private var allergies = ""
    @State private var photoItem: PhotosPickerItem?
    @State private var photo: UIImage?
    @State private var photoError: String?
    @State private var loaded = false

    var body: some View {
        let currentPhoto = photo
        VStack(alignment: .leading, spacing: SSSpacing.lg) {
            HStack(spacing: SSSpacing.md) {
                PhotosPicker(selection: $photoItem, matching: .images, photoLibrary: .shared()) {
                    ZStack {
                        if let photo = currentPhoto {
                            Image(uiImage: photo).resizable().scaledToFill()
                        } else {
                            SSColor.surface
                            Image(systemName: "person.crop.circle.badge.plus").font(.system(size: 30)).foregroundStyle(SSColor.accent)
                        }
                    }
                    .frame(width: 88, height: 88)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(SSColor.line))
                }
                .accessibilityLabel(photo == nil ? "Add a photo of yourself" : "Change your photo")
                VStack(alignment: .leading, spacing: 4) {
                    Text("A recent photo").font(SSFont.headline)
                    Text("Helps responders recognize you quickly.").font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
                    if photo != nil {
                        Button("Remove photo", role: .destructive) { removePhoto() }
                            .font(SSFont.caption.weight(.semibold))
                            .frame(minHeight: 32)
                    }
                    if let photoError { Text(photoError).font(SSFont.caption).foregroundStyle(SSColor.warn) }
                }
            }

            textArea("What you look like", placeholder: "Height, hair, anything you usually wear", text: $description)
            textArea("Medical notes", placeholder: "Conditions, medications, where you keep an inhaler or EpiPen", text: $medical)
            textArea("Allergies", placeholder: "Medicines, foods", text: $allergies)

            Label("Stays on your iPhone. Shared with professional dispatch only if an alert reaches them.",
                  systemImage: "lock.shield")
                .font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
        }
        .onAppear(perform: load)
        .onChange(of: description) { persist() }
        .onChange(of: medical) { persist() }
        .onChange(of: allergies) { persist() }
        .onChange(of: photoItem) { _, item in
            guard let item else { return }
            Task { await importPhoto(item) }
        }
    }

    private func textArea(_ label: String, placeholder: String, text: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: SSSpacing.xs) {
            Text(label).ssEyebrow()
            TextField(placeholder, text: text, axis: .vertical)
                .lineLimit(2...5)
                .font(SSFont.body)
                .padding(SSSpacing.md)
                .background(SSColor.surface, in: RoundedRectangle(cornerRadius: SSRadius.small, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: SSRadius.small, style: .continuous).stroke(SSColor.line))
                .accessibilityLabel(label)
        }
    }

    private func load() {
        guard !loaded else { return }
        loaded = true
        let p = model.profile
        description = p?.physicalDescription ?? ""
        medical = p?.medicalNotes ?? ""
        allergies = p?.allergies ?? ""
        photo = ResponderPhotoStore.load(p?.photoFileName)
    }

    private func persist() {
        guard loaded else { return }
        var p = model.profile ?? Profile()
        func clean(_ s: String) -> String? {
            let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
            return t.isEmpty ? nil : t
        }
        p.physicalDescription = clean(description)
        p.medicalNotes = clean(medical)
        p.allergies = clean(allergies)
        if p != model.profile { model.profile = p }
    }

    private func importPhoto(_ item: PhotosPickerItem) async {
        photoError = nil
        do {
            guard let data = try await item.loadTransferable(type: Data.self), let image = UIImage(data: data) else {
                photoError = "That photo couldn't be opened."
                return
            }
            var p = model.profile ?? Profile()
            p.photoFileName = try ResponderPhotoStore.save(image, replacing: p.photoFileName)
            model.profile = p
            photo = image
        } catch {
            photoError = "That photo couldn't be saved."
        }
    }

    private func removePhoto() {
        guard var p = model.profile else { return }
        ResponderPhotoStore.delete(p.photoFileName)
        p.photoFileName = nil
        model.profile = p
        photo = nil
        photoItem = nil
    }
}

#Preview {
    ScrollView { ResponderProfileForm().padding() }
        .background(SSColor.background).foregroundStyle(SSColor.ink)
        .environment(AppModel.preview())
        .preferredColorScheme(.dark)
}
