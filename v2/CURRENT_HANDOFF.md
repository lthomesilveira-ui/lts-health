# Verified package — integrated review, 2026-10-06 UTC

`PKG-INTEGRATED-REVIEW-001` is technically complete. Build `integrated-review-20261006.39` is published by normal PR #318 at `23b6ed237cbe401c9cf0357c5dc1956fdca86bef`: source-aware daily review, closed-day water/training and sleep/training contrasts, three progressive report modes, a device-only consultation text summary and canonical hydration in Home Today/week. All seven candidate gates and ten post-merge workflows passed, including deploy `37405185278` and real authenticated E2E `37405185316`. Final responsive captures and the exact authenticated public app were inspected, including all three modes, date/source controls, coverage and sparse-data limits. Existing approved first-screen structure, full history and integrations are preserved. No new owner subjective or physical-device acceptance is inferred. See `releases/INTEGRATED_REVIEW_20261006.md` and `EXECUTION_STATE.json`.

Initial real dietary-water receipt is now privately verified and the public historical hydration view was inspected. This supersedes the absence statements below. The initial export was manual; automatic recurrence stays separate in `LTS-WATER-RECURRENCE-001`. Original authenticated MyFitnessPal water history is still pending. Keep MyFitnessPal as the entry source and preserve the paid/configured bridge, key and selected metrics. No source data is changed or reconstructed by this frontend package.

# Historical verified restart — published .38 and unresolved water, 2026-10-05

The exact-public manual inspection blocker is superseded by the private 2026-10-05 validation record: secure authentication succeeded and build `home-dashboard-reference-20261003.38` was inspected. PRs #315/#316 are merged at `b3bc19200c63a153260115d23871f1e2872d5fc5`; all ten post-merge runs were independently rechecked as successful. `PKG-EVIDENCE-INSIGHTS-001` is technically done. This does not presume owner UX/physical-device acceptance. Do not revert to `.36`/`.37` or ask for authentication to close an already completed gate.

The read-only restart audit confirms the working bridge still receives other metrics, with no dietary-water receipt, and Polar has no recorded sync error. The owner reports water remains absent in Apple Health even after a direct Google Health entry. The internal cause is unconfirmed; waiting is not a verified remedy. The owner chose to keep MyFitnessPal as the sole water-entry source. Pursue supported direct access or an authentic batch export; preserve the existing extractor and importer. Do not change the recording routine, repeat phone micro-tests, rotate the valid key or substitute a support message for a solution.

New Google Health API projects are not currently onboarded; the legacy Fitbit API shutdown on 30/10/2026 prevents treating it as a durable replacement. No new source volume was imported and no water resolution is claimed. Original MFP history remains separate and pending. See `releases/CONTINUITY_WATER_20261005.md` and `EXECUTION_STATE.json`. Earlier checkpoints below are historical.

# Published checkpoint — evidence-backed insights, 2026-10-05

Frontend `.37` is published through normal PR #313 at `dc80a109f9074b891952e14c916ca6e5738d0484`. Shared source-aware nutrition contrasts and matching-repetition working-load comparisons are available in Home and Reports, with the Home calendar preserved on drill-down. All seven final candidate gates passed; synthetic desktop and two phone widths were inspected. Deploy `37260736710` and authenticated E2E `37260736697` passed, including independently recomputed private observed means/counts. A post-merge synthetic screenshot hit a detached control; the current-DOM capture helper is corrected separately. No private health values are published.

`PKG-EVIDENCE-INSIGHTS-001` remains `blocked_user` for exact manual public visual inspection: secure Cloud Browser login was interrupted and fresh navigation still shows login. Automated owner-data verification is complete, but it does not replace this visual acceptance. Do not retry authentication unless the owner asks, request phone micro-QA or mark the package done. See `releases/EVIDENCE_INSIGHTS_20261004.md` and `EXECUTION_STATE.json`; `.36` remains the previous fully inspected checkpoint.

The phone now confirms MFP totals reach Google Health, but Apple Health Water still has no records. Transport to the LTS receiver is not verified, and timing/provider behavior remain unresolved. Do not repeat phone micro-tests, rotate the working key or claim permanent impossibility/guaranteed eventual sync.

