# Preserve a failed Google callback reason — package047

A genuine owner callback returned a code and the requested nutrition-read-only scope, and consumed its pending state before expiry, but the connection remained unlinked. The existing recovery page combined different failures without retaining the failing stage. It is no longer accurate to describe this attempt as an owner who has not started authorization. The exact earlier cause cannot be reconstructed from the available logs.

The server now emits one closed-schema event after an atomically consumed valid state fails. It distinguishes state decryption, code/token exchange, identity verification, token encryption and saving. Token exchange reports an allowlisted OAuth error, HTTP status and structural validation category; every arbitrary response/error/description is discarded. Requests, identity, state, codes, secrets, tokens and provider text never enter the diagnostic event. Malformed, random, expired and replayed callbacks emit nothing; success emits nothing. A logging failure cannot change recovery.

Token rejection still fails closed with the existing JSON error/status and fixed browser recovery. Success, encryption, exact single read-only scope, identity checks, generations, disconnect, scheduler and source storage are preserved. No schema, permission, configuration, credential, OAuth scope or frontend asset changes. This does not restore water or close any original source/access/recurrence condition.

## Verification

Local syntax, 90 Node tests, continuity and public-payload guards passed. The new cases check known/unknown client and grant rejections, malformed and oversized bodies, missing token fields, scope/lifetime rejection, decryption, identity403, save rejection/error, quiet success/replay and logger failure. Each canary test checks that private values are absent from the event and that no hydration record was written. An initial new-test syntax typo was corrected before the successful run; no assertion was removed.

Exact candidate CI, normal merge and native backend publication are completed as recorded below. The next genuine owner attempt is now needed because the earlier consumed code cannot be replayed and the old failure was not recorded.

## Primary documentation reviewed

- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.google.com/health/reference/rest/v4/users/getIdentity
- https://supabase.com/docs/guides/functions/auth-headers
- https://supabase.com/changelog.md

The existing identity route, resource format and nutrition-read-only scope agree with current Google documentation; this does not establish successful access for the real account. Relevant changelog review does not require a dependency or schema update.

## Delivered verification

PR511 exact candidate a2a615bbf9c0a596660cdb5cafe2c97a74d06f76 and tree cb6f5004c0d03a60c9266730f70939c709c10a40 passed17/17 workflows, including90 Node tests,24 PostgreSQL tests and Chromium/WebKit callback recovery at320/393/1440. No diagnostic canary appears in a reported event.

Candidate Laboratory Originals42506470756/job128810080895 first failed on the existing null boundingBox read at lab-original-browser:38. Only that failed job was repeated on unchanged source; job128810465097 passed. Original failure/artifact13627363634 and SHA25676af7d55e5ac4030d4bf048d7181b31d545478b136a0861442066fb9363434fa are preserved.

Normal PR511 merge 32d9cf48176054b7493bf03ec8e0592da0306db3 preserved the exact tested tree. Google publication42506923881 and deploy42506923919 passed; broad unchanged-frontend repetitions remain enumerated separately until completion.

Native callback7/connection8/scheduled3 are ACTIVE, retain JWT false/true/false, and all6/6/7 deployed files exactly match the tested source. No schema, credential, setting, permission, scope or clinical record changed.

Native probes verified callback JSON400/invalid_callback, browser303 to the fixed recovery page with no-referrer, connection401 and scheduled405/401/403. The public index remains exact .128 with SHA2565b653531e930ed4361f326a694ce083d350742c1ac717e3dc67f7ce091c3282d.

Live aggregate remains zero connected Google accounts and zero hydration reads. A fresh genuine owner callback is needed to capture the safe failure stage; the earlier consumed code is not replayed. None of the original nine conditions is closed.

Publication snapshot: 20/21 success; pending unchanged-frontend repetitions 42506923880. They have not been claimed successful or rerun.
