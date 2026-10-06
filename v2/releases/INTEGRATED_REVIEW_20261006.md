# Integrated review — 2026-10-06 UTC

Status: technically complete and publicly verified `integrated-review-20261006.39`. Normal PR #318 merged at `23b6ed237cbe401c9cf0357c5dc1956fdca86bef`. Package `PKG-INTEGRATED-REVIEW-001`, task `LTS-INTEGRATED-REVIEW-001`, feedback FB-030. Owner subjective UX and physical-device acceptance are not presumed.

## Product and UX

- Preserve the approved Home hierarchy and existing full-history details.
- Correct Home Today/week water indicators to use the canonical deduplicated hydration model, including actual bridge water. Reader failures and source conflicts do not become a false absence or zero.
- Add three progressive report modes: cross-domain overview, selected-date context and consultation summary. Food, water and sleep origins can be selected independently; food selection is shared with existing nutrition insights.
- Join only exact provider dates. Include water-only/sleep-only dates in daily exploration. Show dated context from canonical workouts, composition, labs and medication events without causal or clinical interpretation.
- Present closed-day descriptive water/training and sleep/training contrasts only with at least five observations in each group. Show actual denominators, source, cohort dates and limits; the threshold is not statistical significance.
- Offer a private device-only text summary, generated from the current window and selected origins. No data is sent to professionals or published automatically. This is not a clinical report or treatment recommendation.
- Preserve chosen mode/period, make source/method details progressive and provide section jumps without corrupting route hashes.

## Data and privacy boundaries

Initial actual water transport is independently verified in the private receipt audit. It followed a manual export; automatic recurrence is not inferred. Original authenticated MFP water history remains separately pending. Source keys, phone selections and paid integrations are preserved; this frontend package does not mutate clinical data.

Unknown/ambiguous food origins, conflicting water, unsupported sleep units, duplicate sleep dates, quarantined/noncanonical workouts and failed readers are excluded or explicitly unavailable. Sources/devices are not pooled. Today is visible as partial context, excluded from mean and cohort calculations. Missing records are not zeroes or confirmed rest; same-date sleep does not identify the night before/after training.

Only synthetic fixtures and operational engineering metadata are in this repository. No private values, payloads, screenshots, identifiers or credentials are included.

## Evidence

- Local independent integrated-review model tests, existing reports, evidence-insights and health-context contracts passed.
- Added production-renderer synthetic browser journeys for desktop 1536 × 864, mobile 390 × 844, reduced physical browser 393 × 650 and small phone 320 × 740, including export and failure paths.
- All seven final candidate gates passed for `85850aa322ee9d711014d8e8ce1540d67189f17a`: recovery `37404992152`, workout-source evidence `37404992123`, product architecture `37404992131`, export `37404992103`, functional depth `37404992077`, cockpit `37404992072` and nutrition history `37404992064`.
- Final synthetic responsive artifact `11387280460` was inspected in desktop, phone and reduced physical-browser layouts. Capture helpers synchronize with current rerendered DOM; no production calculations or assertions were weakened.
- All ten post-merge workflows passed: deploy `37405185278`, real authenticated E2E `37405185316`, export `37405185346`, recovery `37405185300`, nutrition `37405185242`, functional depth `37405185260`, timeline `37405185262`, smoke `37405185274`, public v2 smoke `37405211666` and homologation smoke `37405211784`.
- Exact authenticated public Cloud Browser inspection confirmed build `.39`, canonical hydration in Home Today/week, all three integrated review modes, independent source pickers, closed-date exploration, source-synchronized food insights and a consultation preview with actual coverage and sparse-base limits. The private screenshot stays outside the repository.
- Existing histories, Polar authorization and the working phone bridge remain preserved. The initial water delivery does not close `LTS-WATER-RECURRENCE-001` or original authenticated MFP water history `LTS-HYD-IMPORT-001`.
