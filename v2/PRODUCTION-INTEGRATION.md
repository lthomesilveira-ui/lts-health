# Integrated application candidate

This candidate consolidates the already-reviewed dashboard, interval reports, source-quality boundaries and history views into the existing `/v2/` application. The public root already routes to `/v2/`. It is not a new preview URL, database migration or permission grant.

## Source and presentation

`tools/prepare-health-production.mjs` copies generic runtime assets from the reviewed read-only staging surface into `/v2/`, excluding its read-only proxy and banner stylesheet. The production entry uses its own build identity and a closed import map. Core authentication and the body/workout/water write handlers remain byte-identical; the preview retains its own write guard. The accepted daily/period metric layout is preserved.

`production-integration-contract.mjs` checks full JS/CSS/SVG parity against the reviewed source, module dependency closure, correct Home renderer, separate preview guard, authentication boundary and operational form wiring. The preview's existing exact runtime hashes remain a separate gate.

## Operational matrix

| Flow | Candidate behavior | Validation boundary |
| --- | --- | --- |
| Body record | Existing authenticated owner-scoped insert; blank fields remain null | Fake transport and existing input-validation suite; no live insert performed |
| Structured workout | Existing authenticated RPC; owner is not accepted from caller payload | Fake transport, required fields and bounded RPC; live transaction/reload not performed |
| Water entry/import | Explicit user-confirmed input; existing owner/source-key upsert | Fake transport verifies confirmation and idempotent key; no artificial health data inserted |
| Goals | Reviewed protection for historical/documented references; preflight reread and conditional update/insert | Synthetic protected/current/concurrent-row cases |
| Upload | Existing private bucket and generic inspector; originals preserved on parser failure | Unchanged core plus privacy contract; no private upload performed |
| Integration status | Existing authenticated status actions can run in production | Fake transport; status never creates or rotates credentials |
| Polar refresh | Existing production app-open behavior retained: connected, configured, last attempt older than six hours | Synthetic disconnected/recent/stale/absent-owner cases; no live refresh invoked by QA |
| Authorization/key controls | Existing explicit user actions only | No credentials, RLS, grants, server code or scopes changed |

## Acceptance gates

- Pure model, source parity, auth/write boundary and privacy tests must pass.
- The new browser suite must use a mocked authenticated SDK without `?fixture`, because legacy fixture mode selects older renderers. Every external request is blocked; invented data only.
- Browser checks cover narrow/mobile/desktop layouts, actual dashboard renderer, routes, repeated open/cancel, logout and absent-session login. Existing fixture-only input/login tests remain additional guards, not proof of actual product rendering.
- Real authenticated end-to-end read/write/persist/reopen and physical iPhone validation are not established by these synthetic tests.
- Publishing, merging and deploying this candidate require separate approval. No such action is performed by this preparation script.

Water-source recovery, clinical interpretation and numeric source corrections are not manufactured or resolved by frontend promotion.
