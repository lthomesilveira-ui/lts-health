import Foundation

actor SupabaseAPI {
    static let shared = SupabaseAPI()

    private let baseURL = URL(string: "https://plztdqyuqcjohiimudnr.supabase.co")!
    private let publishableKey = "sb_publishable_7SdlV1H52wVVbPEsN7i7hg_jbluJ8aI"
    private let keychain = KeychainStore.shared
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private var session: SupabaseSession?

    private init() {
        if let raw = keychain.get("session"), let data = raw.data(using: .utf8) {
            session = try? decoder.decode(SupabaseSession.self, from: data)
        }
    }

    var hasSession: Bool { session != nil }

    func signIn(email: String, password: String) async throws {
        var components = URLComponents(url: baseURL.appendingPathComponent("auth/v1/token"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "grant_type", value: "password")]
        var request = URLRequest(url: components.url!)
        request.httpMethod = "POST"
        request.setValue(publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["email": email, "password": password])
        let token = try await tokenResponse(for: request)
        try persist(token)
    }

    func signOut() {
        session = nil
        keychain.remove("session")
    }

    func send(batch: AppleSyncBatch) async throws -> AppleSyncResponse {
        let token = try await validAccessToken()
        do {
            return try await invoke(batch: batch, accessToken: token)
        } catch APIError.unauthorized {
            let refreshed = try await refreshAccessToken(force: true)
            return try await invoke(batch: batch, accessToken: refreshed)
        }
    }

    private func invoke(batch: AppleSyncBatch, accessToken: String) async throws -> AppleSyncResponse {
        var request = URLRequest(url: baseURL.appendingPathComponent("functions/v1/health-apple-sync-batch"))
        request.httpMethod = "POST"
        request.setValue(publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try encoder.encode(batch)
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        if http.statusCode == 401 { throw APIError.unauthorized }
        guard (200..<300).contains(http.statusCode) else {
            throw APIError.server(status: http.statusCode, body: String(data: data, encoding: .utf8) ?? "")
        }
        return try decoder.decode(AppleSyncResponse.self, from: data)
    }

    private func validAccessToken() async throws -> String {
        guard let session else { throw APIError.notSignedIn }
        if session.shouldRefresh { return try await refreshAccessToken(force: false) }
        return session.accessToken
    }

    private func refreshAccessToken(force: Bool) async throws -> String {
        guard let current = session else { throw APIError.notSignedIn }
        if !force && !current.shouldRefresh { return current.accessToken }
        var components = URLComponents(url: baseURL.appendingPathComponent("auth/v1/token"), resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "grant_type", value: "refresh_token")]
        var request = URLRequest(url: components.url!)
        request.httpMethod = "POST"
        request.setValue(publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["refresh_token": current.refreshToken])
        let token = try await tokenResponse(for: request)
        try persist(token)
        return session!.accessToken
    }

    private func tokenResponse(for request: URLRequest) async throws -> TokenResponse {
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else {
            throw APIError.server(status: http.statusCode, body: String(data: data, encoding: .utf8) ?? "")
        }
        return try decoder.decode(TokenResponse.self, from: data)
    }

    private func persist(_ token: TokenResponse) throws {
        let newSession = SupabaseSession(
            accessToken: token.access_token,
            refreshToken: token.refresh_token,
            expiresAt: Date().addingTimeInterval(token.expires_in)
        )
        let data = try encoder.encode(newSession)
        guard let raw = String(data: data, encoding: .utf8) else { throw APIError.invalidResponse }
        try keychain.set(raw, for: "session")
        session = newSession
    }
}

enum APIError: LocalizedError {
    case notSignedIn
    case unauthorized
    case invalidResponse
    case server(status: Int, body: String)

    var errorDescription: String? {
        switch self {
        case .notSignedIn: return "Entre no LTS Health Sync para enviar dados."
        case .unauthorized: return "A sessão expirou. Entre novamente."
        case .invalidResponse: return "Resposta inválida do servidor."
        case let .server(status, _): return "Falha do servidor (\(status))."
        }
    }
}
