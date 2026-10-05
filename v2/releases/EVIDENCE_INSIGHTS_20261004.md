# Evidence insights — 2026-10-04

Status: `.37` published through normal PR #313 at `dc80a109f9074b891952e14c916ca6e5738d0484`. Automated authenticated validation passed; exact manual public visual inspection and owner acceptance are not claimed.

The owner asked to use existing longitudinal history for useful dashboards and reports, leaving water as a separate integration gap. This package revises the current authenticated LTS app in place. No database/schema/security changes, reimports, paid services or new public data are introduced.

## Delivered calculation contracts

- One shared model powers a compact Home brief and the detailed Reports section.
- Nutrition contrasts compare daily observed values on dates with versus without a canonical recorded workout. Every origin stays separate; each metric has its own counts. At least five observed days per group are required to display a difference. This is a display rule, not statistical significance or proof of dietary completeness. Absence of a workout record is not confirmed rest.
- Load comparisons use the maximum recorded working load at the same repetition count, within the same exercise/equipment/location/source/unit/recorded-technique cohort. The two latest unambiguous closed sessions are shown, along with the total compatible-session count. These differences are not strength estimates, causal findings or established trends. Effort and execution may be incompletely recorded.
- Today, future dates, conflicting daily nutrition, unknown provenance, warmups, unknown load scales, orphan children and multiple same-cohort sessions on a date are excluded from these new comparisons. Original histories are untouched.
- Reports provide source selection, pagination with reset on period change, metric-specific denominators, method limits and exercise-history links. Narrow tables become readable cards.

## Verification

Local syntax and independent synthetic model expectations passed, as did existing report, functional-depth, privacy and continuity contracts. The local Chromium launch was denied by the environment; it is not marked passed. All seven final candidate checks passed at `d689e3e81fc8305e1b7e824504b31887f99620ff`, including production-renderer controls and calculations at desktop, phone and narrow-phone widths. Synthetic visual captures were inspected. Home insight details preserve the selected Home calendar window.

Deployment `37260736710` and real authenticated E2E `37260736697` passed against published `.37`. The rendered nutrition table was checked against independently recomputed private observed means, metric-specific counts and display boundaries; available load links opened exercise evidence. Other public post-merge gates passed. The functional-depth screenshot helper hit a detached control during rerender after promotion; it now scrolls the current DOM synchronously. This capture correction does not alter product calculations or the published asset build.

The secure Cloud Browser login was interrupted. A fresh canonical public navigation still shows the login form. Do not retry authentication without renewed owner intent, claim exact manual authenticated visual inspection, mark the package done or ask for repeated phone micro-tests. `EXECUTION_STATE.json` records this acceptance blocker explicitly; the previous fully inspected release remains `.36` until the visual gate is met.

No private values, dates, payloads, screenshots or credentials are included in public evidence. Synthetic UI evidence is clearly synthetic.

## Preserved limitations

Water transport is still unconfirmed. The phone reports an updated MFP total in Google Health but no corresponding Apple Health water records. The server cannot fix absent phone records; provider relay behavior/timing remains unresolved. Do not rotate the working export key, repeat completed setup or claim that a five-minute schedule guarantees end-to-end transport. Original historical water import and other external/accepted gaps stay separate. This package does not require more owner micro-QA.