# Verified checkpoint — real Health Auto Export activation, 2026-10-04

The configured physical iPhone successfully sent daily JSON v2 to receiver version 3. The database receipt and real MyFitnessPal nutrition provenance were independently verified; the exact authenticated public Data route shows **Recebendo dados** and Nutrition displays the new daily summaries. The unit correction is promoted by normal PR #311 at `f264d0580d5cfe9db8736edc209eda243456faef`; all five candidate and nine post-merge workflows passed. `LTS-HEALTH-AUTO-EXPORT-UNITS-001` and physical activation are done. Polar stays authorized. Preserve the working phone key and setup.

No water volume was received. `LTS-HEALTH-AUTO-EXPORT-WATER-001` is a separate physical-phone source check; the historical original MFP water import stays pending. The owner requested a five-minute automation cadence, with best-effort iOS scheduling. Direct MyFitnessPal API access, all Apple Health metrics and subjective UX acceptance are not implied. Public frontend remains `.36`; private health values, payloads and credentials stay outside this repository. See `releases/HEALTH_AUTO_EXPORT_UNITS_20261004.md` and `EXECUTION_STATE.json`.

# Active checkpoint — Health Auto Export unit compatibility, 2026-10-04

The owner completed physical-iPhone permissions, MyFitnessPal Health sharing and an enabled REST automation: JSON v2, summarized by Day, Default period and a requested five-minute cadence. The protected receiver accepts authentication but real uploads fail with HTTP 422 `unsupported_unit`. This is now a server compatibility task owned by Codex, not missing user setup. No actual receipt has been verified. Receiver version 3 adds explicit `count/min` heart-rate equivalence and fixed-vocabulary validation diagnostics without health values, sources or credentials. Local contract tests passed and deployed code was read back exactly. Inspect the next real attempt and resolve its unit before claiming activation. Keep the valid key and existing phone configuration. See `releases/HEALTH_AUTO_EXPORT_UNITS_20261004.md` and `EXECUTION_STATE.json`.

# Verified checkpoint — Health Auto Export, 2026-10-04

Owner approved and purchased annual Premium Health Auto Export. This reopens Apple Health for the third-party bridge, without an Apple Developer subscription. Build `.36` is published and technically verified: PR #309 merged normally at `19219d1f8abacaf6151f8b7a2d0bac09f9f4ddb3`; all seven final candidate gates and all ten post-merge workflows passed, including deploy `37231135684` and real authenticated E2E `37231135691`. The exact authenticated public Data route was inspected in Cloud Browser: `.36`, authorized Polar and an honest pending-iPhone state. See `EXECUTION_STATE.json` and `releases/HEALTH_AUTO_EXPORT_20261004.md`.

Backend migrations and the two authenticated/custom-key functions are deployed. Actual deployed HTTP ingestion, stable replay and rejection after revocation passed with an isolated synthetic owner; the test owner, connection and health rows were then removed and absence independently verified. Phone credentials remain private and revocable; setup status does not claim a real upload. Daily nutrition and water use explicit provenance; original nutrition wins on overlapping dates. Polar remains authorized and unchanged. Sleep/recovery stay source-separated. `PKG-HEALTH-AUTO-EXPORT-001` is technically complete. The first real phone upload remains `blocked_user`: grant Health permissions, enable MyFitnessPal HealthKit sharing, generate the LTS configuration and create a daily JSON v2 REST API automation. Historical original MyFitnessPal water is still pending.

# LTS Health — CURRENT HANDOFF

## Previous same-day checkpoint — useful duration and water reports, 2026-10-04

`PKG-MFP-REPORT-COVERAGE-001` is technically complete and `.35` is published. PR #306 merged at `de7c1cc0ebdd25405036fa59fadd5acdcb378ce0`: partial recorded durations with session coverage, water history and equal-window averages, a reachable mobile refresh action, readable mobile period comparisons and official MyFitnessPal ZIP guidance. All five final candidate gates passed; responsive synthetic captures were inspected. PR #307 synchronized the real-data lab assertion with the actual selected report at `dc48bd4d0fc354547f840fda75675e393fdf6979`. All nine final post-merge workflows passed, including deploy `37225072815` and authenticated E2E `37225072814`. Exact-public authenticated Cloud Browser inspection confirmed the build, recorded duration coverage, absent water, unchanged authorized Polar and official MFP instructions. See `releases/MFP_REPORT_COVERAGE_20261004.md`.

