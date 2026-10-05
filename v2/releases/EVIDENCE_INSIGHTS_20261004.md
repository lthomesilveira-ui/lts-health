# Evidence insights — 2026-10-04

Status: candidate `.37`; public delivery and owner acceptance are not claimed yet.

The owner asked to use existing longitudinal history for useful dashboards and reports, leaving water as a separate integration gap. This package revises the current authenticated LTS app in place. No database/schema/security changes, reimports, paid services or new public data are introduced.

## Delivered calculation contracts

- One shared model powers a compact Home brief and the detailed Reports section.
- Nutrition contrasts compare daily observed values on dates with versus without a canonical recorded workout. Every origin stays separate; each metric has its own counts. At least five observed days per group are required to display a difference. This is a display rule, not statistical significance or proof of dietary completeness. Absence of a workout record is not confirmed rest.
- Load comparisons use the maximum recorded working load at the same repetition count, within the same exercise/equipment/location/source/unit/recorded-technique cohort. The two latest unambiguous closed sessions are shown, along with the total compatible-session count. These differences are not strength estimates, causal findings or established trends. Effort and execution may be incompletely recorded.
- Today, future dates, conflicting daily nutrition, unknown provenance, warmups, unknown load scales, orphan children and multiple same-cohort sessions on a date are excluded from these new comparisons. Original histories are untouched.
- Reports provide source selection, pagination with reset on period change, metric-specific denominators, method limits and exercise-history links. Narrow tables become readable cards.

## Verification

Local syntax and independent synthetic model expectations passed, as did existing report, functional-depth, privacy and continuity contracts. The local Chromium launch was denied by the environment; it is not marked passed. Candidate CI must run the production-renderer test at desktop, phone and narrow-phone widths. Authenticated release tests and exact public Cloud Browser inspection remain required before marking the package done.

No private values, dates, payloads, screenshots or credentials are included in public evidence. Synthetic UI evidence is clearly synthetic.

## Preserved limitations

Water transport is still unconfirmed. The phone reports an updated MFP total in Google Health but no corresponding Apple Health water records. The server cannot fix absent phone records; provider relay behavior/timing remains unresolved. Do not rotate the working export key, repeat completed setup or claim that a five-minute schedule guarantees end-to-end transport. Original historical water import and other external/accepted gaps stay separate. This package does not require more owner micro-QA.
