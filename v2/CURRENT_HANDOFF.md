# LTS Health — CURRENT HANDOFF

Updated: 2026-09-14 after physical-iPhone reference-parity correction and permanent Training visual guard. Public engineering metadata only; health data, credentials and private screenshots stay private.

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

## Current verified product release

Reference-parity product package:
- PR #279
- build `ux-coherence-reference-parity-20260914.16`
- product merge commit `2393213b2824812a5f463d947b3f6be53246e4a7`
- checkpoint `v2/releases/REFERENCE_PARITY_IPHONE_20260914.md`

PR #279 fixed the exact physical-iPhone defects observed in Training and refined Home hierarchy/readability. Post-merge deploy, smoke, Timeline, functional depth, deployed homologation, staging and real authenticated E2E succeeded.

Permanent regression guard:
- PR #280
- guard merge commit `f1b1779c385aadcae167ba2165186c10e28b762e`
- `v2/cockpit-smoke.mjs` now rejects low-contrast Training metric/telemetry/structure values and overlapping/collapsed first-exercise preview geometry at the mobile reference viewport.

The guard itself was tested after an initial route-fixture attempt proved insufficient; the final version renders the canonical Training reference component with fixture data and passed its cockpit browser gate before merge.

## Home/Início state

Home is in the approved mobile reference family but is **not accepted as finished**.

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

The owner still considers Home materially far from the original reference, so continue direct reference-to-implementation comparison rather than generic dashboard polishing.

## Training state

Functional depth already includes complete history, session/exercise/set detail and source-safe descriptive exercise history.

The current mobile reference package has:
- compact session header and segmented `Resumo / Exercícios / Histórico` navigation;
- red session protagonist surface;
- duration, energy, average HR and set count as first-glance metrics;
- HR min/avg/max only when source data exists;
- exercise/set detail and complete history.

The 14/09 physical iPhone screenshots exposed a CSS regression despite green CI: real values existed but were almost white on light cards, and the first-exercise preview collapsed. PR #279 explicitly fixes those surfaces. PR #280 makes the same defect a permanent CI gate.

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

Visual convergence is now the dominant workstream:
1. Home/Início — direct comparison against the approved first reference screen.
2. Training — confirm the newly corrected physical-device result, then refine only evidence-backed gaps.
3. Composition — bring geometry, typography, graphs and detail into the same reference language.
4. Exams/Labs.
5. Timeline.
6. Nutrition/hydration.
7. Recovery/analyses.
8. Cross-product visual consistency and final physical-iPhone acceptance.

Do not trade away existing history/provenance depth to obtain visual similarity.

## Pending user/external items

Historical MyFitnessPal water remains pending by explicit owner decision. The extraction helper exists, but the actual historical water payload requires an authenticated MyFitnessPal notebook session. The owner will do that later; keep it visible as a pending source item but do not block app development.

Preserve all other integration/security blockers from the structured ledger. Never infer missing health records.

## Evidence and privacy

The original visual reference and encrypted authenticated visual evidence are private. Never publish plaintext health screenshots, private keys, credentials, cookies or personal health payloads in the public repository.

## Next autonomous action

Start from current `main`, confirm the latest guard/package checks, then continue direct reference convergence with **Composition next unless Home/Training public evidence reveals a remaining P0 regression**. Before asking the owner to test again, produce a substantive visible jump and validate the public authenticated build. When physical-iPhone feedback conflicts with CI, the physical device wins.