The owner authorized the agent to lead MyFitnessPal implementation. The provider denied this cloud browser before login and remained blocked after one reload; the agent stopped that site. The plugin does not expose diary or water access. No new account data was imported, and no continuous MyFitnessPal connection is active. The existing official ZIP and authenticated water JSON importers remain ready when actual files are available. Do not request a password as a solution to this security block. Water remains pending. Polar credentials and consent must not be requested again. Apple Health is deferred; Polar's present session/sleep connector does not replace every HealthKit category. Owner/physical-device usefulness acceptance is not presumed.

## Previous same-day checkpoint — Polar activation


Polar activation is verified against the real provider: owner consent, encrypted callback, initial history import, idempotent replay and a real refresh grant succeeded. The authenticated public app shows last-success status and imported Polar chart/table rows; canonical workouts were preserved. Normal token-expiry handling is restored in `health-polar-connection` version 16. `PKG-POLAR-LIVE-SYNC-001` is complete: PR #304 merged at `a4a66649f0ad8086b889f91eb2265d0687b3e96c`, all four candidate and eight post-merge workflows passed, and normal runtime replay succeeded after promotion. The frontend remains `.34`. Credentials and consent must not be requested again. See `releases/POLAR_LIVE_SYNC_20261004.md` and `EXECUTION_STATE.json`.

`PKG-USEFUL-REPORTS-001` is technically complete. PR #302 published `.34` at product commit `7c62565ab5571d10d26a45b40ce4aa7c6c0e6240`: current-day calendars, equal prior periods, regional scan/workout/nutrition context, lab method/reference comparisons and source-separated recovery. Six final candidate gates and nine post-merge workflows passed, including authenticated desktop/mobile data verification. The exact public build was inspected in authenticated Cloud Browser: all-history/90-day axes, left-arm context, lab search/current-point references and account activation states.

Polar OAuth/callback and protected tables are deployed; real activation is described above. Updates on app open and manual refresh work; no closed-app background schedule exists. MyFitnessPal API approval and notebook water import remain blocked; Apple Health is deferred. No user secrets are to be requested through chat. See `releases/USEFUL_REPORTS_20261004.md` and `EXECUTION_STATE.json`. Owner/physical-device usefulness acceptance is not presumed.

## Previous checkpoint — 2026-10-03

The published build is `home-dashboard-reference-20261003.33`, promoted by normal PRs #298, #299 and #300. Product commit: `747adeb7c2a4b7ba43fc9abb799207a82ce53881`. `.30` was already delivered by PR #297; do not restore `.29` or an old export.

The owner authorized implementation of the UX review and completion of missing private data. The current package adds synchronized source-backed panels, current-result laboratory views and recorded medication context while preserving histories and security. See `releases/HEALTH_CONTEXT_20261003.md`. The reviewed private import was independently reconciled and replayed without additional insertions; its private manifest and medical values do not belong here.

All final PR gates and all nine post-merge workflows passed, including deployment and authenticated desktop/mobile runtime. The exact public `.33` was opened in the authenticated Cloud Browser; laboratory collections, recorded treatment context, preserved composition history and synchronized dates were inspected. Full-history and 90-day panels were checked to have identical calendar axes. Private reconciliation/import evidence and plaintext screenshots stay outside this repository.

The technical package is complete. Owner judgment, physical-device acceptance and final pixel parity are not presumed. Historical MyFitnessPal water and existing integration/account blockers are preserved in `EXECUTION_STATE.json`; no new source data is invented. See `releases/HEALTH_CONTEXT_20261003.md` for exact gate and encrypted-artifact identifiers.

## Historical checkpoints — superseded by the checkpoint above

The remaining text preserves prior feedback and engineering context. Old release names, candidate states and next actions below are historical, not the current execution queue.

