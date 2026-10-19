import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { buildLabNumericProofSql } from './support/lab-numeric-proof-sql.mjs';

// These fixtures contain invented values only. Run in the disposable PG17 CI
// service, never with an application connection, saved account or source PDF.
// No local server is started and no software is installed by this test runner.
assert.equal(process.env.LAB_NUMERIC_PROOF_SYNTHETIC_TEST, '1', 'Explicit synthetic-test opt-in required');
assert.equal(process.env.PGDATABASE, 'lab_numeric_proof_test', 'Disposable test database required');
assert.ok(['127.0.0.1', '::1'].includes(process.env.PGHOST), 'Literal loopback test server required');
assert.equal(process.env.PGUSER, 'postgres', 'Expected disposable CI role');
assert.equal(process.env.PGPASSWORD, 'synthetic-ci-only', 'Only disposable synthetic credentials are accepted');
assert.ok(!process.env.PGHOSTADDR && !process.env.PGSERVICE && !process.env.PGSERVICEFILE, 'Connection host/service overrides are forbidden');
assert.ok(/^[0-9]{1,5}$/.test(process.env.PGPORT ?? '5432') && Number(process.env.PGPORT ?? '5432') >= 1 && Number(process.env.PGPORT ?? '5432') <= 65535, 'Invalid test port');

// Do not forward inherited libpq, psql or application connection settings.
const psqlEnv = {
  PATH: process.env.PATH, LANG: 'C.UTF-8',
  PGHOST: process.env.PGHOST, PGPORT: process.env.PGPORT ?? '5432',
  PGDATABASE: 'lab_numeric_proof_test', PGUSER: 'postgres', PGPASSWORD: 'synthetic-ci-only',
  PGCONNECT_TIMEOUT: '5', PGSSLMODE: 'disable', PGPASSFILE: '/dev/null',
  PGAPPNAME: 'synthetic-lab-numeric-proof-tests',
};

function run(sql, success = true) {
  const result = spawnSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=terse', '-At', '-q'], {
    input: `SET timezone='UTC'; SET datestyle='ISO, YMD';\n${sql}`,
    env: psqlEnv, encoding: 'utf8', timeout: 45_000, maxBuffer: 8_000_000,
  });
  assert.ifError(result.error);
  if (success) assert.equal(result.status, 0, result.stderr);
  else assert.notEqual(result.status, 0, 'A guarded transaction unexpectedly committed');
  return result;
}
assert.equal(run("SELECT current_setting('server_version_num')::integer / 10000;").stdout.trim(), '17', 'PostgreSQL 17 is required');
assert.equal(run('SELECT current_database();').stdout.trim(), 'lab_numeric_proof_test');
assert.equal(run("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public';").stdout.trim(), '0', 'Disposable public schema must be empty before any fixture DDL');
assert.equal(run("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public';").stdout.trim(), '0', 'Disposable public schema must have no preexisting functions');

const ownerId = '00000000-0000-0000-0000-000000000099';
const otherOwner = '00000000-0000-0000-0000-000000000098';
const idFor = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const encode = value => Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
const json = sql => JSON.parse(run(sql).stdout.trim());

function syntheticRow(n, userId = ownerId) {
  return {
    id: idFor(n), user_id: userId, source_record_id: `synthetic-lab-${n}`,
    biomarker: `Synthetic marker ${n}`, collection_date: '2025-01-15', report_date: '2025-01-16',
    result_raw: `${n},5 (2)`, result_numeric: n + 0.5, unit: 'synthetic-unit',
    method: 'Synthetic retained method', laboratory: 'Synthetic laboratory',
    source: 'Synthetic fixture', source_file: 'synthetic.pdf', flag: null,
    confidence: 'synthetic', notes: 'Synthetic only', created_at: '2025-01-16T00:00:00+00:00',
    reference_range: 'Synthetic retained reference',
    source_payload: {
      numeric_kind: 'exact', pdf_page: n, library_file_id: 'synthetic-library-item',
      retained: { nested: [n, true, null, 'invented'] },
      method_verification: { audit_id: 'synthetic-existing-method' },
      reference_verification: { audit_id: 'synthetic-existing-reference' },
    },
  };
}

function snapshot() {
  return {
    labs: json("SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id, t.source_record_id), '[]'::jsonb) FROM public.health_lab_results t;"),
    sidecar: json("SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM public.synthetic_untouched t;"),
    references: json("SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM public.synthetic_payload_ref t;"),
  };
}
const versions = () => json('SELECT jsonb_object_agg(id::text, xmin::text) FROM public.health_lab_results;');

