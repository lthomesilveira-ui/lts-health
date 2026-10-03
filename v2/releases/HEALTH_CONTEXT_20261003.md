# Result-first health context — published .33

Build: `home-dashboard-reference-20261003.33`. This document contains public engineering metadata only.

## Changes

- Preserves the existing app, navigation, full histories and owner isolation.
- Adds four simultaneous panels on one calendar window, a laboratory-marker selector and a shared day explorer.
- All four panels use identical calendar bounds, including full history. The public inspection also corrected inherited layout that clipped the main plot date labels; both behaviors now have permanent model/browser assertions.
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

## Verified evidence and remaining dependencies

Passed locally: health-context model, functional-depth model, architecture, UX coherence, continuity, public-audit, refresh resilience, database security, privacy, public-payload and laboratory parser-safety contracts.

Normal promotion: PRs #298, #299 and #300. Final product commit: `747adeb7c2a4b7ba43fc9abb799207a82ce53881`.

Final PR gates passed: cockpit `37133816393`, functional depth `37133816580`, dashboard reference `37133816483`, nutrition history `37133816428` and recovery depth `37133816452`. Desktop/mobile synthetic visuals were inspected; the calendar checks run at desktop, 390px and 320px, with the reduced 393x650 layout protected by the cockpit gate.

All nine final post-merge workflows passed: deployment `37133872512`, real authenticated desktop/mobile E2E `37133872546`, functional depth `37133872559`, recovery `37133872533`, nutrition `37133872550`, smoke `37133872525`, timeline `37133872491`, public pages `37133891905` and homologation pages `37133891950`.

The exact public `.33` was opened with an authenticated Cloud Browser session. Current collections and marker values, recorded application context and complete composition history were inspected. Marker selection, full-history/90-day matching axes and the same-day cross-domain readout were exercised. This direct inspection exposed and corrected the two calendar/layout issues above; it is not replaced by CI alone.

Encrypted real-auth screenshot artifact: `11277494595`, SHA256 `2c57c016c5669f4128914b31a7a8f5806d62e3cc20ae8292ef2f0e92eb9ea75c`. Plaintext medical screenshots and the private reviewed import manifest remain private.

Physical-device owner acceptance is distinct from technical verification and is not claimed. Historical MyFitnessPal water and new third-party integrations are not claimed as completed by this package. No data was fabricated to fill source gaps.
