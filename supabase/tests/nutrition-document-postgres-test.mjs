import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { buildNutritionPlanInsertSql } from './support/nutrition-plan-insert.mjs';
import { syntheticManifest, syntheticOwner, syntheticOtherOwner } from './support/nutrition-document-fixture.mjs';

// Refuse inherited application credentials, non-loopback servers and all database
// names except the dedicated disposable CI database. Never auto-connect to live.
assert.equal(process.env.NUTRITION_DOCUMENT_SYNTHETIC_TEST, '1', 'Explicit synthetic-test opt-in required');
assert.equal(process.env.PGDATABASE, 'nutrition_document_test', 'Disposable test database required');
assert.ok(['127.0.0.1', '::1'].includes(process.env.PGHOST), 'Literal loopback test server required');
assert.equal(process.env.PGUSER, 'postgres', 'Expected disposable CI role');
assert.equal(process.env.PGPASSWORD, 'synthetic-ci-only', 'Only disposable synthetic credentials are accepted');
assert.ok(!process.env.PGHOSTADDR && !process.env.PGSERVICE && !process.env.PGSERVICEFILE, 'Connection host/service overrides are forbidden');
assert.ok(/^[0-9]{1,5}$/.test(process.env.PGPORT ?? '5432') && Number(process.env.PGPORT ?? '5432') >= 1 && Number(process.env.PGPORT ?? '5432') <= 65535, 'Invalid test port');

// Do not forward inherited libpq, psql or application connection settings.
const psqlEnv = {
  PATH: process.env.PATH, LANG: 'C.UTF-8',
  PGHOST: process.env.PGHOST, PGPORT: process.env.PGPORT ?? '5432',
  PGDATABASE: 'nutrition_document_test', PGUSER: 'postgres', PGPASSWORD: 'synthetic-ci-only',
  PGCONNECT_TIMEOUT: '5', PGSSLMODE: 'disable', PGPASSFILE: '/dev/null',
  PGAPPNAME: 'synthetic-nutrition-document-tests',
};

const fixture = readFileSync(new URL('./fixtures/nutrition-document-synthetic.sql', import.meta.url), 'utf8');
const tables = ['health_documents', 'health_personal_goals', 'health_lab_results', 'health_medication_prescriptions', 'health_daily_nutrition', 'health_source_daily_metrics'];
function run(sql, success = true) {
  const result = spawnSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-At', '-q'], {
    input: `SET timezone='UTC'; SET datestyle='ISO, YMD';\n${sql}`,
    env: psqlEnv, encoding: 'utf8', timeout: 45_000, maxBuffer: 8_000_000,
  });
  assert.ifError(result.error);
  if (success) assert.equal(result.status, 0, result.stderr);
  else assert.notEqual(result.status, 0, 'A guarded transaction unexpectedly committed');
  return result;
}
assert.equal(run("SELECT current_setting('server_version_num')::integer / 10000;").stdout.trim(), '17');
assert.equal(run('SELECT current_database();').stdout.trim(), 'nutrition_document_test');

const json = sql => JSON.parse(run(sql).stdout.trim());
function snapshot() {
  return Object.fromEntries(tables.map(table => [table, json(`SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb) FROM public.${table} t;`)]));
}
function prepare() {
  run(fixture);
  const manifest = syntheticManifest();
  const preimage = json(`SELECT jsonb_build_object('count',count(*),'hash',md5(coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.id),'[]'::jsonb)::text)) FROM public.health_documents d WHERE d.user_id='${syntheticOwner}'::uuid;`);
  manifest.expectedDocsCount = preimage.count;
  manifest.expectedDocsHash = preimage.hash;
  return manifest;
}
function failWithoutChange(sql, errorPattern) {
  const before = snapshot();
  const result = run(sql, false);
  if (errorPattern) assert.match(result.stderr, errorPattern);
  assert.deepEqual(snapshot(), before, 'Failure must roll back every synthetic data table');
}
function tamperEncodedManifest(sql, mutate) {
  // Test-only corruption of the inert manifest exercises SQL-side defense in
  // depth even when callers bypass the generator's JavaScript validation.
  return sql.replace(/decode\('([A-Za-z0-9+/=]+)', 'base64'\)/, (_, encoded) => {
    const manifest = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    mutate(manifest);
    return `decode('${Buffer.from(JSON.stringify(manifest)).toString('base64')}', 'base64')`;
  });
}

