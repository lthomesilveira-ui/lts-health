# Google hydration background reader — 2026-11-07

## Problem and behavior

The protected Google connection could read after an app action, but had no server agenda. Package044 adds an hourly server-only reader for already authorized connections. It does not require opening the app, add a permanent invocation credential, widen Google scopes or promote an unreviewed source into canonical water.

## Boundaries

- A private database job creates a cryptographically random single-use ticket, stores only its hash, and expires it after five minutes. Browser roles lose extension transport queue/response access as well as scheduler RPC access.
- The endpoint rejects browser origins and accepts only a bounded JSON tick. It cannot accept an owner ID, date range or source mapping.
- The service selects at most two connected, due, lease-free owners. Successful manual reads and failed scheduled attempts both enforce a50-minute backoff.
- The fixed window contains today in São Paulo plus the previous29civil days. Original source offsets remain unchanged.
- Manual and scheduled paths share encrypted owner-bound tokens, verified Health identity, token refresh, complete pagination, source validation and a two-minute transaction lease.
- Scheduled snapshots carry a private trigger marker and remain idempotent. A new authorization generation clears previous scheduled connection proof, preserving retained source/clinical history.
- Installation is dormant. Activation requires exact runtime deployment and a safe empty-owner dispatch. A successful empty run proves engineering only; real source arrival, canonical reconciliation and later attributable recurrence remain separate.

## Validation status

71 local invented-data Node tests passed. The added disposable PostgreSQL tests use a real PostgreSQL17 database and pgcrypto, with explicit synthetic cron/HTTP transport stand-ins. Native migration, exact function readback, live ACL checks and dispatch are still pending. No provider token, raw ticket, personal health observation or owner identifier is included here.

The first PostgreSQL run42417604410 passed20/22 tests. Two fixture assertions failed: separate clock reads exceeded the strict five-minute synthetic expired-ticket interval by microseconds; a one-column SQL function alias aggregated its UUID as a scalar. The fixture now uses one captured clock and an explicit named JSON object. Production timing constraints and the HTTP candidate contract remain unchanged. The failed first run is retained rather than counted as passed.
