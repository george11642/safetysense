import Foundation

// Wire types for the SafetySense backend (Supabase Edge Function `api`).
// Every route: POST JSON to <base>/<route>. Property names are camelCase in Swift and
// snake_case on the wire via `BackendCoding` (convertToSnakeCase / convertFromSnakeCase).
// Timestamps are kept as ISO-8601 strings; use `BackendCoding.date(from:)` to parse.

enum BackendRoute: String, Sendable, CaseIterable {
    case register
    case profileUpdate = "profile/update"
    case contactsSet = "contacts/set"
    case sessionStart = "session/start"
    case sessionHeartbeat = "session/heartbeat"
    case sessionEnd = "session/end"
    case alertCreate = "alert/create"
    case alertEscalate = "alert/escalate"
    case alertCancel = "alert/cancel"
    case alertLocation = "alert/location"
    case alertStatus = "alert/status"
    case evidenceUpload = "evidence/upload"
    case shareGet = "share/get"
    case shareAction = "share/action"
    case accountDelete = "account/delete"

    /// Device routes need `x-device-id` + `x-device-secret`.
    var requiresDeviceAuth: Bool {
        switch self {
        case .register, .shareGet, .shareAction: false
        default: true
        }
    }
}

enum BackendCoding {
    static func makeEncoder() -> JSONEncoder {
        let e = JSONEncoder()
        e.keyEncodingStrategy = .convertToSnakeCase
        e.outputFormatting = [.sortedKeys]
        return e
    }

    static func makeDecoder() -> JSONDecoder {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        return d
    }

    static func date(from string: String?) -> Date? {
        guard let string else { return nil }
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: string) { return d }
        f.formatOptions = [.withInternetDateTime]
        if let d = f.date(from: string) { return d }
        // Postgres can return microseconds; trim to milliseconds and retry.
        if let dot = string.firstIndex(of: "."), let tz = string[dot...].firstIndex(where: { $0 == "+" || $0 == "-" || $0 == "Z" }) {
            let frac = string[string.index(after: dot)..<tz].prefix(3)
            let trimmed = String(string[..<dot]) + "." + frac + String(string[tz...])
            f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            return f.date(from: trimmed)
        }
        return nil
    }
}

struct BackendErrorBody: Codable, Sendable { var error: String }

enum BackendError: Error, Sendable, Equatable, LocalizedError {
    case notConfigured
    case notRegistered
    case http(status: Int, message: String)
    case transport(String)
    case decoding(String)

    var errorDescription: String? {
        switch self {
        case .notConfigured: "The SafetySense server isn't set up in this build."
        case .notRegistered: "This device isn't registered yet."
        case .http(let status, let message): "Server error \(status): \(message)"
        case .transport(let m): "Network problem: \(m)"
        case .decoding(let m): "Unexpected server response: \(m)"
        }
    }
}

/// `x-device-id` / `x-device-secret`, stored in the Keychain.
struct DeviceCredentials: Codable, Sendable, Equatable {
    var deviceId: String
    var deviceSecret: String
}

// MARK: - register
struct RegisterRequest: Codable, Sendable, Equatable { var name: String; var phone: String; var campus: String }
typealias RegisterResponse = DeviceCredentials

/// `profile/update`: name and phone edits after registration, so contacts and dispatch aren't
/// left with old values. Failing is harmless: `AppModel` sends it again on the next sync.
typealias ProfileUpdateRequest = RegisterRequest

// MARK: - contacts/set
struct ContactDTO: Codable, Sendable, Equatable { var name: String; var phone: String }
struct ContactsSetRequest: Codable, Sendable, Equatable { var contacts: [ContactDTO] }
struct OKResponse: Codable, Sendable, Equatable { var ok: Bool }

// MARK: - session
struct SessionStartRequest: Codable, Sendable, Equatable {
    var mode: String                 // GuardMode.rawValue
    var checkInIntervalS: Int
    var graceS: Int?
    var sealedDetails: String?
}
struct SessionStartResponse: Codable, Sendable, Equatable { var sessionId: String }

struct HeartbeatRequest: Codable, Sendable, Equatable {
    var sessionId: String
    var lat: Double?
    var lng: Double?
    var accuracy: Double?
    var battery: Double?
}
struct HeartbeatResponse: Codable, Sendable, Equatable {
    var ok: Bool
    var serverTime: String
    /// The session's live alert, when the server raised one the phone may not know about (the
    /// watchdog, while the phone was offline). Duress alerts are never included.
    var alert: LiveAlertDTO? = nil
}

