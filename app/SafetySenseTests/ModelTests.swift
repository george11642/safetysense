import Foundation
import Testing
@testable import SafetySense

@Suite("Models")
struct ModelTests {
    @Test func guardModeRawValuesMatchAPI() {
        #expect(GuardMode.allCases.map(\.rawValue) == ["everyday", "walk", "night_out", "date", "ride"])
    }

    @Test func dispatchDefaultsFollowSpec() {
        let p = DispatchPolicySettings.default
        #expect(p.policy(for: .nightOut) == .contactsFirst)
        #expect(p.manualSOS == .dispatchImmediately)
        #expect(p.startingLevel(for: .manualSOS, in: .nightOut) == .dispatch)
        #expect(p.startingLevel(for: .actionButton, in: .walk) == .dispatch)
        #expect(p.startingLevel(for: .riskEngine, in: .nightOut) == .alert)
        #expect(p.startingLevel(for: .missedCheckIn, in: .date) == .alert)
    }

    @Test func escalationLevelsMatchLadder() {
        #expect(EscalationLevel.allCases.map(\.rawValue) == [0, 1, 2, 3])
        #expect(EscalationLevel.checkIn.autoEscalateAfter == 45)
        #expect(EscalationLevel.alert.autoEscalateAfter == 90)
    }

    @Test func settingsRoundTripWithModeKeyedDictionaries() throws {
        var s = AppSettings()
        s.dispatchPolicies.perMode[.date] = .dispatchImmediately
        s.checkInIntervalOverrides[.nightOut] = 3600
        let data = try JSONEncoder().encode(s)
        let json = String(decoding: data, as: UTF8.self)
        #expect(json.contains("\"night_out\""))
        #expect(try JSONDecoder().decode(AppSettings.self, from: data) == s)
    }

    @Test func secondOpinionIsClamped() {
        #expect(SecondOpinion(adjustment: 5, rationale: "").adjustment == SecondOpinion.maxAdjustment)
        #expect(SecondOpinion(adjustment: -5, rationale: "").adjustment == -SecondOpinion.maxAdjustment)
    }

    @Test func sampleAlertRoundTrips() throws {
        let alert = SampleData.alert()
        let decoded = try JSONDecoder().decode(AlertRecord.self, from: JSONEncoder().encode(alert))
        #expect(decoded == alert)
    }
}
