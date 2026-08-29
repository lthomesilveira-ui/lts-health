import Foundation

struct SupabaseSession: Codable {
    let accessToken: String
    let refreshToken: String
    let expiresAt: Date

    var shouldRefresh: Bool { expiresAt.timeIntervalSinceNow < 120 }
}

struct TokenResponse: Decodable {
    let access_token: String
    let refresh_token: String
    let expires_in: Double
}

struct AppleMetric: Codable {
    let date: String
    let metric_type: String
    let value: Double
    let unit: String
    let source_name: String
    let source_family: String
}

struct AppleSyncBatch: Codable {
    let batch_id: String
    let bridge_version: String
    let source_file: String?
    let metrics: [AppleMetric]
}

struct AppleSyncResponse: Decodable {
    let ok: Bool
    let batch_id: String
    let accepted: Int
    let rejected: Int
    let canonicalized: Int
    let review_blocked: Int
    let promotion_missing: Int
    let promotion_invalid: Int
}
