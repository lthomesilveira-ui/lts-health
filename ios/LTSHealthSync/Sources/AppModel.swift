import Foundation

enum SyncStatusKind {
    case info
    case success
    case warning
    case error
}

@MainActor
final class AppModel: ObservableObject {
    @Published var email = ""
    @Published var password = ""
    @Published var isSignedIn = false
    @Published var isBusy = false
    @Published var message = ""
    @Published var statusKind: SyncStatusKind = .info
    @Published var lastSyncAt: Date?
    @Published var lastPrimaryCount = 0
    @Published var lastSourceCount = 0
    @Published var lastReviewCount = 0
    @Published var healthConfigured = false
    @Published var sourceSyncConfigured = false

    private let api = SupabaseAPI.shared
    private let health = HealthKitSyncCoordinator.shared
    private let candidateHealth = CandidateHealthMetricsCoordinator.shared
    private let defaults = UserDefaults.standard

    init() {
        restoreLocalStatus()
        Task { isSignedIn = await api.hasSession }
    }

    var activationReady: Bool {
        isSignedIn && healthConfigured && sourceSyncConfigured
    }

    var lastSyncSummary: String? {
        guard lastSyncAt != nil else { return nil }
        return "\(lastPrimaryCount) dado(s) principal(is) · \(lastSourceCount) dado(s) por origem · \(lastReviewCount) preservado(s) para revisão"
    }

    func signIn() async {
        guard !email.isEmpty, !password.isEmpty else {
            setStatus("Informe e-mail e senha.", kind: .warning)
            return
        }
        isBusy = true
        defer { isBusy = false }
        do {
            try await api.signIn(email: email, password: password)
            password = ""
            isSignedIn = true
            setStatus("Conta conectada.", kind: .success)
        } catch {
            setStatus(error.localizedDescription, kind: .error)
        }
    }

    func signOut() async {
        await api.signOut()
        isSignedIn = false
        setStatus("Sessão encerrada.", kind: .info)
    }

    func connectHealthAndInitialSync() async {
        guard isSignedIn else {
            setStatus("Entre na conta antes de conectar o Apple Saúde.", kind: .warning)
            return
        }
        isBusy = true
        defer { isBusy = false }

        do {
            try await health.requestAuthorizationAndStart()
            healthConfigured = true
            let primary = try await health.initialSync(days: 365)

            do {
                try await candidateHealth.requestAuthorizationAndStart()
                sourceSyncConfigured = true
                let sources = try await candidateHealth.initialSync(days: 365)
                recordSuccessfulSync(primary: primary.canonicalized, sources: sources.accepted, review: primary.blocked)
                setStatus("Apple Saúde conectado e sincronização inicial concluída.", kind: .success)
            } catch {
                sourceSyncConfigured = defaults.bool(forKey: "candidateHealthSetupCompleted")
                recordSuccessfulSync(primary: primary.canonicalized, sources: 0, review: primary.blocked)
                setStatus("Os dados principais foram sincronizados, mas a leitura complementar não terminou: \(error.localizedDescription)", kind: .warning)
            }
        } catch {
            healthConfigured = defaults.bool(forKey: "healthSetupCompleted")
            sourceSyncConfigured = defaults.bool(forKey: "candidateHealthSetupCompleted")
            setStatus(error.localizedDescription, kind: .error)
        }
    }

    func syncNow() async {
        guard isSignedIn else {
            setStatus("Entre na conta antes de sincronizar.", kind: .warning)
            return
        }
        isBusy = true
        defer { isBusy = false }

        do {
            let primary = try await health.recentSync(days: 7)
            do {
                let sources = try await candidateHealth.recentSync(days: 7)
                recordSuccessfulSync(primary: primary.canonicalized, sources: sources.accepted, review: primary.blocked)
                setStatus("Sincronização concluída.", kind: .success)
            } catch {
                recordSuccessfulSync(primary: primary.canonicalized, sources: 0, review: primary.blocked)
                setStatus("Os dados principais foram sincronizados, mas a leitura complementar falhou nesta tentativa: \(error.localizedDescription)", kind: .warning)
            }
        } catch {
            setStatus(error.localizedDescription, kind: .error)
        }
    }

    private func restoreLocalStatus() {
        healthConfigured = defaults.bool(forKey: "healthSetupCompleted")
        sourceSyncConfigured = defaults.bool(forKey: "candidateHealthSetupCompleted")
        let timestamp = defaults.double(forKey: "lastSuccessfulSyncAt")
        if timestamp > 0 { lastSyncAt = Date(timeIntervalSince1970: timestamp) }
        lastPrimaryCount = defaults.integer(forKey: "lastPrimarySyncCount")
        lastSourceCount = defaults.integer(forKey: "lastSourceSyncCount")
        lastReviewCount = defaults.integer(forKey: "lastReviewSyncCount")
    }

    private func recordSuccessfulSync(primary: Int, sources: Int, review: Int) {
        let now = Date()
        lastSyncAt = now
        lastPrimaryCount = primary
        lastSourceCount = sources
        lastReviewCount = review
        defaults.set(now.timeIntervalSince1970, forKey: "lastSuccessfulSyncAt")
        defaults.set(primary, forKey: "lastPrimarySyncCount")
        defaults.set(sources, forKey: "lastSourceSyncCount")
        defaults.set(review, forKey: "lastReviewSyncCount")
    }

    private func setStatus(_ text: String, kind: SyncStatusKind) {
        message = text
        statusKind = kind
    }
}
