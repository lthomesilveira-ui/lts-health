# Isolated Health dashboard preview

Build health-dashboard-20261017.64. This authenticated, read-only preview keeps production /v2/ unchanged.

## Dashboard
- Day mode with Today or any historical date; today is explicitly partial.
- Period mode: 7, 30, 60 and 90 complete days, six calendar months, one calendar year, and received history. Periods end yesterday. Every dashboard section uses the same bounds; older laboratory/protocol context keeps its actual date and outside-period label.
- Water, protein, ingested energy, active energy, explicit total expenditure, steps and sleep retain independent source identities. Means show observed days over calendar days. Unknown values never become zero, and different device/source totals are never added.
- Comparisons require the same source, unit, eligible-day positions, at least five days and 70% coverage in both equal-duration windows. Known partials and ambiguous duplicates are excluded. Combined device provenance remains identified and cannot support a trend until deduplication is established.
- Recorded training sessions, duration coverage, named muscle groups and historical gaps remain distinct from exercise/set counts or actual adherence.
- Laboratory values preserve raw qualifiers, precision, reference ranges and methods. Reference movement is descriptive and does not assert clinical improvement or diagnosis.
- Documented protocols retain dates without implying present use. Water/protein guidance pairs registered targets with the exact same observed days; historical or documentary-only references do not become current targets.

## Isolation and validation
The preview uses existing Supabase session/RLS and the unchanged publishable client configuration. No private data, credentials, migration or new access grant is committed. The classic preview guard precedes modules, permits authentication/read queries and blocks mutations, RPC and edge functions. This is not a replacement for server authorization.

Tests use synthetic fixtures only. The dashboard browser gate covers 320, 393, 1180 and 1440 pixel viewports, period/day navigation, origins, accessible day detail, context, route return and empty/error states. Existing domain-history, interval, analytic and auth/guard gates remain. Screenshots from these tests do not establish real-data or physical iPhone/Safari validation.
