# Independent Polar updates — 12/10/2026

The existing `.44` frontend is preserved. This is a backend activation and source-audit package, not a new visual release or a claim that all external dependencies are eliminated.

## Delivered and executed

- Native migration `20261012213757_polar_schedule_singleton_ticket.sql` applied successfully. It is a different, non-destructive bounded-slot design, not direct-SQL circumvention of the unapplied ticket-row migration.
- The private slot contains only a digest and operational timestamps. Each cron invocation creates a random ticket valid for five minutes; one atomic conditional update marks it consumed. An old/replayed/expired ticket cannot authorize another invocation.
- The consumption backend has column-scoped update permission only for `ticket_consumed_at`. It cannot enable the agenda or extend expiry. Anonymous and authenticated browser roles have no private-schema or authorization-RPC access. Functions remain security invoker; RLS remains enabled.
- Rolled-back live checks passed for first use, replay, expired input, malformed input and disabled configuration. No personal records were changed by these probes.
- Live controlled payload rejection returned 400, then same-ticket replay returned 401. Missing and invalid-ticket HTTP checks also returned 401. An earlier concurrent synthetic probe returned 400 plus a fail-closed 503; that transient result is not silently counted as a 401 proof or a provider sync.
- The real private cron invoked `health-polar-scheduled` v1 and completed the Polar-to-database path independently, before app inspection. HTTP completed successfully with no provider failure; a real `last_scheduled_sync_at` and scheduled trigger were recorded.
- Later temporary validation ticks were skipped by the recent-attempt throttle. Minute-level validation was removed, and the final `lts-health-polar-hourly` job is active at `17 * * * *` with config enabled and verified interval 60 minutes.
- Canonical/source-ID duplicates remain absent. Existing provider authorization, encrypted tokens, source boundaries, paid bridge and histories were preserved; no new owner consent or key reset was requested.
- The existing callback bundle predates schedule columns. Native migration `20261012221134_polar_schedule_revision_boundary.sql` protects every new authorization revision by resetting scheduled-success/attempt markers at the database boundary. A rolled-back revision probe passed; real current schedule evidence was preserved. The working OAuth callback did not need redeployment or credential changes.
- Authenticated exact-public `.44` inspection shows hourly server mode and the real automatic-completion timestamp. The app's source statement still qualifies device-to-Polar availability and does not guarantee instant provider data.

## Source audit and remaining boundaries

The current source audit found no duplicate daily grain or negative values for the supported nonnegative measures. A further genuine paid-bridge receipt arrived; that receipt alone does not prove MyFitnessPal water attribution or iOS automatic cadence. Existing recent laboratory data was verified as present.

Previously supplied preliminary/final Fleury originals and a prior report were located privately. Do not request them again or reimport existing results. New-format PDF automation is still held by the laboratory safety contract; the source discovery is not a claim that a specialized parser or direct hospital integration is released.

Original authenticated MFP water history, direct official API approval, identifiable automatic MFP water recurrence and native physical-iPhone/signing validation remain explicit tasks. They do not invalidate the completed Polar job, and they must not be marked done from intention or assumed device behavior. New-format laboratory parsing also remains separately held as described above.

## Auth security closure and publication

The owner selected the secure administrative sign-in method and account. Credential values were never returned to the agent. The existing Health project's `Prevent use of leaked passwords` setting was enabled and saved; no other Auth setting, password, provider, key or access permission was changed. The native post-save security advisor at 2026-10-12T22:32:30Z no longer reports `auth_leaked_password_protection`. Its four remaining RLS/no-policy informational findings describe intentional browser-denied backend tables, not a reason to grant browser access.

Normal PR #331 promoted candidate `7b1da169f2aec698e4500267868ff604621200de` as main `0405d5e457029a3de45ca93d3578ee4db1922fda`. The candidate and local tree matched `a8569d6b6a7531b613d8d8fdf7df4b5413875755`. All six candidate workflows and all ten triggered post-merge workflows completed successfully. Deploy: `38316126096`; public Pages: `38316157235`; homologation Pages: `38316157344`; Polar background: `38316126129`; Functional Depth: `38316126158`. The full run list is recorded in the PR. Exact authenticated public `.44` Home was inspected after publication; the approved frontend and real latest workout/source views remain intact.

## Preservation and checks

The older unapplied ticket-row SQL is kept for history and marked superseded. The original bootstrap migration remains historical; its reusable-key enqueue body is overwritten by the new applied function. No reusable Vault/provider/owner credential enters the extension-managed HTTP queue.

Local background, provider, owner/encryption, lab-quarantine, continuity and public-payload checks are required. Candidate workflow and normal PR promotion evidence is recorded with the release before completion. No private screenshots, source files, health values, account IDs or keys belong in this repository.
