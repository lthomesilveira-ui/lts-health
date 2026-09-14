# LTS Health — CURRENT HANDOFF

Updated: 2026-09-13 after verified Home semantic correction and Training reference convergence. Public engineering metadata only; health data and credentials stay private.

## Read first

Repository `lthomesilveira-ui/lts-health`; public app `https://lthomesilveira-ui.github.io/lts-health/v2/`; public branch `main`.

Before any write re-fetch main, active branch, `architecture-v2`, `CURRENT_HANDOFF.md`, `PROJECT_MASTER.md`, `EXECUTION_STATE.json`, `FEEDBACK_LEDGER.md` and `REFERENCE_VISUAL_CONTRACT.md`. Audit parallel changes, preserve compatible work, use normal PR/merge and never force.

Current code/deploy evidence outranks documentation. `EXECUTION_STATE.json` owns task states. `PROJECT_MASTER.md` and `FEEDBACK_LEDGER.md` preserve historical decisions. Chat memory is not a source of truth.

## User direction and visual authority

The user wants the mobile product to converge toward the recovered approved reference image, not a web dashboard compressed into a phone. The original approved mobile image is saved in PRIVATE Drive as `LTS Health - referencia visual aprovada.png`; SHA256 `dc322921f2d05d26f6478d213a6e3a2317978fba62897a77df4dda29d03cc05c`. Do not copy the image into the public repository. Example values/targets/treatment text in the reference are illustrative and must never manufacture production health data.

Physical-iPhone screenshots from the user are valid rejection evidence and should outrank fixture-only visual confidence. There is still no final pixel-parity or product-completeness approval.

## Current verified release

Latest merged product commit: `f6968be347b8573f898dafd241c75ebeda30db7e`.
Build: `ux-coherence-training-reference-20260913.11`.
PR #272.

Post-merge deploy, smoke, Timeline smoke, deployed homologation, staging smoke and real authenticated E2E all succeeded. The authenticated flow exercised the public app and full histories with real authorized data. This validates delivery/integrity, not complete ingestion of every historical external source and not physical-iPhone rendering.

Checkpoint for this Training package: `releases/TRAINING_REFERENCE_20260913.md`.
Earlier functional-depth checkpoint: `releases/HISTORY_DEPTH_20260913.md`.

## Home state

The Home was rebuilt from the approved mobile reference family and then corrected using the user's physical-iPhone screenshot.

Current rules:
- dark mobile shell, compact composition metrics, Today, recent records, weekly progress and bottom navigation;
- `Hoje` means the current calendar day only. Do not show an older workout, nutrition record or treatment as if it happened today;
- older records belong under `Últimos registros` or another explicitly historical surface;
- do not expose internal provenance strings such as `user report in LTS Health conversation` in consumer-facing cards;
- empty current-day states must be explicit rather than silently substituted with the latest historical value;
- preserve safe area so bottom navigation does not cover content.

The Home semantic/density correction was merged through PR #271 and fully passed deploy/staging/homologation/authenticated checks before Training work began.

## Training state

Training functional depth was already delivered before the visual convergence: complete pagination, query/year filter, historical session/exercise/set detail, read-only exercise occurrences and source-safe descriptive load history.

The current Training mobile visual package now:
- uses the same dark-shell family as the approved reference;
- uses a compact app-like session header;
- styles existing Summary/History navigation as a compact segmented control;
- makes the current session a red protagonist surface;
- presents duration, energy, average heart rate and set count as compact first-glance metrics;
- renders exercise/set cards with denser phone-first hierarchy;
- preserves full historical drill-down and bottom safe area.

Do **not** fabricate heart-rate zones, graphs or missing telemetry merely to mimic the reference. Add such tabs only when backed by actual source data; otherwise show explicit unavailable/insufficient-data states.

## Functional depth already delivered

- Training: complete history, session/exercise/set detail and exercise progression where comparison is source-safe.
- Labs: every marker selectable including single/textual results; search; source/unit/method selector; periods; accessible point lookup; complete result pagination. Unknown metadata, duplicate dates and censored values cannot manufacture trends.
- Composition: all measurements available; source/period/year filtering; safe two-date comparison; record detail; segmental values only with a safe link.
- Runtime: route-domain readiness, data-change refresh, focus/scroll/disclosure preservation.

Do not reimplement these because older documents still mention old caps.

## Evidence and privacy outside chat

The original reference and durable encrypted real-auth evidence are stored privately in Drive. The private decryption key is also in PRIVATE Drive as `LTS Health - chave privada das evidencias visuais.pem`; only the public key belongs in the repository. Follow `FUNCTIONAL_DEPTH.md` for authorized retrieval/decryption. Never publish plaintext health screenshots or private keys.

## Remaining work and execution order

1. Continue Training convergence only where real data supports the approved reference (e.g. richer summary/exercise separation; graphs/zones only when evidenced).
2. Timeline: meaningful day/month navigation and direct contextual entry into detailed records, preserving provenance and duplicate boundaries.
3. Nutrition/hydration: deeper available history, useful period/day detail, clear source freshness and missing/ambiguous states.
4. Recovery/analyses: descriptive source-separated trends and navigation without causal medical conclusions.
5. Cross-product visual consistency and final user acceptance against the recovered reference.

Preserve all historical integration/security blockers. The MyFitnessPal historical water import still requires the user's authenticated notebook export/import action; credentials and cookies must not be transferred. Do not infer missing health records or treat route existence as completion.

## Next autonomous action

Start from current `main` and verify the real public app before the next write. Continue visual convergence without undoing Home semantics or delivered historical depth. For any new visual claim, prefer authenticated public evidence and physical-iPhone feedback over fixture-only checks. Persist each coherent package in a release checkpoint and update this handoff after verified promotion.
