import Foundation

/// A phone resource shown on Support and Home quick-dial.
///
/// Every number here was checked against the organization's own page (or its listing on
/// sharenm.org / campus police pages) on 2026-11-04, and CNM Title IX against CNM's Title IX
/// policy page (Dean of Students, x51240) on 2026-11-05. Re-check before each release, per
/// AGENTS.md: a wrong number in a crisis is worse than no number.
struct SupportResource: Identifiable, Hashable, Sendable {
    enum Kind: String, Sendable { case advocate, medical, report, crisis }

    let id: String
    let name: String
    let detail: String
    let phone: String
    var isAllHours: Bool
    var kind: Kind
    /// Campuses this is most relevant to (empty = everyone).
    var campuses: Set<Campus> = []
}

enum SupportDirectory {
    static let verifiedOn = "Nov 4, 2026"

    // MARK: Talk to someone now (confidential)

    static let loboRespect = SupportResource(
        id: "loborespect", name: "LoboRESPECT Advocacy Center",
        detail: "UNM's confidential advocates. They can explain your options without you having to decide anything.",
        phone: "505-277-2911", isAllHours: true, kind: .advocate, campuses: [.unm])

    static let rapeCrisisCenter = SupportResource(
        id: "rccnm", name: "Rape Crisis Center of Central NM",
        detail: "Confidential support, any time, for anyone in the Albuquerque area. Se habla español.",
        phone: "505-266-7711", isAllHours: true, kind: .advocate)

    static let rainn = SupportResource(
        id: "rainn", name: "RAINN National Sexual Assault Hotline",
        detail: "Confidential, anywhere in the US.",
        phone: "1-800-656-4673", isAllHours: true, kind: .advocate)

    static let lifeline988 = SupportResource(
        id: "988", name: "988 Suicide & Crisis Lifeline",
        detail: "Call or text 988 if you're overwhelmed or thinking about hurting yourself.",
        phone: "988", isAllHours: true, kind: .crisis)

    // MARK: Medical care

    static let sane = SupportResource(
        id: "sane", name: "Albuquerque SANE Collaborative",
        detail: "A confidential exam with a specially trained nurse. You don't need to file a police report to get care.",
        phone: "505-884-7263", isAllHours: true, kind: .medical)

    // MARK: Reporting (only if and when you choose)

    static let unmPolice = SupportResource(
        id: "unmpd", name: "UNM Police", detail: "Campus police dispatch. Also runs the 24/7 safety escort.",
        phone: "505-277-2241", isAllHours: true, kind: .report, campuses: [.unm])

    static let unmTitleIX = SupportResource(
        id: "unm-titleix", name: "UNM Title IX (CEEO)",
        detail: "Campus options like housing or class changes and a formal complaint. Weekdays 8–5.",
        phone: "505-277-5251", isAllHours: false, kind: .report, campuses: [.unm])

    static let cnmSecurity = SupportResource(
        id: "cnm-security", name: "CNM Security", detail: "24/7 dispatch for every CNM campus.",
        phone: "505-224-3002", isAllHours: true, kind: .report, campuses: [.cnm])

    static let cnmTitleIX = SupportResource(
        id: "cnm-titleix", name: "CNM Title IX",
        detail: "Ask for extension 51240, the Dean of Students, CNM's Title IX Coordinator for students. Weekdays.",
        phone: "505-224-4000", isAllHours: false, kind: .report, campuses: [.cnm])

    static let apd = SupportResource(
        id: "apd", name: "Albuquerque Police (non-emergency)",
        detail: "To make a report off campus. In danger right now, call 911.",
        phone: "505-242-2677", isAllHours: true, kind: .report)

    // MARK: Groupings

    static func advocates(for campus: Campus) -> [SupportResource] {
        sorted([loboRespect, rapeCrisisCenter, rainn], for: campus)
            .filter { $0.campuses.isEmpty || $0.campuses.contains(campus) || campus == .other }
    }

    static let medical: [SupportResource] = [sane]

    static func reporting(for campus: Campus) -> [SupportResource] {
        switch campus {
        case .unm: [unmPolice, apd, unmTitleIX]
        case .cnm: [cnmSecurity, apd, cnmTitleIX]
        case .other: [apd, unmPolice, cnmSecurity]
        }
    }

    /// Two numbers on Home: campus safety plus a 24/7 advocate.
    static func quickDial(for campus: Campus) -> [SupportResource] {
        switch campus {
        case .unm: [unmPolice, loboRespect]
        case .cnm: [cnmSecurity, rapeCrisisCenter]
        case .other: [apd, rapeCrisisCenter]
        }
    }

    private static func sorted(_ list: [SupportResource], for campus: Campus) -> [SupportResource] {
        list.sorted { a, b in
            let aLocal = a.campuses.contains(campus), bLocal = b.campuses.contains(campus)
            return aLocal && !bLocal
        }
    }
}
