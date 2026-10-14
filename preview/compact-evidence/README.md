# Isolated Health validation preview

Generic app code copied from candidate e960481eb41562dc6abe6d07e6584623dd7c3099, build compact-evidence-20261014.59.

This directory does not replace /v2/. It uses the same existing Supabase project, publishable client configuration, session and row-level security. It contains no private records, screenshots, database migration, credentials or new access grant. Signed-out access shows the normal login screen. Demonstration mode remains explicitly opt-in through the existing fixture query parameter.

Browser tests intercept the service with synthetic data only. They verify this preview path rather than the production path. Real-data review is performed separately through an already authenticated cloud browser; synthetic screenshots are not evidence of real-data validation.

The preview-only guard runs after the SDK and before app modules. It preserves authentication and read queries, blocks database/storage mutations, RPC and edge-function invocation (including automatic Polar sync), and disables known write forms. This is an application validation guard, not a change to server authorization or RLS. Expected generic asset hashes are embedded in tests/preview-contract.mjs; no JSON manifest or private payload is published.

The renderer includes the separately reviewed display refinements (Corpo title, compact source control and collection-date heading). Source clinical records and production files are unchanged.
