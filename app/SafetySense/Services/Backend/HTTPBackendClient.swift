import Foundation
import Network
import os

/// The real SafetySense API client (Supabase Edge Function `api`). One POST per route, exactly
/// as in ARCHITECTURE.md "Backend contract".
///
/// - **Credentials:** `register` returns a device id + secret, which are kept in the Keychain
///   (`AppGroup.KeychainAccounts.deviceCredentials`, the same item `SettingsStore` uses) and
///   loaded at init, so background intents and refresh tasks can call device routes too.
/// - **Safety switch:** unless "Allow real calls" is on (`BackendRuntimeOptions`), every alert and
///   session goes out with `dry_run: true`, so the server never calls, texts or dispatches.
/// - **Retries:** idempotent routes retry transport errors, 429 and 5xx with backoff. Creating an
///   alert or session retries only when the request clearly never reached the server, so a slow
///   response can't turn into two rounds of phone calls.
/// - **Offline:** heartbeats, alert locations, session ends and alert cancels that fail are kept
///   in `BackendOutbox` and sent when the network returns, after the next successful request, or
///   from a background refresh. Session ends and cancels also retry on a timer until they land.
actor HTTPBackendClient: BackendClientProtocol {
    /// Shared by the app's services, App Intents running in the background, and BG refresh tasks.
    static let shared = HTTPBackendClient()

    struct RetryPolicy: Sendable {
        var maxAttempts: Int
        /// Retry errors where the server may already have acted (timeouts, dropped connections, 5xx).
        var retriesAmbiguousFailures: Bool

        static let idempotent = RetryPolicy(maxAttempts: 3, retriesAmbiguousFailures: true)
        static let createOnce = RetryPolicy(maxAttempts: 3, retriesAmbiguousFailures: false)
        static let single = RetryPolicy(maxAttempts: 1, retriesAmbiguousFailures: false)
    }

    private let configuration: BackendConfiguration
    private let session: URLSession
    private let secrets: any SecretStore
    private let options: @Sendable () -> BackendRuntimeOptions
    private let outbox: BackendOutbox
    private let encoder = BackendCoding.makeEncoder()
    private let decoder = BackendCoding.makeDecoder()
    private let log = Logger(subsystem: "com.georgeteifel.SafetySense", category: "backend")

    private var credentials: DeviceCredentials?
    private var pathMonitor: NWPathMonitor?
    private var isFlushing = false
    private var retryTask: Task<Void, Never>?
    private var retryAttempt = 0

    init(configuration: BackendConfiguration = .live,
         session: URLSession = HTTPBackendClient.makeSession(),
         secrets: any SecretStore = KeychainSecretStore(),
         options: @escaping @Sendable () -> BackendRuntimeOptions = { BackendRuntimeOptions.current() },
         outbox: BackendOutbox = BackendOutbox()) {
        self.configuration = configuration
        self.session = session
        self.secrets = secrets
        self.options = options
        self.outbox = outbox
        self.credentials = secrets.data(for: AppGroup.KeychainAccounts.deviceCredentials)
            .flatMap { try? JSONDecoder().decode(DeviceCredentials.self, from: $0) }
    }

    static func makeSession() -> URLSession {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 20
        config.timeoutIntervalForResource = 45
        config.waitsForConnectivity = false
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        config.httpAdditionalHeaders = ["accept": "application/json"]
        return URLSession(configuration: config)
    }

    // MARK: BackendClientProtocol

    var isConfigured: Bool { configuration.isValid }

    var isRegistered: Bool { credentials != nil }

    func setCredentials(_ credentials: DeviceCredentials?) {
        self.credentials = credentials
        persist(credentials)
    }

    func register(_ request: RegisterRequest) async throws -> RegisterResponse {
        let creds: RegisterResponse = try await post(.register, request, retry: .createOnce)
        setCredentials(creds)
        return creds
    }

    func updateProfile(_ request: ProfileUpdateRequest) async throws -> OKResponse {
        try await post(.profileUpdate, request, retry: .idempotent)
    }

    func setContacts(_ request: ContactsSetRequest) async throws -> OKResponse {
        try await post(.contactsSet, request, retry: .idempotent)
    }

    func startSession(_ request: SessionStartRequest) async throws -> SessionStartResponse {
        let opts = options()
        let mode = GuardMode(rawValue: request.mode) ?? .everyday
        let wire = SessionStartWire(request: request,
                                    dryRun: !opts.allowRealCalls,
                                    dispatchPolicy: opts.dispatchPolicies.policy(for: mode).rawValue)
        return try await post(.sessionStart, wire, retry: .createOnce)
    }

    func heartbeat(_ request: HeartbeatRequest) async throws -> HeartbeatResponse {
        do {
            let response: HeartbeatResponse = try await post(.sessionHeartbeat, request, retry: .idempotent)
            outbox.save(outbox.load().filter {
                if case .heartbeat(let old) = $0.item { return old.sessionId != request.sessionId }
                return true
            })
            return response
        } catch let error as BackendError where error.isWorthQueueing {
            outbox.enqueue(.heartbeat(request))
            throw error
        }
    }

    func endSession(_ request: SessionEndRequest) async throws -> OKResponse {
        // A clean end must never be followed by a replayed heartbeat for the same session.
        dropQueued(sessionID: request.sessionId)
        do {
            return try await post(.sessionEnd, request, retry: .idempotent)
        } catch let error as BackendError where error.isWorthQueueing {
            // Left open, the watchdog would alert contacts for someone who ended safely.
            enqueueDurable(.sessionEnd(request))
            throw error
        }
    }

    func createAlert(_ request: AlertCreateRequest) async throws -> AlertCreateResponse {
        var request = request
        // Drills always stay dry; everything else is dry until "Allow real calls" is on.
        request.dryRun = request.dryRun == true || !options().allowRealCalls
        return try await post(.alertCreate, request, retry: .createOnce)
    }

    func escalateAlert(_ request: AlertEscalateRequest) async throws -> AlertEscalateResponse {
        try await post(.alertEscalate, request, retry: .idempotent)
    }

    func cancelAlert(_ request: AlertCancelRequest) async throws -> AlertCancelResponse {
        do {
            return try await post(.alertCancel, request, retry: .idempotent)
        } catch let error as BackendError where error.isWorthQueueing {
            // Lost, the server's own 90 s countdown would dispatch after a valid cancel.
            enqueueDurable(.alertCancel(request))
            throw error
        }
    }

    func updateAlertLocation(_ request: AlertLocationRequest) async throws -> OKResponse {
        do {
            return try await post(.alertLocation, request, retry: .idempotent)
        } catch let error as BackendError where error.isWorthQueueing {
            outbox.enqueue(.location(request))
            throw error
        }
    }

    func alertStatus(_ request: AlertStatusRequest) async throws -> AlertStatusResponse {
        try await post(.alertStatus, request, retry: .idempotent)
    }

    func uploadEvidence(_ request: EvidenceUploadRequest) async throws -> OKResponse {
        try await post(.evidenceUpload, request, retry: .idempotent)
    }

    func getShare(_ request: ShareGetRequest) async throws -> ShareGetResponse {
        try await post(.shareGet, request, retry: .idempotent)
    }

    func shareAction(_ request: ShareActionRequest) async throws -> OKResponse {
        try await post(.shareAction, request, retry: .createOnce)
    }

    func deleteAccount() async throws -> AccountDeleteResponse {
        let response: AccountDeleteResponse = try await post(.accountDelete, EmptyRequest(), retry: .idempotent)
        outbox.save([])   // nothing queued for this device may be replayed after deletion
        return response
    }

    /// Finishes an erase that couldn't reach the server, with the credentials it set aside.
    func deleteAccount(using credentials: DeviceCredentials) async throws -> AccountDeleteResponse {
        try await post(.accountDelete, EmptyRequest(), retry: .idempotent, credentials: credentials)
    }

    // MARK: Outbox

    /// Number of heartbeats / locations waiting for the network.
    var pendingOutboxCount: Int { outbox.load().count }

    /// Sends whatever is queued, oldest first. Stops at the first network failure.
    func flushOutbox() async {
        guard !isFlushing, credentials != nil, configuration.isValid else { return }
        isFlushing = true
        defer { isFlushing = false }
        let snapshot = outbox.load()
        var remaining = snapshot
        guard !remaining.isEmpty else { return }
        log.info("Flushing \(remaining.count, privacy: .public) queued update(s)")
        while let entry = remaining.first {
            do {
                switch entry.item {
                case .heartbeat(let beat):
                    let _: HeartbeatResponse = try await post(.sessionHeartbeat, beat, retry: .single, flushAfter: false)
                case .location(let fix):
                    let _: OKResponse = try await post(.alertLocation, fix, retry: .single, flushAfter: false)
                case .sessionEnd(let end):
                    let _: OKResponse = try await post(.sessionEnd, end, retry: .single, flushAfter: false)
                case .alertCancel(let cancel):
                    let _: AlertCancelResponse = try await post(.alertCancel, cancel, retry: .single, flushAfter: false)
                }
                remaining.removeFirst()
            } catch let error as BackendError where error.isWorthQueueing {
                break
            } catch {
                remaining.removeFirst()   // 4xx: the session or alert is over; drop it.
            }
        }
        // Keep anything enqueued while we were flushing (a newer heartbeat replaces an older one).
        let added = outbox.load().filter { !snapshot.contains($0) }
        let merged = added.reduce(remaining) { BackendOutbox.merging($1.item, into: $0, now: $1.enqueuedAt) }
        outbox.save(merged)
        if merged.contains(where: \.item.isDurable) {
            scheduleDurableRetry()
        } else {
            retryAttempt = 0
        }
    }

    private func enqueueDurable(_ item: BackendOutbox.Item) {
        outbox.enqueue(item)
        // The app may be suspended before the timer below fires.
        HeartbeatScheduler.scheduleAppRefresh()
        startMonitoringIfNeeded()
        scheduleDurableRetry()
    }

    /// Nothing else may be running to trigger a flush once a session has ended.
    private func scheduleDurableRetry() {
        guard retryTask == nil else { return }
        retryAttempt += 1
        let delay = Self.durableRetryDelay(attempt: retryAttempt)
        retryTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(delay))
            await self?.runDurableRetry()
        }
    }

    private func runDurableRetry() async {
        retryTask = nil
        await flushOutbox()
    }

    /// 15 s, 30 s, 60 s, then every 2 minutes.
    static func durableRetryDelay(attempt: Int) -> TimeInterval {
        min(15 * pow(2, Double(max(attempt, 1) - 1)), 120)
    }

    private func dropQueued(sessionID: String) {
        outbox.save(outbox.load().filter {
            if case .heartbeat(let beat) = $0.item { return beat.sessionId != sessionID }
            return true
        })
    }

    /// Flushes the outbox whenever the network comes back.
    private func startMonitoringIfNeeded() {
        guard pathMonitor == nil else { return }
        let monitor = NWPathMonitor()
        monitor.pathUpdateHandler = { [weak self] path in
            guard path.status == .satisfied, let self else { return }
            Task { await self.flushOutbox() }
        }
        monitor.start(queue: DispatchQueue(label: "com.georgeteifel.SafetySense.path"))
        pathMonitor = monitor
    }

    // MARK: Transport

    private func post<Body: Encodable & Sendable, Response: Decodable & Sendable>(
        _ route: BackendRoute, _ body: Body, retry: RetryPolicy, flushAfter: Bool = true,
        credentials override: DeviceCredentials? = nil
    ) async throws -> Response {
        guard configuration.isValid else { throw BackendError.notConfigured }
        startMonitoringIfNeeded()

        var urlRequest = URLRequest(url: configuration.url(for: route))
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "content-type")
        urlRequest.setValue(configuration.publishableKey, forHTTPHeaderField: "apikey")
        if route.requiresDeviceAuth {
            guard let credentials = override ?? credentials else { throw BackendError.notRegistered }
            urlRequest.setValue(credentials.deviceId, forHTTPHeaderField: "x-device-id")
            urlRequest.setValue(credentials.deviceSecret, forHTTPHeaderField: "x-device-secret")
        }
        do {
            urlRequest.httpBody = try encoder.encode(body)
        } catch {
            throw BackendError.decoding("Couldn't encode \(route.rawValue)")
        }

        var attempt = 0
        while true {
            attempt += 1
            do {
                let response: Response = try await perform(urlRequest, route: route)
                if flushAfter { Task { await self.flushOutbox() } }
                return response
            } catch let failure as Failure {
                let canRetry = attempt < retry.maxAttempts
                    && (failure.neverReachedServer || retry.retriesAmbiguousFailures)
                    && failure.isRetryable
                log.notice("\(route.rawValue, privacy: .public) failed (attempt \(attempt, privacy: .public)): \(failure.error.logDescription, privacy: .public)")
                guard canRetry else { throw failure.error }
                try await Task.sleep(for: Self.backoff(attempt: attempt, retryAfter: failure.retryAfter))
            }
        }
    }

    private struct Failure: Error {
        var error: BackendError
        var isRetryable: Bool
        /// True for errors raised before any byte reached the server (DNS, no route, offline).
        var neverReachedServer: Bool
        var retryAfter: TimeInterval?
    }

    private func perform<Response: Decodable>(_ request: URLRequest, route: BackendRoute) async throws -> Response {
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch let error as URLError {
            throw Failure(error: .transport(error.shortDescription), isRetryable: error.isTransient,
                          neverReachedServer: error.neverReachedServer, retryAfter: nil)
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            throw Failure(error: .transport("request failed"), isRetryable: true, neverReachedServer: false, retryAfter: nil)
        }

        guard let http = response as? HTTPURLResponse else {
            throw Failure(error: .transport("no HTTP response"), isRetryable: true, neverReachedServer: false, retryAfter: nil)
        }
        guard (200..<300).contains(http.statusCode) else {
            let message = (try? decoder.decode(BackendErrorBody.self, from: data))?.error
                ?? HTTPURLResponse.localizedString(forStatusCode: http.statusCode)
            let retryAfter = (http.value(forHTTPHeaderField: "retry-after")).flatMap(TimeInterval.init)
            let status = http.statusCode
            // 429 from our own rate limit ("too many alerts") is final; a gateway 429 isn't.
            let retryable = status >= 500 || (status == 429 && route != .alertCreate)
            // 502/503/504 come from the gateway before the function runs.
            let gateway = status == 502 || status == 503 || status == 504
            throw Failure(error: .http(status: status, message: message), isRetryable: retryable,
                          neverReachedServer: gateway, retryAfter: retryAfter)
        }
        do {
            return try decoder.decode(Response.self, from: data)
        } catch {
            throw Failure(error: .decoding("\(route.rawValue) returned an unexpected shape"), isRetryable: false,
                          neverReachedServer: false, retryAfter: nil)
        }
    }

    static func backoff(attempt: Int, retryAfter: TimeInterval?) -> Duration {
        if let retryAfter, retryAfter > 0 { return .seconds(min(retryAfter, 10)) }
        let base = 0.6 * pow(2, Double(attempt - 1))       // 0.6 s, 1.2 s, 2.4 s
        return .milliseconds(Int((base + Double.random(in: 0...0.3)) * 1000))
    }

    private func persist(_ credentials: DeviceCredentials?) {
        let data = credentials.flatMap { try? JSONEncoder().encode($0) }
        secrets.set(data, for: AppGroup.KeychainAccounts.deviceCredentials)
    }
}