function prepare() {
  // Initial empty-schema guard above makes this an owned disposable fixture.
  // Never drop a whole schema or use CASCADE against an unknown database.
  run(`DROP TABLE IF EXISTS public.synthetic_payload_ref;
    DROP TABLE IF EXISTS public.health_lab_results;
    DROP TABLE IF EXISTS public.synthetic_untouched;
    CREATE TABLE public.health_lab_results (
      id uuid PRIMARY KEY, user_id uuid NOT NULL, source_record_id text UNIQUE NOT NULL,
      biomarker text, collection_date date, report_date date, result_raw text, result_numeric numeric,
      unit text, method text, laboratory text, source text, source_file text, flag text, confidence text,
      notes text, created_at timestamptz, reference_range text, source_payload jsonb
    );
    CREATE TABLE public.synthetic_untouched (id text PRIMARY KEY, value jsonb NOT NULL);
    CREATE TABLE public.synthetic_payload_ref (id integer PRIMARY KEY, payload jsonb NOT NULL);
    INSERT INTO public.synthetic_untouched VALUES ('synthetic-retained', '{"nested":[1,true,null]}'::jsonb);`);
  const rows = Array.from({ length: 17 }, (_, index) => syntheticRow(index + 1, index === 16 ? otherOwner : ownerId));
  run(`INSERT INTO public.health_lab_results SELECT (jsonb_populate_record(NULL::public.health_lab_results, value)).*
    FROM jsonb_array_elements(convert_from(decode('${encode(rows)}', 'base64'), 'UTF8')::jsonb);`);
  const beforeRows = snapshot().labs.filter(row => row.id <= idFor(15));
  assert.equal(beforeRows.length, 15);
  return {
    ownerId,
    targets: beforeRows.map((before, index) => {
      const after = structuredClone(before);
      after.source_payload.numeric_reading_verification = {
        schema: 'documentary_numeric_reading_v1', status: 'source_verified',
        audit_id: `synthetic-numeric-proof-${index + 1}`, evidence_text: `Invented evidence ${index + 1}`,
      };
      return { before, after };
    }),
  };
}

function failWithoutChange(sql, errorPattern) {
  assert.ok(errorPattern instanceof RegExp, 'Name the intended guard in every rejection test');
  const before = snapshot();
  const beforeVersions = versions();
  const result = run(sql, false);
  assert.doesNotMatch(result.stderr, /syntax error at|does not exist|could not connect|connection to server/, 'Compilation/connection failures do not count as passing guards');
  assert.match(result.stderr, errorPattern);
  assert.deepEqual(snapshot(), before, 'Rejected proposals must leave every fixture table unchanged');
  assert.deepEqual(versions(), beforeVersions, 'Rejected proposals must leave row versions unchanged');
}

function tamper(sql, mutate) {
  // Test-only corruption proves SQL checks scope independently of JavaScript.
  return sql.replace(/decode\('([A-Za-z0-9+/=]+)', 'base64'\)/, (_, encoded) => {
    const manifest = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    mutate(manifest);
    return `decode('${encode(manifest)}', 'base64')`;
  });
}

test('exactly 15 proof additions preserve every result, metadata field, other row and table', () => {
  const manifest = prepare();
  const before = snapshot();
  const previousVersions = versions();
  const result = run(buildLabNumericProofSql(manifest));
  assert.match(result.stderr, /15 rows updated; 15 exact postimages verified/);
  const after = snapshot();
  assert.deepEqual(after.labs.slice(0, 15), manifest.targets.map(target => target.after));
  assert.deepEqual(after.labs.slice(15), before.labs.slice(15));
  assert.deepEqual(after.sidecar, before.sidecar);
  assert.deepEqual(after.references, before.references);
  assert.equal(after.labs.length, 17);
  for (const row of after.labs.slice(0, 15)) {
    const stripped = structuredClone(row);
    delete stripped.source_payload.numeric_reading_verification;
    assert.deepEqual(stripped, before.labs.find(old => old.id === row.id));
  }
  const nextVersions = versions();
  for (const row of before.labs) assert.equal(nextVersions[row.id] !== previousVersions[row.id], row.id <= idFor(15));
});

test('replaying exact postimages performs zero updates, including unchanged xmin', () => {
  const manifest = prepare();
  const sql = buildLabNumericProofSql(manifest);
  run(sql);
  const before = snapshot(); const beforeVersions = versions();
  const result = run(sql);
  assert.match(result.stderr, /0 rows updated; 15 exact postimages verified/);
  assert.deepEqual(snapshot(), before);
  assert.deepEqual(versions(), beforeVersions);
});

