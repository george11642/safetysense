import Foundation
import LocalAuthentication

/// Face ID / passcode check for sensitive controls (ending a session, opening the Vault).
enum DeviceAuth {
    enum Outcome: Equatable, Sendable {
        case success
        /// The person cancelled or the face didn't match.
        case failed
        /// No biometrics or passcode on this device (e.g. a fresh simulator). Callers fall back to the safety PIN.
        case unavailable
    }

    /// Biometry name for button labels ("Face ID", "Touch ID" or "passcode").
    @MainActor static var biometryName: String {
        let context = LAContext()
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil) else { return "PIN" }
        switch context.biometryType {
        case .faceID: return "Face ID"
        case .touchID: return "Touch ID"
        case .opticID: return "Optic ID"
        default: return "PIN"
        }
    }

    /// True when Face ID / Touch ID is enrolled and usable right now.
    nonisolated static var hasBiometrics: Bool {
        LAContext().canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
    }

    /// Runs `.deviceOwnerAuthentication` (biometrics with passcode fallback). Without enrolled
    /// biometrics it returns `.unavailable` so callers go straight to SafetySense's own safety PIN
    /// pad (which also accepts the duress PIN) instead of the iPhone passcode sheet.
    nonisolated static func authenticate(reason: String) async -> Outcome {
        guard hasBiometrics else { return .unavailable }
        return await authenticateOwner(reason: reason)
    }

    /// Face ID or the iPhone passcode, for when there's no safety PIN to fall back on.
    nonisolated static func authenticateOwner(reason: String) async -> Outcome {
        let context = LAContext()
        context.localizedCancelTitle = "Not now"
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else { return .unavailable }
        return await withCheckedContinuation { continuation in
            context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { ok, err in
                if ok { continuation.resume(returning: .success); return }
                let code = (err as? LAError)?.code
                continuation.resume(returning: code == .passcodeNotSet || code == .biometryNotEnrolled ? .unavailable : .failed)
            }
        }
    }
}
