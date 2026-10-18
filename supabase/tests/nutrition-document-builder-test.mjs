import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildNutritionPlanInsertSql } from './support/nutrition-plan-insert.mjs';
import { syntheticManifest } from './support/nutrition-document-fixture.mjs';

test('builds one bounded transactional insert without database calls or dynamic SQL', () => {
  const manifest = syntheticManifest();
  const before = structuredClone(manifest);
  const sql = buildNutritionPlanInsertSql(manifest);
  assert.deepEqual(manifest, before);
  assert.match(sql, /BEGIN;[\s\S]*LOCK TABLE public\.health_documents IN SHARE ROW EXCLUSIVE MODE;[\s\S]*COMMIT;/);
  assert.equal((sql.match(/INSERT INTO public\.health_documents/g) ?? []).length, 1);
  assert.doesNotMatch(sql.replace(/^--.*$/gm, ''), /\b(?:UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|EXECUTE|ON CONFLICT)\b/);
  assert.doesNotMatch(sql, /health_personal_goals|health_lab_results|health_medication_prescriptions|health_daily_nutrition|health_source_daily_metrics/);
  assert.match(sql, /WHERE d\.id <> inserted_id/);
});

test('serializes Unicode, quotes, backslashes, dollar tags and SQL-looking text as inert JSON', () => {
  const manifest = syntheticManifest();
  manifest.newRow.title = "Synthetic café 🥕 ' \\ ; $nutrition_document_insert$; DROP TABLE public.health_documents; --";
  manifest.newRow.notes = "'); COMMIT; SELECT 'inert'; --\nsecond line";
  const sql = buildNutritionPlanInsertSql(manifest);
  const encoded = sql.match(/decode\('([A-Za-z0-9+/=]+)', 'base64'\)/)?.[1];
  assert.ok(encoded);
  assert.deepEqual(JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')), manifest);
  assert.ok(!sql.includes(manifest.newRow.title));
  assert.equal((sql.match(/\$nutrition_document_insert\$/g) ?? []).length, 2);
});

test('rejects unsafe identities, extra row authority and noncanonical manifest fields', () => {
  const mutations = [
    m => { m.ownerUserId = "'; DROP TABLE public.health_documents; --"; },
    m => { m.anchorSourceRecordId = "synthetic:anchor'; SELECT 1; --"; },
    m => { m.newRow.source_record_id = 'synthetic:new\\payload'; },
    m => { m.newRow.source_record_id = m.anchorSourceRecordId; },
    m => { m.expectedDocsCount = 0; }, m => { m.expectedDocsCount = 1.1; },
    m => { m.expectedDocsCount = '2'; }, m => { m.expectedDocsHash = 'x'.repeat(32); },
    m => { m.ownerUserId = m.ownerUserId.toUpperCase().replace(/^1/, 'A'); },
    m => { m.newRow.user_id = m.ownerUserId; }, m => { m.newRow.id = m.ownerUserId; },
    m => { m.newRow.created_at = '2025-02-12'; }, m => { m.table = 'other_table'; },
    m => { m.newRow.document_type = 'medical_plan'; }, m => { m.newRow.source_file = ' '; },
    m => { m.newRow.notes = true; }, m => { delete m.newRow.source; },
  ];
  for (const mutate of mutations) {
    const manifest = syntheticManifest(); mutate(manifest);
    assert.throws(() => buildNutritionPlanInsertSql(manifest), /Nutrition document manifest:/);
  }
});

test('rejects missing or unbound projection and unsupported clinical claims', () => {
  const mutations = [
    m => { m.newRow.source_payload.nutrition_plan_ui = null; },
    m => { m.newRow.document_date = '2025-02-30'; },
    m => { m.newRow.checksum = 'b'.repeat(64); },
    m => { m.newRow.source_payload.nutrition_plan_ui.source_record_id = 'synthetic:wrong'; },
    m => { m.newRow.source_payload.nutrition_plan_ui.documented_on = '2025-02-13'; },
    m => { m.newRow.source_payload.nutrition_plan_ui.schema_version = 2; },
    m => { m.newRow.source_payload.nutrition_plan_ui.clinical_start = '2025-02-12'; },
    m => { delete m.newRow.source_payload.nutrition_plan_ui.clinical_start; },
    m => { m.newRow.source_payload.nutrition_plan_ui.clinical_start_status = 'confirmed'; },
    m => { m.newRow.source_payload.nutrition_plan_ui.verification.pages = [1]; },
    m => { m.newRow.source_payload.nutrition_plan_ui.verification.pages = [1, 3]; },
    m => { m.newRow.source_payload.nutrition_plan_ui.daily_targets.protein_g.value = 0; },
    m => { m.newRow.source_payload.nutrition_plan_ui.daily_targets.water_ml.unit = 'g'; },
    m => { m.newRow.source_payload.nutrition_plan_ui.author.signature_verified = true; },
    m => { m.newRow.source_payload.nutrition_plan_ui.alternatives[0].replaces_meal_id = 'absent'; },
    m => { m.newRow.source_payload.nutrition_plan_ui.meals = []; },
  ];
  for (const mutate of mutations) {
    const manifest = syntheticManifest(); mutate(manifest);
    assert.throws(() => buildNutritionPlanInsertSql(manifest), /Nutrition document manifest:/);
  }
});

test('rejects JSON lossy coercions, hidden serializers and invalid Unicode', () => {
  for (const bad of [undefined, NaN, Infinity, 1n, () => 1, Symbol('unsafe'), new Date(), '\0', '\ud800']) {
    const manifest = syntheticManifest(); manifest.newRow.source_payload.bad = bad;
    assert.throws(() => buildNutritionPlanInsertSql(manifest), /Nutrition document manifest:/);
  }
  const cycle = syntheticManifest(); cycle.newRow.source_payload.cycle = cycle;
  assert.throws(() => buildNutritionPlanInsertSql(cycle), /cyclic/);
  const hidden = syntheticManifest(); Object.defineProperty(hidden, 'toJSON', { value: () => ({}) });
  assert.throws(() => buildNutritionPlanInsertSql(hidden), /non-enumerable/);
  const accessor = syntheticManifest(); Object.defineProperty(accessor, 'newRow', { enumerable: true, get() { throw new Error('must not execute'); } });
  assert.throws(() => buildNutritionPlanInsertSql(accessor), /accessors/);
  const sparse = syntheticManifest(); sparse.newRow.source_payload.bad = Array(2);
  assert.throws(() => buildNutritionPlanInsertSql(sparse), /sparse/);
  const decorated = syntheticManifest(); decorated.newRow.source_payload.bad = Array(2);
  decorated.newRow.source_payload.bad[1] = 1; decorated.newRow.source_payload.bad.extra = 1;
  assert.throws(() => buildNutritionPlanInsertSql(decorated), /sparse/);
});

test('missing optional notes becomes explicit null without altering the input', () => {
  const manifest = syntheticManifest(); delete manifest.newRow.notes;
  const sql = buildNutritionPlanInsertSql(manifest);
  const encoded = sql.match(/decode\('([A-Za-z0-9+/=]+)', 'base64'\)/)[1];
  assert.equal(JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')).newRow.notes, null);
  assert.equal('notes' in manifest.newRow, false);
});

test('integration harness refuses unsafe connection settings before invoking psql', () => {
  const safe = { PATH: process.env.PATH, NUTRITION_DOCUMENT_SYNTHETIC_TEST: '1', PGHOST: '127.0.0.1', PGPORT: '5432', PGDATABASE: 'nutrition_document_test', PGUSER: 'postgres', PGPASSWORD: 'synthetic-ci-only' };
  for (const patch of [
    { NUTRITION_DOCUMENT_SYNTHETIC_TEST: '' }, { PGHOST: 'database.example.invalid' },
    { PGHOST: 'localhost' }, { PGHOSTADDR: '192.0.2.1' }, { PGDATABASE: 'postgres' },
    { PGSERVICE: 'unexpected' }, { PGSERVICEFILE: '/tmp/synthetic-service' },
    { PGUSER: 'unexpected' }, { PGPASSWORD: 'unexpected' }, { PGPORT: '5432 host=remote' },
  ]) {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('./nutrition-document-postgres-test.mjs', import.meta.url))], { env: { ...safe, ...patch }, encoding: 'utf8', timeout: 5000 });
    assert.ifError(result.error);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /AssertionError/);
    assert.doesNotMatch(result.stderr, /psql.*ENOENT|could not connect|connection to server/);
  }
});
