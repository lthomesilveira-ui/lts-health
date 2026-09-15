# LTS Health — CURRENT HANDOFF

Updated: 2026-09-15 after physical-iPhone evidence rejected the visual QA closure for build `.26`. Public engineering metadata only; health data, credentials and private screenshots stay private.

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

## Current published release — rejected on physical iPhone

The currently published build remains:
- PR #292;
- build `ux-coherence-public-visual-closure-20260915.26`;
- product commit `3519968f82eb6043a8835e7fa9ad8b5e2be27395`;
- merge commit `cb4ec22f9fe9c5f3f00b2c9875db7d6e9ea7c5cf`;
- checkpoint `v2/releases/PUBLIC_AUDIT_QA_20260915.md`.

The package chain from PR #285 through #292 rebuilt the audited Home/Training experience, aligned the internal routes, removed visual and navigation regressions found in the public app, and made authenticated evidence follow real UI navigation with route-specific readiness.

All nine post-merge workflows for the product commit passed. The final encrypted real-auth artifact is `10379557671`, digest SHA256 `152f3a0ca8b70676ca3380da4711ff66b256589b6d82b791bd819c3b57ac174b`.

The actual public URL was then opened in Cloud Browser with the authenticated session, build `.26` was confirmed, and every primary/secondary area was navigated. Separately, all 32 final authenticated screenshots — desktop and mobile — were privately decrypted and visually inspected. No plaintext screenshot or key material belongs in the repository.

The owner then supplied eight full-size screenshots from a physical iPhone. Those screenshots invalidate the previous statement that no obvious defect remained: the Home retained an empty hidden-topbar track, all audited mobile routes reserved bottom space twice, the first viewport was oversized, and Training ended in a large blank surface. Build `.26` is published but visually rejected and must not be presented for homologation.

The active package is `PKG-PHYSICAL-IPHONE-REMEDIATION-001`. Its candidate build is `physical-iphone-remediation-20260915.28`; it is not a verified release until normal PR/merge, deploy, authenticated public navigation and post-deploy inspection are complete.

## Home/Início state

Home preserves the approved mobile reference structure, but the `.26` implementation failed on a physical iPhone and is **not accepted as finished by the owner**.

Current non-negotiable semantics:
- `Hoje` means the current calendar day only;
- historical workout/nutrition/treatment records must not masquerade as today;
- older items belong in explicitly historical surfaces such as `Últimos registros`;
- no internal provenance/debug strings in consumer-facing cards;
- empty current-day states are explicit;
- bottom navigation cannot cover content.

Current reference-oriented mobile order is:
1. brand/header + greeting;
2. compact composition metrics;
3. Today;
4. weekly progress;
5. older recent records.

The owner screenshots show that the remote evidence overstated first-screen parity. Preserve the information order, but collapse the empty topbar track, eliminate duplicated bottom reserve and require the weekly progress surface to begin within a reduced `393 × 650` Safari viewport.

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

`LTS-PHYSICAL-IPHONE-001` is in progress. Finish the coherent mobile-shell/Home/Training/internal-route package, then publish and repeat the full authenticated public-browser inspection before asking for owner judgment.

Do not trade away existing history/provenance depth to obtain visual similarity. Do not add reference-only graphs, device imagery, values or health semantics without canonical evidence.

## Pending user/external items

Historical MyFitnessPal water remains pending by explicit owner decision. The extraction helper exists, but the actual historical water payload requires an authenticated MyFitnessPal notebook session. The owner will do that later; keep it visible as a pending source item but do not block app development.

Preserve all other integration/security blockers from the structured ledger. Never infer missing health records.

## Evidence and privacy

The original visual reference and encrypted authenticated visual evidence are private. Never publish plaintext health screenshots, private keys, credentials, cookies or personal health payloads in the public repository.

The approved source remains in the owner's private Drive as `LTS Health - referencia visual aprovada.png`, SHA256 `dc322921f2d05d26f6478d213a6e3a2317978fba62897a77df4dda29d03cc05c`. The final authenticated evidence remains encrypted in GitHub artifact `10379557671`; use the private procedure documented in the project if a future audit must reopen it.

## Next action

Do not ask the owner to judge `.26`; it was rejected with physical-iPhone evidence. Build `.27` reached production and passed real-auth, but the post-deploy Pages gate rejected its 10 px mobile navigation typography. Promote corrected `.28` only through a normal PR, then open the exact public build, authenticate, navigate every area, inspect desktop plus reduced/full mobile evidence, correct obvious defects and only then request homologation. When physical-iPhone feedback conflicts with CI or remote screenshots, the physical device wins.