/// `session/start` on the wire. Adds the backend's optional `dry_run` and `dispatch_policy`, and
/// keeps the numbers inside what the server accepts.
struct SessionStartWire: Encodable, Sendable, Equatable {
    var mode: String
    var checkInIntervalS: Int
    /// Server watchdog window: with no heartbeat for this long, the server raises a
    /// `heartbeat_lost` alert. Heartbeats are every 60 s, so this is three missed beats.
    var graceS: Int
    var sealedDetails: String?
    var dryRun: Bool
    var dispatchPolicy: String

    /// The server's watchdog uses `grace_s` as "no heartbeat for this long". The app's 45 s is
    /// the *check-in* answer window, which would trip the watchdog between 60 s heartbeats.
    static let minimumHeartbeatGrace = 180
    /// The server's limit, for a session where nothing keeps the app running behind a locked screen.
    static let maximumHeartbeatGrace = 3600

    init(request: SessionStartRequest, dryRun: Bool, dispatchPolicy: String) {
        mode = request.mode
        // 0 means "no scheduled check-ins" in the app; the server wants 15...3600.
        checkInIntervalS = min(max(request.checkInIntervalS, 15), 3600)
        graceS = min(max(request.graceS ?? 0, Self.minimumHeartbeatGrace), Self.maximumHeartbeatGrace)
        sealedDetails = request.sealedDetails
        self.dryRun = dryRun
        self.dispatchPolicy = dispatchPolicy
    }
}

