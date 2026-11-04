import SwiftUI
import UIKit

/// Shows the call in its own window above everything else (the Guard overlay, any open sheet,
/// alerts), the way the system call screen sits above apps. RootView calls `update` whenever
/// the scheduler's phase changes.
@MainActor
enum FakeCallPresenter {
    private static var window: UIWindow?

    static func update(model: AppModel) {
        if model.fakeCall.phase.isPresenting { present(model: model) } else { dismiss() }
    }

    private static func present(model: AppModel) {
        guard window == nil else { return }
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        guard let scene = scenes.first(where: { $0.activationState == .foregroundActive }) ?? scenes.first else { return }
        let host = UIHostingController(rootView: FakeCallScreen().environment(model))
        host.view.backgroundColor = .black
        let w = UIWindow(windowScene: scene)
        w.windowLevel = .alert + 1
        w.rootViewController = host
        w.overrideUserInterfaceStyle = .dark
        w.alpha = 0
        w.makeKeyAndVisible()
        UIView.animate(withDuration: 0.25) { w.alpha = 1 }
        window = w
    }

    private static func dismiss() {
        guard let w = window else { return }
        window = nil
        UIView.animate(withDuration: 0.25, animations: { w.alpha = 0 }, completion: { _ in
            w.isHidden = true
            w.rootViewController = nil
        })
    }
}
