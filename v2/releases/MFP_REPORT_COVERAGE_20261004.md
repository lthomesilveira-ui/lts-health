# MyFitnessPal and useful report coverage — 2026-10-04

Published `home-dashboard-reference-20261003.35`. Technical release verification and authenticated public inspection are complete; MyFitnessPal account access and actual water import remain blocked.

## Behavior

- Known workout durations are shown even when other sessions lack a duration. Each period shows the number of sessions with duration. An incomplete recorded total never produces a complete-period difference.
- Period comparisons show prior/current/difference together on phones, with the date windows visible and without requiring horizontal scrolling.
- The report refresh button remains visible on phones with a 44 px touch target, so a failed source can actually be retried.
- Ingested water has a historical chart and equal-window comparison using recorded positive daily totals. Replays are deduplicated, conflicting dates are excluded, missing days are absent, and failed overlapping sources block the calculation. Unknown or differing source identities block period differences.
- Data & sources explains the official MyFitnessPal ZIP export path, its Premium/Premium+ requirement, and the separate need for a real water source. An import never claims that an account is connected.

## Account access

The owner authorized the agent to lead account implementation. On 2026-10-04 the MyFitnessPal website served an explicit security denial before sign-in in the cloud browser. One low-risk reload did not recover access; the agent stopped that site and reported the denial. No password was requested, no authenticated diary was read, no safeguard was bypassed, and no account data was imported in this package.

The installed MyFitnessPal plugin exposes goal calculation and recipe search, not account diary, water or export operations. Official continuous API access is still unavailable to this project. The existing ZIP nutrition importer and complete authenticated water JSON importer remain the executable ingestion paths when actual files are available. Water provenance completion remains blocked; report readiness does not substitute for importing water.

The authorized Polar connection remains intact. Its present connector reads training sessions and sleep; it does not implement every daily-activity or Apple Health data category. Updates on app open and manual refresh work, without a closed-app schedule. Apple Health remains deferred as requested.

## Verification

Local report, hydration, MyFitnessPal transfer and Polar contracts pass. Report contracts exercise partial durations, duplicate/conflicting water, source failure, missingness, unknown provenance and blocked comparisons. The production-path browser gate adds these scenarios at desktop, mobile and narrow widths. All five final candidate gates passed at `f76fdaefe5280ad6196360df8176bf8c9ec808e1`; physical-device/owner usefulness acceptance is not presumed.

## Primary provider guidance

- [Official MyFitnessPal export instructions](https://support.myfitnesspal.com/hc/en-us/articles/360032273352-Export-your-nutrition-progress-and-exercise-data), updated 2026-08-06: Premium/Premium+ ZIP containing nutrition, progress and exercise CSVs. The article does not establish a water-volume export; real water data must be checked independently.
- [Official diary/export sharing guidance](https://support.myfitnesspal.com/hc/en-us/articles/360032623371-Export-your-data-or-share-your-diary-with-a-Trainer-Doctor-or-Nutritionist): file export and diary sharing have different capabilities. No diary-sharing permission was changed.
- [Cloud browser site-block guidance](https://help.openai.com/articles/20001280-using-cloud-browser-in-chatgpt#when-a-website-blocks-the-task).

No private health values, credentials, source files or plaintext authenticated screenshots belong in this public record.

## Published evidence

PR #306 merged normally at `de7c1cc0ebdd25405036fa59fadd5acdcb378ce0`. Final candidate gates: reference `37224570143`, functional depth `37224570035`, cockpit `37224570186`, nutrition `37224570002`, recovery `37224570063`. Responsive synthetic artifact `11311845561` was inspected: mobile prior/current/difference values are visible together and refresh has a 44 px touch target.

The first post-merge real-data check sampled the previous laboratory chart before the scheduled new report render. PR #307 preserved its no-manufactured-trend assertion and added a wait for the previous report to detach. It merged normally at `dc48bd4d0fc354547f840fda75675e393fdf6979` after all four candidate checks passed. No lab values or application behavior were changed by that test correction.

All nine final post-merge workflows passed: deploy `37225072815`, authenticated real-data E2E `37225072814`, full histories `37225072908`, public Pages `37225090323`, homologation Pages `37225090260`, timeline `37225072819`, smoke `37225072813`, nutrition `37225072810`, recovery `37225072812`.

The exact public `.35` was opened in authenticated Cloud Browser after deployment. The report showed the recorded duration and actual session coverage, blocked incomplete duration differences, preserved the missing-water state, and continued to expose the actual Polar history. Data & sources showed Polar authorized, MyFitnessPal API access pending, and the expanded official ZIP instructions. A private viewport proof stays outside this repository. No MyFitnessPal account activation or new source import is claimed.