extension BackendError {
    /// Worth keeping in the outbox: the server never answered, or answered with a 5xx.
    var isWorthQueueing: Bool {
        switch self {
        case .transport: true
        case .http(let status, _): status >= 500 || status == 429
        default: false
        }
    }

    /// True when the request can't have reached the server, so nothing happened there.
    var neverReachedServer: Bool {
        switch self {
        case .notConfigured, .notRegistered: true
        case .transport(let message): BackendError.unreachableMessages.contains(message)
        default: false
        }
    }

    /// The server looked at this request and will never accept it, so retrying is pointless.
    /// 401 and 429 aren't here: a new registration or a little time can clear those.
    var isPermanentRejection: Bool {
        if case .http(let status, _) = self { return (400..<500).contains(status) && status != 401 && status != 408 && status != 429 }
        return false
    }

    static let unreachableMessages: Set<String> = ["offline", "server not found", "couldn't connect"]

    /// Log-safe description (no request bodies, no secrets).
    var logDescription: String {
        switch self {
        case .notConfigured: "not configured"
        case .notRegistered: "not registered"
        case .http(let status, let message): "HTTP \(status) \(message)"
        case .transport(let m): "transport \(m)"
        case .decoding(let m): "decoding \(m)"
        }
    }
}

private extension URLError {
    var neverReachedServer: Bool {
        switch code {
        case .notConnectedToInternet, .cannotFindHost, .cannotConnectToHost, .dnsLookupFailed,
             .internationalRoamingOff, .dataNotAllowed, .callIsActive, .secureConnectionFailed:
            true
        default:
            false
        }
    }

    var isTransient: Bool {
        switch code {
        case .cancelled, .badURL, .unsupportedURL, .userAuthenticationRequired, .appTransportSecurityRequiresSecureConnection:
            false
        default:
            true
        }
    }

    var shortDescription: String {
        switch code {
        case .notConnectedToInternet: "offline"
        case .timedOut: "timed out"
        case .networkConnectionLost: "connection lost"
        case .cannotFindHost, .dnsLookupFailed: "server not found"
        case .cannotConnectToHost: "couldn't connect"
        default: "error \(code.rawValue)"
        }
    }
}
