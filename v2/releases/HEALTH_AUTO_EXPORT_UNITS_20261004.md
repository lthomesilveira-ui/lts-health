# Verified real activation — 2026-10-04

PR #311 merged normally at `f264d0580d5cfe9db8736edc209eda243456faef`, candidate `111a7584f2496caa63b6060d00f0eb85bf75545a`. All five candidate gates passed: Auto Export `37236660598`, nutrition `37236660593`, recovery `37236660628`, dashboard `37236660591`, functional depth `37236660669`. All nine post-merge workflows passed: deployment `37236790472`, Auto Export `37236790347`, nutrition `37236790247`, recovery `37236790332`, functional depth `37236790369`, smoke `37236790345`, timeline `37236790317`, public Pages `37236814633`, homologation Pages `37236814643`.

The owner retried from the physical iPhone and received HTTP 200 with actual supported data accepted. Database receipt and original MyFitnessPal nutrient provenance were independently verified. The exact authenticated public Data route displays **Recebendo dados**, and Nutrition exposes the new daily summaries in the normal runtime. No synthetic row or owner credential was used for this verification. Deployed version 3 and merged shared files were compared byte-for-byte with tested source.

Water is absent from the real upload; the public app states that no water volume has arrived. Its phone HealthKit availability/source is a separate blocked task. Keep the valid existing key and enabled five-minute automation. Exact background timing is not guaranteed, and broader metric import, direct MFP API access, original water history and subjective UX acceptance remain separate.

## Earlier diagnostic checkpoint — superseded by the verified activation above

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
