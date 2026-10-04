# Health Auto Export bridge — 2026-10-04

## Trigger and behavior

The owner approved the annual Health Auto Export Premium bridge and confirmed purchase. This package accepts daily Apple Health JSON v2 uploads, so nutrition published by MyFitnessPal to Health can reach LTS automatically. Recorded water is supported; provider-to-Health water availability is not assumed. This is a separate bridge from the currently unavailable direct MyFitnessPal API.

The authenticated Data screen creates a random, revocable phone key and exposes copy controls. Only SHA-256 is stored server-side; plaintext is kept in page memory briefly, never browser storage, the repository, logs or backups. Configuration alone is labelled waiting for the first upload. Actual receipt metadata drives the receiving state.

## Data and privacy

- `health-auto-export-connection` validates a real nonanonymous owner JWT. `health-auto-export-receive` disables the gateway JWT only because it implements custom per-owner key authentication before reading the body and checks revocation again atomically before writing.
- The connection table is RLS-enabled and inaccessible to anonymous/authenticated browser roles. Management/ingestion RPCs are executable only by service_role. Browser roles cannot forge or overwrite bridge provenance in nutrition/source rows.
- JSON is limited to 1 MiB, 80 metric definitions and 2,500 points. Daily aggregation is mandatory. Units, values, real dates, duplicate daily points and source strings are validated. Unsupported types are ignored with counts, not converted into plausible values. Only Health Metrics exports are accepted.
- Different original sources retain different IDs. Unknown sources are labelled unknown, never inferred as MyFitnessPal. Replay updates stable source IDs; held/superseded rows retain status and value. Rotation/revocation and ingestion serialize on the connection row.
- Daily nutrition is projected separately per source. Existing original nutrition wins on overlapping dates in the display layer. Backups retain original rows and provenance. Missing nutrients remain null.
- Water uses actual volumes, explicit units and canonical bridge provenance. Conflicting overlapping water observations remain excluded from totals. The bridge does not complete `LTS-HYD-IMPORT-001`, which requires the original authenticated MyFitnessPal water export.
- Sleep, heart rate, HRV, respiratory rate, saturation, weight and activity remain separate source evidence; they do not replace bioimpedance, canonical activity summaries or structured strength sessions. Polar endpoints, authorization and history are unchanged.

## Validation completed before candidate promotion

- Parser/receiver, UI key lifecycle, hydration and useful-report contracts passed.
- Desktop/mobile setup, canonical boundary, source status, source-copy, verifiable backup and recovery browser gates passed.
- Actual database transaction probes passed for creation, replay, nutrition projection, held value/status retention, rotation and revocation; the transaction was rolled back with no synthetic health rows retained.
- Database metadata confirms RLS on connection storage, no browser/anonymous SELECT, no browser ingestion EXECUTE and service ingestion EXECUTE.
- Actual anonymous connection calls and missing/unknown phone keys returned 401.
- Security advisor: protected service-only tables intentionally have RLS with no browser policies ([explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)); an existing Auth leaked-password protection warning is outside this package ([setting](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)).

## Candidate state and phone activation

Candidate frontend: `home-dashboard-reference-20261003.36`. Candidate CI, normal merge, public deploy and exact authenticated Cloud Browser verification are required before declaring delivery. Update this section with actual evidence after promotion.

The owner must grant Health read permissions on the physical iPhone, enable MyFitnessPal HealthKit sharing, and configure a REST API automation with the LTS-provided URL/header/key. Use Health Metrics, JSON v2, Summarize ON, Day grouping, Default period and an hourly cadence; select only the supported needed metrics. Prefer MyFitnessPal for nutrition where the exporter offers preferred sources. Export yesterday/today once and verify receipt in LTS. Background refresh/widget improve opportunities; iOS unlocked-device restrictions mean hourly delivery is not guaranteed.

No real iPhone upload has been verified yet. No new Polar credentials or consent are required. No Apple Developer subscription is needed for this third-party bridge; the separate native companion physical-device task remains deferred.

## Primary implementation sources

- [JSON overview](https://help.healthyapps.dev/en/health-auto-export/export-format/)
- [Health Metrics JSON contract](https://help.healthyapps.dev/en/health-auto-export/export-format/health-metrics/)
- [REST API automation](https://help.healthyapps.dev/en/health-auto-export/automations/rest-api/)
- [MyFitnessPal Apple Health sharing](https://support.myfitnesspal.com/hc/en-us/articles/360032271092-Apple-Health-connection-and-syncing)
