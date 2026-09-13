# LTS Health — CURRENT HANDOFF

Updated: 2026-09-13 08:28 BRT

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

The goal is structural convergence, not superficial CSS: strong hierarchy, restrained density, useful real-data trends, short journeys and drill-down only when it adds value.

Core UX questions:
- Home: how am I now, what changed, what matters today?
- Composition: am I losing fat while preserving/gaining lean mass?
- Training: am I progressing in load, volume and performance?
- Labs: what changed over time, with source/unit/context preserved?
- Timeline: what happened together over time?

## Current verified release

Public main commit: `2c4f90ff7925c11dc0f2e8a4c5f07d72330384b7`
Build id: `ux-coherence-model-convergence-20260913.5`
Current P0 release line: PRs #255–#261.

The latest public release completed successfully:
- deploy;
- main smoke;
- Timeline smoke;
- staging smoke;
- deployed homologation;
- real authenticated E2E.

Latest authenticated real-data visual proof:
- workflow: `LTS Health Real Auth E2E`;
- run: `34754370788`;
- artifact: `real-auth-visual-evidence`;
- artifact id: `10316970169`;
- files include authenticated desktop/mobile evidence for Home, Training and Composition.

The evidence was produced from the real authenticated public app, not fixture mode, and inspected before this handoff was updated.

## Structural product routes released

### Home

The authenticated Home is structural and app-like rather than a legacy dashboard:
- `Seu panorama`;
- current composition as the primary hero;
- real weight trend from comparable body-composition records only;
- latest training as the primary recent event;
- nutrition and labs as quieter secondary signals;
- mobile bottom navigation;
- duplicate generic shell actions suppressed on structural routes.

### Training

The authenticated Training route contains:
- session hero;
- duration / energy / average HR / set count;
- exercise cards;
- structured set rows with load × repetitions;
- technique/failure metadata as compact badges;
- duplicated technique labels normalized/deduplicated;
- missing historical load/reps shown explicitly as not informed, never fabricated;
- recent session list.

### Composition

Composition P0 is released and visually verified. The route now contains:
- latest-measurement hero;
- clear weight / body-fat / skeletal-muscle hierarchy;
- `O que mudou` using the 12 most recent comparable measurements from the current source;
- real longitudinal trend tabs for body-fat percentage, skeletal-muscle mass, weight and fat mass;
- recent history;
- provenance/ambiguity note kept secondary to the primary reading.

Composition safety rules:
- only unique measurement dates enter automatic comparison;
- the active trend/delta stays within the same origin as the current measurement;
- ambiguous dates and other origins remain preserved but are excluded from automatic trend/delta;
- insufficient comparable history produces an explicit fallback instead of a fabricated trend;
- full same-source history remains preserved even though the primary change narrative is intentionally recent.

A first authenticated Composition pass revealed that an all-history delta was technically valid but not useful as the primary current answer; it was changed to the most recent 12 comparable measurements. A second inspection revealed a duplicated generic `Registrar bio` shell action on desktop. The structural runtime now deterministically owns/hides the generic shell action, and the final authenticated evidence confirms the duplicate is gone.

## Important lessons / failures already diagnosed

Do not repeat these:
- CI green does not equal good UX.
- Fixture mode previously showed a different surface than the user's authenticated app.
- Never call a CSS-only patch a redesign.
- Never claim visual parity without inspecting real authenticated screenshots from the deployed version.
- Cache/versioning must be bumped whenever presentation assets change.
- Real-auth contracts can become stale when intentional product literals change; update the contract in the same release line.
- Structural route chrome must be owned deterministically by runtime when CSS-only hiding is not sufficient across environments.
- Longitudinal math may be technically valid but still be poor product UX; the primary answer should emphasize a recent, relevant comparable window and keep full history available as context.

## Current user acceptance

The user previously said the structural direction was better and authorized continued convergence toward the approved model.

Home, Training and Composition are now materially more app-like and have passed real authenticated release gates, but this is still directional acceptance. Do not label final UX acceptance or exact visual parity until the user explicitly accepts it.

## P0 UX model convergence — status

Home mobile refinement: RELEASED / awaiting product-level feedback.
Training session/detail refinement: RELEASED / awaiting product-level feedback.
Composition experience: RELEASED / awaiting product-level feedback.

Remaining execution order:
1. Labs longitudinal experience.
2. Timeline.
3. Analyses / remaining domains.
4. Cross-product visual consistency and final acceptance pass.

## Next P0 — Labs longitudinal experience

Goal: extend the same structural app language into Labs without reverting to the generic explorer/report surface.

Requirements:
- make the latest/relevant lab context immediately understandable;
- expose a marker trend only when biomarker, origin, unit and dates are safely comparable;
- preserve source, collection date, unit and reference-range context;
- keep ambiguous same-date results out of automatic trend calculation;
- make the mobile first viewport useful without requiring the user to parse a long laboratory list;
- use a single primary longitudinal visualization instead of multiple equal-weight dashboard cards;
- preserve drill-down to result history and provenance;
- do not diagnose, classify a result medically or attribute causality automatically.

## Data / trust rules

- Never put private health payloads or credentials in this repository handoff.
- The private database, not chat memory, is authoritative for health records.
- Do not invent missing values.
- Preserve source/provenance boundaries.
- Do not combine ambiguous sources or units.
- Protocol/treatment data is temporal context only; no causal medical claims.
- Real authenticated E2E must validate changed real-data behavior.

## Release gates for UX work

A UX package is not ready merely because static/smoke tests are green. Before telling the user to open it:
1. run affected static/contracts;
2. deploy the exact commit;
3. run public smoke;
4. run real authenticated E2E on `main`;
5. save real authenticated mobile screenshots for the changed structural route;
6. inspect those screenshots against the approved direction;
7. reject internally if the screen still looks like the old dashboard, clips, overflows, duplicates chrome or weakens provenance rules.

## Next autonomous action

Start the Labs longitudinal structural package from current `main`. Re-fetch the required operational documents before any write, inspect the existing lab data contract and legacy screen only to preserve safe semantics, then implement a dedicated structural Labs route with real-data visual proof. Use normal branches/PRs and never force.
