import Foundation

/// What the Marked safe screen shows. Taken just before the cancel, because the ladder clears
/// `activeAlert` as soon as a PIN is accepted. Built the same way for the safety and duress PINs,
/// so nothing on screen can tell them apart.
struct MarkedSafeSummary: Sendable, Equatable {
    var alertID: UUID
    /// The Guard the alert came from (nil for an SOS with no session running).
    var mode: GuardMode?
    var startedAt: Date
    var endedAt: Date
    var reachedDispatch: Bool
    var contactFirstNames: [String]
    /// This build contacts nobody, or the server logged the alert as a test.
    var wasTest = false
    /// The server hasn't confirmed the alert or its cancel, so nobody can be promised anything.
    /// Comes from the connection alone, so it reads the same for both PINs.
    var couldntConfirm = false
    /// Clips saved when the PIN went in. Taken once, because a duress alert keeps recording and
    /// a count that rose on this screen would tell the two PINs apart.
    var clipCount = 0

    /// `2:11`, the clock without AM or PM, as the prototype's summary line reads.
    static func clock(_ date: Date) -> String {
        let time = date.formatted(date: .omitted, time: .shortened)
        return time.split(whereSeparator: \.isWhitespace).first.map(String.init) ?? time
    }

    var bodyText: String {
        if wasTest { return "This was a test alert, so nobody was contacted. Your live link stopped sharing your location." }
        if couldntConfirm {
            return "SafetySense hasn't heard back from its server, so \(NameList.join(contactFirstNames)) may not know you're okay yet. If you can, text them yourself."
        }
        if contactFirstNames.isEmpty { return "Your alert has stopped, and your live link stopped sharing your location." }
        return "We told \(NameList.join(contactFirstNames)) that you're okay, and your live link stopped sharing your location."
    }

    /// `NIGHT OUT · ALERT 2:11–2:31 · 3 CLIPS IN VAULT`, or
    /// `NIGHT OUT · ALERT 2:11 · STOPPED PRE-DISPATCH` when dispatch was never requested.
    func summaryLine(clipCount: Int) -> String {
        var parts: [String] = []
        if let mode, mode != .everyday { parts.append(mode.displayName) }
        if reachedDispatch {
            parts.append("Alert \(Self.clock(startedAt))–\(Self.clock(endedAt))")
            if clipCount > 0 { parts.append("\(clipCount) \(clipCount == 1 ? "clip" : "clips") in Vault") }
        } else {
            parts.append("Alert \(Self.clock(startedAt))")
            parts.append("Stopped pre-dispatch")
        }
        return parts.joined(separator: " · ").uppercased()
    }
}
