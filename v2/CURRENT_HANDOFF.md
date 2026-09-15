# LTS Health — CURRENT HANDOFF

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
