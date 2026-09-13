# Verified release — functional history depth

Date: 2026-09-13. Public engineering metadata only.

## Exact release

- PR #266, merged normally with expected head checked.
- Published code: `de631a4b78c2d244ff75e660df4c4763a21a95b7`.
- Build: `ux-coherence-history-depth-20260913.8`.
- Public app: `https://lthomesilveira-ui.github.io/lts-health/v2/`.

## Delivered scope

Training now exposes all available canonical sessions through pagination, query and year filters, historical session detail, preserved return context, and read-only exercise history. Load curves require comparable exercise/equipment/location/units and do not estimate strength or prescribe training.

Labs now offers all markers, including single and textual results, with search, explicit source/unit/method cohorts, full periods and full paginated result history. Ambiguous or censored results remain available to read without being forced into trends.

Composition now offers full measurement history, year/source/period navigation, date-pair comparison and read-only detail with segmental values only when linkage is safe. The reviewed oldest record correctly showed that no segmental record could be linked; no values were fabricated.

Home keeps the accepted structural direction instead of adding large new dashboard blocks. A clipped mobile rail and hidden mobile refresh control found by browser tests were corrected before release.

## Evidence actually executed

- Pre-merge Functional Depth: run `34782347061` (production structural render path with a synthetic service, desktop/390px/320px).
- Pre-merge product architecture/reference: `34782347051`; cockpit: `34782347057`.
- Deploy: `34782704192`.
- Post-merge functional depth: `34782704098`.
- Real authenticated public E2E: `34782704240`.
- General smoke: `34782704118`; Timeline: `34782704236`.
- Deployed homologation: `34782722191`; staging: `34782722247`.

All above concluded successfully. Real-auth waited for the exact build and compared complete UI history access with independent paginated database reads. These checks do not establish that every historical source ever supplied has been imported; they validate access to the records in the authorized database at the time of the run.

## Private visual inspection and durability

The encrypted artifact `10325417914` from the real-auth run was downloaded, its SHA256 checked, decrypted privately and the actual desktop/mobile screenshots inspected. Review included Home, training history, Labs, composition overview and historical measurement detail. No physical-iPhone or pixel-identical-parity claim is made.

Artifact SHA256: `6701fdd0f3e7a116086ce711b5cc5ea75e8491793b496b2414b742a9184883d2`.

A durable owner-only Drive copy is named `LTS Health - evidencias privadas release history-depth 20260913.8.zip`. Sharing metadata was checked: not shared, owner only. Use the private key and procedure documented in `FUNCTIONAL_DEPTH.md`; never commit decrypted screenshots or key material. This release fixes future screenshot uploads; previous plaintext artifacts are not claimed deleted.

The original approved reference is also recovered and preserved privately, with its hash and precedence in `REFERENCE_VISUAL_CONTRACT.md`.

## Acceptance and next work

FB-018 / issue #265: core Training/Labs/Composition depth delivered, pending user product feedback. FB-019: durable state and evidence recorded outside chat. Overall product completeness, exact visual parity and remaining domains are not marked complete.

Next executable work: Timeline, nutrition/hydration, recovery/analyses and cross-product visual consistency. MyFitnessPal water still requires the user's authenticated notebook export/import; integration and account-security blockers remain unchanged in `EXECUTION_STATE.json`.
