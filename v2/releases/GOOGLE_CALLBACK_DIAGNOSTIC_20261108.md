# Preserve a failed Google callback reason — package047

A genuine owner callback returned a code and the requested nutrition-read-only scope, and consumed its pending state before expiry, but the connection remained unlinked. The existing recovery page combined different failures without retaining the failing stage. It is no longer accurate to describe this attempt as an owner who has not started authorization. The exact earlier cause cannot be reconstructed from the available logs.

The server now emits one closed-schema event after an atomically consumed valid state fails. It distinguishes state decryption, code/token exchange, identity verification, token encryption and saving. Token exchange reports an allowlisted OAuth error, HTTP status and structural validation category; every arbitrary response/error/description is discarded. Requests, identity, state, codes, secrets, tokens and provider text never enter the diagnostic event. Malformed, random, expired and replayed callbacks emit nothing; success emits nothing. A logging failure cannot change recovery.

Token rejection still fails closed with the existing JSON error/status and fixed browser recovery. Success, encryption, exact single read-only scope, identity checks, generations, disconnect, scheduler and source storage are preserved. No schema, permission, configuration, credential, OAuth scope or frontend asset changes. This does not restore water or close any original source/access/recurrence condition.

## Verification

Local syntax, 90 Node tests, continuity and public-payload guards passed. The new cases check known/unknown client and grant rejections, malformed and oversized bodies, missing token fields, scope/lifetime rejection, decryption, identity403, save rejection/error, quiet success/replay and logger failure. Each canary test checks that private values are absent from the event and that no hydration record was written. An initial new-test syntax typo was corrected before the successful run; no assertion was removed.

Exact candidate CI, normal merge and native backend publication are pending. After exact publication the next genuine owner attempt is needed because prior consumed codes cannot be replayed and the old failure was not recorded. Do not ask for that attempt before publication.

## Primary documentation reviewed

- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.google.com/health/reference/rest/v4/users/getIdentity
- https://supabase.com/docs/guides/functions/auth-headers
- https://supabase.com/changelog.md

The existing identity route, resource format and nutrition-read-only scope agree with current Google documentation; this does not establish successful access for the real account. Relevant changelog review does not require a dependency or schema update.
