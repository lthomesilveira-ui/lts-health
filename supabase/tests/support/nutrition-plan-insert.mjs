import { documentedNutritionPlan } from '../../../preview/compact-evidence/src/documented-nutrition-plan.js';

// This is an explicitly invoked SQL generator, not a migration or a database
// client. Keep real manifests and generated SQL outside the repository and CI.
const OWNER = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SOURCE = /^[A-Za-z0-9][A-Za-z0-9:._/-]{0,239}$/;
const MD5 = /^[a-f0-9]{32}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const MANIFEST_KEYS = ['ownerUserId', 'anchorSourceRecordId', 'expectedDocsCount', 'expectedDocsHash', 'newRow'];
const ROW_KEYS = ['source_record_id', 'document_date', 'title', 'document_type', 'source_file', 'source', 'checksum', 'extraction_status', 'confidence', 'notes', 'source_payload'];
const fail = message => { throw new TypeError(`Nutrition document manifest: ${message}`); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;

function validateJson(value, seen = new Set(), depth = 0) {
  if (depth > 50) fail('JSON nesting is too deep');
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'string') {
    if (value.includes('\0') || !value.isWellFormed()) fail('invalid Unicode or NUL in text');
    return;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('non-finite JSON number');
    return;
  }
  if (typeof value !== 'object') fail('values must be plain JSON');
  if (seen.has(value)) fail('cyclic JSON');
  if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('values must be plain JSON objects');
  seen.add(value);
  if (Object.getOwnPropertySymbols(value).length) fail('symbol keys are not supported');
  if (Object.getOwnPropertyNames(value).some(key => !(Array.isArray(value) && key === 'length') && !Object.getOwnPropertyDescriptor(value, key)?.enumerable)) fail('non-enumerable JSON properties are not supported');
  for (const key of Object.keys(value)) {
    if (key.includes('\0') || !key.isWellFormed()) fail('invalid JSON key');
    const property = Object.getOwnPropertyDescriptor(value, key);
    if (!property || !('value' in property)) fail('accessors are not supported');
    validateJson(property.value, seen, depth + 1);
  }
  if (Array.isArray(value) && (Object.keys(value).length !== value.length || Object.keys(value).some((key, index) => key !== String(index)))) fail('sparse or decorated arrays are not supported');
  seen.delete(value);
}

function exactKeys(value, allowed, label) {
  if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) fail(`unsupported ${label} fields`);
}

/** Generate one guarded INSERT transaction. It never connects or executes SQL.
 * expectedDocsHash is PostgreSQL's MD5 of the canonical ordered JSONB array of
 * every existing owner document, including id and created_at (see README).
 * SQL text never contains manifest text as syntax: only a base64 JSON literal.
 */
