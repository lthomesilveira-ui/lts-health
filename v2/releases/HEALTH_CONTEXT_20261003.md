# Result-first health context — candidate .31

Build: `home-dashboard-reference-20261003.33`. This document contains public engineering metadata only.

## Changes

- Preserves the existing app, navigation, full histories and owner isolation.
- Adds four simultaneous panels on one calendar window, a laboratory-marker selector and a shared day explorer.
- Home windows end on the current São Paulo calendar day. Empty windows never silently fall back to older history.
- Replaces laboratory counts with marker values; the laboratory page groups values and references from a selectable collection.
- Chooses the latest laboratory cohort by default, rather than preferring an older cohort with more points.
- Shows isolated observations without manufacturing a trend or comparing unknown methods.
- Preserves composition origins; the overview shows the complete history without joining different devices/origins.
- Medication context shows only recorded local time, site and side. No dose, schedule, next-side suggestion, raw messages or raw payload is fetched by the normal UI.
- Reads only allowlisted JSON scalar fields for device/context labels. Authentication, RLS and private-file protections are unchanged.
- Removes the obsolete DOM rewrite observer: canonical rendering already belongs to `main.js`; depth controls continue to redraw explicitly.

## Data work

The owner-authorized private import was reviewed against current-result pages, deduplicated across repeated reports, reconciled field by field after insertion and replayed to verify idempotence. Existing rows were preserved. Qualitative/censored results were not coerced into exact numbers. Historical tables and assay controls were excluded. The manifest, report, record identifiers and medical values remain private and do not belong in this repository.

## Evidence and remaining gates

Passed locally: health-context model, functional-depth model, architecture, UX coherence, continuity, public-audit, refresh resilience, database security, privacy, public-payload and laboratory parser-safety contracts.

PR browser gates, deployment and exact-build authenticated public inspection are required before this candidate is described as published. Physical-device owner acceptance is distinct from technical verification. Historical MyFitnessPal ingestion and new third-party integrations are not claimed as completed by this package.
