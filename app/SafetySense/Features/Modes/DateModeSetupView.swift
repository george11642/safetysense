import PhotosUI
import SwiftUI

/// Date setup (SPEC 5): sealed details about the match. Encrypted, sent as `sealed_details`,
/// and shown to a contact only if an alert fires.
struct DateModeSetupView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var details = SealedDateDetails()
    @State private var profileLink = ""
    @State private var datingApp = ""
    @State private var venueAddress = ""
    @State private var hasEndTime = true
    @State private var endTime = Date.now.addingTimeInterval(2 * 3600)
    @State private var photoItem: PhotosPickerItem?
    @State private var photo: UIImage?
    @State private var isStarting = false
    @State private var started = 0

    private var canStart: Bool {
        !details.matchName.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SSSpacing.lg) {
                SetupHeader(mode: .date, title: "Who are you meeting?",
                            subtitle: model.alertDelivery.dateSetupSubtitle)

                SealedExplainer(title: "Sealed until you need help", points: [
                    ("eye.slash", "Your contacts don't see these details during a normal date."),
                    ("bell.badge", model.alertDelivery.dateAlertPoint),
                    ("lock.rotation", "The photo stays encrypted on this phone. The text details are encrypted on SafetySense's server, which holds the key so it can open them for your live link."),
                ])

                VStack(alignment: .leading, spacing: SSSpacing.md) {
                    photoPicker
                    SetupField(label: "Their name", text: $details.matchName, prompt: "First name is fine",
                               systemImage: "person")
                    SetupField(label: "Where you met", text: $datingApp, prompt: "Hinge, Tinder, a friend…",
                               systemImage: "heart.text.square")
                    SetupField(label: "Profile link", text: $profileLink, prompt: "Paste their profile URL",
                               systemImage: "link", keyboard: .URL, capitalization: .never, contentType: .URL)
                }

                VStack(alignment: .leading, spacing: SSSpacing.md) {
                    SetupField(label: "Venue (optional)", text: $details.venueName, prompt: "Coffee shop on Central",
                               systemImage: "mappin.and.ellipse")
                    SetupField(label: "Address (optional)", text: $venueAddress, prompt: "Street or cross streets",
                               systemImage: "map", contentType: .fullStreetAddress)
                    SetupField(label: "Anything else (optional)", text: Binding(get: { details.notes ?? "" },
                                                                                set: { details.notes = $0 }),
                               prompt: "Car, what they're wearing…", systemImage: "note.text", capitalization: .sentences)
                }

                Card {
                    VStack(alignment: .leading, spacing: SSSpacing.sm) {
                        Toggle(isOn: $hasEndTime.animation(.snappy)) {
                            Label("Check in when it should be over", systemImage: "clock.badge.checkmark")
                                .font(SSFont.body)
                        }
                        .tint(SSColor.accent)
                        if hasEndTime {
                            DatePicker("Expected end", selection: $endTime, in: Date.now..., displayedComponents: [.hourAndMinute])
                                .font(SSFont.body)
                            Text(model.alertDelivery.dateEndCheckNote)
                                .font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
                        }
                    }
                }

            }
            .padding(.top, SSSpacing.md)
            .padding(.bottom, SSSpacing.lg)
        }
        .scrollDismissesKeyboard(.interactively)
        .pinnedFooter {
            PrimaryButton("Start Date guard", systemImage: "heart.fill", isLoading: isStarting) { start() }
                .disabled(!canStart)
            Text("Their details stay sealed unless an alert fires.")
                .font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
        }
        .ssScreen()
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(SSColor.background, for: .navigationBar)
        .toolbarBackgroundVisibility(.visible, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
        }
        .sensoryFeedback(.success, trigger: started)
        .onChange(of: photoItem) { _, item in Task { await loadPhoto(item) } }
    }

    private var photoPicker: some View {
        let current = photo  // PhotosPicker's label closure isn't main-actor isolated.
        let pickerTitle = current == nil ? "Add their photo" : "Change photo"
        return PhotosPicker(selection: $photoItem, matching: .images) {
            HStack(spacing: SSSpacing.md) {
                Group {
                    if let current {
                        Image(uiImage: current).resizable().scaledToFill()
                    } else {
                        Image(systemName: "person.crop.circle.badge.plus")
                            .font(.system(size: 28))
                            .foregroundStyle(SSColor.accent)
                    }
                }
                .frame(width: 64, height: 64)
                .animation(.smooth, value: current)
                .background(SSColor.accentSoft)
                .clipShape(Circle())
                .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text(pickerTitle).font(SSFont.headline).foregroundStyle(SSColor.accent)
                    Text("Optional. A screenshot of their profile works.")
                        .font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(SSColor.inkMuted)
                    .accessibilityHidden(true)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func loadPhoto(_ item: PhotosPickerItem?) async {
        guard let item, let data = try? await item.loadTransferable(type: Data.self),
              let image = UIImage(data: data) else { return }
        photo = image
    }

    private func start() {
        isStarting = true
        var sealed = details
        sealed.matchName = sealed.matchName.trimmingCharacters(in: .whitespaces)
        sealed.venueName = sealed.venueName.trimmingCharacters(in: .whitespaces)
        sealed.profileLink = profileLink.isEmpty ? nil : profileLink
        sealed.datingApp = datingApp.isEmpty ? nil : datingApp
        sealed.venueAddress = venueAddress.isEmpty ? nil : venueAddress
        if sealed.notes?.isEmpty == true { sealed.notes = nil }
        sealed.expectedEnd = hasEndTime ? endTime : nil
        if let jpeg = photo?.jpegData(compressionQuality: 0.8) {
            sealed.photoFileName = try? SealedPhotoStore.save(jpeg)
        }
        Task {
            await model.startGuard(mode: .date, sealedDate: sealed)
            isStarting = false
            started += 1
            dismiss()
        }
    }
}

#Preview { NavigationStack { DateModeSetupView() }.environment(AppModel.preview(screen: .dateSetup)) }
