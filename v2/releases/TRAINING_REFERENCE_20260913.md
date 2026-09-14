# LTS Health — Training reference convergence — 2026-09-13

Branch package: `training-reference-convergence-20260913`.

Purpose: move the authenticated mobile Training session closer to the recovered approved visual reference without changing health records or fabricating missing data.

Changes in this package:
- training route adopts the same dark mobile shell family as the approved Home reference;
- session header is compact and app-like;
- the existing Summary/History navigation is restyled as a compact segmented control;
- the session hero becomes the dominant red training surface;
- duration, energy, average heart rate and set count become compact first-glance metrics;
- exercise cards and series are denser and easier to scan on a phone;
- bottom safe area and mobile navigation are preserved;
- full historical drill-down remains intact;
- no graphs, heart-rate zones or values are invented when source data is unavailable.

Build target: `ux-coherence-training-reference-20260913.11`.

Acceptance gate before merge: existing dashboard/reference contract, functional-depth regression and authenticated public-app checks must remain green. This record is a checkpoint, not a claim of final pixel parity or product completion.
