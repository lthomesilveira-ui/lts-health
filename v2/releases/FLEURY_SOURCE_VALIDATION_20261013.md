# Fleury original-source validation — 13/10/2026

This is a private-data fidelity and offline format-validation package. Published frontend `.44`, ingestion routing, provider credentials and the paid bridge are preserved. It does not release a general PDF importer or claim physical-device/owner acceptance.

## Source-backed result

Previously supplied preliminary and final Fleury PDFs were materialized privately. Layout-preserving Poppler extraction was independently compared with the dedicated application's current collection using the original file digest, physical PDF page, collection date, result, explicit unit and document print date. Representative multi-column and multi-result pages were rendered and inspected.

The audit identified an omitted result group in an original multi-result assay section. Only source-proven missing rows were inserted in the dedicated database. Existing record projections were compared before and after and remained identical. A second execution inserted nothing. A post-write read and independent source comparison verified the repaired collection; original page evidence and reference qualifications remain private. No flags, prescriptions, diagnoses, source overlaps or historical values were inferred or rewritten.

## Reusable validation

`fleury-source-audit.py` is an **offline, read-only** audit tool. It accepts a local PDF and optional private snapshot, and writes its findings outside its source checkout with private file permissions. It has no database client. Stdout is limited to a fixed completion/review message.

The supported layout vocabulary separates primary results from references, prior-result tables, reported calculations, absolute and percentage cells, decimal conventions, censored/qualitative results, collection versus print dates and same-page repeated copies. Missing/ambiguous results, wrong units, source-digest mismatches and conflicting copies remain held. Public synthetic tests cover these boundaries without patient fixtures.

The existing production laboratory endpoint remains quarantined. These real-source checks validate the specific known layouts for offline auditing, not arbitrary scans, new hospital formats, OCR, direct laboratory integration or automatic canonical writes.

## Current integrations and outstanding work

The restart verified continuing hourly server-side Polar completions with no recorded provider error, and a later real paid-bridge receipt containing hydration. Further receipts do not establish their manual/automatic trigger or original MyFitnessPal water attribution. The original authenticated MFP water history, independently identifiable automatic water recurrence, direct API approval, broader laboratory ingestion and native signed iPhone validation remain separate dependencies.

No new owner consent, source re-upload, subscription, key rotation or manual daily entry is required for this package. Private results, payloads, document hashes and screenshots do not belong in this repository.

## Checks and promotion

Local source-audit failure cases, private real-source comparisons, database idempotency/preservation checks, lab quarantine, lab source boundaries, provider/bridge, continuity and public-payload guards passed. Browser-dependent laboratory/runtime checks are delegated to the established remote CI, since a supported local browser surface is unavailable. Candidate and post-promotion workflow evidence is recorded in the subsequent verification checkpoint. No new visual-release claim is made.
