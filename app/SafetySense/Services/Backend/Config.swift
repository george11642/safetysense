import Foundation

/// Where the SafetySense backend lives. Values come from Info.plist (`SSBackendBaseURL`,
/// `SSBackendPublishableKey`, `SSShareBaseURL`) when they're set, otherwise from the live
/// contest backend below. The publishable key is a public client key (like a Supabase anon
/// key): it identifies the project and is safe to ship. Device routes are protected by the
/// per-device secret from `register`, which is kept in the Keychain.
struct BackendConfiguration: Sendable, Equatable {
    var baseURL: URL
    var publishableKey: String
    /// Contacts' live-location page, `<share base><token>`.
    var shareBaseURL: URL

    var isValid: Bool { !publishableKey.isEmpty && baseURL.scheme == "https" }

    func url(for route: BackendRoute) -> URL {
        baseURL.appending(path: route.rawValue)
    }

    static let live = BackendConfiguration(
        baseURL: SafetySenseConfig.infoURL("SSBackendBaseURL") ?? SafetySenseConfig.backendBaseURL,
        publishableKey: SafetySenseConfig.infoString("SSBackendPublishableKey") ?? SafetySenseConfig.publishableKey,
        shareBaseURL: SafetySenseConfig.infoURL("SSShareBaseURL") ?? SafetySenseConfig.shareBaseURL
    )
}

/// Live contest backend (Supabase project `uvunyysuyuonhoviszmc`, Vercel share pages).
enum SafetySenseConfig {
    static let backendBaseURL = URL(string: "https://uvunyysuyuonhoviszmc.supabase.co/functions/v1/api/")!
    static let publishableKey = "sb_publishable__JyRQ8x_BXI2FWlRsgUULA__5tdSYuh"
    static let shareBaseURL = URL(string: "https://safetysense-live.vercel.app/a/")!

    static func infoString(_ key: String) -> String? {
        guard let value = Bundle.main.object(forInfoDictionaryKey: key) as? String else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    static func infoURL(_ key: String) -> URL? {
        infoString(key).flatMap(URL.init(string:)).flatMap { $0.scheme == "https" ? $0 : nil }
    }
}

/// Runtime safety switches read on every request (cheap: one defaults lookup).
struct BackendRuntimeOptions: Sendable, Equatable {
    /// When false (the default), alerts and sessions go out with `dry_run: true`: the server
    /// records everything but places no calls, sends no texts and never reaches dispatch.
    var allowRealCalls: Bool
    /// Per-mode dispatch policy for `session/start` (used by server-side watchdog alerts).
    var dispatchPolicies: DispatchPolicySettings

    static let safe = BackendRuntimeOptions(allowRealCalls: false, dispatchPolicies: .default)

    /// Reads the App Group switches. Unit tests can never place real calls.
    static func current() -> BackendRuntimeOptions {
        let defaults = AppGroup.defaults
        let info = ProcessInfo.processInfo
        let isTesting = info.environment["XCTestConfigurationFilePath"] != nil
        var allow = defaults.bool(forKey: AppGroup.Keys.allowRealCalls)
        if let i = info.arguments.firstIndex(of: "-ssAllowRealCalls"), i + 1 < info.arguments.count {
            allow = ["1", "yes", "true"].contains(info.arguments[i + 1].lowercased())
        }
        let settings = defaults.data(forKey: AppGroup.Keys.settings)
            .flatMap { try? JSONDecoder().decode(AppSettings.self, from: $0) }
        return BackendRuntimeOptions(allowRealCalls: allow && !isTesting,
                                     dispatchPolicies: settings?.dispatchPolicies ?? .default)
    }
}
