import Foundation
import Network

/// Says when the network comes back, so waiting work (a session link, a registration, evidence)
/// runs at once instead of at its next timer.
@MainActor
final class ConnectivityMonitor {
    /// Runs on each change from offline to online, not on the first reading at launch.
    var onReturn: (@MainActor () -> Void)?

    private let monitor = NWPathMonitor()
    private var wasOffline = false

    func start() {
        monitor.pathUpdateHandler = { [weak self] path in
            let online = path.status == .satisfied
            Task { @MainActor in self?.update(online: online) }
        }
        monitor.start(queue: DispatchQueue(label: "com.georgeteifel.SafetySense.connectivity"))
    }

    private func update(online: Bool) {
        if online, wasOffline { onReturn?() }
        wasOffline = !online
    }
}
