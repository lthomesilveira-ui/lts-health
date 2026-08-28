# LTS Health — Architecture Reset Plan

## Why this reset exists
The production UI accumulated multiple render layers over the same DOM and `loadAll` lifecycle. Static smoke tests passed while authenticated mobile behavior could still regress because modules loaded sequentially and mutated the same screens after render. The result was contradictory copy, stale technical labels, blank content, and tabs that could stop responding.

The dedicated Supabase backend and canonical health data remain the source of truth. This reset is about the frontend architecture and acceptance gates, not a data migration.

## Production rule
Main remains a stable fallback. New architecture work is developed separately and is not promoted until the acceptance gates below are green. No more UI patches that wrap `loadAll`, global `activateTab`, or mutate another module's rendered DOM.

## Target architecture
- One application bootstrap.
- One router/navigation owner.
- One data store with explicit queries and loading/error states.
- One render owner per screen.
- Shared components for cards, charts, lists, provenance, loading and empty states.
- Feature modules consume normalized data; they do not overwrite each other.
- Repository contains no private health payloads.
- Dedicated LTS Health Supabase only.

## Product information architecture
Primary: Bio, Treinos, Evolução, Análise, Tratamentos.
Secondary: Hoje, Timeline, Saúde & Exames, Nutrição, Dados/Inbox.

## Work packages
### 0. Stabilize production
- Remove recently added UI-overwrite layers from runtime.
- Keep prior public version as fallback.
- Verify navigation and authenticated data loading before further promotion.

### 1. Canonical data audit
- Reconcile counts/ranges for body composition, workouts/exercises/sets, segmental data, labs/documents, nutrition/meals/activity, metrics, uploads, quality issues and treatment history.
- Reconcile recent user-reported workouts against the database.
- Document duplicate/overlap rules for Polar vs Apple Health and MFP activity vs canonical workouts.

### 2. Claude parity — minimum product floor
Bio:
- latest metrics
- complete history
- multi-metric charts
- arbitrary two-date comparison
- segmental history
- manual bio entry

Treinos:
- calendar/history
- session drilldown
- exercise and set drilldown
- exercise progression by compatible unit
- muscle-group volume by period
- search/filter
- detailed manual entry

Evolução / Análise:
- body trajectory
- training frequency/volume
- evidence-based cross-domain context
- no unsupported readiness/recovery score

Tratamentos:
- neutral temporal history/context only
- no dosing/cycle/injection instructions

### 3. Complete health data hub
- Apple Health export ingestion with conservative source-aware deduplication.
- Polar Flow import when it adds detail beyond Apple Health.
- Fleury and Einstein lab/document ingestion with original evidence preserved.
- MyFitnessPal full-history nutrition/meal analytics.
- Timeline connecting all domains.

### 4. Assistant-grade analysis
- deterministic summaries first
- explicit evidence and limitations
- longitudinal correlations only with adequate paired observations
- no causal claims from temporal association
- no invented values

## Acceptance gates before any new public UI
1. Authenticated mobile: all primary and secondary tabs navigate correctly.
2. Authenticated desktop: same navigation and data state.
3. Latest known workout and latest known body composition appear correctly.
4. No screen shows technical implementation language such as canonical/parity/backend/PWA/readiness to the user unless inside a diagnostic/admin view.
5. No contradictory zero-count summary when data exists.
6. Empty/loading/error states are explicit and do not hide other tabs.
7. No duplicate workout from overlapping sources.
8. Static smoke passes.
9. Browser interaction smoke passes.
10. Production promotion only after the above are green.

## Non-goals
- No architecture restart of the backend.
- No destructive reclassification of health history.
- No inferred missing loads, reps, biomarkers or body metrics.
- No private health data in public GitHub.
