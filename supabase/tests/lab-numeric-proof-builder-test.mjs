import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { buildLabNumericProofSql } from './support/lab-numeric-proof-sql.mjs';

// Every identifier, document reference and result in these fixtures is invented.
const ownerId = '00000000-0000-0000-0000-000000000099';
function fixture() {
  return {
    ownerId,
    targets: Array.from({ length: 15 }, (_, index) => {
      const n = index + 1;
      const before = {
        id: `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`, user_id: ownerId,
        source_record_id: `synthetic-lab-${n}`, biomarker: `Synthetic marker ${n}`,
        collection_date: '2025-01-15', result_raw: `${n},5 (2)`, result_numeric: n + 0.5,
        unit: 'synthetic-unit', method: 'Synthetic retained method',
        reference_range: 'Synthetic retained reference', flag: null, notes: 'Synthetic only',
        source_payload: {
          numeric_kind: 'exact', retained: { nested: [n, true, null, 'invented'] },
          method_verification: { audit_id: 'synthetic-existing-method' },
          reference_verification: { audit_id: 'synthetic-existing-reference' },
        },
      };
      const after = structuredClone(before);
      after.source_payload.numeric_reading_verification = {
        schema: 'documentary_numeric_reading_v1', status: 'source_verified',
        audit_id: `synthetic-numeric-proof-${n}`, evidence_text: `Invented evidence ${n}`,
      };
      return { before, after };
    }),
  };
}
const decodeManifest = sql => JSON.parse(Buffer.from(sql.match(/decode\('([A-Za-z0-9+/=]+)', 'base64'\)/)[1], 'base64').toString('utf8'));

test('encodes exactly 15 complete synthetic pairs without changing the manifest', () => {
  const manifest = fixture();
  const original = structuredClone(manifest);
  const sql = buildLabNumericProofSql(manifest);
  assert.deepEqual(manifest, original);
  assert.deepEqual(decodeManifest(sql), original);
  assert.match(sql, /^-- PRIVATE/);
  assert.match(sql, /BEGIN;[\s\S]*COMMIT;\s*$/);
});

test('generated SQL writes only one JSON key in one column and has no destructive/schema operations', () => {
  const sql = buildLabNumericProofSql(fixture()).replace(/^--.*$/gm, '');
  const assignments = [...sql.matchAll(/\bUPDATE public\.health_lab_results AS lab\s+SET ([\s\S]*?)\s+WHERE/g)];
  assert.equal(assignments.length, 1);
  assert.equal(assignments[0][1], "source_payload = jsonb_set(lab.source_payload, '{numeric_reading_verification}', target->'after'->'source_payload'->'numeric_reading_verification', true)");
  assert.doesNotMatch(sql, /\b(?:INSERT\s+INTO|DELETE\s+FROM|CREATE\s+(?:TABLE|FUNCTION|TRIGGER|RULE)|ALTER\s|DROP\s|TRUNCATE\s|GRANT\s|DISABLE\s|SECURITY\s+DEFINER)\b/i);
  assert.match(sql, /lab\.id = row_id AND lab\.user_id = owner_id AND to_jsonb\(lab\) = target->'before'/);
});

test('DDL and all-row preflight precede every update, and postimages are checked afterward', () => {
  const sql = buildLabNumericProofSql(fixture());
  const tableLock = sql.indexOf('LOCK TABLE public.health_lab_results IN SHARE ROW EXCLUSIVE MODE;');
  const triggerGuard = sql.indexOf('FROM pg_trigger');
  const ruleGuard = sql.indexOf('FROM pg_rewrite');
  const rowLock = sql.indexOf('FOR UPDATE;');
  const allLocked = sql.indexOf('IF locked_count <> 15');
  const update = sql.indexOf('UPDATE public.health_lab_results AS lab');
  const postcheck = sql.indexOf('Numeric proof exact postcondition failed');
  assert.ok(tableLock >= 0 && tableLock < triggerGuard && triggerGuard < rowLock && ruleGuard < rowLock);
  assert.ok(rowLock < allLocked && allLocked < update && update < postcheck);
  assert.match(sql, /ORDER BY \(value->'before'->>'id'\)::uuid LOOP/g);
  assert.match(sql, /current_row IS NOT DISTINCT FROM target->'after' THEN CONTINUE/);
});

