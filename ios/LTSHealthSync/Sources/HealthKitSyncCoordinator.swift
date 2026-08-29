import Foundation
import HealthKit

final class HealthKitSyncCoordinator: @unchecked Sendable {
    static let shared = HealthKitSyncCoordinator()

    private let healthStore = HKHealthStore()
    private let api = SupabaseAPI.shared
    private let defaults = UserDefaults.standard
    private let calendar = Calendar.autoupdatingCurrent
    private let bridgeVersion = "ios-healthkit-v1"
    private var observers: [HKObserverQuery] = []

    private init() {}

    private var activitySummaryType: HKActivitySummaryType { HKObjectType.activitySummaryType() }

    private var triggerTypes: [HKQuantityType] {
        [
            HKObjectType.quantityType(forIdentifier: .activeEnergyBurned),
            HKObjectType.quantityType(forIdentifier: .appleExerciseTime),
            HKObjectType.quantityType(forIdentifier: .appleStandTime)
        ].compactMap { $0 }
    }

    private var readTypes: Set<HKObjectType> {
        var types = Set<HKObjectType>(triggerTypes)
        types.insert(activitySummaryType)
        return types
    }

    func requestAuthorizationAndStart() async throws {
        guard HKHealthStore.isHealthDataAvailable() else { throw HealthSyncError.healthDataUnavailable }
        try await requestAuthorization()
        defaults.set(true, forKey: "healthSetupCompleted")
        try await enableBackgroundDelivery()
        startObservers()
    }

    func startObserversIfConfigured() {
        guard defaults.bool(forKey: "healthSetupCompleted"), HKHealthStore.isHealthDataAvailable() else { return }
        startObservers()
        Task { try? await enableBackgroundDelivery() }
    }

    func initialSync(days: Int = 365) async throws -> SyncReport {
        let end = calendar.startOfDay(for: Date())
        let start = calendar.date(byAdding: .day, value: -(max(days, 1) - 1), to: end) ?? end
        return try await syncActivitySummaries(from: start, through: end)
    }

    func recentSync(days: Int = 7) async throws -> SyncReport {
        let end = calendar.startOfDay(for: Date())
        let start = calendar.date(byAdding: .day, value: -(max(days, 1) - 1), to: end) ?? end
        return try await syncActivitySummaries(from: start, through: end)
    }

