import Foundation
import HealthKit

final class CandidateHealthMetricsCoordinator: @unchecked Sendable {
    static let shared = CandidateHealthMetricsCoordinator()

    private let healthStore = HKHealthStore()
    private let api = SupabaseAPI.shared
    private let defaults = UserDefaults.standard
    private let calendar = Calendar.autoupdatingCurrent
    private let bridgeVersion = "ios-healthkit-candidates-v1"
    private let syncGate = CandidateSyncGate()
    private var observers: [HKObserverQuery] = []

    private init() {}

    private struct MetricSpec {
        let identifier: HKQuantityTypeIdentifier
        let metricType: String
        let unit: HKUnit
        let unitLabel: String
        let options: HKStatisticsOptions

        var quantityType: HKQuantityType? {
            HKObjectType.quantityType(forIdentifier: identifier)
        }
    }

    private var specs: [MetricSpec] {
        [
            MetricSpec(
                identifier: .stepCount,
                metricType: "steps",
                unit: .count(),
                unitLabel: "count",
                options: [.cumulativeSum, .separateBySource]
            ),
            MetricSpec(
                identifier: .restingHeartRate,
                metricType: "resting_heart_rate_bpm",
                unit: .count().unitDivided(by: .minute()),
                unitLabel: "count/min",
                options: [.discreteAverage, .separateBySource]
            ),
            MetricSpec(
                identifier: .heartRateVariabilitySDNN,
                metricType: "hrv_sdnn_ms",
                unit: .secondUnit(with: .milli),
                unitLabel: "ms",
                options: [.discreteAverage, .separateBySource]
            ),
            MetricSpec(
                identifier: .respiratoryRate,
                metricType: "respiratory_rate_bpm",
                unit: .count().unitDivided(by: .minute()),
                unitLabel: "count/min",
                options: [.discreteAverage, .separateBySource]
            ),
            MetricSpec(
                identifier: .bodyMass,
                metricType: "weight_kg",
                unit: .gramUnit(with: .kilo),
                unitLabel: "kg",
                options: [.discreteAverage, .separateBySource]
            )
        ]
    }

    private var quantityTypes: [HKQuantityType] {
        specs.compactMap(\.quantityType)
    }

    private var readTypes: Set<HKObjectType> {
        Set(quantityTypes.map { $0 as HKObjectType })
    }

    func requestAuthorizationAndStart() async throws {
        guard HKHealthStore.isHealthDataAvailable() else { throw CandidateHealthError.healthDataUnavailable }
        try await requestAuthorization()
        defaults.set(true, forKey: "candidateHealthSetupCompleted")
        try await enableBackgroundDelivery()
        startObservers()
    }

    func startObserversIfConfigured() {
        guard defaults.bool(forKey: "candidateHealthSetupCompleted"), HKHealthStore.isHealthDataAvailable() else { return }
        startObservers()
        Task { try? await enableBackgroundDelivery() }
    }

    func initialSync(days: Int = 365) async throws -> CandidateSyncReport {
        try await sync(days: days)
    }

    func recentSync(days: Int = 7) async throws -> CandidateSyncReport {
        try await sync(days: days)
    }

