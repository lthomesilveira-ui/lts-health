# LTS Health — CURRENT HANDOFF

Updated: 2026-09-12 22:31 BRT

This file is the first document any new agent/assistant should read before changing the product. It contains only public project metadata; private health payloads and credentials must remain outside the repository.

## Source of truth

Repository: `lthomesilveira-ui/lts-health`
Public app: `https://lthomesilveira-ui.github.io/lts-health/v2/`
Public branch: `main`
Development policy: never force branches; re-fetch `main`, active branch, `v2/PROJECT_MASTER.md`, `v2/EXECUTION_STATE.json`, `v2/FEEDBACK_LEDGER.md`, `v2/REFERENCE_VISUAL_CONTRACT.md` and this file before any write.

Operational hierarchy:
1. Current repository state and deployed evidence.
2. `v2/CURRENT_HANDOFF.md` for the latest continuation point.
3. `v2/EXECUTION_STATE.json` for the historical machine-readable ledger.
4. `v2/PROJECT_MASTER.md`, `v2/PROJECT_BRIEF.md`, `v2/PRODUCT_ARCHITECTURE.md`, `v2/FEEDBACK_LEDGER.md`, `v2/CONTINUITY_PROTOCOL.md` for durable product decisions.
5. Chat memory is never the operational source of truth.

## Current product direction

The user rejected the legacy dashboard/web-BI feel. The approved direction is a mobile-first personal longitudinal health application with immediate comprehension, closer in product language to Apple Health / Whoop than to a corporate BI dashboard.

The user explicitly approved the generated visual direction and asked to converge the real app toward that model. The goal is not superficial CSS. It requires structural screens, strong hierarchy, restrained density, useful charts, and clear drill-down.

Core UX questions:
- Home: how am I now, what changed, what matters today?
- Composition: am I losing fat while preserving/gaining lean mass?
- Training: am I progressing in load, volume and performance?
- Labs: what changed over time, with source/unit/context preserved?
- Timeline: what happened together over time?

## Current verified release

Public main commit: `fc6566fcecbc451ba0911cbdea7b0acd0cf61c15`
Build id: `ux-coherence-model-convergence-20260913.2`
Primary release PRs: #255, #256, #257.

The public release completed:
- deploy success;
- main smoke success;
- Timeline smoke success;
- deployed homologation success;
- real authenticated E2E success.

Latest authenticated real-data visual proof:
- workflow: `LTS Health Real Auth E2E`;
- run: `34730635619`;
- artifact: `real-auth-visual-evidence`;
- artifact id: `10308869813`;
- files: `desktop-home.png`, `mobile-home.png`, `mobile-training.png`.

These screenshots were generated from the real authenticated public app, not fixture mode, and were inspected before this handoff was updated.

## Current real implementation

Structural product screens exist in:
- `v2/src/product-layout-v2.js`
- `v2/product-layout-v2.css`
- `v2/model-convergence-shell.css`
- `v2/src/product-layout-runtime.js`

Current authenticated Home now contains:
- `Seu panorama`;
- current composition as the primary hero;
- real weight trend rendered from comparable body-composition records only;
- current weight, body-fat percentage and skeletal-muscle mass when present;
- latest training as the primary recent event;
- duration, energy and average heart rate from the latest canonical workout;
- nutrition and labs as quieter secondary signals;
- mobile bottom navigation;
- compact structural-route shell without duplicate contextual route action.

Composition trend safety rule:
- the Home trend is not a decorative chart;
- it uses real `health_body_composition` data already loaded by the app;
- when the latest record has a source, the sparkline is restricted to that same source;
- ambiguous sources are not silently merged;
- insufficient comparable history falls back explicitly instead of inventing a trend.

Current Training now contains:
- session hero;
- duration / energy / average HR / set count;
- exercise cards;
- structured set rows with load × repetitions;
- technique/failure metadata as compact badges;
- duplicated technique labels normalized/deduplicated;
- missing historical load/reps shown as `Dados não informados`, never fabricated;
- recent session list.

