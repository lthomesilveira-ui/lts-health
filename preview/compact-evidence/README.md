# Health read-only preview

Build `health-dashboard-20261019.72`. Production `/v2` and the authentication boundary remain unchanged.

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

## Consumer-facing language

The primary experience uses plain language for missing days, partial periods, source differences and update failures. Provenance remains available under secondary disclosures, while technical diagnostics are separated from the health summary. Internal identities, numerical rules and the preserved raw clinical values remain unchanged. Browser checks use synthetic sessions and data only.

## Recorded training context

The existing session summary now shows explicitly recorded completion comments, the original report behind a disclosure, and the distribution of recorded sets by each exercise’s literal group label. Extensions, recorded working/warm-up phases and reported failures remain separate. Unknown phases are not promoted to working sets; the distribution is not muscle activation, exclusive physiological volume or a training prescription. Conflicting/orphaned details stay out of the summary; unavailable reads are not zero. No stored workout, prescription or existing historical comparison is changed. Public fixtures are invented.

## Consistent laboratory readings (.72)

The detailed laboratory history and report consumers share the dashboard's conservative read-only contract. Raw results remain visible. Notes, limits, unknown metadata and incompatible intermediate collections never become automatic differences or connected curves. Existing documentary blood-count proof is reused without creating new reviews. Tests and visual evidence use synthetic records only.
