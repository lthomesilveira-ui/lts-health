// Preparation only: a pure SQL generator, never a database client or migration.
// Real full-row manifests and generated SQL are private health data. Keep them
// outside source control, public previews, CI output and uploaded artifacts.
// This module neither changes preview configuration nor enables database writes.
// Source review, owner approval and any rollback authorization are separate.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PROOF_KEY = 'numeric_reading_verification';
const fail = message => { throw new TypeError(`Lab numeric proof manifest: ${message}`); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => Object.hasOwn(value, key);

function validateJson(value, seen = new Set(), depth = 0) {
  if (depth > 50) fail('JSON nesting is too deep');
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'string') {
    if (value.includes('\0') || !value.isWellFormed()) fail('invalid Unicode or NUL');
    return;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Object.is(value, -0) || (Number.isInteger(value) && !Number.isSafeInteger(value))) fail('non-lossless JSON number');
    return;
  }
  if (typeof value !== 'object') fail('plain JSON values required');
  if (seen.has(value)) fail('cyclic JSON');
  if (![Array.isArray(value) ? Array.prototype : Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('plain JSON objects and arrays required');
  if (Object.getOwnPropertySymbols(value).length) fail('symbol keys are unsupported');
  seen.add(value);
  for (const key of Object.getOwnPropertyNames(value)) {
    if (Array.isArray(value) && key === 'length') continue;
    if (key.includes('\0') || !key.isWellFormed()) fail('invalid JSON key');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor.enumerable || !own(descriptor, 'value')) fail('accessors and hidden fields are unsupported');
    validateJson(descriptor.value, seen, depth + 1);
  }
  if (Array.isArray(value) && (Object.keys(value).length !== value.length || Object.keys(value).some((key, index) => key !== String(index)))) fail('sparse or decorated arrays are unsupported');
  seen.delete(value);
}

function exactKeys(value, keys, label) {
  if (!object(value) || Object.keys(value).length !== keys.length || keys.some(key => !own(value, key))) fail(`invalid ${label} fields`);
}

function equalJson(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== typeof b || typeof a !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => own(b, key) && equalJson(a[key], b[key]));
}

/**
 * buildLabNumericProofSql({ ownerId, targets: [{ before, after }, ...] })
 *
 * Exactly 15 complete PostgreSQL to_jsonb(row) pre/postimages are required.
 * The sole allowed difference is one previously absent top-level payload key.
 * Proof schema/status/audit identity are checked here, not the documentary truth
 * of the proof: independent source review and deep validation remain mandatory.
 * No I/O occurs. Returned SQL is sensitive even though its manifest is base64.
 * It has no DELETE, DDL, rollback helper, auth bypass or application configuration.
 * A repeated run accepts exact postimages and performs zero UPDATEs.
 */