test('mixed exact before/after states converge, with no rewrite of the already-applied subset', () => {
  const manifest = prepare();
  const first = manifest.targets[0];
  run(`UPDATE public.health_lab_results SET source_payload=convert_from(decode('${encode(first.after.source_payload)}', 'base64'),'UTF8')::jsonb WHERE id='${first.before.id}';`);
  const firstVersion = versions()[first.before.id];
  assert.match(run(buildLabNumericProofSql(manifest)).stderr, /14 rows updated/);
  assert.equal(versions()[first.before.id], firstVersion);
  assert.deepEqual(snapshot().labs.slice(0, 15), manifest.targets.map(target => target.after));
});

test('a conflict on the last target aborts all 15 before the first write', () => {
  const manifest = prepare();
  run(`UPDATE public.health_lab_results SET notes='Synthetic concurrent edit' WHERE id='${idFor(15)}';`);
  failWithoutChange(buildLabNumericProofSql(manifest), /full-row preimage conflict/);
});

test('wrong-owner, nonexistent-owner and missing-last-row proposals fail closed', () => {
  let manifest = prepare();
  run(`UPDATE public.health_lab_results SET user_id='${otherOwner}' WHERE id='${idFor(15)}';`);
  failWithoutChange(buildLabNumericProofSql(manifest), /missing or owned by another user/);
  manifest = prepare();
  manifest.ownerId = '00000000-0000-0000-0000-000000000097';
  for (const target of manifest.targets) target.before.user_id = target.after.user_id = manifest.ownerId;
  failWithoutChange(buildLabNumericProofSql(manifest), /missing or owned by another user/);
  manifest = prepare();
  run(`DELETE FROM public.health_lab_results WHERE id='${idFor(15)}';`);
  failWithoutChange(buildLabNumericProofSql(manifest), /missing or owned by another user/);
});

test('incomplete or extra-field snapshots and later edits to an applied proof are conflicts', () => {
  for (const mutate of [
    target => { delete target.before.notes; delete target.after.notes; },
    target => { target.before.unknown_column = target.after.unknown_column = null; },
  ]) {
    const manifest = prepare(); mutate(manifest.targets[14]);
    failWithoutChange(buildLabNumericProofSql(manifest), /full-row preimage conflict/);
  }
  const manifest = prepare(); const sql = buildLabNumericProofSql(manifest); run(sql);
  run(`UPDATE public.health_lab_results SET source_payload=jsonb_set(source_payload,'{numeric_reading_verification,audit_id}','"synthetic-later-review"'::jsonb) WHERE id='${idFor(15)}';`);
  failWithoutChange(sql, /full-row preimage conflict/);
});

test('an ambiguous target ID in a schema without its primary key is rejected', () => {
  const manifest = prepare();
  const duplicate = syntheticRow(15, otherOwner);
  duplicate.source_record_id = 'synthetic-duplicate-identity';
  run(`ALTER TABLE public.health_lab_results DROP CONSTRAINT health_lab_results_pkey;
    INSERT INTO public.health_lab_results SELECT (jsonb_populate_record(NULL::public.health_lab_results,
      convert_from(decode('${encode(duplicate)}', 'base64'), 'UTF8')::jsonb)).*;`);
  failWithoutChange(buildLabNumericProofSql(manifest), /target ID is not globally unique/);
});

test('SQL independently rejects corrupted envelopes, owners, counts and duplicate IDs', () => {
  const cases = [
    [m => { m.targets.pop(); }, /Exactly 15/],
    [m => { m.targets.push(structuredClone(m.targets[0])); }, /Exactly 15/],
    [m => { m.targets = {}; }, /Invalid numeric proof manifest/],
    [m => { m.ownerId = "'; COMMIT; --"; }, /Invalid numeric proof manifest/],
    [m => { delete m.ownerId; }, /Invalid numeric proof manifest/],
    [m => { m.extra = true; }, /Invalid numeric proof manifest/],
    [m => { m.targets[14] = structuredClone(m.targets[0]); }, /Duplicate numeric proof target/],
    [m => { m.targets[14].extra = true; }, /Invalid numeric proof target/],
    [m => { m.targets[14].before = null; }, /Invalid numeric proof target/],
    [m => { m.targets[14].before.id = 'invalid'; }, /owner or row identity mismatch/],
    [m => { m.targets[14].after.user_id = otherOwner; }, /owner or row identity mismatch/],
  ];
  for (const [mutate, guard] of cases) {
    const manifest = prepare();
    failWithoutChange(tamper(buildLabNumericProofSql(manifest), mutate), guard);
  }
});

