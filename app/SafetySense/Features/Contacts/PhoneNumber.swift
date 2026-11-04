import Foundation

/// US phone number helpers. The backend accepts US numbers only, stored as E.164 ("+15055550123").
enum PhoneNumber {
    /// Converts what a person typed or what Contacts returned into E.164, or nil when it
    /// isn't a 10-digit US number. Accepts "(505) 555-0123", "505.555.0123", "+1 505 555 0123", "1-505-...".
    static func normalizedUS(_ raw: String) -> String? {
        let digits = raw.filter(\.isASCIIDigit)
        let national: Substring
        switch digits.count {
        case 10: national = Substring(digits)
        case 11 where digits.first == "1": national = digits.dropFirst()
        default: return nil
        }
        // NANP: area code and exchange can't start with 0 or 1.
        guard let area = national.first, let exchange = national.dropFirst(3).first,
              area != "0", area != "1", exchange != "0", exchange != "1" else { return nil }
        return "+1" + national
    }

    /// "(505) 555-0123" for display. Falls back to the input when it isn't a US number.
    static func display(_ e164OrRaw: String) -> String {
        guard let e164 = normalizedUS(e164OrRaw) else { return e164OrRaw }
        let d = Array(e164.dropFirst(2))
        return "(\(String(d[0..<3]))) \(String(d[3..<6]))-\(String(d[6..<10]))"
    }

    /// Formats while typing: "5055" -> "(505) 5", keeping at most 10 national digits.
    static func formatAsTyped(_ raw: String) -> String {
        var digits = raw.filter(\.isASCIIDigit)
        if digits.count == 11, digits.first == "1" { digits.removeFirst() }
        digits = String(digits.prefix(10))
        let d = Array(digits)
        switch d.count {
        case 0: return ""
        // No closing paren yet, so backspace past "(505" isn't undone by re-formatting.
        case 1...3: return "(\(String(d))"
        case 4...6: return "(\(String(d[0..<3]))) \(String(d[3...]))"
        default: return "(\(String(d[0..<3]))) \(String(d[3..<6]))-\(String(d[6...]))"
        }
    }

    /// Digits for VoiceOver ("5 0 5, 5 5 5, 0 1 2 3") so numbers aren't read as millions.
    static func spokenLabel(_ e164OrRaw: String) -> String {
        guard let e164 = normalizedUS(e164OrRaw) else { return e164OrRaw }
        let d = Array(e164.dropFirst(2)).map(String.init)
        return [d[0..<3], d[3..<6], d[6..<10]].map { $0.joined(separator: " ") }.joined(separator: ", ")
    }

    /// `tel:` URL for a dialable number such as "505-277-2241", "988" or "911".
    static func telURL(_ number: String) -> URL? {
        let digits = number.filter { $0.isASCIIDigit || $0 == "+" }
        return URL(string: "tel:\(digits)")
    }
}

private extension Character {
    var isASCIIDigit: Bool { isASCII && isNumber }
}