test('rejects wrong counts, duplicate IDs, wrong owners, identities and extra envelope fields', () => {
  const mutations = [
    m => { m.targets.pop(); }, m => { m.targets.push(structuredClone(m.targets[0])); },
    m => { m.targets[14] = structuredClone(m.targets[0]); },
    m => { m.ownerId = ''; }, m => { m.ownerId = "'; COMMIT; --"; },
    m => { m.ownerId = m.ownerId.toUpperCase().replace('99', 'AB'); },
    m => { m.targets[14].before.user_id = '00000000-0000-0000-0000-000000000098'; },
    m => { m.targets[14].after.id = m.targets[0].before.id; },
    m => { m.targets[0].before.id = m.targets[0].after.id = 'invalid'; },
    m => { m.targets[0].after.user_id = null; },
    m => { m.targets[0].extra = 'unexpected'; }, m => { m.table = 'another_table'; },
    m => { delete m.targets[0].before.source_payload; },
    m => { delete m.targets[0].after; }, m => { m.targets = {}; },
  ];
  for (const mutate of mutations) {
    const manifest = fixture(); mutate(manifest);
    assert.throws(() => buildLabNumericProofSql(manifest), TypeError);
  }
});

test('rejects changes to every original row field, including clinical numeric and documentary fields', () => {
  const fields = Object.keys(fixture().targets[0].before).filter(key => key !== 'source_payload');
  for (const field of fields) {
    const manifest = fixture();
    manifest.targets[14].after[field] = field === 'result_numeric' ? 999 : 'Synthetic changed value';
    assert.throws(() => buildLabNumericProofSql(manifest), TypeError, `Must reject ${field}`);
  }
  for (const mutate of [
    m => { delete m.targets[0].after.notes; },
    m => { m.targets[0].after.new_column = null; },
    m => { m.targets[0].after.source_payload.retained.nested[0] = 999; },
    m => { delete m.targets[0].after.source_payload.method_verification; },
    m => { m.targets[0].after.source_payload.reference_verification.audit_id = 'changed'; },
    m => { m.targets[0].after.source_payload.numeric_kind = 'censored'; },
    m => { m.targets[0].after.source_payload.another_key = null; },
  ]) {
    const manifest = fixture(); mutate(manifest);
    assert.throws(() => buildLabNumericProofSql(manifest), /only addition/);
  }
});

test('an existing proof, even null, and non-object payloads fail closed', () => {
  for (const value of [null, {}, { schema: 'old' }]) {
    const manifest = fixture();
    manifest.targets[0].before.source_payload.numeric_reading_verification = value;
    assert.throws(() => buildLabNumericProofSql(manifest), /must be absent/);
  }
  for (const field of ['before', 'after']) for (const value of [null, [], 'synthetic', false]) {
    const manifest = fixture(); manifest.targets[0][field].source_payload = value;
    assert.throws(() => buildLabNumericProofSql(manifest), /must be an object/);
  }
});

test('requires the documentary proof envelope while leaving source verification to independent review', () => {
  for (const mutate of [
    p => { p.schema = 'documentary_numeric_reading_v2'; }, p => { delete p.schema; },
    p => { p.status = 'inferred'; }, p => { p.audit_id = ''; },
    p => { p.audit_id = ' \n\t'; }, p => { p.audit_id = 'x'.repeat(161); },
    p => { p.audit_id = 7; },
  ]) {
    const manifest = fixture(); mutate(manifest.targets[0].after.source_payload.numeric_reading_verification);
    assert.throws(() => buildLabNumericProofSql(manifest), /invalid proof/);
  }
  for (const value of [undefined, null, [], 'synthetic']) {
    const manifest = fixture(); manifest.targets[0].after.source_payload.numeric_reading_verification = value;
    assert.throws(() => buildLabNumericProofSql(manifest), TypeError);
  }
});

test('accepts JSON key reordering and preserves SQL-looking text only as inert encoded data', () => {
  const manifest = fixture();
  const text = "Synthetic café 🧪 ' \\ ; $lab_numeric_proof$; COMMIT; DROP TABLE public.health_lab_results; --\n";
  manifest.targets[0].before.notes = manifest.targets[0].after.notes = text;
  manifest.targets[0].after.source_payload.numeric_reading_verification.evidence_text = text;
  manifest.targets[0].after = Object.fromEntries(Object.entries(manifest.targets[0].after).reverse());
  const sql = buildLabNumericProofSql(manifest);
  assert.equal(sql.includes(text), false);
  assert.deepEqual(decodeManifest(sql), manifest);
});