test('successful insert adds exactly one complete document and preserves all old data', () => {
  const manifest = prepare();
  const before = snapshot();
  run(buildNutritionPlanInsertSql(manifest));
  const after = snapshot();
  const inserted = after.health_documents.filter(row => row.source_record_id === manifest.newRow.source_record_id);
  assert.equal(inserted.length, 1);
  const { id, user_id, created_at, ...data } = inserted[0];
  assert.match(id, /^[0-9a-f-]{36}$/);
  assert.equal(user_id, syntheticOwner);
  assert.ok(created_at);
  assert.deepEqual(data, manifest.newRow);
  assert.deepEqual(after.health_documents.filter(row => row.id !== id), before.health_documents);
  for (const table of tables.slice(1)) assert.deepEqual(after[table], before[table]);
  assert.equal(after.health_documents.length, before.health_documents.length + 1);
});

test('repeated execution fails atomically, including after refreshing the owner preimage', () => {
  const manifest = prepare();
  const sql = buildNutritionPlanInsertSql(manifest);
  run(sql);
  failWithoutChange(sql, /source identity already exists/);
  const preimage = json(`SELECT jsonb_build_object('count',count(*),'hash',md5(coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.id),'[]'::jsonb)::text)) FROM public.health_documents d WHERE d.user_id='${syntheticOwner}'::uuid;`);
  manifest.expectedDocsCount = preimage.count;
  manifest.expectedDocsHash = preimage.hash;
  failWithoutChange(buildNutritionPlanInsertSql(manifest), /source identity already exists/);
});

test('stale count, stale hash and changed existing row reject the entire transaction', () => {
  for (const mutate of [m => { m.expectedDocsCount += 1; }, m => { m.expectedDocsHash = '0'.repeat(32); }]) {
    const manifest = prepare(); mutate(manifest);
    failWithoutChange(buildNutritionPlanInsertSql(manifest), /snapshot changed/);
  }
  const manifest = prepare();
  run("UPDATE public.health_documents SET notes='Synthetic concurrent edit' WHERE source_record_id='synthetic:existing:history';");
  failWithoutChange(buildNutritionPlanInsertSql(manifest), /snapshot changed/);
});

test('missing, wrong-owner and globally ambiguous anchors fail closed', () => {
  for (const mutate of [m => { m.ownerUserId = syntheticOtherOwner; }, m => { m.anchorSourceRecordId = 'synthetic:missing'; }, m => { m.anchorSourceRecordId = 'synthetic:other-owner:document'; }]) {
    const manifest = prepare(); mutate(manifest);
    failWithoutChange(buildNutritionPlanInsertSql(manifest), /Anchor document/);
  }
  const manifest = prepare();
  run(`INSERT INTO public.health_documents(user_id,source_record_id) VALUES ('${syntheticOtherOwner}','synthetic:existing:anchor');`);
  failWithoutChange(buildNutritionPlanInsertSql(manifest), /Anchor document/);
});

test('new source identity already used by another owner is rejected', () => {
  const manifest = prepare();
  run(`INSERT INTO public.health_documents(user_id,source_record_id) VALUES ('${syntheticOtherOwner}','synthetic:nutrition-document:new');`);
  failWithoutChange(buildNutritionPlanInsertSql(manifest), /source identity already exists/);
});

