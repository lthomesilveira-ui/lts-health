import Foundation

@MainActor
final class AppModel: ObservableObject {
    @Published var email = ""
    @Published var password = ""
    @Published var isSignedIn = false
    @Published var isBusy = false
    @Published var message = ""
    @Published var lastSyncAt: Date?

    private let api = SupabaseAPI.shared
    private let health = HealthKitSyncCoordinator.shared

    init() {
        let timestamp = UserDefaults.standard.double(forKey: "lastSuccessfulSyncAt")
        if timestamp > 0 { lastSyncAt = Date(timeIntervalSince1970: timestamp) }
        Task { isSignedIn = await api.hasSession }
    }

    func signIn() async {
        guard !email.isEmpty, !password.isEmpty else {
            message = "Informe e-mail e senha."
            return
        }
        isBusy = true
        defer { isBusy = false }
        do {
            try await api.signIn(email: email, password: password)
            password = ""
            isSignedIn = true
            message = "Conta conectada."
        } catch {
            message = error.localizedDescription
        }
    }

    func signOut() async {
        await api.signOut()
        isSignedIn = false
        message = "Sessão encerrada."
    }

    func connectHealthAndInitialSync() async {
        guard isSignedIn else {
            message = "Entre na conta antes de conectar o Apple Saúde."
            return
        }
        isBusy = true
        defer { isBusy = false }
        do {
            try await health.requestAuthorizationAndStart()
            let report = try await health.initialSync(days: 365)
            lastSyncAt = Date()
            message = "Apple Saúde conectado: \(report.canonicalized) métricas canônicas sincronizadas."
        } catch {
            message = error.localizedDescription
        }
    }

    func syncNow() async {
        guard isSignedIn else {
            message = "Entre na conta antes de sincronizar."
            return
        }
        isBusy = true
        defer { isBusy = false }
        do {
            let report = try await health.recentSync(days: 7)
            lastSyncAt = Date()
            message = "Sincronização concluída: \(report.canonicalized) canônicas, \(report.blocked) preservadas por revisão."
        } catch {
            message = error.localizedDescription
        }
    }
}
