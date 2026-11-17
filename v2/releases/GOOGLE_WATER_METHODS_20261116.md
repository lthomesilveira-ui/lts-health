# Additional Google hydration reads — .140

The native Google app can display current hydration while the raw API listing returns only old observations. An explicit action in the existing water-availability detail compares two additional documented methods: `GET dataPoints:reconcile` and `POST dataPoints:dailyRollUp`, both for seven civil days with the existing read-only nutrition grant and all-sources family. The ordinary listing comparison remains separate.

The account identity and owner lease are checked before the reads. Each method makes one request, with a shared 30-second deadline and existing byte limits. Reconciliation is capped at 25 points; daily aggregation is capped at seven daily buckets. Next-page presence is reported rather than followed. A daily bucket without a hydration payload is missing information, distinct from a validated explicit zero. Provider rejection is reported as an unavailable method and does not silently become an empty list.

Amounts, raw bodies, point identifiers, account identifiers and credentials are excluded from responses and diagnostic logs. Counts from the two methods are independent; no values are added together or promoted into water totals. Source approval, snapshots, ordinary/background hydration freshness, authorization and clinical history are preserved. The control does not run during navigation or automatic status checks.

Primary references:

- https://developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints/reconcile
- https://developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints/dailyRollUp
- https://developers.google.com/health/reference/rest/v4/HydrationLogRollupValue

Validation: 118 local Node tests pass, including method requests, anonymous reconciliation results, missing/zero daily payloads, rejected methods, identity/grant boundaries, invalid dates and volumes, duplicate conflicts, privacy, owner isolation and concurrent disconnect. Candidate browser gates and exact publication remain pending. The real-account outcome belongs in the private project checkpoint; this document makes no claim that current water was received or recovered.

Local pinned Playwright1.56.1 Chromium journeys passed at320/390/1440px with unchanged synthetic observations and zero writes. Local WebKit could not start because system libraries are absent; this is not a passed WebKit gate. Remote candidate checks, production publication and the real-account comparison remain pending. Automatic approval review rejected the git push for missing explicit publication authorization. No alternate route was used to publish; public .139 and the server remain unchanged.

The owner subsequently explicitly authorized publication of this reviewed change and application update after remaining checks. The historical approval rejection is resolved; candidate checks, exact deployment and the real-account outcome still require verification.
