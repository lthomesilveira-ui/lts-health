# Google hydration background reader — 2026-11-07

## Problem and behavior

The protected Google connection could read after an app action, but had no server agenda. Package044 adds an hourly server-only reader for already authorized connections. It does not require opening the app, add a permanent invocation credential, widen Google scopes or promote an unreviewed source into canonical water.

## Boundaries

- A private database job creates a cryptographically random single-use ticket, expires it after five minutes, and retains its raw value temporarily only in a private column denied even to the service role. Separate cron transactions issue the ticket at minute35 and dispatch it at36. Private synchronous HTTP keeps it out of the shared pg_net queue; only its hash and aggregate dispatch outcome remain after sending.
- The endpoint rejects browser origins and accepts only a bounded JSON tick. It cannot accept an owner ID, date range or source mapping.
- The service selects at most two connected, due, lease-free owners. Successful manual reads and failed scheduled attempts both enforce a50-minute backoff.
- The fixed window contains today in São Paulo plus the previous29civil days. Original source offsets remain unchanged.
- Manual and scheduled paths share encrypted owner-bound tokens, verified Health identity, token refresh, complete pagination, source validation and a two-minute transaction lease.
- Scheduled snapshots carry a private trigger marker and remain idempotent. A new authorization generation clears previous scheduled connection proof, preserving retained source/clinical history.
- Installation is dormant. Activation requires exact runtime deployment and a safe empty-owner dispatch. A successful empty run proves engineering only; real source arrival, canonical reconciliation and later attributable recurrence remain separate.

## Verified delivery

Exact candidate 923658170da615fe42ab115be3f3de61911fdb1e, tree ce811ba85e33f01c0792833cef8fe2f0e0ce398e, passed 17/17 workflows. Run 42418654023 executed 71 Node and 24 PostgreSQL 17.11 tests, all passed. The database uses explicit synthetic cron/HTTP stand-ins; the native boundary was then verified independently.

Normal PR508 merge feadc8c180d8e4971bfd6485015ed615267e0bca preserved that tree. All 21 publication workflows passed, including deploy 42421364912 and Pages 42421401211/42421401221. Existing frontend .126 assets are unchanged; all 25 original frontend publication workflows were also read as completed/success without reruns.

Native migration 20261107223447 corresponds exactly to source 20261107213824_google_health_background_schedule.sql. The first native confirmation expired before execution; a fresh native confirmation applied successfully. The private http 1.6 schema denies usage to browser and service roles. The service can consume the ticket hash, but cannot read its temporary raw value, issue a ticket or redirect transport. All eight added functions have empty search paths and explicit grants; they remain SECURITY INVOKER. The new private table has RLS without client policies by design; advisors reported only the expected private-table informational notices.

Connection 5/callback 5/scheduled 1 were deployed sequentially, preserving gateway JWT true/false/false. All 6/6/7 reachable files were read back exactly. The first comparison included an unused schedule module pruned from owner bundles; comparison was corrected to each entrypoint's actual dependency graph, without redeployment or source changes. Five live boundary probes returned the expected 401/400/405/401/403.

The two hourly cron phases are enabled at minute 35/36. One committed ticket issuance followed by the real bounded dispatch returned HTTP 200 with attempted/completed/skipped/failed all zero. The temporary raw ticket was cleared, consumption recorded, and a duplicate dispatch returned null. This verifies engineering on an empty authorized-owner list, not a Google hydration observation or a naturally occurring cron execution.

The existing genuine authenticated public .126 refreshed and showed Google Health ready to connect. No fresh OAuth flow, credential request or owner consent was initiated. No canonical observation was written or promoted. Owner-observed403 remains technically unattributed; already-present tester/redirect configuration does not prove a successful grant. Nine original dependencies remain open with their independent evidence requirements. No provider token, raw ticket, personal health observation or owner identifier is included here.

## Retained validation history

The first PostgreSQL run42417604410 passed20/22 tests. Two fixture assertions failed: separate clock reads exceeded the strict five-minute synthetic expired-ticket interval by microseconds; a one-column SQL function alias aggregated its UUID as a scalar. The fixture now uses one captured clock and an explicit named JSON object. Production timing constraints and the HTTP candidate contract remain unchanged. The failed first run is retained rather than counted as passed.

Native preflight found that pg_net0.20.4 transport objects belong to the managed administrator, grant PUBLIC access, and cannot safely be tightened by the project role. No ineffective revocation was applied. The revised path uses the supported http1.6 extension inside a private schema, with explicit120s/5s request/connect timeouts and two independently committed cron phases. It changes no existing Polar/pg_net ACL or job. The transport stands in the PostgreSQL fixture now model this private synchronous boundary and ticket consumption. The prior22/22 database result belongs to the earlier transport candidate; the final revised24/24 result is identified above.

The first private-transport run42418468595 passed23/24 database tests. Its second malformed-response case tried to issue another ticket while the first was still unconsumed and valid after the synthetic transport subtransaction rolled back. The two independent malformed-response fixtures now start from separate fresh schedules. The production five-minute refusal and dispatch logic are unchanged. This failed run is retained separately.