test('SQL independently rejects corrupted schema, identity, dates, hash, pages and clinical start', () => {
  const mutations = [
    m => { m.newRow.document_type = 'medical_plan'; },
    m => { m.newRow.user_id = syntheticOtherOwner; },
    m => { m.newRow.source_file = ''; },
    m => { m.newRow.document_date = '2025-02-30'; },
    m => { m.newRow.checksum = 'f'.repeat(64); },
    m => { m.newRow.source_payload.nutrition_plan_ui.source_record_id = 'synthetic:wrong'; },
    m => { m.newRow.source_payload.nutrition_plan_ui.documented_on = '2025-02-11'; },
    m => { m.newRow.source_payload.nutrition_plan_ui.received_on = '2025-02-30'; },
    m => { m.newRow.source_payload.nutrition_plan_ui.schema_version = 2; },
    m => { m.newRow.source_payload.nutrition_plan_ui.clinical_start = '2025-02-12'; },
    m => { delete m.newRow.source_payload.nutrition_plan_ui.clinical_start; },
    m => { m.newRow.source_payload.nutrition_plan_ui.clinical_start_status = 'confirmed'; },
    m => { m.newRow.source_payload.nutrition_plan_ui.verification = null; },
    m => { m.newRow.source_payload.nutrition_plan_ui.verification.pages = [1, 1]; },
    m => { m.newRow.source_payload.nutrition_plan_ui.verification.pages = [1, 3]; },
    m => { m.newRow.source_payload.nutrition_plan_ui.daily_targets.protein_g.value = -1; },
    m => { m.newRow.source_payload.nutrition_plan_ui.daily_targets.water_ml.unit = 'g'; },
    m => { m.newRow.source_payload.nutrition_plan_ui.daily_targets.fiber_g.pages = [3]; },
    m => { m.newRow.source_record_id = "synthetic:new'; DROP TABLE public.health_documents; --"; },
    m => { m.ownerUserId = "'; SELECT 1; --"; },
  ];
  for (const mutate of mutations) {
    const manifest = prepare();
    failWithoutChange(tamperEncodedManifest(buildNutritionPlanInsertSql(manifest), mutate));
  }
});

test('SQL-looking documentary text is stored exactly and cannot become executable SQL', () => {
  const manifest = prepare();
  manifest.newRow.title = "Synthetic café 🥕 ' \\ ; $nutrition_document_insert$; DROP TABLE public.health_documents; --";
  manifest.newRow.notes = "'); COMMIT; SELECT 'inert'; --\nsecond line";
  run(buildNutritionPlanInsertSql(manifest));
  const row = json("SELECT to_jsonb(d) FROM public.health_documents d WHERE source_record_id='synthetic:nutrition-document:new';");
  assert.equal(row.title, manifest.newRow.title);
  assert.equal(row.notes, manifest.newRow.notes);
  assert.equal(snapshot().health_documents.length, 4);
});

test('post-insert fingerprint detects owner and other-owner trigger changes and rolls them back', () => {
  for (const target of ['synthetic:existing:anchor', 'synthetic:other-owner:document']) {
    const manifest = prepare();
    run(`CREATE OR REPLACE FUNCTION public.synthetic_mutate_existing() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE public.health_documents SET notes='Synthetic forbidden trigger edit' WHERE source_record_id='${target}'; RETURN NEW; END $$;
      CREATE TRIGGER synthetic_mutate AFTER INSERT ON public.health_documents FOR EACH ROW EXECUTE FUNCTION public.synthetic_mutate_existing();`);
    failWithoutChange(buildNutritionPlanInsertSql(manifest), /Preexisting .*documents changed/);
  }
});

test('suppressed, mutated and extra-row inserts roll back rather than reporting success', () => {
  for (const [timing, body, error] of [
    ['BEFORE', 'RETURN NULL;', /Expected exactly one inserted document/],
    ['BEFORE', "NEW.title := 'Synthetic unauthorized rewrite'; RETURN NEW;", /differs from reviewed row/],
    ['AFTER', `IF NEW.source_record_id='synthetic:nutrition-document:new' THEN INSERT INTO public.health_documents(user_id,source_record_id) VALUES ('${syntheticOtherOwner}','synthetic:extra:trigger'); END IF; RETURN NEW;`, /Preexisting documents changed outside insert scope/],
  ]) {
    const manifest = prepare();
    run(`CREATE OR REPLACE FUNCTION public.synthetic_change_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN ${body} END $$;
      CREATE TRIGGER synthetic_change ${timing} INSERT ON public.health_documents FOR EACH ROW EXECUTE FUNCTION public.synthetic_change_insert();`);
    failWithoutChange(buildNutritionPlanInsertSql(manifest), error);
  }
});

test('explicit rollback instead of commit leaves the synthetic database unchanged', () => {
  const manifest = prepare();
  const before = snapshot();
  run(buildNutritionPlanInsertSql(manifest).replace(/COMMIT;\s*$/, 'ROLLBACK;\n'));
  assert.deepEqual(snapshot(), before);
});