    private func requestAuthorization() async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            healthStore.requestAuthorization(toShare: [], read: readTypes) { success, error in
                if let error { continuation.resume(throwing: error) }
                else if success { continuation.resume(returning: ()) }
                else { continuation.resume(throwing: HealthSyncError.authorizationNotCompleted) }
            }
        }
    }

    private func enableBackgroundDelivery() async throws {
        for type in triggerTypes {
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                healthStore.enableBackgroundDelivery(for: type, frequency: .hourly) { success, error in
                    if let error { continuation.resume(throwing: error) }
                    else if success { continuation.resume(returning: ()) }
                    else { continuation.resume(throwing: HealthSyncError.backgroundDeliveryFailed) }
                }
            }
        }
    }

    private func startObservers() {
        guard observers.isEmpty else { return }
        for type in triggerTypes {
            let query = HKObserverQuery(sampleType: type, predicate: nil) { [weak self] _, completion, error in
                guard let self else { completion(); return }
                if error != nil { completion(); return }
                Task {
                    await self.consumeChanges(for: type)
                    completion()
                }
            }
            observers.append(query)
            healthStore.execute(query)
        }
    }

    private func consumeChanges(for type: HKQuantityType) async {
        do {
            _ = try await advanceAnchor(for: type)
            guard await api.hasSession else { return }
            _ = try await recentSync(days: 7)
        } catch {
            // Observer completion must still run; next launch/manual sync is idempotent.
        }
    }

    private func advanceAnchor(for type: HKSampleType) async throws -> Bool {
        let key = anchorKey(for: type)
        let currentAnchor = loadAnchor(key: key)
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKAnchoredObjectQuery(
                type: type,
                predicate: nil,
                anchor: currentAnchor,
                limit: HKObjectQueryNoLimit
            ) { [weak self] _, samples, deletedObjects, newAnchor, error in
                guard let self else { continuation.resume(returning: false); return }
                if let error { continuation.resume(throwing: error); return }
                if let newAnchor { self.saveAnchor(newAnchor, key: key) }
                continuation.resume(returning: !(samples ?? []).isEmpty || !(deletedObjects ?? []).isEmpty)
            }
            healthStore.execute(query)
        }
    }

    private func syncActivitySummaries(from startDate: Date, through endDate: Date) async throws -> SyncReport {
        let summaries = try await fetchActivitySummaries(from: startDate, through: endDate)
        let metrics = summaries.flatMap(metrics(from:))
        guard !metrics.isEmpty else { return SyncReport(accepted: 0, canonicalized: 0, rejected: 0, blocked: 0) }

        var report = SyncReport(accepted: 0, canonicalized: 0, rejected: 0, blocked: 0)
        for chunk in metrics.chunked(into: 150) {
            let batch = AppleSyncBatch(
                batch_id: UUID().uuidString,
                bridge_version: bridgeVersion,
                source_file: nil,
                metrics: chunk
            )
            let response = try await api.send(batch: batch)
            report.accepted += response.accepted
            report.canonicalized += response.canonicalized
            report.rejected += response.rejected
            report.blocked += response.review_blocked
        }
        defaults.set(Date().timeIntervalSince1970, forKey: "lastSuccessfulSyncAt")
        return report
    }

    private func fetchActivitySummaries(from startDate: Date, through endDate: Date) async throws -> [HKActivitySummary] {
        var start = calendar.dateComponents([.era, .year, .month, .day], from: startDate)
        var end = calendar.dateComponents([.era, .year, .month, .day], from: endDate)
        start.calendar = calendar
        end.calendar = calendar
        let predicate = HKQuery.predicate(forActivitySummariesBetweenStart: start, end: end)
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKActivitySummaryQuery(predicate: predicate) { _, summaries, error in
                if let error { continuation.resume(throwing: error) }
                else { continuation.resume(returning: summaries ?? []) }
            }
            healthStore.execute(query)
        }
    }

    private func metrics(from summary: HKActivitySummary) -> [AppleMetric] {
        let components = summary.dateComponents(for: calendar)
        guard let year = components.year, let month = components.month, let day = components.day else { return [] }
        let date = String(format: "%04d-%02d-%02d", year, month, day)
        let sourceName = "Apple Health ActivitySummary"
        let family = "apple_activity_summary"
        return [
            AppleMetric(
                date: date,
                metric_type: "active_energy_kcal",
                value: summary.activeEnergyBurned.doubleValue(for: .kilocalorie()),
                unit: "kcal",
                source_name: sourceName,
                source_family: family
            ),
            AppleMetric(
                date: date,
                metric_type: "exercise_minutes",
                value: summary.appleExerciseTime.doubleValue(for: .minute()),
                unit: "min",
                source_name: sourceName,
                source_family: family
            ),
            AppleMetric(
                date: date,
                metric_type: "stand_hours",
                value: summary.appleStandHours.doubleValue(for: .count()),
                unit: "count",
                source_name: sourceName,
                source_family: family
            )
        ]
    }

    private func anchorKey(for type: HKSampleType) -> String {
        "healthkit.anchor.\(type.identifier)"
    }

    private func loadAnchor(key: String) -> HKQueryAnchor? {
        guard let data = defaults.data(forKey: key) else { return nil }
        return try? NSKeyedUnarchiver.unarchivedObject(ofClass: HKQueryAnchor.self, from: data)
    }

    private func saveAnchor(_ anchor: HKQueryAnchor, key: String) {
        if let data = try? NSKeyedArchiver.archivedData(withRootObject: anchor, requiringSecureCoding: true) {
            defaults.set(data, forKey: key)
        }
    }
}

struct SyncReport {
    var accepted: Int
    var canonicalized: Int
    var rejected: Int
    var blocked: Int
}

enum HealthSyncError: LocalizedError {
    case healthDataUnavailable
    case authorizationNotCompleted
    case backgroundDeliveryFailed

    var errorDescription: String? {
        switch self {
        case .healthDataUnavailable: return "O Apple Saúde não está disponível neste aparelho."
        case .authorizationNotCompleted: return "A autorização do Apple Saúde não foi concluída."
        case .backgroundDeliveryFailed: return "Não foi possível ativar a atualização em segundo plano."
        }
    }
}

private extension Array {
    func chunked(into size: Int) -> [[Element]] {
        guard size > 0 else { return [self] }
        return stride(from: 0, to: count, by: size).map { index in
            Array(self[index..<Swift.min(index + size, count)])
        }
    }
}