The authenticated screenshot for the latest canonical workout shows the real 11/09/2026 session with 59 min, 524 kcal, average HR 105 bpm and 35 structured sets. Private health payloads remain in the private database and are not copied into repository metadata beyond this high-level release evidence.

## Important lessons / failures already diagnosed

Do not repeat these:
- CI green does not equal good UX.
- Fixture mode previously showed a different surface than the user's authenticated app.
- The structural runtime previously stopped polling before real authenticated data finished loading; it was extended to tolerate real load timing.
- Cache/versioning previously allowed Safari to retain old presentation assets.
- Tests previously searched for legacy Home selectors and therefore could not prove the new Home existed.
- The user repeatedly saw a legacy dashboard despite claims of redesign. Never call a CSS patch a redesign.
- Never claim visual parity without inspecting real authenticated screenshots from the deployed version.
- The real-auth contract itself can become stale when an intentionally changed product title/selector is promoted; update the contract in the same release line rather than treating a stale literal as product failure.
- Mobile shell track dimensions must match the actual header height; a previous 52 px reserved track with a 50 px header created a visible 2 px layout gap and was corrected without weakening the geometry gate.

## Current user acceptance

On 2026-09-12, after viewing the first structural authenticated version, the user said: `Está em uma direção melhor sim` and authorized continued evolution toward the approved model.

The Home/Training model-convergence package released after that comment is materially more app-like and has been visually inspected by the executing assistant, but it has not yet received a new explicit user acceptance statement.

This remains directional acceptance, not final UX acceptance.

## P0 UX model convergence — status

Home mobile refinement: RELEASED / awaiting product-level feedback.
Training session/detail refinement: RELEASED / awaiting product-level feedback.

Delivered in the current P0 line:
- composition made visually primary;
- decorative trend bars replaced with a real, source-safe longitudinal weight chart;
- latest workout made a protagonist rather than one of three equal dashboard tiles;
- secondary nutrition/lab signals reduced in visual weight;
- structural Training made denser and easier to scan;
- shell chrome reduced on the structural routes;
- real authenticated screenshots became the release evidence rather than fixture screenshots.

Remaining execution order:
1. Composition experience.
2. Labs longitudinal experience.
3. Timeline.
4. Analyses / remaining domains.
5. Cross-product visual consistency and final acceptance pass.

## Next P0 — Composition experience

Goal: extend the same app language from Home/Training into Composition without reverting to the old generic domain/dashboard surface.

Requirements:
- make latest measurement immediately understandable;
- show weight, body-fat and lean/muscle dimensions with clear hierarchy;
- preserve source boundaries and never compare incompatible body-composition origins as if equivalent;
- support longitudinal trend and period comparison only where source/date semantics allow;
- reduce explanatory chrome and giant generic cards;
- make the mobile first viewport useful on its own;
- use real data, not decorative chart geometry;
- preserve access to historical detail and provenance without making them dominate the primary view.

## Data / trust rules

- Never put private health payloads or credentials in this repository handoff.
- The database, not chat memory, is authoritative for private health records.
- Do not invent missing values.
- Preserve source/provenance boundaries.
- Do not combine ambiguous sources.
- Protocol/treatment data is temporal context only; no causal medical claims.
- Real authenticated E2E must validate changed real-data behavior.

## Release gates for UX work

A UX package is not ready merely because static/smoke tests are green. Before telling the user to open it:
1. run affected static/contracts;
2. deploy the exact commit;
3. run public smoke;
4. run real authenticated E2E on `main`;
5. save real authenticated mobile screenshots;
6. inspect those screenshots against the approved direction;
7. reject internally if the screen still looks like the old dashboard, clips, overflows, or is materially unlike the intended hierarchy.

## Next autonomous action

Continue from the verified Home/Training P0 release, not from the legacy cockpit. Start the Composition experience as the next coherent package. Re-fetch current `main` and this handoff before any write. Use normal branches/PRs, never force. Preserve private data in the database, use source-safe longitudinal logic, and require real authenticated visual proof before asking for the next user product review.
