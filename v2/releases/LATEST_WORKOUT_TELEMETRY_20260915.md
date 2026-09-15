# LTS Health — truthful partial workout telemetry — 15/09/2026

Public engineering checkpoint in progress. It contains no personal health values, workout payloads, credentials or private screenshots.

## Purpose

A canonical workout may describe the full session while a device captured only part of it. The UI must not present extrapolated energy or partial heart-rate telemetry as if both described the complete session.

## Candidate

- build `latest-workout-telemetry-20260915.29`;
- structured workout remains canonical;
- confirmed Polar evidence enriches the same workout and does not create a duplicate session;
- estimated session energy is explicitly labeled as estimated;
- heart-rate values from a partial recording are explicitly labeled as a recorded segment;
- raw source payloads remain outside presentation and public backup surfaces.

## Gate

The package remains in progress until normal PR/merge, CI, deploy, exact-build public inspection, authenticated navigation when possible, and mobile/desktop visual review are complete. Owner homologation is separate.