test('SQL rejects every widened column/payload change and invalid proof envelope', () => {
  const cases = [
    ...['result_raw', 'result_numeric', 'unit', 'method', 'reference_range', 'flag', 'notes', 'source_file', 'created_at'].map(field => [m => { m.targets[14].after[field] = 'Synthetic forbidden edit'; }, /exceeds the one-key scope/]),
    [m => { m.targets[14].after.source_payload.numeric_kind = 'censored'; }, /exceeds the one-key scope/],
    [m => { delete m.targets[14].after.source_payload.method_verification; }, /exceeds the one-key scope/],
    [m => { m.targets[14].after.source_payload.retained.nested[0] = 999; }, /exceeds the one-key scope/],
    [m => { m.targets[14].before.source_payload.numeric_reading_verification = null; }, /key must be new/],
    [m => { m.targets[14].before.source_payload = null; }, /key must be new/],
    [m => { delete m.targets[14].after.source_payload.numeric_reading_verification; }, /key must be new/],
    [m => { m.targets[14].after.source_payload.numeric_reading_verification = null; }, /Invalid numeric proof schema/],
    ...['schema', 'status', 'audit_id'].map(field => [m => { m.targets[14].after.source_payload.numeric_reading_verification[field] = ''; }, /Invalid numeric proof schema/]),
    [m => { m.targets[14].after.source_payload.numeric_reading_verification.audit_id = 'x'.repeat(161); }, /Invalid numeric proof schema/],
  ];
  for (const [mutate, guard] of cases) {
    const manifest = prepare();
    failWithoutChange(tamper(buildLabNumericProofSql(manifest), mutate), guard);
  }
});

test('active and disabled user triggers are refused before their side effects can run', () => {
  for (const disabled of [false, true]) {
    const manifest = prepare();
    run(`CREATE OR REPLACE FUNCTION public.synthetic_numeric_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN UPDATE public.synthetic_untouched SET value='"synthetic-forbidden-trigger"'::jsonb; RETURN NEW; END $$;
      CREATE TRIGGER synthetic_numeric_hook AFTER UPDATE ON public.health_lab_results FOR EACH ROW EXECUTE FUNCTION public.synthetic_numeric_trigger();
      ${disabled ? 'ALTER TABLE public.health_lab_results DISABLE TRIGGER synthetic_numeric_hook;' : ''}`);
    failWithoutChange(buildLabNumericProofSql(manifest), /User triggers present/);
  }
});

test('active and disabled rewrite rules are refused before their side effects can run', () => {
  for (const disabled of [false, true]) {
    const manifest = prepare();
    run(`CREATE RULE synthetic_numeric_rule AS ON UPDATE TO public.health_lab_results DO ALSO
      INSERT INTO public.synthetic_untouched VALUES ('synthetic-rule', '{"forbidden":true}'::jsonb);
      ${disabled ? 'ALTER TABLE public.health_lab_results DISABLE RULE synthetic_numeric_rule;' : ''}`);
    failWithoutChange(buildLabNumericProofSql(manifest), /Rewrite rules present/);
  }
});

test('internal foreign-key cascades involving source_payload are rejected before writing', () => {
  const manifest = prepare();
  run(`ALTER TABLE public.health_lab_results ADD CONSTRAINT synthetic_payload_unique UNIQUE (source_payload);
    ALTER TABLE public.synthetic_payload_ref ADD CONSTRAINT synthetic_payload_fk FOREIGN KEY (payload)
      REFERENCES public.health_lab_results (source_payload) ON UPDATE CASCADE;
    INSERT INTO public.synthetic_payload_ref SELECT 1, source_payload FROM public.health_lab_results WHERE id='${idFor(1)}';`);
  assert.equal(run("SELECT count(*) FROM pg_trigger WHERE tgrelid='public.health_lab_results'::regclass AND NOT tgisinternal;").stdout.trim(), '0');
  failWithoutChange(buildLabNumericProofSql(manifest), /Foreign keys involving the numeric proof payload/);
});

test('SQL-looking text remains inert and preserves Unicode and literal punctuation exactly', () => {
  const manifest = prepare();
  const text = "Synthetic café 🧪 ' \\ ; $lab_numeric_proof$; COMMIT; DROP TABLE public.health_lab_results; --\n";
  manifest.targets[0].after.source_payload.numeric_reading_verification.evidence_text = text;
  run(buildLabNumericProofSql(manifest));
  assert.deepEqual(snapshot().labs.slice(0, 15), manifest.targets.map(target => target.after));
});

test('explicit transaction rollback leaves all fixture content and row versions unchanged', () => {
  const manifest = prepare();
  const before = snapshot(); const beforeVersions = versions();
  run(buildLabNumericProofSql(manifest).replace(/COMMIT;\s*$/, 'ROLLBACK;\n'));
  assert.deepEqual(snapshot(), before);
  assert.deepEqual(versions(), beforeVersions);
});
