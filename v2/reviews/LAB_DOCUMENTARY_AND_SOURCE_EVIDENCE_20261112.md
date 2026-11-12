# Documentary and source evidence review — 2026-11-12

This is verification of existing evidence, not a new application release. Public runtime `.131`, laboratory values/proofs, health records, credentials, access controls and import limits remain unchanged. The only code change is the protected read-only laboratory verifier.

## Reviewed laboratory presentation

The independently stored documentary proofs are accepted by both the full-row reader and the exact loader projection. The recovered original PDF bytes agree with their recorded document identity. A subsequent complete native reread found no change in any field of the reviewed rows.

Protected presentation validation: **passed**, run [43147576489](https://github.com/lthomesilveira-ui/lts-health/actions/runs/43147576489), exact source commit `5b39f3eb00c62200386fd10712f1d1b3dbf0da1b`. All 15 reviewed rows passed at 1440px and 390px; the complete native reread after the run also matched every original field. Forty private screenshots were encrypted before artifact upload. PR523/524 candidates each passed15/15; the reference-comparison correction PR525 passed14/14 before its normal merge. No application runtime changed. The check requires every reviewed collection card and graph point at desktop and mobile widths, exact original values/units and source reference text, matching owner-scoped loaded rows and a final independent integrity read.

The initial protected run 43143578212 failed. Bounded diagnostics in 43145511593 identified `lab-reviewed-collection-reference`. HTML `innerText` collapses source line breaks; the verifier now compares the exact dedicated reference text node with `allTextContents`. No reference or medical result was rewritten and no assertion was removed.

The older `LTS-LAB-PROPOSAL-RECOVERY-001` concerns a literal historical mutation manifest. That manifest remains unrecovered. This current independent review must not be represented as recovery or execution of that proposal, nor trigger reconstruction of clinical changes.

## Non-Google source evidence

- Existing canonical workout evidence passes orphan and collection-date checks. Legacy summaries still lack precise start times or a shared event identifier; matching by date/value is insufficient. The original Apple XML Polar events stay separate from canonical workouts and provider observations.
- New basal candidates include declared source names but still lack both interval bounds and independently verified full-day coverage. No daily total was promoted from those candidates.
- The unresolved historical source records still carry the explicit unknown-origin placeholder. Later named sources do not retroactively identify them. Current exporter documentation makes `source` optional when unavailable; it does not establish a version-specific diagnosis for these records.
- A fresh Polar support reply recommends reinstall/reset but does not prove recovery or address preservation of local-only data. It does not resolve the legacy workout identity problem. The previously completed phone checks were not repeated; no reset, unpair or reinstall was performed.
- Existing Health Sync correspondence adds no source-specific read/write diagnosis. The existing Health Auto Export request still has no supplier response. No duplicate outbound message was sent.

## Current receiver versus historical failed upload

All six deployed receiver files match the tested source. Current body-observability, summary and basal contract tests pass. The limit remains 1,048,576 bytes. Genuine recent requests were read completely and accepted; their safe summaries report no water and no verified coverage.

Those observations establish current protection and acceptance of those requests. They do **not** recover the size, interval, aggregation/batch contents or data of the historical rejected request. Device diagnostics or an original provider-side record are still required before attributing or attempting recovery of that incident. No synthetic health request was inserted into production.

## Google boundary

No credential was read, copied through an exposed channel, rotated, deleted or saved. No new client, subscription, execution credit or workaround service was purchased. A supported protected credential update path remains unavailable; another owner login alone does not repair that limitation. Hydration history, current hydration, recurrence and physical-device acceptance retain their own unmet criteria.

Primary references: [metric source field](https://help.healthyapps.dev/en/health-auto-export/export-format/health-metrics/), [REST grouping and batching](https://help.healthyapps.dev/en/health-auto-export/automations/rest-api/), [device diagnostic logs](https://help.healthyapps.dev/en/health-auto-export/troubleshooting/app-event-logs/), [Polar original session export](https://support.polar.com/us-en/export-training-sessions-flow).

Patient values, source-record identities, PDF hashes and private screenshots are excluded from this public note. The full private continuity audit retains the inspection details and the distinction between validated work and remaining evidence gaps.
