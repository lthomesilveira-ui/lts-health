# LTS Health — CURRENT HANDOFF

Updated: 2026-09-13. Public engineering metadata only; health data and credentials stay private.

## Read first

Repository `lthomesilveira-ui/lts-health`; public app `https://lthomesilveira-ui.github.io/lts-health/v2/`; public branch `main`.

Before any write re-fetch main, active branch, architecture-v2, CURRENT_HANDOFF.md, PROJECT_MASTER.md, EXECUTION_STATE.json, FEEDBACK_LEDGER.md and REFERENCE_VISUAL_CONTRACT.md. Audit parallel changes, preserve compatible work, use normal PR/merge and never force.

Current code/deploy evidence outranks documentation. `EXECUTION_STATE.json` owns the machine-readable task states; this handoff describes the current transition. `PROJECT_MASTER.md` preserves history, `FEEDBACK_LEDGER.md` preserves feedback, `FUNCTIONAL_DEPTH.md` describes tests and private evidence handling. Chat memory is not a source of truth.

## User direction

The user accepted the structural layout direction, but said it exposes too little history/functionality. Issue #265 is P0. Preserve Home's concise hierarchy and the current design; add real depth behind it rather than more dashboard cards or a new redesign. No final completeness or exact visual parity is approved.

The original approved mobile image has now been recovered and saved in the owner's PRIVATE Drive as `LTS Health - referencia visual aprovada.png`; SHA256 `dc322921f2d05d26f6478d213a6e3a2317978fba62897a77df4dda29d03cc05c`. It must not be copied into this public repository because it includes personal/illustrative context. The older textual desktop contract is historical, not authority to undo the later mobile direction.

## Last verified public release

Commit `f97c3cd941f50cb12dd5ab79635064429121d584`; build `ux-coherence-model-convergence-20260913.7`; PRs #263/#264. Real authenticated E2E run `34755276514`; deploy run `34755276530`. Home, Training, Composition and Labs are structural routes. This is a historical verified baseline, not verification of the package below.

## Current package — PKG-FUNCTIONAL-DEPTH-001

Implementation prepared; not yet promoted/visually accepted. Target build `ux-coherence-history-depth-20260913.8`.

- Training: complete pagination/query/year; session/series; descriptive exercise history, equipment/place/unit boundaries, return context.
- Labs: search and select every marker; origin/unit/method selector; period and accessible point selection; full result pagination including text, missing and ambiguous entries.
- Composition: full history/source/period, arbitrary same-source comparison, read-only measurement and segmental detail without guessing links.
- Runtime: wait for route domains, refresh after data changes, preserve focus/scroll/disclosures.
- Continuity: historical tasks retained; recovered visual reference and private evidence material outside chat.

Tests: history-depth-contract.mjs (local pass); history-depth-browser.mjs (GitHub browser execution pending); real-auth-e2e.mjs plus real-auth-depth-checks.mjs (public exact-build verification pending). Local browser access is restricted; do not claim local visual validation. Use CI browser evidence and inspect the resulting images.

New authenticated artifacts must be encrypted before upload; see FUNCTIONAL_DEPTH.md. The private key is saved in PRIVATE Drive as `LTS Health - chave privada das evidencias visuais.pem`; only the public key is in the repository. Neither original reference nor decryption key requires chat memory. Previous plaintext artifacts are not claimed deleted.

## Release gates

Run source/model/provenance contracts, synthetic production-path browser journeys at desktop/390px/320px, inspect synthetic visuals, merge normally, wait for exact public build, run real authenticated UI/independent database coverage, decrypt and inspect real mobile/desktop images privately, then record evidence. CI green alone is not visual acceptance; synthetic service is not real-user data. Missing, error, ambiguous and outdated evidence must not be conflated.

## Next action

Finish this package's CI and public authenticated verification, fix failures before asking the user to inspect, persist actual release evidence and update issue #265. Afterwards deepen Timeline, nutrition/hydration, recovery/analyses and final consistency. Water import still requires the user's authenticated notebook action. All other historical integration/security blockers remain in EXECUTION_STATE.json; do not erase them.