export function buildLabNumericProofSql(manifest) {
  validateJson(manifest);
  exactKeys(manifest, ['ownerId', 'targets'], 'manifest');
  if (typeof manifest.ownerId !== 'string' || !UUID.test(manifest.ownerId)) fail('ownerId must be a lowercase UUID');
  if (!Array.isArray(manifest.targets) || manifest.targets.length !== 15) fail('exactly 15 targets required');
  const ids = new Set();
  for (const target of manifest.targets) {
    exactKeys(target, ['before', 'after'], 'target');
    const { before, after } = target;
    if (!object(before) || !object(after) || !['id', 'user_id', 'source_payload'].every(key => own(before, key) && own(after, key))) fail('complete row objects required');
    if (typeof before.id !== 'string' || !UUID.test(before.id) || ids.has(before.id)) fail('distinct lowercase row UUIDs required');
    if (before.user_id !== manifest.ownerId || after.user_id !== manifest.ownerId || after.id !== before.id) fail('owner or row identity mismatch');
    ids.add(before.id);
    if (!object(before.source_payload) || !object(after.source_payload)) fail('source_payload must be an object');
    if (own(before.source_payload, PROOF_KEY)) fail('proof key must be absent in the before-image');
    const proof = after.source_payload[PROOF_KEY];
    if (!own(after.source_payload, PROOF_KEY) || !object(proof) || proof.schema !== 'documentary_numeric_reading_v1' || proof.status !== 'source_verified' || typeof proof.audit_id !== 'string' || !proof.audit_id.trim() || proof.audit_id.length > 160) fail('invalid proof schema, status or audit_id');
    const { [PROOF_KEY]: ignored, ...remainingPayload } = after.source_payload;
    if (!equalJson(before.source_payload, remainingPayload) || !equalJson(before, { ...after, source_payload: before.source_payload })) fail('only addition of the numeric proof key is permitted');
  }
  const json = JSON.stringify(manifest);
  if (Buffer.byteLength(json, 'utf8') > 2_000_000) fail('manifest is too large');
  const encoded = Buffer.from(json, 'utf8').toString('base64');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) fail('invalid encoding');
  return `-- PRIVATE reviewed numeric-proof proposal. Requires separate execution approval.
-- Base64 is transport encoding, NOT redaction. Never publish this generated SQL.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = pg_catalog, public;
SET LOCAL timezone = 'UTC';
SET LOCAL datestyle = 'ISO, YMD';
-- Freeze concurrent writes and trigger/rule DDL before inspecting the catalog.
LOCK TABLE public.health_lab_results IN SHARE ROW EXCLUSIVE MODE;
DO $lab_numeric_proof$
DECLARE
  manifest jsonb := convert_from(decode('${encoded}', 'base64'), 'UTF8')::jsonb;
  target jsonb;
  before_row jsonb;
  after_row jsonb;
  proof jsonb;
  current_row jsonb;
  owner_id uuid;
  row_id uuid;
  seen_ids uuid[] := ARRAY[]::uuid[];
  locked_count integer := 0;
  write_count integer := 0;
  affected_count integer;
BEGIN
  IF jsonb_typeof(manifest) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid numeric proof manifest';
  END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(manifest)) <> 2
    OR NOT manifest ?& ARRAY['ownerId', 'targets']
    OR jsonb_typeof(manifest->'ownerId') IS DISTINCT FROM 'string'
    OR (manifest->>'ownerId') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    OR jsonb_typeof(manifest->'targets') IS DISTINCT FROM 'array'
  THEN RAISE EXCEPTION 'Invalid numeric proof manifest'; END IF;
  IF jsonb_array_length(manifest->'targets') <> 15 THEN
    RAISE EXCEPTION 'Exactly 15 numeric proof targets required';
  END IF;
  owner_id := (manifest->>'ownerId')::uuid;

  -- Ordinary non-inherited tables only: no unseen child tables or their hooks.
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = 'public.health_lab_results'::regclass AND relkind = 'r' AND NOT relispartition)
    OR EXISTS (SELECT 1 FROM pg_inherits WHERE inhparent = 'public.health_lab_results'::regclass OR inhrelid = 'public.health_lab_results'::regclass)
  THEN RAISE EXCEPTION 'Unsupported numeric proof table topology'; END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.health_lab_results'::regclass AND NOT tgisinternal)
  THEN RAISE EXCEPTION 'User triggers present on numeric proof table'; END IF;
  IF EXISTS (SELECT 1 FROM pg_rewrite WHERE ev_class = 'public.health_lab_results'::regclass)
  THEN RAISE EXCEPTION 'Rewrite rules present on numeric proof table'; END IF;
  -- A payload foreign key can cascade through internal triggers. Refuse that
  -- schema too rather than relying only on the user-trigger prohibition.
  IF EXISTS (
    SELECT 1 FROM pg_constraint AS constraint_row
    JOIN pg_attribute AS payload_column ON payload_column.attrelid = 'public.health_lab_results'::regclass
      AND payload_column.attname = 'source_payload' AND NOT payload_column.attisdropped
    WHERE constraint_row.contype = 'f' AND (
      (constraint_row.conrelid = payload_column.attrelid AND payload_column.attnum = ANY(constraint_row.conkey))
      OR (constraint_row.confrelid = payload_column.attrelid AND payload_column.attnum = ANY(constraint_row.confkey))
    )
  ) THEN RAISE EXCEPTION 'Foreign keys involving the numeric proof payload are unsupported'; END IF;

  -- Validate every pair before taking any row lock or writing anything.
  FOR target IN SELECT value FROM jsonb_array_elements(manifest->'targets') LOOP
    IF jsonb_typeof(target) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Invalid numeric proof target';
    END IF;
    IF (SELECT count(*) FROM jsonb_object_keys(target)) <> 2 OR NOT target ?& ARRAY['before', 'after']
      OR jsonb_typeof(target->'before') IS DISTINCT FROM 'object'
      OR jsonb_typeof(target->'after') IS DISTINCT FROM 'object'
    THEN RAISE EXCEPTION 'Invalid numeric proof target'; END IF;
    before_row := target->'before';
    after_row := target->'after';
    IF NOT before_row ?& ARRAY['id', 'user_id', 'source_payload']
      OR NOT after_row ?& ARRAY['id', 'user_id', 'source_payload']
      OR jsonb_typeof(before_row->'id') IS DISTINCT FROM 'string'
      OR (before_row->>'id') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR before_row->'id' IS DISTINCT FROM after_row->'id'
      OR before_row->'user_id' IS DISTINCT FROM manifest->'ownerId'
      OR after_row->'user_id' IS DISTINCT FROM manifest->'ownerId'
    THEN RAISE EXCEPTION 'Numeric proof owner or row identity mismatch'; END IF;
    row_id := (before_row->>'id')::uuid;
    IF row_id = ANY(seen_ids) THEN RAISE EXCEPTION 'Duplicate numeric proof target'; END IF;
    seen_ids := array_append(seen_ids, row_id);
    IF jsonb_typeof(before_row->'source_payload') IS DISTINCT FROM 'object'
      OR jsonb_typeof(after_row->'source_payload') IS DISTINCT FROM 'object'
      OR (before_row->'source_payload') ? 'numeric_reading_verification'
      OR NOT (after_row->'source_payload') ? 'numeric_reading_verification'
    THEN RAISE EXCEPTION 'Numeric proof key must be new in an object payload'; END IF;
    proof := after_row->'source_payload'->'numeric_reading_verification';
    IF jsonb_typeof(proof) IS DISTINCT FROM 'object'
      OR proof->>'schema' IS DISTINCT FROM 'documentary_numeric_reading_v1'
      OR proof->>'status' IS DISTINCT FROM 'source_verified'
      OR jsonb_typeof(proof->'audit_id') IS DISTINCT FROM 'string'
      OR btrim(proof->>'audit_id') = '' OR length(proof->>'audit_id') > 160
    THEN RAISE EXCEPTION 'Invalid numeric proof schema, status or audit_id'; END IF;
    IF (before_row - 'source_payload') IS DISTINCT FROM (after_row - 'source_payload')
      OR (before_row->'source_payload') IS DISTINCT FROM ((after_row->'source_payload') - 'numeric_reading_verification')
    THEN RAISE EXCEPTION 'Numeric proof change exceeds the one-key scope'; END IF;
  END LOOP;

  -- Lock ALL 15 in deterministic UUID order. A late conflict precedes ALL writes.
  FOR target IN SELECT value FROM jsonb_array_elements(manifest->'targets') ORDER BY (value->'before'->>'id')::uuid LOOP
    row_id := (target->'before'->>'id')::uuid;
    IF (SELECT count(*) FROM public.health_lab_results WHERE id = row_id) > 1 THEN
      RAISE EXCEPTION 'Numeric proof target ID is not globally unique';
    END IF;
    SELECT to_jsonb(lab) INTO current_row FROM public.health_lab_results AS lab
      WHERE lab.id = row_id AND lab.user_id = owner_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Numeric proof target missing or owned by another user'; END IF;
    IF current_row IS DISTINCT FROM target->'before' AND current_row IS DISTINCT FROM target->'after'
    THEN RAISE EXCEPTION 'Numeric proof full-row preimage conflict'; END IF;
    locked_count := locked_count + 1;
  END LOOP;
  IF locked_count <> 15 THEN RAISE EXCEPTION 'Not all numeric proof targets were locked'; END IF;

  FOR target IN SELECT value FROM jsonb_array_elements(manifest->'targets') ORDER BY (value->'before'->>'id')::uuid LOOP
    row_id := (target->'before'->>'id')::uuid;
    SELECT to_jsonb(lab) INTO current_row FROM public.health_lab_results AS lab
      WHERE lab.id = row_id AND lab.user_id = owner_id;
    IF current_row IS NOT DISTINCT FROM target->'after' THEN CONTINUE; END IF;
    UPDATE public.health_lab_results AS lab
      SET source_payload = jsonb_set(lab.source_payload, '{numeric_reading_verification}', target->'after'->'source_payload'->'numeric_reading_verification', true)
      WHERE lab.id = row_id AND lab.user_id = owner_id AND to_jsonb(lab) = target->'before';
    GET DIAGNOSTICS affected_count = ROW_COUNT;
    IF affected_count <> 1 THEN RAISE EXCEPTION 'Numeric proof expected exactly one scoped update'; END IF;
    write_count := write_count + affected_count;
  END LOOP;

  FOR target IN SELECT value FROM jsonb_array_elements(manifest->'targets') LOOP
    SELECT to_jsonb(lab) INTO current_row FROM public.health_lab_results AS lab
      WHERE lab.id = (target->'after'->>'id')::uuid AND lab.user_id = owner_id;
    IF NOT FOUND OR current_row IS DISTINCT FROM target->'after'
    THEN RAISE EXCEPTION 'Numeric proof exact postcondition failed'; END IF;
  END LOOP;
  RAISE NOTICE 'Numeric proof: % rows updated; 15 exact postimages verified', write_count;
END;
$lab_numeric_proof$;
COMMIT;
`;
}
