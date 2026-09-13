# LTS Health — CURRENT HANDOFF

Updated: 2026-09-13 after the verified functional-depth release. Public engineering metadata only; health data and credentials stay private.

## Read first

Repository `lthomesilveira-ui/lts-health`; public app `https://lthomesilveira-ui.github.io/lts-health/v2/`; public branch `main`.

Before any write re-fetch main, active branch, architecture-v2, CURRENT_HANDOFF.md, PROJECT_MASTER.md, EXECUTION_STATE.json, FEEDBACK_LEDGER.md and REFERENCE_VISUAL_CONTRACT.md. Audit parallel changes, preserve compatible work, use normal PR/merge and never force.

Current code/deploy evidence outranks documentation. `EXECUTION_STATE.json` owns task states; this handoff explains the current transition. `PROJECT_MASTER.md` and `FEEDBACK_LEDGER.md` preserve historical decisions. Latest verified evidence and feedback reconciliation are in `releases/HISTORY_DEPTH_20260913.md`. Older prepared/in-progress wording in historical feedback is superseded by that release record and the machine-readable task states. Chat memory is not a source of truth.

## User direction and reference

The user accepted the structural layout direction but said it exposed too little history/functionality. Issue #265 remains the continuation umbrella. Keep the concise Home and deepen the journeys behind its summaries; do not restart the design or add large equal-weight dashboard blocks. There is no final product-completeness or exact-parity approval.

The original approved mobile image is recovered and saved in PRIVATE Drive as `LTS Health - referencia visual aprovada.png`; SHA256 `dc322921f2d05d26f6478d213a6e3a2317978fba62897a77df4dda29d03cc05c`. The image contains personal/illustrative context and must not be copied into the public repository. Example values, targets and treatment text are not production data or recommendations. The older textual desktop contract is historical, not authority to undo the later mobile direction.

## Current verified release

Code commit `de631a4b78c2d244ff75e660df4c4763a21a95b7`; build `ux-coherence-history-depth-20260913.8`; PR #266.

Deploy `34782704192`, real authenticated E2E `34782704240`, post-merge functional depth `34782704098`, general/Timeline smoke and both deployed homologation/staging succeeded. Exact identifiers, limits of the evidence and private visual inspection are recorded in `releases/HISTORY_DEPTH_20260913.md`.

Real-auth validated the exact deployed build and complete UI access against independent authorized database reads. This is not proof of complete ingestion of every historical source, nor physical-iPhone testing. Synthetic production-path browser testing covered desktop, 390px and 320px; it is explicitly separate from real authenticated verification.

## Functional depth delivered in this release

- Training: complete pagination, query and year filter; historical session/exercise/series detail; read-only exercise occurrences and source-safe descriptive load history; return context preserved.
- Labs: every marker selectable, including single/textual results; search; source/unit/method selector; recent/full periods and accessible point lookup; complete result pagination. Unknown metadata, duplicate dates and censored values cannot manufacture trends.
- Composition: all measurements available, source/period/year filtering, two-date comparison within the same safe source, individual record detail and segmental values only with a safe link. Ambiguous records remain available as individual evidence.
- Runtime: route-domain readiness, data-change refresh, focus/scroll/disclosure preservation. Mobile refresh is now reachable; the narrow-screen rail overflow found by testing was corrected.
- Home: accepted structural presentation preserved rather than expanded into another dashboard.

These delivered core tasks are `done` in the ledger. The overall functional-depth package remains open only because `LTS-REMAINING-DOMAINS-001` is ready. Do not reimplement the delivered histories because an earlier chat or document still says the old caps exist.

## Evidence and privacy outside chat

Real visual artifact `10325417914` was encrypted before upload, downloaded, decrypted privately and inspected. Durable PRIVATE Drive archive: `LTS Health - evidencias privadas release history-depth 20260913.8.zip`; SHA256 `6701fdd0f3e7a116086ce711b5cc5ea75e8491793b496b2414b742a9184883d2`. The archive's Drive sharing was verified as owner-only.

The decryption key is saved in PRIVATE Drive as `LTS Health - chave privada das evidencias visuais.pem`; only the public key is in the repository. Follow `FUNCTIONAL_DEPTH.md` for authorized retrieval/decryption. CI artifacts expire; use the durable Drive archive when needed. Never publish plaintext health screenshots or private keys. Previous plaintext artifacts from older releases are not claimed deleted and still warrant an owner-authorized retention review.

## Remaining work and execution order

1. Timeline: meaningful day/month navigation and direct contextual entry into detailed records, preserving provenance and duplicate boundaries.
2. Nutrition/hydration: deeper available history, useful period/day detail, clear source freshness and missing/ambiguous states.
3. Recovery/analyses: useful descriptive source-separated trends and navigation, without causal medical conclusions.
4. Cross-product visual consistency and final user acceptance against the recovered reference.

Preserve all historical integration/security blockers. The MyFitnessPal historical water import still requires the user's authenticated notebook export/import action; credentials and cookies must not be transferred. Do not infer missing health records or treat a route's existence as completion.

## Next autonomous action

Read the current main and ledger, then start the remaining-domain package from the verified .8 release without changing the accepted Home. Retain `history-depth-contract.mjs`, the synthetic production-path browser gate and real-auth full-history checks as regressions. Persist every future checkpoint with actual published evidence, not promises. The legacy renderer/runtime coordination remains acknowledged technical debt, not a completed architectural removal.
