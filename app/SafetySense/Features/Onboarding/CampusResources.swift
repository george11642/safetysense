import SwiftUI

/// A local or national number loaded for the user's campus (SPEC 8.3).
/// Numbers come from docs/OPEN_QUESTIONS.md and the coordinator's verified list; re-check before launch.
struct SafetyResource: Identifiable, Sendable, Hashable {
    enum Kind: String, Sendable { case emergency, campusPolice, advocacy, medical, national }

    var id: String { name }
    let name: String
    let detail: String
    let number: String
    let kind: Kind
    var available247 = false

    var systemImage: String {
        switch kind {
        case .emergency: "phone.badge.waveform.fill"
        case .campusPolice: "building.columns"
        case .advocacy: "heart.text.square"
        case .medical: "cross.case"
        case .national: "phone.circle"
        }
    }

    var tint: Color {
        switch kind {
        case .emergency: SSColor.danger
        case .campusPolice: SSColor.calm
        case .advocacy: SSColor.accent
        case .medical: SSColor.warn
        case .national: SSColor.inkMuted
        }
    }
}

enum CampusResources {
    static let emergency = SafetyResource(name: "911", detail: "Emergency. SafetySense supplements 911, never replaces it.",
                                          number: "911", kind: .emergency, available247: true)
    static let rainn = SafetyResource(name: "RAINN Sexual Assault Hotline", detail: "National, confidential",
                                      number: "1-800-656-4673", kind: .national, available247: true)
    static let crisis988 = SafetyResource(name: "988 Suicide & Crisis Lifeline", detail: "Call or text, national",
                                          number: "988", kind: .national, available247: true)
    static let rapeCrisisCenter = SafetyResource(name: "Rape Crisis Center of Central NM", detail: "Advocacy and support, Albuquerque",
                                                 number: "505-266-7711", kind: .advocacy, available247: true)
    static let sane = SafetyResource(name: "Albuquerque SANE", detail: "Medical care and forensic exams, no report required",
                                     number: "505-884-7263", kind: .medical, available247: true)
    static let unmPolice = SafetyResource(name: "UNM Police (UNMPD)", detail: "Main campus",
                                          number: "505-277-2241", kind: .campusPolice, available247: true)
    static let loboRespect = SafetyResource(name: "LoboRESPECT Advocacy Center", detail: "UNM, confidential advocates",
                                            number: "505-277-2911", kind: .advocacy, available247: true)
    static let cnmSecurity = SafetyResource(name: "CNM Security dispatch", detail: "All CNM campuses",
                                            number: "505-224-3001", kind: .campusPolice, available247: true)

    /// Campus-specific numbers first, then the ones everyone gets.
    static func local(for campus: Campus) -> [SafetyResource] {
        switch campus {
        case .unm: [unmPolice, loboRespect, sane]
        case .cnm: [cnmSecurity, rapeCrisisCenter, sane]
        case .other: [rapeCrisisCenter, sane]
        }
    }

    static let national: [SafetyResource] = [emergency, rainn, crisis988]

    static func all(for campus: Campus) -> [SafetyResource] { local(for: campus) + national }
}

/// Tappable resource row; opens the dialer.
struct SafetyResourceRow: View {
    let resource: SafetyResource
    @Environment(\.openURL) private var openURL

    var body: some View {
        Button {
            if let url = PhoneNumber.telURL(resource.number) { openURL(url) }
        } label: {
            HStack(spacing: SSSpacing.sm) {
                Image(systemName: resource.systemImage)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(resource.tint)
                    .frame(width: 36, height: 36)
                    .background(resource.tint.opacity(0.15), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    Text(resource.name).font(SSFont.callout.weight(.semibold)).foregroundStyle(SSColor.ink)
                    Text(resource.detail + (resource.available247 ? " · 24/7" : ""))
                        .font(SSFont.caption).foregroundStyle(SSColor.inkMuted)
                }
                Spacer(minLength: SSSpacing.xs)
                Text(resource.number).font(SSFont.mono(13, weight: .semibold)).foregroundStyle(SSColor.ink)
            }
            .padding(.vertical, SSSpacing.xs)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(resource.name), \(resource.detail)")
        .accessibilityHint("Calls \(resource.number)")
    }
}

#Preview {
    ScrollView {
        VStack(spacing: 4) {
            ForEach(CampusResources.all(for: .unm)) { SafetyResourceRow(resource: $0) }
        }
        .padding()
    }
    .background(SSColor.background)
    .preferredColorScheme(.dark)
}
