import Foundation
import Testing
@testable import SafetySense

@Suite("Backend contract")
struct BackendContractTests {
    private func keys<T: Encodable>(_ value: T) throws -> Set<String> {
        let data = try BackendCoding.makeEncoder().encode(value)
        let obj = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        return Set(obj?.keys.map { $0 } ?? [])
    }

    @Test func sessionStartUsesSnakeCase() throws {
        let k = try keys(SessionStartRequest(mode: "night_out", checkInIntervalS: 2700, graceS: 45, sealedDetails: "x"))
        #expect(k == ["mode", "check_in_interval_s", "grace_s", "sealed_details"])
    }

    @Test func alertCreateUsesSnakeCase() throws {
        let k = try keys(AlertCreateRequest(sessionId: "s", level: 2, reason: "r", trigger: "manual_sos",
                                            lat: 1, lng: 2, accuracy: 3, battery: 0.5, dryRun: true,
                                            dispatchPolicy: "contacts_first"))
        #expect(k == ["session_id", "level", "reason", "trigger", "lat", "lng", "accuracy", "battery", "dry_run", "dispatch_policy"])
    }

    @Test func evidenceUploadUsesSnakeCase() throws {
        let k = try keys(EvidenceUploadRequest(alertId: "a", seq: 0, sha256: "h", ciphertextB64: "c"))
        #expect(k == ["alert_id", "seq", "sha256", "ciphertext_b64"])
    }

    @Test func shareActionUsesSnakeCase() throws {
        let k = try keys(ShareActionRequest(token: "t", action: ShareAction.onMyWay.rawValue, responderName: "Maya"))
        #expect(k == ["token", "action", "responder_name"])
    }

    @Test func decodesAlertCreateResponse() throws {
        let json = #"{"alert_id":"a1","share_url":"https://x/a/t","notified":[{"name":"Maya","channel":"call","status":"queued"}]}"#
        let r = try BackendCoding.makeDecoder().decode(AlertCreateResponse.self, from: Data(json.utf8))
        #expect(r.alertId == "a1")
        #expect(r.notified.first?.channel == .call)
    }

    @Test func decodesShareGetWithNulls() throws {
        let json = #"{"first_name":"Alex","status":"active","level":2,"reason":"r","started_at":"2026-11-04T10:00:00.123456+00:00","location":null,"battery":null,"events":[{"who":"Maya","action":"on_my_way","at":"2026-11-04T10:01:00Z"}],"sealed_details":null}"#
        let r = try BackendCoding.makeDecoder().decode(ShareGetResponse.self, from: Data(json.utf8))
        #expect(r.firstName == "Alex")
        #expect(r.location == nil)
        #expect(BackendCoding.date(from: r.startedAt) != nil)
        #expect(r.events.first?.model.displayText == "Maya is on the way")
    }

    @Test func decodesEscalateSimulated() throws {
        let json = #"{"dispatch":{"provider":"simulated","alarm_id":"sim-1","status":"active"}}"#
        let r = try BackendCoding.makeDecoder().decode(AlertEscalateResponse.self, from: Data(json.utf8))
        #expect(r.dispatch.model.provider == .simulated)
        #expect(r.dispatch.model.displayStatus.hasPrefix("Simulated"))
    }

    @Test func mockBackendRequiresRegistration() async throws {
        let backend = MockBackendClient()
        await #expect(throws: BackendError.notRegistered) {
            _ = try await backend.startSession(SessionStartRequest(mode: "walk", checkInIntervalS: 900))
        }
        _ = try await backend.register(RegisterRequest(name: "A", phone: "+1", campus: "unm"))
        let s = try await backend.startSession(SessionStartRequest(mode: "walk", checkInIntervalS: 900))
        #expect(!s.sessionId.isEmpty)
    }
}
