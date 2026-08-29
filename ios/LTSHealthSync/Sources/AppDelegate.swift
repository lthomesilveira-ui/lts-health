import UIKit

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        HealthKitSyncCoordinator.shared.startObserversIfConfigured()
        CandidateHealthMetricsCoordinator.shared.startObserversIfConfigured()
        return true
    }
}
