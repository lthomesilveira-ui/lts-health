# Prospective basal candidate capture: synthetic PostgreSQL tests

`health-basal-candidates-postgres-test.mjs` runs against **genuine PostgreSQL 17**. It intentionally destroys and recreates only its own disposable fixture. Before doing so it requires explicit opt-in, a literal loopback host, the exact dedicated database/user/password below, no libpq service or host overrides, and an initially empty public schema with no preexisting auth/private schema.

```sh
HEALTH_BASAL_SYNTHETIC_TEST=1 \
PGHOST=127.0.0.1 PGPORT=5432 \
PGDATABASE=health_basal_candidates_test PGUSER=postgres \
PGPASSWORD=synthetic-ci-only \
node --test supabase/tests/health-basal-candidates-postgres-test.mjs
```

Start a fresh PostgreSQL 17 instance and create the empty database first. `psql` must be on PATH. Never use a real application database or credentials. The optional `HEALTH_BASAL_TEST_LIBDIR` is only for a locally extracted official PostgreSQL package's shared-library directory.

The fixture is a **minimal synthetic dependency model**, not a full Supabase/production rebuild. It loads the repository's original source-metric table migration, exact legacy bridge functions, exact canonical nutrition boundary/server-write guards, and the new candidate migration. The legacy ingest function definition is compared byte-for-byte before and after applying the new migration. `support/basal-candidates-fixture.mjs` exposes the same bootstrap SQL without inserting connections for the HTTP integration suite.

Covered behavior:

- Private schema, RLS, invoker execution, empty search path, no frontend access, and service-role SELECT/INSERT-only candidate/receipt privileges.
- Original quantity/unit/date/source and optional timestamps preserved; source calendar date is not shifted into UTC; coverage is always false.
- Basal-only requests leave source metrics and nutrition untouched; mixed requests match the unchanged legacy nutrition projection and charge rate limits once.
- Request-level SHA-256 idempotency binds both arrays; replay is a no-op; altered receipt payload rejects atomically; distinct receipts retain repeated observations.
- SQL and JSON nulls, missing/wrong field types, unknown fields, counts, numeric/string bounds, source ownership, impossible/future dates, control characters and offset limits reject without mutation.
- Maximum 2,500-candidate batches and quantity/string boundaries succeed without aggregation.
- A deliberately injected late candidate failure rolls back prior legacy writes, receipts and rate state.
- Real simultaneous PostgreSQL connections demonstrate the shared 120/hour cap, exact-receipt replay/collision handling, and both orderings of ingest versus revoke/rotate row locks. Lock wait assertions use `pg_stat_activity`, not only timing assumptions.
- Privileged owner erasure can cascade. Runtime callers cannot update/delete/truncate evidence, but the migration does not claim to prevent privileged database administration.

No test uses production data, a production endpoint, PGlite, a mocked SQL engine, or automatic canonical promotion.
