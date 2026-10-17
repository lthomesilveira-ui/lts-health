# Health read-only preview

Build `health-dashboard-20261017.65`. Production `/v2` and the authentication boundary remain unchanged.

The approved daily/period card layout is preserved. This revision restores source-backed context within those cards:
- Detailed training sessions, exercise and set counts, recorded set qualifiers, and explicit linked telemetry. Polar device records remain separate and are never added to canonical session counts.
- Latest laboratory collection separated from older marker histories, current reference position distinct from historical comparability, and human-readable reasons for unavailable comparisons. Only unambiguous report ranges are classified.
- Documentary dates for protocol entries, recorded applications, historical targets distinguished from current goals, and latest-known body assessments clearly outside the selected window.

All automated fixtures are synthetic. No real health records, documents or screenshots are committed. The preview blocks data writes and integration actions.

## Validation
Run `.github/workflows/health-compact-preview.yml`: exact runtime hashes, source/analytical contracts, signed-out and read-only boundaries, complete histories, interval navigation and responsive browser tests. The browser suite covers full and sparse data at 320, 393, 1180 and 1440 CSS pixels, day/period/source changes and route return.
