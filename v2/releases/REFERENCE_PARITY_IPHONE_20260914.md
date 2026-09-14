# LTS Health — physical-iPhone reference parity checkpoint — 14/09/2026

Public engineering checkpoint only. No personal health payloads or private screenshots are stored here.

## Why this package exists

Physical-iPhone screenshots from the owner showed that CI-green Training still rendered important values almost white on pale cards and collapsed the first-exercise preview. The same feedback reinforced that Home/Início must converge directly toward the recovered approved mobile reference rather than merely share its color family.

Physical-device evidence outranks fixture-only confidence. This package therefore treats the screenshots as a product rejection signal, not a cosmetic note.

## Product correction

PR #279 introduced `v2/reference-parity-20260914.css` and build `ux-coherence-reference-parity-20260914.16`.

Training corrections:
- explicitly readable session heading on the light mobile canvas;
- duration, energy, average-heart-rate and set-count values use high-contrast dark ink;
- minimum/average/maximum heart-rate values use high-contrast dark ink;
- exercise and set counts use high-contrast dark ink;
- first-exercise preview uses a stable two-column layout and a styled action instead of collapsing its labels;
- full history and source-safe data semantics remain unchanged.

Home corrections:
- mobile hierarchy remains dark-shell/reference-oriented but restores readable type sizes after earlier over-compression;
- order is header/greeting, compact composition metrics, Today, weekly progress, then older recent records;
- Today semantics remain current-calendar-day only; historical records cannot masquerade as today.

No missing telemetry, health values, targets or treatment information were fabricated to imitate the reference.

## Verified promotion

PR #279 merged to `main` as commit `2393213b2824812a5f463d947b3f6be53246e4a7`.

Post-merge evidence succeeded for deploy, smoke, Timeline, functional depth, deployed homologation, staging and real authenticated E2E. This proves delivery/integrity of the published build, not final visual acceptance by the owner.

## Permanent regression guard

PR #280 converts the physical-iPhone defect into a browser gate. `v2/cockpit-smoke.mjs` now renders the Training reference surface at the mobile reference viewport and rejects:
- metric/telemetry/structure values whose contrast ratio falls below 4.5 against their card background;
- a first-exercise preview whose copy/action escapes its card or overlaps.

The branch gate initially exposed that route-based fixture navigation did not exercise the reference Training renderer. The guard was corrected to render the canonical Training reference component directly with fixture data, and the new cockpit check passed before promotion.

PR #280 merged to `main` as commit `f1b1779c385aadcae167ba2165186c10e28b762e`.

## What this does not claim

- No pixel-parity claim.
- No final Home or app acceptance.
- No claim that every domain already matches the approved reference.
- No completion of MyFitnessPal historical-water ingestion.

## Remaining visual execution

Continue direct reference comparison, not generic incremental polishing. Priority order after this checkpoint:
1. Home/Início — keep closing structure, density, typography and first-screen hierarchy against the approved first reference screen.
2. Training — compare the published physical-device result again before declaring this screen accepted; then refine Summary/Exercises only where actual data supports the reference.
3. Composition.
4. Labs/Exams.
5. Timeline.
6. Nutrition/hydration.
7. Recovery/analyses.
8. Cross-product consistency and final physical-iPhone acceptance.

The private approved reference remains in the owner's Drive as `LTS Health - referencia visual aprovada.png`, SHA256 `dc322921f2d05d26f6478d213a6e3a2317978fba62897a77df4dda29d03cc05c`. Do not copy that image into this public repository.

Historical MyFitnessPal water remains an explicit user-blocked source step: later, the owner runs the authenticated notebook extraction; the application work continues independently until then.