Updated: 2026-09-15 after the owner rejected the published `.29` Home and the approved mobile reference was reopened for a decisive dashboard rebuild. Public engineering metadata only; health data, credentials and private screenshots stay private.

## Restart phrase

`LTSH-CONTINUE`

If a new chat/agent receives only that phrase, recover the real repository state first and continue from this document. Chat memory is not a source of truth.

## Read first

Repository `lthomesilveira-ui/lts-health`; public app `https://lthomesilveira-ui.github.io/lts-health/v2/`; public branch `main`.

Before any write re-fetch `main`, active branch, `architecture-v2`, `CURRENT_HANDOFF.md`, `PROJECT_MASTER.md`, `EXECUTION_STATE.json`, `FEEDBACK_LEDGER.md` and `REFERENCE_VISUAL_CONTRACT.md`. Audit parallel changes, preserve compatible work, use normal PR/merge and never force.

Current code/deploy evidence outranks stale documentation. `EXECUTION_STATE.json` is the structured queue but may lag a newly verified release until its reconciliation package lands; do not undo delivered work because an older task still says ready/in_progress.

## Visual authority and current acceptance

The owner expects the mobile product to converge toward the recovered approved reference image, not merely share its colors. The private original is stored in Drive as `LTS Health - referencia visual aprovada.png`; SHA256 `dc322921f2d05d26f6478d213a6e3a2317978fba62897a77df4dda29d03cc05c`. Never copy it into this public repository.

The reference contains the intended mobile Home/Início plus Training summary and exercise/set screens. Home/Início should be recognizable as the first reference screen using real data; Training should be recognizable as the session/detail reference while never inventing unavailable telemetry.

Physical-iPhone screenshots from the owner outrank fixture-only visual confidence. The owner explicitly reported on 14/09 that the product had improved but remained far from the approved mockup. There is **no final pixel parity or product acceptance** yet.

## Current published release — rejected by the owner

The currently published build is `latest-workout-telemetry-20260915.29`, promoted normally by PR #296 at `main` commit `4d8bbf33426bf81f0ff2124cdd2b23c31aab10af`. Its automation and deploy evidence do not constitute visual acceptance. The owner opened `.29`, supplied a physical-device capture and explicitly reported that the dashboard still did not deliver the agreed layout.

The exact public `.29` was also opened in Cloud Browser with an authenticated session during the new audit. The first composition load failed and rendered placeholders even though the real records existed; a manual refresh loaded the domain. This established a transient loader failure, not absent history, and the candidate adds one bounded retry before showing an error.

The package chain from PR #285 through #292 rebuilt the audited Home/Training experience, aligned the internal routes, removed visual and navigation regressions found in the public app, and made authenticated evidence follow real UI navigation with route-specific readiness.

All nine post-merge workflows for the product commit passed. The final encrypted real-auth artifact is `10379557671`, digest SHA256 `152f3a0ca8b70676ca3380da4711ff66b256589b6d82b791bd819c3b57ac174b`.

The actual public URL was then opened in Cloud Browser with the authenticated session, build `.26` was confirmed, and every primary/secondary area was navigated. Separately, all 32 final authenticated screenshots — desktop and mobile — were privately decrypted and visually inspected. No plaintext screenshot or key material belongs in the repository.

The owner then supplied eight full-size screenshots from a physical iPhone. Those screenshots invalidate the previous statement that no obvious defect remained: the Home retained an empty hidden-topbar track, all audited mobile routes reserved bottom space twice, the first viewport was oversized, and Training ended in a large blank surface. Build `.26` is published but visually rejected and must not be presented for homologation.

The active package is `PKG-HOME-DASHBOARD-REFERENCE-REBUILD-001`. Its candidate build is `home-dashboard-reference-20260915.30`. It owns the unresolved physical-iPhone acceptance, the truthful partial-telemetry presentation and the new Home reconstruction as one coherent release. No private workout values or screenshots enter this repository.

## Home/Início state

Home is being rebuilt from the recovered private reference because the owner rejected `.29`; no earlier implementation is accepted as finished.

Current non-negotiable semantics:
- `Hoje` means the current calendar day only;
- historical workout/nutrition/treatment records must not masquerade as today;
- older items belong in explicitly historical surfaces such as `Últimos registros`;
- no internal provenance/debug strings in consumer-facing cards;
- empty current-day states are explicit;
- bottom navigation cannot cover content.

