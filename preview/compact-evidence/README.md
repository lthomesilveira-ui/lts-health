# Health read-only preview

Build `health-dashboard-20261018.69`. Production `/v2` and the authentication boundary remain unchanged.

The approved daily/period card layout is preserved. This revision adds a tightly bounded, read-only interpretation of reviewed hemoglobin/hematocrit table footnotes. Original raw values remain visible, stored data is unchanged, and other markers, censored values, aliases, methods and references retain their existing boundaries. The prior contextual improvements remain:
- Detailed training sessions, exercise and set counts, recorded set qualifiers, and explicit linked telemetry. Polar device records remain separate and are never added to canonical session counts.
- Latest laboratory collection separated from older marker histories, current reference position distinct from historical comparability, and human-readable reasons for unavailable comparisons. Only unambiguous report ranges are classified.
- Documentary dates for protocol entries, recorded applications, historical targets distinguished from current goals, and latest-known body assessments clearly outside the selected window.

All automated fixtures are synthetic. No real health records, documents or screenshots are committed. The preview blocks data writes and integration actions.

## Validation
Run `.github/workflows/health-compact-preview.yml`: exact runtime hashes, source/analytical contracts, signed-out and read-only boundaries, complete histories, interval navigation and responsive browser tests. The browser suite covers full and sparse data at 320, 393, 1180 and 1440 CSS pixels, day/period/source changes and route return.

## Documentary nutrition reference

The preview reads a bounded, authenticated nutrition-plan projection and compares one food origin plus the selected water origin with its declared daily references. Document receipt does not establish clinical start or adherence. Earlier windows require an explicit retrospective comparison. Meals and alternatives are documentary detail, not consumed-food records. Fixtures and SQL tests are synthetic; no private document or real manifest belongs in this repository.

## Historical dietary access

The full saved archive is independent of the summary window, with explicit source, year, month and date navigation. Historical meal summaries retain the source domain and date; mirrored metric origins never acquire canonical meals. Requested missing dates and failed source reads remain visible instead of jumping to the latest entry. Timeline links verify the loaded record identity, and the daily overview offers explicit access when another food origin has records for that day. No historical data is rewritten or invented.

Synthetic archive checks exceed two thousand daily dates and five thousand meal records, exercise real pagination, missing years, fractional originals, ambiguous records, source failures and recovery, route persistence and narrow-screen controls.
