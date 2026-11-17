# Physical-time hydration availability — .141

The native-app/cloud discrepancy is still open. Package055 adds an explicit opt-in POST `dataPoints:rollUp` over physical-time windows and reuses the existing date controls for a comparison of up to seven selected civil dates. Existing callers without `physical_time:true` retain the previous two-method response. This does not change the normal reader or scheduled ingestion.

The physical range uses actual America/Sao_Paulo date boundaries, including historical DST and skipped midnights. Each aggregate covers at most24hours; a final shorter bucket is retained. At most eight buckets cover seven local dates across DST. The one additional request shares identity verification, byte limits and the30-second deadline. Pagination is reported rather than followed.

Missing hydration payloads, explicit numeric zero, a valid empty response and provider rejection are distinct. Unexpected fields, malformed/off-grid/out-of-range intervals, duplicate conflicts, foreign metrics and invalid volumes are rejected. Only fixed metadata counts leave the server; source values, point IDs and credentials remain private. Aggregates are not promoted to a canonical daily total or added across methods. Account leases, snapshots, freshness and existing scope/encryption/schedules are preserved.

Validation prepared:123 Node tests pass, including five new principal tests. The synthetic browser test retains all prior journeys and adds a physical-only positive case, overlong historical selection rejection and a selected two-day comparison in Chromium/WebKit320/390/1440. Exact remote gates, deployment and actual-owner outcomes are pending. Real-account evidence belongs in the private checkpoint; no recovery is claimed here.

Primary references:

- https://developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints/rollUp
- https://developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints/dailyRollUp
- https://developers.google.com/health/filters

Local pinned Chromium320/390/1440 journeys passed with zero writes and unchanged invented observations. Narrow historical and desktop screenshots were inspected. Initial missing local browser binaries were resolved by installing the pinned official runtime into scratch; WebKit remains required in the existing remote gate.
