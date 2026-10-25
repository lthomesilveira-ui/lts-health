# Synthetic PostgreSQL lab metadata check

All fixture names, values, dates and identifiers are invented. These files contain no patient data, source documents, real project identifiers, account credentials or private SQL payloads.

The apply/rollback transaction bodies match the independently reviewed proposal after replacing the entire target JSON with invented rows. Row locking, table locking, exact precondition checks, trigger/rule guards, assignments, exception paths and postconditions are unchanged.

## Available execution paths

- `bash run-local-checks.sh`: requires existing `initdb`, `pg_ctl`, `psql` and `createdb`. Creates a disposable local cluster with TCP disabled, runs the tests through a Unix socket and stops/removes the cluster. Downloads nothing.
- `health-lab-metadata-synthetic.yml`: proposed GitHub Actions workflow, to be placed in `.github/workflows/` only after publication approval. Uses the official `postgres:17` service with an invented disposable password and no external service secrets. Runs the same checks through localhost. No artifacts are uploaded.

`run-checks.sh` requires explicit `HEALTH_SYNTHETIC_PG=1`, a local host/socket, database name `synthetic_lab_review`, and an empty public schema. It refuses an existing populated schema or a remote host.

## Cases

1. Normal apply: exact expected postimages for exactly three rows
2. Apply replay: exact postimages plus unchanged row transaction versions
3. Normal rollback: exact original before-images
4. Rollback replay: unchanged row transaction versions
5. Conflicting current row: abort without partial writes
6. Later edit: rollback aborts and preserves it
7. Missing row: abort without partial writes
8. Trigger present: apply and rollback both abort without side effects
9. Rewrite rule present: apply and rollback both abort without side effects

Status at preparation: PostgreSQL execution NOT RUN. The local runtime has no PostgreSQL binaries. Shell syntax and structural/privacy checks pass; compilation and runtime behavior require the authorized CI run. No real database was modified.
