import SwiftUI

/// One titled block of a legal page.
struct LegalSection: Identifiable, Sendable, Equatable {
    var id: String { title }
    let title: String
    let body: String
}

/// The in-app privacy notice and terms. Retention here must match `backend/README.md`.
enum LegalCopy {
    static let supportEmail = "gteifel@unm.edu"
    static var supportURL: URL? { URL(string: "mailto:\(supportEmail)?subject=SafetySense%20support") }

    static let privacy: [LegalSection] = [
        LegalSection(title: "The short version",
                     body: "SafetySense works on your iPhone first. It sends data to its server only so it can reach your people in an alert. There are no ads, no analytics and no trackers, and nothing is sold."),
        LegalSection(title: "What stays on your iPhone",
                     body: "Sound is checked in a 30-second memory loop and forgotten. Transcripts and the on-device AI's reasoning never leave your iPhone. Your PINs are saved only as salted hashes in the Keychain, and your safe word stays in the Keychain. Your responder profile (photo, description, medical notes) stays on this iPhone in this build."),
        LegalSection(title: "What goes to the server",
                     body: "Your name, mobile number and campus. Your trusted contacts' names and numbers. Each Guard session's mode and heartbeats, with your location and battery level. Date, ride and walk details, such as where you're headed and who's following along. These are encrypted with a key the server holds, and shown to your contacts only if an alert starts."),
        LegalSection(title: "During an alert",
                     body: "Your location goes to the server and to your contacts' live link. The microphone turns on and records evidence, even if listening was off or no Guard was running. Evidence audio is encrypted on your iPhone before it uploads, so the server holds only ciphertext and only you can unlock it."),
        LegalSection(title: "How long it's kept",
                     body: "On this iPhone, evidence is deleted after the time you pick under Keep data for. On the server, the schedule is fixed: evidence and locations after 30 days, alerts and ended sessions after 90 days, test alerts and sealed details after 48 hours."),
        LegalSection(title: "Who helps run it",
                     body: "Supabase hosts the server. Twilio places calls and texts to your contacts. Noonlight handles dispatch requests. Vercel hosts your contacts' live link page. Each one gets only what its job needs. In TestFlight builds, calls, texts and dispatch are off."),
        LegalSection(title: "Your control",
                     body: "Delete everything, in Settings, removes your data from this iPhone and erases this iPhone's alerts, locations and evidence from the server. If an alert is still running, the server finishes that deletion when it ends."),
    ]

    static let terms: [LegalSection] = [
        LegalSection(title: "SafetySense supplements 911",
                     body: "SafetySense never replaces 911. If you're in danger right now, call 911. SafetySense can't guarantee that it will notice a problem, that a message will arrive, or that anyone will respond."),
        LegalSection(title: "This is a test build",
                     body: "SafetySense is a student project for the 2026 UNM/CNM App Contest. TestFlight builds never call or text anyone, and they never contact dispatch. Features may change or stop working."),
        LegalSection(title: "Limits of detection",
                     body: "SafetySense notices sounds, movement and missed check-ins. It can't detect drugging, and it can be wrong in both directions. Don't rely on it as your only plan."),
        LegalSection(title: "Using it fairly",
                     body: "Add only people who have agreed to be your trusted contacts. Don't start false alerts. Recording laws differ by place, so you're responsible for how you use saved audio."),
        LegalSection(title: "No warranty",
                     body: "SafetySense is provided as is, without any warranty, to the fullest extent the law allows."),
    ]
}

/// A readable page of titled paragraphs.
struct LegalPageView: View {
    let title: String
    let sections: [LegalSection]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: SSSpacing.lg) {
                ForEach(sections) { section in
                    VStack(alignment: .leading, spacing: SSSpacing.xxs) {
                        Text(section.title).font(SSFont.headline).accessibilityAddTraits(.isHeader)
                        Text(section.body).font(SSFont.callout).foregroundStyle(SSColor.inkMuted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            .padding(.vertical, SSSpacing.md)
        }
        .ssScreen()
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
    }
}

/// Version, what the app is built with, and how to reach a person.
struct AboutView: View {
    var body: some View {
        List {
            Section {
                LabeledContent("Version", value: SettingsView.version)
                LabeledContent("Made by", value: "George and Mary Teifel")
            } footer: {
                Text("A student entry in the 2026 UNM/CNM App Contest.")
            }
            .listRowBackground(SSColor.surface)

            Section {
                Text("SafetySense uses only Apple's frameworks. It includes no third-party libraries, so there are no open-source licenses to list, and no ad or analytics SDKs.")
                    .font(SSFont.callout).foregroundStyle(SSColor.inkMuted)
            } header: {
                Text("Acknowledgements")
            }
            .listRowBackground(SSColor.surface)
        }
        .settingsListStyle("About")
    }
}

#Preview("Privacy") { NavigationStack { LegalPageView(title: "Privacy", sections: LegalCopy.privacy) }.preferredColorScheme(.dark) }
#Preview("About") { NavigationStack { AboutView() }.preferredColorScheme(.dark) }
