# Integration continuity — 12/10/2026

Server activation below is a historical blocked checkpoint, now superseded by `POLAR_BACKGROUND_20261012.md`. The non-destructive singleton-ticket migration was applied and genuine scheduled execution verified. Do not apply the older ticket-row proposal or deactivate the active hourly job merely because of the historical text below.

Published build: `integration-continuity-20261012.44`, verified on 2026-10-12. UI delivery and background-server activation have separate acceptance. This is not a declaration that the whole project is finished.

PR 327 final candidate `92ffe5d66b8d8ddf24b0d30ac01b8ec703e0e18b` passed all seven gates. PR 328 corrected an obsolete literal `.43` Home expectation by using the same exact release manifest already checked at publication; all six candidate gates passed. All eleven corrected post-merge workflows passed at `2cb1d93e76252c221e3ceafed04be57952e17c01`, including authenticated E2E `38303227396`, Functional Depth `38303227625` and deploy `38303227420`.

Synthetic artifact `11770862312`, SHA256 `8721883c4d6f63f442d0acd8f5f46f0623100668f6e468dc99d22e4dd8025511`, was downloaded/verified and inspected at desktop and reduced-mobile sizes. The exact authenticated public .44 source page and Home were manually inspected. No physical-device owner acceptance is inferred.

## Code and local checks

- Connection copy distinguishes data already received from independently proved automatic execution.
- Nutrition and water do not inherit the same MyFitnessPal attribution. Original authenticated MFP water history remains separate.
- Polar displays scheduled/on-open/unverified states only from verified server status; no fabricated automatic-success timestamp.
- Scheduler requests have bounded payloads, method/origin checks, connection enumeration limits, a recent-attempt throttle and fixed-code errors. Public owner routes cannot claim the scheduled trigger.
- Existing encryption, scopes, revision checks and source identifiers are preserved. A lost lease cannot be reported as a successful completion.
- No clinical interpretation or guessed goal was added.

## Server activation is deliberately blocked

- `20261012192605_polar_background_schedule.sql` was applied through MCP. The hourly job is inactive and the config is disabled.
- Both Edge Function deployment targets initially returned internal/UNAVAILABLE errors. Publication recovered after the owner renewed autonomy: `health-polar-scheduled` version 1 is deployed with custom authentication, and `health-polar-connection` version 17 retains JWT verification. The scheduler bundle matches the submitted files.
- Live POST requests with no ticket and with an invalid synthetic ticket returned HTTP 401. An owner-triggered sync through authenticated public `.44` completed successfully; error state remained clear and source-ID duplicate groups were absent. This is not evidence of closed-app scheduling.
- The planned single-use ticket migration returned `Invalid or expired requestState` again after renewed permission and a fresh Continue instruction. Bounded retries stopped. Read-only verification confirms no ticket table or migration history entry. `supabase/planned/polar_schedule_one_time_credentials.sql` is still not applied migration history.
- Extension-owned `net` queue grants could not be assumed revoked by the original best-effort statements. The planned replacement therefore never sends a reusable Vault/provider/owner credential: each invocation receives a five-minute ticket consumed atomically before reading connections.
- Do not activate the existing job before applying that replacement and verifying genuine scheduled execution. The handlers are already published; the bootstrap reusable-key path must remain disabled. No callback route, existing provider authorization or Auto Export key was reset.

## Original-source audit

The supplied original Apple Health ZIP was streamed with `apple-polar-history-profile.py`. Polar workout events and their field structure are present; no hydration records were found. The legacy workout summary lacks second-precision durations, so the strict event-link rule cannot prove identity. This corrects “no original at all” without promoting or duplicating canonical workouts.

Native HealthKit/device validation, approved direct MFP API access, original MFP water export and representative additional lab documents remain separate dependencies. Existing laboratory data and both travel sessions remain intact.

## Security

The live advisor still reports disabled leaked-password protection. Connected project tools do not expose that Auth setting. Backend-only credential tables intentionally deny browser roles; the new private schedule config also denies browser access.

## Safe next activation sequence

1. Resolve the native migration confirmation/request state; publication is already restored. Never bypass an approval requirement with direct SQL or another route.
2. Apply the explicitly planned ticket migration, record its generated migration version, and verify private grants and atomic replay denial.
3. Confirm the already-published scheduler version 1 and owner route version 17 remain source-matched, with JWT verification enabled on the owner route. Redeploy only if code or live evidence actually changes.
4. Use one bounded validation schedule, confirm a genuine cron → HTTP → provider → database completion, then set the final hourly schedule.
5. Verify scheduled status/timestamps through the authenticated app and close `LTS-POLAR-BACKGROUND-001` only after those checks.

No permanent minute-level polling, new subscription, manual daily entry or owner QA of engineering microchanges is required.