    private func requestAuthorization() async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            healthStore.requestAuthorization(toShare: [], read: readTypes) { success, error in
                if let error { continuation.resume(throwing: error) }
                else if success { continuation.resume(returning: ()) }
                else { continuation.resume(throwing: CandidateHealthError.authorizationNotCompleted) }
            }
        }
    }

    private func enableBackgroundDelivery() async throws {
        for type in quantityTypes {
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                healthStore.enableBackgroundDelivery(for: type, frequency: .hourly) { success, error in
                    if let error { continuation.resume(throwing: error) }
                    else if success { continuation.resume(returning: ()) }
                    else { continuation.resume(throwing: CandidateHealthError.backgroundDeliveryFailed) }
                }
            }
        }
    }

    private func startObservers() {
        guard observers.isEmpty else { return }
        for type in quantityTypes {
            let query = HKObserverQuery(sampleType: type, predicate: nil) { [weak self] _, completion, error in
                guard let self else { completion(); return }
                if error != nil { completion(); return }
                Task {
                    await self.syncRecentIfAuthenticated()
                    completion()
                }
            }
            observers.append(query)
            healthStore.execute(query)
        }
    }

    private func syncRecentIfAuthenticated() async {
        guard await api.hasSession else { return }
        guard await syncGate.begin() else { return }
        defer { Task { await syncGate.end() } }
        _ = try? await recentSync(days: 7)
    }

    private func sync(days: Int) async throws -> CandidateSyncReport {
        let end = calendar.startOfDay(for: Date())
        let start = calendar.date(byAdding: .day, value: -(max(days, 1) - 1), to: end) ?? end
        let endExclusive = calendar.date(byAdding: .day, value: 1, to: end) ?? Date()
        var metrics: [AppleMetric] = []

        for spec in specs {
            metrics.append(contentsOf: try await dailyMetrics(for: spec, from: start, to: endExclusive))
        }

        guard !metrics.isEmpty else { return CandidateSyncReport(accepted: 0, rejected: 0) }
        var report = CandidateSyncReport(accepted: 0, rejected: 0)
        for chunk in metrics.chunked(into: 150) {
            let batch = AppleSyncBatch(
                batch_id: UUID().uuidString,
                bridge_version: bridgeVersion,
                source_file: nil,
                metrics: chunk
            )
            let response = try await api.send(batch: batch)
            report.accepted += response.accepted
            report.rejected += response.rejected
        }
        return report
    }

    private func dailyMetrics(for spec: MetricSpec, from start: Date, to end: Date) async throws -> [AppleMetric] {
        guard let quantityType = spec.quantityType else { return [] }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: [])
        var interval = DateComponents()
        interval.day = 1
        let anchor = calendar.startOfDay(for: start)

        return try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<[AppleMetric], Error>) in
            let query = HKStatisticsCollectionQuery(
                quantityType: quantityType,
                quantitySamplePredicate: predicate,
                options: spec.options,
                anchorDate: anchor,
                intervalComponents: interval
            )
            query.initialResultsHandler = { [weak self] _, collection, error in
                guard let self else { continuation.resume(returning: []); return }
                if let error { continuation.resume(throwing: error); return }
                guard let collection else { continuation.resume(returning: []); return }
                var output: [AppleMetric] = []
                collection.enumerateStatistics(from: start, to: end) { statistics, _ in
                    let components = self.calendar.dateComponents([.year, .month, .day], from: statistics.startDate)
                    guard let year = components.year, let month = components.month, let day = components.day else { return }
                    let date = String(format: "%04d-%02d-%02d", year, month, day)
                    for source in statistics.sources() ?? [] {
                        let quantity: HKQuantity?
                        if spec.options.contains(.cumulativeSum) {
                            quantity = statistics.sumQuantity(for: source)
                        } else {
                            quantity = statistics.averageQuantity(for: source)
                        }
                        guard let quantity else { continue }
                        let value = quantity.doubleValue(for: spec.unit)
                        guard value.isFinite, value >= 0 else { continue }
                        output.append(AppleMetric(
                            date: date,
                            metric_type: spec.metricType,
                            value: value,
                            unit: spec.unitLabel,
                            source_name: source.name,
                            source_family: self.sourceFamily(for: source.name)
                        ))
                    }
                }
                continuation.resume(returning: output)
            }
            self.healthStore.execute(query)
        }
    }

    private func sourceFamily(for sourceName: String) -> String {
        let normalized = sourceName
            .replacingOccurrences(of: "\u{00A0}", with: " ")
            .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
            .lowercased()
        if normalized.contains("polar") { return "polar_flow" }
        if normalized.contains("watch") { return "apple_watch" }
        if normalized.contains("iphone") { return "iphone" }
        return "healthkit_candidate"
    }
}

private actor CandidateSyncGate {
    private var running = false

    func begin() -> Bool {
        guard !running else { return false }
        running = true
        return true
    }

    func end() {
        running = false
    }
}

struct CandidateSyncReport {
    var accepted: Int
    var rejected: Int
}

enum CandidateHealthError: LocalizedError {
    case healthDataUnavailable
    case authorizationNotCompleted
    case backgroundDeliveryFailed

    var errorDescription: String? {
        switch self {
        case .healthDataUnavailable: return "O Apple Saúde não está disponível neste aparelho."
        case .authorizationNotCompleted: return "A autorização adicional do Apple Saúde não foi concluída."
        case .backgroundDeliveryFailed: return "Não foi possível ativar a atualização candidata em segundo plano."
        }
    }
}