Current reference-oriented mobile order is:
1. brand/header, greeting, date and short context;
2. three compact composition metrics;
3. Today;
4. weekly progress;
5. longitudinal evolution with 30 days / 90 days / 1 year / history and eight metric choices;
6. six-domain horizontal panorama, recent events and provenance.

The `.30` candidate uses the approved dark mobile canvas with white cards, keeps the desktop canvas light, collapses the hidden topbar track, eliminates duplicated bottom reserve and requires weekly progress within a reduced `393 × 650` Safari viewport. Historical data and all existing drill-downs remain intact.

## Training state

Functional depth already includes complete history, session/exercise/set detail and source-safe descriptive exercise history.

The current mobile reference package has:
- compact session header and segmented `Resumo / Exercícios / Histórico` navigation;
- red session protagonist surface;
- duration, energy, average HR and set count as first-glance metrics;
- HR min/avg/max only when source data exists;
- exercise/set detail and complete history.

The 14/09 physical iPhone screenshots exposed a CSS regression despite green CI: real values existed but were almost white on light cards, and the first-exercise preview collapsed. PR #279 fixed those surfaces and PR #280 made the defect a permanent gate. The final `.26` evidence confirms the corrected summary and exercise/set hierarchy with real authenticated content.

Do **not** fabricate heart-rate zones, time series, graphs or other telemetry solely to mimic the mockup. Add them only when backed by actual source data; otherwise show an explicit unavailable/insufficient-data state.

## Functional depth already delivered

Do not reimplement older caps or lose these capabilities:
- Training: complete history, session/exercise/set detail, exercise occurrences and source-safe progression.
- Labs: all markers selectable, search, origin/unit/method separation, periods, point lookup and complete result pagination; ambiguous dates/units/censored values cannot manufacture trends.
- Composition: all measurements, source/period/year filters, safe two-date comparison, record detail, segmental values only with a safe link.
- Timeline: year → month → exact-day navigation with contextual drill-down.
- Nutrition: complete available daily history by year, daily detail and explicit missing/duplicate handling.
- Recovery/analyses: source-separated descriptive evidence; no unsafe device merging or causal medical conclusions.
- Runtime: route readiness, refresh/data-change handling and history drill-down preservation.

## Remaining execution order

`LTS-HOME-DASHBOARD-REFERENCE-REBUILD-001`, `LTS-PHYSICAL-IPHONE-001` and `LTS-WORKOUT-PARTIAL-TELEMETRY-001` are in progress under one package. Finish the complete gates, publish `.30`, open the exact public build, inspect authenticated real content in desktop and mobile evidence, correct obvious defects and only then ask for owner judgment.

Do not trade away existing history/provenance depth to obtain visual similarity. Do not add reference-only graphs, device imagery, values or health semantics without canonical evidence.

## Pending user/external items

Historical MyFitnessPal water remains pending by explicit owner decision. The extraction helper exists, but the actual historical water payload requires an authenticated MyFitnessPal notebook session. The owner will do that later; keep it visible as a pending source item but do not block app development.

Preserve all other integration/security blockers from the structured ledger. Never infer missing health records.

## Evidence and privacy

The original visual reference and encrypted authenticated visual evidence are private. Never publish plaintext health screenshots, private keys, credentials, cookies or personal health payloads in the public repository.

The approved source remains in the owner's private Drive as `LTS Health - referencia visual aprovada.png`, SHA256 `dc322921f2d05d26f6478d213a6e3a2317978fba62897a77df4dda29d03cc05c`. The final authenticated evidence remains encrypted in GitHub artifact `10379557671`; use the private procedure documented in the project if a future audit must reopen it.

## Next action

Do not ask the owner to judge `.29`; it was explicitly rejected. Promote candidate `.30` only through a normal PR, then open the exact public build, authenticate, navigate affected areas, inspect desktop plus reduced/full mobile evidence, correct obvious defects and only then request homologation. When physical-iPhone feedback conflicts with CI or remote screenshots, the physical device wins.
