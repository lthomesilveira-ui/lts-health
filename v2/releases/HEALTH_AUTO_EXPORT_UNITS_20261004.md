# Health Auto Export unit compatibility — 2026-10-04

## Trigger and current state

The owner completed the phone setup and enabled the requested five-minute REST automation. Real authenticated attempts return HTTP 422 `unsupported_unit`; the initial receiver exposed only the error code. No real successful ingestion or water receipt is claimed. This package owns the server correction and activation verification.

## Initial correction

- Accept `count/min` as explicit heart-rate units equivalent to `bpm`; keep rate data candidate and source-separated.
- Return and log only a recognized metric and fixed-vocabulary unit label on an authenticated unsupported-unit error. Arbitrary unit strings become `unrecognized`; no value, date, source, payload, key or owner identifier is emitted.
- Reject unknown units and mixed-dimension units without any partial database write. Authentication, revocation, limits, stable replay and existing canonical boundaries remain intact.
- Receiver version 3 deployed and retrieved files matched the tested source exactly. Public frontend build remains `.36`.

Parser/receiver, lifecycle UI, hydration, reporting and continuity contracts passed locally. The real retry is still required to establish which additional unit, if any, is failing and prove ingestion. This is a technical checkpoint, not an activation-complete claim.

## Primary contracts

- https://help.healthyapps.dev/en/health-auto-export/export-format/health-metrics/
- https://help.healthyapps.dev/en/health-auto-export/getting-started/unit-preferences/
- https://developer.apple.com/documentation/healthkit/hkunit/count()

Exporter preferences can localize unit strings. Conversion must establish the actual explicit dimension, never infer it from the magnitude of a health value. The five-minute cadence is the owner's preference; iOS background execution does not guarantee exact intervals.
