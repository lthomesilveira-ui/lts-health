# LTS Health — CURRENT HANDOFF

Updated: 2026-09-12 22:04 BRT

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

## Current real implementation

Structural v2 screens exist in:
- `v2/src/product-layout-v2.js`
- `v2/product-layout-v2.css`
- `v2/src/product-layout-runtime.js`

Current structural Home contains:
- `Seu panorama de saúde`
- current composition hero
- recent training/nutrition/labs cards
- mobile bottom navigation

Current Training contains:
- session hero
- duration / energy / average HR / set count
- exercises
- structured sets
- recent session list

The latest real authenticated public visual evidence was produced after PR #253 / main commit `c80ec7f6acaa27701dbe3a5429b23d5bb2ffa8f3` by workflow `LTS Health Real Auth E2E`, run `34725537654`, artifact `real-auth-visual-evidence` (artifact id `10307507771`). It contains `desktop-home.png`, `mobile-home.png`, and `mobile-training.png` from the real authenticated public app, not fixture mode.

This real-auth E2E passed and is now the required visual evidence path. Fixture screenshots are not acceptable evidence for claims about what the user sees.

## Important lessons / failures already diagnosed

Do not repeat these:
- CI green does not equal good UX.
- Fixture mode previously showed a different surface than the user's authenticated app.
- The structural runtime previously stopped polling before real authenticated data finished loading; it was extended to tolerate real load timing.
- Cache/versioning previously allowed Safari to retain old presentation assets.
- Tests previously searched for legacy Home selectors and therefore could not prove the new Home existed.
- The user repeatedly saw a legacy dashboard despite claims of redesign. Never call a CSS patch a redesign.
- Never claim visual parity without inspecting real authenticated screenshots from the deployed version.

## Current user acceptance

On 2026-09-12, after viewing the structural version, the user said: `Está em uma direção melhor sim` and authorized continued evolution toward the approved model.

This is directional acceptance only. It is NOT final UX acceptance.

## Current P0 package — UX model convergence

Status: IN PROGRESS.

Goal: move the public authenticated mobile experience from the current structural v2 toward the approved visual model while preserving real data, provenance, privacy, and working routes.

Execution order:
1. Home mobile refinement.
2. Training session/detail refinement.
3. Composition experience.
4. Labs longitudinal experience.
5. Timeline.
6. Analyses / remaining domains.

Home refinement requirements:
- remove remaining generic-dashboard feel;
- reduce unnecessary chrome/header weight;
- improve spacing, typography, proportions and visual rhythm;
- replace decorative trend bars with real longitudinal data when unambiguous;
- prioritize current composition, latest training and meaningful changes;
- avoid giant vertical cards and horizontal clipping;
- keep bottom navigation simple and app-like;
- first viewport must be useful without analysis by the user.

Training refinement requirements:
- preserve real session → metrics → exercises → sets structure;
- make the session header and key metrics more visual;
- preserve 11/09/2026 real session data already stored in the private database and visible through authenticated UI;
- improve exercise/set readability, including load, reps, failure/drop/rest-pause metadata when available;
- later add exercise progression only when comparable historical data is safe.

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

Continue the P0 UX model-convergence package. Start with Home mobile using the current structural v2 as the base. Do not return to the legacy cockpit. Work in a coherent package, not micro-patches. After Home/Training reach a materially improved state, promote by normal PR, run real-auth visual proof, inspect it, then ask the user for product-level feedback.