/// An alert the server is running for this session. `reason` is the contact-facing line.
struct LiveAlertDTO: Codable, Sendable, Equatable {
    var id: String
    var level: Int
    var shareUrl: String
    var trigger: String? = nil
    var reason: String? = nil
    var startedAt: String? = nil
    var status: String? = nil
    var dispatchPolicy: String? = nil
}

struct SessionEndRequest: Codable, Sendable, Equatable { var sessionId: String }

// MARK: - alert
struct AlertCreateRequest: Codable, Sendable, Equatable {
    var sessionId: String?
    var level: Int                   // 2 or 3
    var reason: String
    var trigger: String              // AlertTrigger.rawValue
    var lat: Double?
    var lng: Double?
    var accuracy: Double?
    var battery: Double?
    var dryRun: Bool?
    var dispatchPolicy: String       // DispatchPolicy.rawValue
    /// The phone's own id for this alert. A repeat with the same id returns the same alert
    /// instead of calling everyone again, so a slow response is always safe to retry.
    var clientAlertId: String? = nil
}
struct AlertCreateResponse: Codable, Sendable, Equatable {
    var alertId: String
    var shareUrl: String
    var notified: [NotifiedContact]
}

struct AlertEscalateRequest: Codable, Sendable, Equatable { var alertId: String; var reason: String }
struct DispatchDTO: Codable, Sendable, Equatable {
    var provider: String             // "noonlight_sandbox" | "simulated"
    var alarmId: String?
    var status: String

    var model: DispatchInfo {
        DispatchInfo(provider: DispatchProvider(rawValue: provider) ?? .simulated, alarmID: alarmId, status: status)
    }
}
struct AlertEscalateResponse: Codable, Sendable, Equatable { var dispatch: DispatchDTO }

struct AlertCancelRequest: Codable, Sendable, Equatable { var alertId: String; var duress: Bool }
/// Duress cancels also answer "cancelled" (the server escalates silently).
struct AlertCancelResponse: Codable, Sendable, Equatable { var ok: Bool; var status: String }

struct AlertLocationRequest: Codable, Sendable, Equatable {
    var alertId: String
    var lat: Double
    var lng: Double
    var accuracy: Double
    var battery: Double
}

struct AlertStatusRequest: Codable, Sendable, Equatable { var alertId: String }
struct EventDTO: Codable, Sendable, Equatable {
    var who: String
    var action: String
    var at: String
    /// Server text for the row, e.g. "Text to Maya: not delivered (error 30034)".
    var detail: String? = nil
    /// Twilio SMS delivery receipt on "text_sent" rows: queued, sent, delivered, undelivered, failed.
    var deliveryStatus: String? = nil
    var errorCode: String? = nil

    /// True when Twilio reported that a text never reached the contact.
    var textNotDelivered: Bool { deliveryStatus == "undelivered" || deliveryStatus == "failed" }

    var model: AlertEvent {
        AlertEvent(who: who, action: textNotDelivered ? "text_not_delivered" : action,
                   at: BackendCoding.date(from: at) ?? .now)
    }
}
struct AlertStatusResponse: Codable, Sendable, Equatable {
    var status: String
    var level: Int
    var dispatch: DispatchDTO?
    var events: [EventDTO]
}

// MARK: - account
struct EmptyRequest: Codable, Sendable, Equatable {}
/// `account/delete`: what the server removed for this device. The device secret stops working at once.
struct AccountDeleteResponse: Codable, Sendable, Equatable {
    struct Counts: Codable, Sendable, Equatable {
        var contacts: Int
        var sessions: Int
        var alerts: Int
        var locations: Int
        var events: Int
        var evidenceRows: Int
        var evidenceObjects: Int
        var device: Int
    }
    var ok: Bool
    var deleted: Counts
}

// MARK: - evidence
struct EvidenceUploadRequest: Codable, Sendable, Equatable {
    var alertId: String
    var seq: Int
    var sha256: String
    var ciphertextB64: String
}

// MARK: - share (public, no device headers)
struct ShareGetRequest: Codable, Sendable, Equatable { var token: String }
struct ShareLocationDTO: Codable, Sendable, Equatable {
    var lat: Double
    var lng: Double
    var accuracy: Double?
    var at: String?
}
struct ShareGetResponse: Codable, Sendable, Equatable {
    var firstName: String
    var status: String
    var level: Int
    var reason: String
    var startedAt: String
    var location: ShareLocationDTO?
    var battery: Double?
    var events: [EventDTO]
    var sealedDetails: String?
}

enum ShareAction: String, Codable, Sendable, CaseIterable {
    case onMyWay = "on_my_way"
    case called911 = "called_911"
    case sendHelp = "send_help"
}
struct ShareActionRequest: Codable, Sendable, Equatable {
    var token: String
    var action: String               // ShareAction.rawValue
    var responderName: String
}