export function buildNutritionPlanInsertSql(manifest) {
  validateJson(manifest);
  exactKeys(manifest, MANIFEST_KEYS, 'manifest');
  if (!OWNER.test(manifest.ownerUserId)) fail('ownerUserId must be a lowercase UUID');
  if (!SOURCE.test(manifest.anchorSourceRecordId)) fail('invalid anchorSourceRecordId');
  if (!Number.isSafeInteger(manifest.expectedDocsCount) || manifest.expectedDocsCount < 1) fail('expectedDocsCount must be a positive safe integer');
  if (!MD5.test(manifest.expectedDocsHash)) fail('expectedDocsHash must be lowercase MD5');
  const row = manifest.newRow;
  exactKeys(row, ROW_KEYS, 'newRow');
  for (const key of ROW_KEYS.filter(key => !['notes', 'source_payload'].includes(key))) {
    if (!nonempty(row[key])) fail(`newRow.${key} is required`);
  }
  if (!SOURCE.test(row.source_record_id) || row.source_record_id === manifest.anchorSourceRecordId) fail('new source identity must be safe and distinct');
  if (row.document_type !== 'nutrition_plan') fail('document_type must be nutrition_plan');
  if (!SHA256.test(row.checksum)) fail('checksum must be lowercase SHA256');
  if (row.notes !== undefined && row.notes !== null && typeof row.notes !== 'string') fail('notes must be text or null');
  if (!object(row.source_payload) || !documentedNutritionPlan({ ...row, nutrition_plan: row.source_payload.nutrition_plan_ui })) fail('invalid or unbound nutrition_plan_ui projection');
  const json = JSON.stringify({ ...manifest, newRow: { ...row, notes: row.notes ?? null } });
  if (Buffer.byteLength(json, 'utf8') > 2_000_000) fail('manifest is too large');
  const encoded = Buffer.from(json, 'utf8').toString('base64');
  // Base64 is limited to an alphabet that cannot terminate the SQL literal.
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) fail('invalid encoding');
  return `-- Generated one-row documentary insert. Independently review before execution.
-- No migration, DDL, UPDATE, DELETE, goal, result or prescription write.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = pg_catalog, public;
SET LOCAL timezone = 'UTC';
SET LOCAL datestyle = 'ISO, YMD';
LOCK TABLE public.health_documents IN SHARE ROW EXCLUSIVE MODE;
DO $nutrition_document_insert$
DECLARE
  manifest jsonb := convert_from(decode('${encoded}', 'base64'), 'UTF8')::jsonb;
  row_data jsonb;
  projection jsonb;
  owner_id uuid;
  inserted_id uuid;
  inserted_count bigint;
  actual_count bigint;
  actual_hash text;
  before_all_count bigint;
  before_all_hash text;
  field_name text;
  page jsonb;
BEGIN
  IF jsonb_typeof(manifest) IS DISTINCT FROM 'object'
    OR (SELECT count(*) FROM jsonb_object_keys(manifest)) <> 5
    OR NOT manifest ?& ARRAY['ownerUserId','anchorSourceRecordId','expectedDocsCount','expectedDocsHash','newRow']
    OR jsonb_typeof(manifest->'ownerUserId') IS DISTINCT FROM 'string'
    OR (manifest->>'ownerUserId') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    OR jsonb_typeof(manifest->'anchorSourceRecordId') IS DISTINCT FROM 'string'
    OR (manifest->>'anchorSourceRecordId') !~ '^[A-Za-z0-9][A-Za-z0-9:._/-]{0,239}$'
    OR jsonb_typeof(manifest->'expectedDocsCount') IS DISTINCT FROM 'number'
    OR (manifest->>'expectedDocsCount') !~ '^[1-9][0-9]*$'
    OR jsonb_typeof(manifest->'expectedDocsHash') IS DISTINCT FROM 'string'
    OR (manifest->>'expectedDocsHash') !~ '^[a-f0-9]{32}$'
  THEN RAISE EXCEPTION 'Invalid nutrition document manifest'; END IF;
  owner_id := (manifest->>'ownerUserId')::uuid;
  row_data := manifest->'newRow';
  IF jsonb_typeof(row_data) IS DISTINCT FROM 'object'
    OR (SELECT count(*) FROM jsonb_object_keys(row_data)) <> 11
    OR NOT row_data ?& ARRAY['source_record_id','document_date','title','document_type','source_file','source','checksum','extraction_status','confidence','notes','source_payload']
  THEN RAISE EXCEPTION 'Invalid nutrition document row fields'; END IF;
  FOREACH field_name IN ARRAY ARRAY['source_record_id','document_date','title','document_type','source_file','source','checksum','extraction_status','confidence'] LOOP
    IF jsonb_typeof(row_data->field_name) IS DISTINCT FROM 'string' OR btrim(row_data->>field_name) = ''
    THEN RAISE EXCEPTION 'Missing nutrition document metadata'; END IF;
  END LOOP;
  IF row_data->>'document_type' IS DISTINCT FROM 'nutrition_plan'
    OR (row_data->>'source_record_id') !~ '^[A-Za-z0-9][A-Za-z0-9:._/-]{0,239}$'
    OR row_data->>'source_record_id' = manifest->>'anchorSourceRecordId'
    OR (row_data->>'checksum') !~ '^[a-f0-9]{64}$'
    OR (row_data->>'document_date') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    OR to_char((row_data->>'document_date')::date, 'YYYY-MM-DD') IS DISTINCT FROM row_data->>'document_date'
    OR jsonb_typeof(row_data->'notes') NOT IN ('string', 'null')
    OR jsonb_typeof(row_data->'source_payload') IS DISTINCT FROM 'object'
  THEN RAISE EXCEPTION 'Invalid nutrition document metadata'; END IF;
  projection := row_data->'source_payload'->'nutrition_plan_ui';
  IF jsonb_typeof(projection) IS DISTINCT FROM 'object'
    OR projection->'schema_version' IS DISTINCT FROM '1'::jsonb
    OR projection->>'type' IS DISTINCT FROM 'documented_nutrition_plan'
    OR projection->>'source_record_id' IS DISTINCT FROM row_data->>'source_record_id'
    OR projection->>'source_sha256' IS DISTINCT FROM row_data->>'checksum'
    OR projection->>'documented_on' IS DISTINCT FROM row_data->>'document_date'
    OR projection->'clinical_start' IS DISTINCT FROM 'null'::jsonb
    OR projection->>'clinical_start_status' IS DISTINCT FROM 'not_documented'
    OR jsonb_typeof(projection->'received_on') IS DISTINCT FROM 'string'
    OR (projection->>'received_on') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    OR to_char((projection->>'received_on')::date, 'YYYY-MM-DD') IS DISTINCT FROM projection->>'received_on'
    OR jsonb_typeof(projection->'page_count') IS DISTINCT FROM 'number'
    OR (projection->>'page_count') !~ '^[1-9][0-9]*$'
    OR projection->'verification'->>'status' IS DISTINCT FROM 'source_verified'
    OR jsonb_typeof(projection->'verification'->'pages') IS DISTINCT FROM 'array'
    OR projection->'author'->>'identification_basis' IS DISTINCT FROM 'printed_logo'
    OR projection->'author'->'signature_verified' IS DISTINCT FROM 'false'::jsonb
  THEN RAISE EXCEPTION 'Invalid or unbound nutrition plan projection'; END IF;
  IF jsonb_array_length(projection->'verification'->'pages') <> (projection->>'page_count')::bigint
    OR (SELECT count(DISTINCT item) FROM jsonb_array_elements(projection->'verification'->'pages') AS p(item)) <> (projection->>'page_count')::bigint
  THEN RAISE EXCEPTION 'Incomplete source verification'; END IF;
  FOR page IN SELECT value FROM jsonb_array_elements(projection->'verification'->'pages') LOOP
    IF jsonb_typeof(page) IS DISTINCT FROM 'number' OR page::text !~ '^[1-9][0-9]*$'
      OR (page::text)::bigint > (projection->>'page_count')::bigint
    THEN RAISE EXCEPTION 'Invalid source verification page'; END IF;
  END LOOP;
  FOREACH field_name IN ARRAY ARRAY['calories_kcal','protein_g','carbs_g','fat_g','fiber_g','water_ml'] LOOP
    IF jsonb_typeof(projection->'daily_targets'->field_name->'value') IS DISTINCT FROM 'number'
      OR (projection->'daily_targets'->field_name->>'value')::numeric <= 0
      OR projection->'daily_targets'->field_name->>'unit' IS DISTINCT FROM (CASE field_name WHEN 'calories_kcal' THEN 'kcal' WHEN 'water_ml' THEN 'mL' ELSE 'g' END)
      OR jsonb_typeof(projection->'daily_targets'->field_name->'pages') IS DISTINCT FROM 'array'
      OR jsonb_array_length(projection->'daily_targets'->field_name->'pages') < 1
    THEN RAISE EXCEPTION 'Invalid nutrition documentary target'; END IF;
    FOR page IN SELECT value FROM jsonb_array_elements(projection->'daily_targets'->field_name->'pages') LOOP
      IF jsonb_typeof(page) IS DISTINCT FROM 'number' OR page::text !~ '^[1-9][0-9]*$'
        OR (page::text)::bigint > (projection->>'page_count')::bigint
      THEN RAISE EXCEPTION 'Invalid nutrition target page'; END IF;
    END LOOP;
  END LOOP;
  IF (SELECT count(*) FROM public.health_documents WHERE source_record_id = manifest->>'anchorSourceRecordId') <> 1
    OR (SELECT count(*) FROM public.health_documents WHERE source_record_id = manifest->>'anchorSourceRecordId' AND user_id = owner_id) <> 1
  THEN RAISE EXCEPTION 'Anchor document does not uniquely identify the expected owner'; END IF;
  IF EXISTS (SELECT 1 FROM public.health_documents WHERE source_record_id = row_data->>'source_record_id')
  THEN RAISE EXCEPTION 'New document source identity already exists'; END IF;
  SELECT count(*), md5(coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.id), '[]'::jsonb)::text)
    INTO actual_count, actual_hash FROM public.health_documents AS d WHERE d.user_id = owner_id;
  IF actual_count <> (manifest->>'expectedDocsCount')::bigint OR actual_hash IS DISTINCT FROM manifest->>'expectedDocsHash'
  THEN RAISE EXCEPTION 'Existing owner document snapshot changed'; END IF;
  SELECT count(*), md5(coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.id), '[]'::jsonb)::text)
    INTO before_all_count, before_all_hash FROM public.health_documents AS d;
  INSERT INTO public.health_documents
    (user_id, source_record_id, document_date, title, document_type, source_file, source, checksum, extraction_status, confidence, notes, source_payload)
  VALUES
    (owner_id, row_data->>'source_record_id', (row_data->>'document_date')::date,
     row_data->>'title', row_data->>'document_type', row_data->>'source_file', row_data->>'source',
     row_data->>'checksum', row_data->>'extraction_status', row_data->>'confidence', row_data->>'notes', row_data->'source_payload')
  RETURNING id INTO inserted_id;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count <> 1 OR inserted_id IS NULL THEN RAISE EXCEPTION 'Expected exactly one inserted document'; END IF;
  IF (SELECT count(*) FROM public.health_documents AS d WHERE d.id = inserted_id AND d.user_id = owner_id
    AND (to_jsonb(d) - ARRAY['id','user_id','created_at']) = row_data) <> 1
  THEN RAISE EXCEPTION 'Inserted document differs from reviewed row'; END IF;
  SELECT count(*), md5(coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.id), '[]'::jsonb)::text)
    INTO actual_count, actual_hash FROM public.health_documents AS d WHERE d.user_id = owner_id AND d.id <> inserted_id;
  IF actual_count <> (manifest->>'expectedDocsCount')::bigint OR actual_hash IS DISTINCT FROM manifest->>'expectedDocsHash'
  THEN RAISE EXCEPTION 'Preexisting owner documents changed during insertion'; END IF;
  SELECT count(*), md5(coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.id), '[]'::jsonb)::text)
    INTO actual_count, actual_hash FROM public.health_documents AS d WHERE d.id <> inserted_id;
  IF actual_count <> before_all_count OR actual_hash IS DISTINCT FROM before_all_hash
  THEN RAISE EXCEPTION 'Preexisting documents changed outside insert scope'; END IF;
END;
$nutrition_document_insert$;
COMMIT;
`;
}
