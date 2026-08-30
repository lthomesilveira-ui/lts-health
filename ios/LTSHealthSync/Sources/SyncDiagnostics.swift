import Foundation

enum BackgroundSyncChannel: String {
    case primary
    case source
}

struct BackgroundSyncSnapshot {
    let lastAttemptAt: Date?
    let lastSuccessAt: Date?
    let lastResult: String?

    var lastAttemptSucceeded: Bool? {
        guard let lastResult else { return nil }
        if lastResult == "success" { return true }
        if lastResult == "failure" { return false }
        return nil
    }
}

enum SyncDiagnostics {
    static let changedNotification = Notification.Name("LTSHealthSyncDiagnosticsChanged")

    private static let defaults = UserDefaults.standard

    static func recordAttempt(_ channel: BackgroundSyncChannel) {
        defaults.set(Date().timeIntervalSince1970, forKey: key(channel, "lastAttemptAt"))
        defaults.set("running", forKey: key(channel, "lastResult"))
        notifyChanged()
    }

    static func recordSuccess(_ channel: BackgroundSyncChannel) {
        let now = Date().timeIntervalSince1970
        defaults.set(now, forKey: key(channel, "lastAttemptAt"))
        defaults.set(now, forKey: key(channel, "lastSuccessAt"))
        defaults.set("success", forKey: key(channel, "lastResult"))
        notifyChanged()
    }

    static func recordFailure(_ channel: BackgroundSyncChannel) {
        defaults.set(Date().timeIntervalSince1970, forKey: key(channel, "lastAttemptAt"))
        defaults.set("failure", forKey: key(channel, "lastResult"))
        notifyChanged()
    }

    static func snapshot(_ channel: BackgroundSyncChannel) -> BackgroundSyncSnapshot {
        BackgroundSyncSnapshot(
            lastAttemptAt: date(forKey: key(channel, "lastAttemptAt")),
            lastSuccessAt: date(forKey: key(channel, "lastSuccessAt")),
            lastResult: defaults.string(forKey: key(channel, "lastResult"))
        )
    }

    private static func key(_ channel: BackgroundSyncChannel, _ suffix: String) -> String {
        "syncDiagnostics.\(channel.rawValue).\(suffix)"
    }

    private static func date(forKey key: String) -> Date? {
        let timestamp = defaults.double(forKey: key)
        return timestamp > 0 ? Date(timeIntervalSince1970: timestamp) : nil
    }

    private static func notifyChanged() {
        NotificationCenter.default.post(name: changedNotification, object: nil)
    }
}
