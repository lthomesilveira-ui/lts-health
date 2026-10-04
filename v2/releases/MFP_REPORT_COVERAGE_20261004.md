# MyFitnessPal and useful report coverage — 2026-10-04

Candidate `home-dashboard-reference-20261003.35`. Publication and authenticated public inspection are pending.

## Behavior

- Known workout durations are shown even when other sessions lack a duration. Each period shows the number of sessions with duration. An incomplete recorded total never produces a complete-period difference.
- Ingested water has a historical chart and equal-window comparison using recorded positive daily totals. Replays are deduplicated, conflicting dates are excluded, missing days are absent, and failed overlapping sources block the calculation. Unknown or differing source identities block period differences.
- Data & sources explains the official MyFitnessPal ZIP export path, its Premium/Premium+ requirement, and the separate need for a real water source. An import never claims that an account is connected.

## Account access

The owner authorized the agent to lead account implementation. On 2026-10-04 the MyFitnessPal website served an explicit security denial before sign-in in the cloud browser. One low-risk reload did not recover access; the agent stopped that site and reported the denial. No password was requested, no authenticated diary was read, no safeguard was bypassed, and no account data was imported in this package.

The installed MyFitnessPal plugin exposes goal calculation and recipe search, not account diary, water or export operations. Official continuous API access is still unavailable to this project. The existing ZIP nutrition importer and complete authenticated water JSON importer remain the executable ingestion paths when actual files are available. Water provenance completion remains blocked; report readiness does not substitute for importing water.

The authorized Polar connection remains intact. Its present connector reads training sessions and sleep; it does not implement every daily-activity or Apple Health data category. Updates on app open and manual refresh work, without a closed-app schedule. Apple Health remains deferred as requested.

## Verification

Local report, hydration, MyFitnessPal transfer and Polar contracts pass. Report contracts exercise partial durations, duplicate/conflicting water, source failure, missingness, unknown provenance and blocked comparisons. The production-path browser gate adds these scenarios at desktop, mobile and narrow widths. Candidate and post-merge evidence will be recorded after execution; physical-device/owner usefulness acceptance is not presumed.

## Primary provider guidance

- [Official MyFitnessPal export instructions](https://support.myfitnesspal.com/hc/en-us/articles/360032273352-Export-your-nutrition-progress-and-exercise-data), updated 2026-08-06: Premium/Premium+ ZIP containing nutrition, progress and exercise CSVs. The article does not establish a water-volume export; real water data must be checked independently.
- [Official diary/export sharing guidance](https://support.myfitnesspal.com/hc/en-us/articles/360032623371-Export-your-data-or-share-your-diary-with-a-Trainer-Doctor-or-Nutritionist): file export and diary sharing have different capabilities. No diary-sharing permission was changed.
- [Cloud browser site-block guidance](https://help.openai.com/articles/20001280-using-cloud-browser-in-chatgpt#when-a-website-blocks-the-task).

No private health values, credentials, source files or plaintext authenticated screenshots belong in this public record.
