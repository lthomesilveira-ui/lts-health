# Polar — verified real-provider activation

The official client, server-side configuration and owner training/sleep consent are verified. The real OAuth callback persisted the encrypted, owner-scoped connection. Credentials, identifiers, clinical values and provider payloads stay outside this public record.

The training-list endpoint rejected plain dates and UTC-offset strings with HTTP 400. Real collection succeeds with account-calendar local ISO datetimes (`YYYY-MM-DDT00:00:00`); sleep requests retain date-only boundaries. Training history is split into bounded date intervals without dropping the initial 90-day coverage. Strict response validation distinguishes malformed or empty objects from valid empty lists.

Diagnostics expose only allowlisted endpoint/stage/status categories and fixed validation vocabulary. Provider response bodies, request URLs, identifiers and credentials are never logged. Public connection errors retain the database's existing categories. Lease cleanup is checked and bound to the claimed attempt. A diagnostic candidate that violated the existing error constraint was corrected; its lease expired normally.

On 2026-10-04, real initial import, idempotent replay and a real refresh-token grant succeeded. The refresh probe used the existing authorized server path, without new scopes or reading tokens into the agent; the normal expiry condition was immediately restored in deployed `health-polar-connection` version 16. Connection last-success advanced, errors cleared and the lease released. Provider records remained unique; canonical workout count and the newest owner-supplied workout were unchanged. The provider returned no sleep entries in the requested window; absent sleep is not replaced or fabricated.

The authenticated public `.34` app was inspected: source status shows authorization and last successful update, and Recovery & analyses displays actual Polar duration history, paginated sessions and heart-rate measurements. Manual synchronization refreshes the loaded domains. Source records remain separate from confirmed strength workouts, and totals are not combined. Encryption/owner separation, single-use callback state and minimal scopes remain covered by existing contracts.

Validation: `v2/polar-contract-test.mjs`, `v2/polar-provider-test.mjs`, continuity and public-payload gates. PR #304 merged normally at `a4a66649f0ad8086b889f91eb2265d0687b3e96c`. All four candidate checks and eight post-merge workflows succeeded; normal runtime replay and authenticated source/report inspection passed after promotion. No frontend redesign or closed-app background schedule is included; on-open updates remain eligible after six hours and manual refresh is available.

MyFitnessPal official API access remains externally blocked. Historical water transfer remains a separate notebook user action; Apple Health is deferred. No message was sent to a provider and no credentials should be requested through chat.

Candidate checks: Functional Depth `37221718598`, Dashboard Reference Contract `37221718687`, Recovery Depth `37221718625`, Nutrition History `37221718691`.

Post-merge checks: Deploy `37221851057`, Functional Depth `37221851044`, Recovery Depth `37221851070`, Nutrition History `37221851016`, Smoke `37221851024`, Timeline `37221851031`, Pages Smoke `37221869391`, Homologation Pages Smoke `37221869411`. The backend correction does not change the frontend build identity or presume subjective/physical-device acceptance.
