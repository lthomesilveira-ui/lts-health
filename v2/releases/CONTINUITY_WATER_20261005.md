# Continuity and water-source restart — 2026-10-05

## Executed reconciliation

- Recovered production `main` at `b3bc19200c63a153260115d23871f1e2872d5fc5`, build `home-dashboard-reference-20261003.38`.
- Reviewed `architecture-v2` and `product-clarity-p0`: no exclusive changes ahead of production. No open pull request was found on restart. No branch force/update or product reset was performed.
- Read the current private validation record and water diagnostic. The former interrupted-login state was superseded by a successful secure login and exact-public manual inspection. This restart did not open another authenticated browser session.
- Rechecked all ten final production workflow runs as successful, including deploy `37297331595` and real-auth E2E `37297331577`.
- Corrected execution state, handoff, project master and feedback ledger to identify `.38` as the verified release and the insight package as technically complete. Physical-device/owner UX acceptance remains unclaimed.

## Water remains unresolved

A read-only live operational audit reconfirmed an active phone bridge and other received metrics, but no dietary-water receipt or canonical water row. Polar has no recorded sync error. The private phone diagnostic also records that a direct Google Health water entry did not appear in Apple Health. This expands the observed failure beyond a third-party re-export hypothesis; it does not identify the provider's internal defect.

The owner explicitly chose to retain MyFitnessPal as the sole water-entry source. No switch to Apple Health, extra daily logging, connection reset, secret rotation, paid connector or support message was performed. The existing owner-browser authenticated batch extractor/importer is preserved. Source files must be obtained and validated before a new parser or claimed import; there was no authentic export during this restart.

## Source-access assessment

Official sources were rechecked:

- [Google Health and Apple Health](https://support.google.com/googlehealth/answer/17037331?hl=en): water write support is documented, but actual relay on this phone remains absent. Do not infer universal impossibility or eventual arrival.
- [Google Health API setup](https://developers.google.com/health/setup): new projects are not currently onboarded. Legacy Fitbit support ended 30/09/2026 and shutdown is scheduled 30/10/2026. A new durable direct connector is not currently available to this project.
- [Google Health export](https://support.google.com/googlehealth/answer/14236615?hl=en): Google Takeout is an official account-export route. It does not establish this owner's water schema, included provenance or continuous ingestion; do not label it a working water integration without a representative real export.
- [MyFitnessPal Apple Health sharing](https://support.myfitnesspal.com/hc/en-us/articles/360032271092-Apple-Health-connection-and-syncing): documented nutrition sharing does not guarantee water-volume sharing. Existing permission checks need not be repeated.

## Next actionable source path

Keep `LTS-HEALTH-AUTO-EXPORT-WATER-001` externally blocked until supported direct access, an authentic batch export or a real water receipt exists. Preserve `LTS-HYD-IMPORT-001` for original MyFitnessPal history. Do not bypass the provider's cloud-browser security block or claim that local/synthetic extractor tests prove live account access. An owner-side authenticated export uses the owner's ordinary browser session and is distinct from cloud-account access. Continuous collection from that source has not been implemented or verified.

Private health values, credentials, raw payloads and screenshots remain outside this repository. This package changes operational documents only; frontend `.38`, receiver version 3 and clinical/source data are unchanged.
