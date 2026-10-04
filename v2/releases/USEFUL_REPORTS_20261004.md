# Useful reports and Polar preparation — published .34

The owner requested practical historical reports and cross-domain investigation context, prioritizing Polar/MyFitnessPal over Apple Health. FB-025 reopens report usefulness after the technical .33 delivery. Owner/physical acceptance is not presumed.

## Product behavior

Production analysis now leads with questions worth investigating, then current/prior periods, four composition curves, five regional segments, searchable laboratory comparisons with individual historical references, training and source-separated recovery. Bounded periods end today in Sao Paulo. All charts share one calendar; full histories remain reachable.

Regional context uses the actual interval between two comparable scans, with recorded regional sessions/sets and protein coverage. Lean mass includes water and other tissue; a reduction is not classified as proven muscle loss or caused by a workout. Device identity crosses body/segment domains only through an unambiguous original-file plus date link. Origin/device changes, duplicate dates and unavailable context block differences.

Labs remain readable across unknown/different methods, units and origins. Exact deltas require the same known origin/unit/method. Censored/textual results remain readable without manufactured curves. Each selected point exposes its own reference; reference ranges are not individual targets. Rules-based questions introduce no diagnosis, dosing or automatic workout prescription and do not claim to be a physician or validated coaching model.

Food means display observed-day coverage, exclude ambiguous dates and never estimate missing days as zero. Prior food deltas require a known matching source. Canonical strength sessions and imported Polar sessions remain separate; their totals are never summed.

## Polar security and activation

Connection/callback Edge Functions version 1 are deployed. Connection actions require a user JWT plus server-side `getUser`. Callback custom authentication uses unpredictable expiring one-use state hashes bound to that authenticated start, with a fixed return URL. Tokens use AES-GCM with owner-bound additional data. Token/state tables are service-only; RLS is enabled and browser grants revoked. Session reads are owner-only; browser writes are denied. No token or raw provider payload enters the UI or backup.

Scopes: `training_sessions:read sleep:read`. Initial prepared pulls request up to 90 days of session metadata and 30 days of available sleep dates; detailed sleep uses one-day calls. Incremental attempts revisit seven days. Sleep uses documented `sleepEvaluation.asleepDuration`, never time in bed as a substitute, and stays per-device complementary evidence. Provider sessions do not create duplicate canonical strength workouts. Owner/provider upserts are idempotent; a lease excludes overlapping sync attempts. Disconnect removes stored credentials/pending states, retaining already received history.

After activation, the app attempts a sync when opened if at least six hours have elapsed since the previous attempt, with a manual update action available. No closed-app background schedule is configured or claimed.

**Not yet a live connection:** registration credentials, secure server secret setup and account consent are unavailable. A real provider pull, token refresh, replay/idempotence and observed schema remain activation acceptance. The private aggregate audit found no authorized connections, pending states or imported sessions.

Register [Polar AccessLink](https://admin.polaraccesslink.com) with name `LTS Health`, website `https://lthomesilveira-ui.github.io/lts-health/v2/` and redirect `https://plztdqyuqcjohiimudnr.supabase.co/functions/v1/health-polar-callback`.

Configure server secrets `POLAR_CLIENT_ID`, `POLAR_CLIENT_SECRET`, `POLAR_TOKEN_ENCRYPTION_KEY` (32 cryptographically random bytes, base64 encoded). Never send actual secrets/passwords/key values through chat or public code. Plan token migration or reauthorization before key rotation.

MyFitnessPal API access remains externally blocked; imported files are distinguished from account synchronization. Historical water still requires the existing notebook extraction/import. No reminder was scheduled. Apple Health/signing is deferred.

## Executed evidence and release state

Local report, encryption/provider-schema, health-context, history, privacy and public-build contracts passed. Fifteen affected modules passed syntax. Post-migration queries confirm RLS and explicit grants, no browser access to token/state tables, owner-only session reads and no user writes. Two advisor INFO notices concern deliberately service-only tables without client policies; the pre-existing password-protection warning is tracked separately. [RLS informational notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

PR #302 published `home-dashboard-reference-20261003.34` at product commit `7c62565ab5571d10d26a45b40ce4aa7c6c0e6240`. All six final candidate gates passed at candidate `067e226452ad6b3e25c91691c8072587acc2b856`: product contract `37166395675`, full histories `37166395765`, cockpit `37166395760`, workout evidence `37166395761`, nutrition `37166395758` and recovery `37166395781`.

All nine post-merge workflows passed: deploy `37166510377`, authenticated real-data desktop/mobile `37166510321`, full histories `37166510345`, public Pages `37166529412` (attempt 2), homologation Pages `37166529425`, nutrition `37166510316`, recovery `37166510341`, timeline `37166510311` and smoke `37166510332`. The first public Pages browser attempt timed out waiting for its fixture; an unchanged-code retry passed. The authenticated gate independently reconciled complete workout, marker and body access, confirmed protected Polar activation status, anonymous rejection and invalid callback rejection, and preserved original histories.

Encrypted private screenshot artifact: `11289633336`, SHA256 `b147e898109d037033746ebd3296a8b48902f1696c76970fff49865d28f172d8`. Synthetic responsive artifact: `11289324075`, SHA256 `218cdb6aa5c4e920c6e1305c482e43b9739536dbb0c119af6a0f84b803a64e99`; desktop/mobile segmental captures were visually reviewed. Plaintext authenticated CI screenshots were not decrypted in this checkpoint; no claim of that review is made.

The exact public `.34` was independently opened in authenticated Cloud Browser on 2026-10-04 after secure login. Production report layout, all-history and 90-day shared axes, legacy left-arm interval context, five segment rows, lab search with retained focus, marker/current-point selection with its own reference and Data & sources activation states were checked. A private viewport capture was retained outside the repository. The report defaults to the latest point when a marker changes; an explicit oldest-point choice remains available.

The technical package is complete. Real Polar consent/pulls/refresh/replay remain activation work; MyFitnessPal API access and notebook water remain blocked. Owner usefulness judgment, physical-iPhone acceptance and final pixel parity are not presumed. Existing private histories remain preserved; no private values, credentials or plaintext health screenshots belong here.

## Primary sources

- [Polar API v4](https://www.polar.com/polar-api-v4/): registration/OAuth/scopes, ranges and session/sleep fields.
- [MyFitnessPal official API](https://www.myfitnesspal.com/apps/api/version): official application access must precede continuous integration.
- [Repeated-measurement bioimpedance study](https://pmc.ncbi.nlm.nih.gov/articles/PMC11649400/): general measurement-condition/variability notes, not validation of a specific user's device or a clinical threshold.
- [Supabase authorization](https://supabase.com/docs/guides/functions/auth-headers): JWT gateway versus callback custom authentication.
- [Supabase grant change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically): explicit grants included with the new schema.
