import Foundation

/// `safetysense://` routes. Any app or web page can open one of these, so a route may only show
/// a screen: it can never start an alert, answer a check-in or change anything.
public enum DeepLink: String, CaseIterable, Sendable {
    case home, checkIn = "checkin", alert, support, vault

    public static let scheme = "safetysense"

    public var url: URL {
        URL(string: "\(Self.scheme)://\(rawValue)")!
    }

    public init?(url: URL) {
        guard url.scheme?.lowercased() == Self.scheme,
              let route = url.host()?.lowercased(), let link = DeepLink(rawValue: route) else { return nil }
        self = link
    }

    /// Where tapping the Live Activity should land for an escalation level.
    public static func forLevel(_ level: Int) -> DeepLink {
        switch level {
        case 0: .home
        case 1: .checkIn
        default: .alert
        }
    }
}