test('rejects lossy JSON, hidden fields, getters, prototypes, cycles and sparse arrays', () => {
  for (const value of [undefined, NaN, Infinity, -Infinity, -0, Number.MAX_SAFE_INTEGER + 1, 1n, () => {}, Symbol('synthetic'), new Date(), '\0', '\ud800']) {
    const manifest = fixture(); manifest.targets[0].after.source_payload.numeric_reading_verification.extra = value;
    assert.throws(() => buildLabNumericProofSql(manifest), TypeError);
  }
  const mutations = [
    p => { p.extra = p; },
    p => { p.extra = new Array(2); },
    p => { p.extra = []; p.extra.other = true; },
    p => { p[Symbol('synthetic')] = 1; },
    p => { Object.defineProperty(p, 'hidden', { value: 1 }); },
    p => { Object.defineProperty(p, 'getter', { enumerable: true, get() { throw new Error('Must never run'); } }); },
    p => { Object.setPrototypeOf(p, { unreviewed: true }); },
    p => { p.extra = new (class SyntheticArray extends Array { toJSON() { throw new Error('Must never run'); } })(); },
  ];
  for (const mutate of mutations) {
    const manifest = fixture(); mutate(manifest.targets[0].after.source_payload.numeric_reading_verification);
    assert.throws(() => buildLabNumericProofSql(manifest), TypeError);
  }
});

test('PostgreSQL runner refuses unsafe connection settings before invoking any client', () => {
  const script = new URL('./lab-numeric-proof-postgres-test.mjs', import.meta.url).pathname;
  const safe = {
    PATH: '/nonexistent-synthetic-no-client', LAB_NUMERIC_PROOF_SYNTHETIC_TEST: '1',
    PGDATABASE: 'lab_numeric_proof_test', PGHOST: '127.0.0.1', PGPORT: '5432',
    PGUSER: 'postgres', PGPASSWORD: 'synthetic-ci-only',
  };
  for (const [override, message] of [
    [{ LAB_NUMERIC_PROOF_SYNTHETIC_TEST: '' }, /Explicit synthetic-test opt-in required/],
    [{ PGDATABASE: 'synthetic-unapproved-database' }, /Disposable test database required/],
    [{ PGHOST: 'example.invalid' }, /Literal loopback test server required/],
    [{ PGUSER: 'synthetic-app-role' }, /Expected disposable CI role/],
    [{ PGPASSWORD: 'synthetic-unapproved-password' }, /Only disposable synthetic credentials/],
    [{ PGHOSTADDR: '127.0.0.1' }, /Connection host\/service overrides/],
    [{ PGSERVICE: 'synthetic-service' }, /Connection host\/service overrides/],
    [{ PGSERVICEFILE: '/synthetic-service-file' }, /Connection host\/service overrides/],
    [{ PGPORT: '0' }, /Invalid test port/],
    [{ PGPORT: '65536' }, /Invalid test port/],
  ]) {
    const result = spawnSync(process.execPath, [script], { env: { ...safe, ...override }, encoding: 'utf8', timeout: 10_000 });
    assert.ifError(result.error);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, message);
    assert.doesNotMatch(result.stderr, /spawnSync psql|ENOENT/, 'Unsafe settings must fail before attempting psql');
  }
});

test('rejects excessive nesting and oversized payloads without leaking supplied text in errors', () => {
  const manifest = fixture();
  const marker = 'synthetic-private-error-marker';
  manifest.targets[0].after.notes = marker;
  assert.throws(() => buildLabNumericProofSql(manifest), error => !error.message.includes(marker));
  const large = fixture(); large.targets[0].after.source_payload.numeric_reading_verification.extra = 'x'.repeat(2_000_001);
  assert.throws(() => buildLabNumericProofSql(large), /too large/);
  const deep = fixture(); let cursor = deep.targets[0].after.source_payload.numeric_reading_verification;
  for (let index = 0; index < 55; index++) cursor = cursor.extra = {};
  assert.throws(() => buildLabNumericProofSql(deep), /too deep/);
});

test('source and CI remain generic, offline from real services and free of real document identifiers', () => {
  const source = readFileSync(new URL('./support/lab-numeric-proof-sql.mjs', import.meta.url), 'utf8');
  const pgTest = readFileSync(new URL('./lab-numeric-proof-postgres-test.mjs', import.meta.url), 'utf8');
  const workflow = readFileSync(new URL('../../.github/workflows/health-lab-numeric-proof.yml', import.meta.url), 'utf8');
  for (const text of [source, pgTest, workflow]) {
    assert.doesNotMatch(text, /https?:\/\/[^\s'"<>]+|\b(?:sb_secret_|sb_publishable_|eyJ)[A-Za-z0-9_-]{16,}|\bfile_[a-f0-9]{20,}\b/i);
  }
  assert.doesNotMatch(source, /\b(?:fetch|createClient|spawnSync|execSync|writeFileSync)\s*\(/);
  assert.doesNotMatch(workflow, /secrets\.|upload-artifact|deploy|contents:\s*write|pull_request_target/i);
  assert.match(workflow, /image: postgres:17/);
  assert.match(workflow, /contents: read/);
  assert.match(pgTest, /Literal loopback test server required/);
  assert.match(pgTest, /public schema must be empty/);
});
