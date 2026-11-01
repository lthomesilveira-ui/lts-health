# Guarded nutrition-document insertion tests

This is a generic SQL generator with **synthetic-only tests**, not an automatic
production migration. Nothing imports it into the browser, runs it at startup,
connects to Supabase, deploys a schema, or applies a real manifest. The workflow
uses a disposable PostgreSQL 17 service and has no application secrets or external
data. All IDs, authors, dates, targets, filenames and hashes in fixtures are fake.

## Generator contract

`buildNutritionPlanInsertSql(manifest)` in `support/nutrition-plan-insert.mjs`
returns SQL text. It never opens a connection or executes that text. The manifest
must contain exactly:

- `ownerUserId`: lowercase UUID of the authorized owner.
- `anchorSourceRecordId`: exact existing document source identity. It must occur
  once in the entire documents table and belong to this owner.
- `expectedDocsCount`: positive integer, counting all current owner documents.
- `expectedDocsHash`: lowercase MD5 fingerprint using the exact preflight query
  below, including every column, `id` and `created_at`.
- `newRow`: `source_record_id`, `document_date`, `title`, `document_type`,
  `source_file`, `source`, `checksum`, `extraction_status`, `confidence`,
  `notes` (optional, defaults to null) and `source_payload`. No `user_id`, `id`,
  `created_at`, table names, SQL fragments or additional row fields are accepted.

Document type must be exactly `nutrition_plan`. The full UI projection is
validated with the same independent pure `documentedNutritionPlan` validator
used by the read-only display. Source identity, date and SHA256 must match the
row, source pages must be verified, and clinical start must remain explicitly
unknown. Strings containing SQL-looking text in documentary titles or notes are
valid data; they cannot become SQL. Identifier-shaped fields have an ASCII
allowlist. Invalid Unicode, NULs, accessors, custom serializers, non-JSON values,
cyclic objects, sparse arrays and unexpected authoritative fields are rejected.

The reviewed manifest is encoded as one base64 JSON value, decoded by PostgreSQL;
no manifest text is interpolated into SQL syntax. This is serialization for SQL
safety, **not encryption or redaction**. A generated script contains recoverable
private content and must stay outside this repository, CI logs and artifacts.
Do not commit a real manifest, rendered script, source document, checksum,
snapshot fingerprint, database row or screenshot.

## Preflight fingerprint

Use the same session settings and expression for the authorized owner's current
rows. Bind `$1` as the owner UUID through the database client's parameter API.
Do not calculate the MD5 in JavaScript or hash a differently formatted JSON dump.

```sql
BEGIN READ ONLY;
SET LOCAL timezone = 'UTC';
SET LOCAL datestyle = 'ISO, YMD';
SELECT count(*) AS expected_docs_count,
       md5(coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.id), '[]'::jsonb)::text)
         AS expected_docs_hash
FROM public.health_documents AS d
WHERE d.user_id = $1::uuid;
COMMIT;
```

This fingerprint is an optimistic consistency check, not an authenticity proof.
MD5 is used only to detect ordinary snapshot changes. The source SHA256 is a
separate documentary binding. Anchor identity and ownership must be reviewed
independently; a supplied manifest is not permission to insert a document.

## Transaction guarantees and limits

The generated transaction locks `public.health_documents` in
`SHARE ROW EXCLUSIVE` mode, sets bounded lock/statement timeouts, confirms the
unique owner-bound anchor, checks that the new source identity is globally
absent, and matches the owner preimage. SQL independently rechecks critical
schema, identity/date/hash, page/target and unknown-clinical-start invariants.

One fixed-column `INSERT` follows. A repeated insert raises an error, even if the
caller refreshes the preimage. The generator does not silently upsert or treat a
duplicate as success. It requires exactly one inserted row, verifies that its
complete stored content matches the reviewed row, then rehashes all existing
owner documents and all existing documents belonging to any owner, excluding
only the newly returned UUID. A changed, removed or added existing document,
unexpected insert rewrite or suppressed insert aborts the entire transaction.

There are no `UPDATE`, `DELETE`, DDL, personal-goal, laboratory-result,
prescription, consumption or water writes in the generated SQL. The fixture's
DDL exists only to create/reset disposable test tables. Database triggers,
policies, extension behavior and grants remain outside this generator's
authority. Independently review the generated SQL, private manifest, actual
schema, privileges and trigger side effects before any authorized execution.
The postguard fingerprints document rows; it cannot certify unrelated tables
against arbitrary production triggers. Do not run with a session that hides
document rows through RLS: the checks require a complete authorized table view,
including the globally unambiguous source identity and other-owner fingerprint.
No privilege or RLS changes are made here.

## Run tests

The dependency-free builder tests run with Node 22 or later:

```sh
node --test supabase/tests/nutrition-document-builder-test.mjs
```

The integration tests require a disposable local PostgreSQL **17** database,
`psql`, and explicit synthetic-only opt-in. They refuse non-loopback hosts,
different database names, unexpected server versions, host-address and
connection-service overrides. Only literal loopback IPs and the fixed fake test
credential are accepted; inherited libpq options are not forwarded to `psql`.
They reset the synthetic tables and must never target real data.

```sh
NUTRITION_DOCUMENT_SYNTHETIC_TEST=1 PGHOST=127.0.0.1 PGPORT=5432 \
PGDATABASE=nutrition_document_test PGUSER=postgres PGPASSWORD=synthetic-ci-only \
node --test supabase/tests/nutrition-document-postgres-test.mjs
```

`.github/workflows/health-nutrition-document-test.yml` supplies the isolated
PostgreSQL 17 service and runs both suites. It exercises successful insertion,
exact scope preservation, explicit rollback, repeated inserts, changed preimages,
wrong/missing/ambiguous owners and anchors, existing other-owner source IDs,
malformed SQL-side manifests and inert hostile text. Synthetic triggers test
rollback after changes to existing owner/other-owner documents, extra inserted
rows, suppressed insertion and mutation of the new row. Goals, results,
prescriptions, consumption and water sentinel tables remain unchanged.

Passing CI demonstrates the generic script against this synthetic schema, not
that a private manifest is accurate or that production authorization was granted.
Independent code and source review remains required before real execution.
