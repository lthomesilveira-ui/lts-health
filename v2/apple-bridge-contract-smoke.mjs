import { readFile } from 'node:fs/promises';

const fn=await readFile('supabase/functions/health-apple-sync-batch/index.ts','utf8');
const migration=await readFile('supabase/migrations/20260829190410_add_source_daily_metrics_for_apple_bridge.sql','utf8');
const statusMigration=await readFile('supabase/migrations/20260829202400_preserve_source_metric_status.sql','utf8');
const reviewedMigration=await readFile('supabase/migrations/20260829202600_preserve_reviewed_source_metric_status.sql','utf8');
const atomicMigration=await readFile('supabase/migrations/20260829203200_atomic_apple_activity_promotion.sql','utf8');
const backup=await readFile('v2/src/data-layer.js','utf8');

for(const token of [
  "const canonicalActivity=new Set(['active_energy_kcal','exercise_minutes','stand_hours'])",
  "const historicalExportFamilies=new Set(['apple_watch','iphone','polar_flow'])",
  "const maxRequestBytes=1_000_000",
  "const maxSourcePayloadBytes=8_192",
  "sourceFamily==='apple_activity_summary'&&canonicalActivity.has(metric)",
  "canonical_status:'candidate'",
  "rows.length>1000",
  "error:'payload_too_large'",
  "reason:'source_payload_too_large'",
  "const sid=sourceId(sourceFamily,metric,d,sourceName)",
  "client_source_record_id:clientSourceRecordId",
  "canonicalSourceIds.push(sid)",
  "sb.rpc('health_promote_apple_activity_summary'",
  "p_source_record_ids:sourceIds",
  "error:'canonical_promotion_failed'",
  "canonicalized:Number(promotion.promoted||0)",
  "review_blocked:Number(promotion.blocked||0)"
]){
  if(!fn.includes(token))throw new Error(`Apple bridge contract missing: ${token}`);
}
const dietary=['dietary_energy_kcal','dietary_protein_g','dietary_carbs_g','dietary_fat_g','dietary_fiber_g'];
for(const metric of dietary){
  if(!fn.includes(`'${metric}'`))throw new Error(`dietary candidate metric missing from Apple bridge allowlist: ${metric}`);
  if(new RegExp(`canonicalActivity[^\\n]*${metric}`).test(fn))throw new Error(`${metric} must never be canonicalized by ActivitySummary promotion`);
}
if(/canonicalActivity[^\n]*steps/.test(fn))throw new Error('steps must not be canonicalized automatically');
if(/canonicalActivity[^\n]*oxygen_saturation_pct/.test(fn))throw new Error('oxygen saturation must not be canonicalized automatically');
if(!fn.includes("allowed=new Set(['active_energy_kcal','exercise_minutes','stand_hours','steps','sleep_duration_h','resting_heart_rate_bpm','heart_rate_avg_bpm','hrv_sdnn_ms','respiratory_rate_bpm','oxygen_saturation_pct','weight_kg','dietary_energy_kcal','dietary_protein_g','dietary_carbs_g','dietary_fat_g','dietary_fiber_g'])"))throw new Error('allowed Apple bridge metric set drifted');
if(/const sid=providedId\|\|/.test(fn)||/const sid=clientSourceRecordId\|\|/.test(fn))throw new Error('client source_record_id can still control the Apple upsert identity');
if(!fn.includes("if(sourceFamily==='apple_activity_summary')return `activity_summary:${metric}:${d}`"))throw new Error('ActivitySummary source id no longer matches historical identity');
if(!fn.includes("return `apple_export:${sourceFamily}:${metric}:${d}:${md5(sourceName)}`"))throw new Error('Apple export source id no longer matches historical identity');
if(!fn.includes("return `apple_bridge:${JSON.stringify([sourceFamily,metric,d,sourceName])}`"))throw new Error('fallback Apple bridge source identity is not deterministic/unambiguous');
if(!fn.includes("new TextEncoder().encode(raw).length>maxRequestBytes"))throw new Error('actual request body size is not bounded');
if(!fn.includes("payloadSize(r.source_payload)>maxSourcePayloadBytes"))throw new Error('per-row source payload size is not bounded');
if(fn.includes("sb.from('health_metrics')"))throw new Error('Edge Function must not write canonical health_metrics directly');
if(fn.includes("sb.from('health_daily_nutrition')"))throw new Error('Edge Function must not write canonical daily nutrition directly');
const payloadBlock=fn.match(/source_payload:\{[\s\S]*?\n\s*\},\n\s*updated_at/)?.[0]||'';
const spread='...(r.source_payload&&typeof r.source_payload===\'object\'?r.source_payload:{})';
const spreadAt=payloadBlock.indexOf(spread),clientIdAt=payloadBlock.indexOf('client_source_record_id:clientSourceRecordId'),batchAt=payloadBlock.indexOf('batch_id:batchId'),bridgeAt=payloadBlock.indexOf('bridge_version:bridgeVersion'),sourceAt=payloadBlock.indexOf('original_source:sourceName');
if(spreadAt<0||clientIdAt<0||batchAt<0||bridgeAt<0||sourceAt<0)throw new Error('Apple provenance payload contract missing protected fields');
if(!(spreadAt<clientIdAt&&clientIdAt<batchAt&&batchAt<bridgeAt&&bridgeAt<sourceAt))throw new Error('client payload can overwrite server-normalized Apple provenance fields');
if(!migration.includes('enable row level security'))throw new Error('Apple source metric table must have RLS enabled');
for(const op of ['select','insert','update','delete'])if(!migration.includes(`health_source_daily_metrics_${op}_own`))throw new Error(`missing ${op} own-row policy`);
if(!migration.includes("canonical_status in ('candidate','canonical','held','superseded')"))throw new Error('canonical status constraint missing');
if(!migration.includes('check (value >= 0)'))throw new Error('nonnegative metric value constraint missing');
for(const token of [
  'health_source_daily_metrics_preserve_status()',
  "old.canonical_status in ('canonical','held','superseded')",
  "new.canonical_status = 'candidate'",
  'new.canonical_status := old.canonical_status',
  'before update of canonical_status',
  'health_source_daily_metrics_preserve_status_trg'
])if(!statusMigration.includes(token))throw new Error(`source status downgrade protection missing: ${token}`);
for(const token of [
  "old.canonical_status in ('held','superseded')",
  "new.canonical_status in ('candidate','canonical')",
  "old.canonical_status = 'canonical'",
  "new.canonical_status = 'candidate'",
  'new.canonical_status := old.canonical_status'
])if(!reviewedMigration.includes(token))throw new Error(`reviewed source status protection missing: ${token}`);
for(const token of [
  'health_promote_apple_activity_summary',
  'security invoker',
  'v_user uuid := auth.uid()',
  'for update',
  "v_row.source_family <> 'apple_activity_summary'",
  "v_row.metric_type not in ('active_energy_kcal','exercise_minutes','stand_hours')",
  "v_row.canonical_status in ('held','superseded')",
  "'apple_health:' || v_row.metric_type || ':' || v_row.metric_date::text",
  'v_row.value',
  "set canonical_status = 'canonical'",
  'revoke all on function public.health_promote_apple_activity_summary',
  'grant execute on function public.health_promote_apple_activity_summary'
])if(!atomicMigration.toLowerCase().includes(token.toLowerCase()))throw new Error(`atomic Apple promotion contract missing: ${token}`);
if(backup.includes("source_file,source_payload','metric_date'"))throw new Error('raw source payload must not be exported in structured backup');
if(!backup.includes("source_record_id,metric_date,metric_type,value,unit,source_name,source_family,canonical_status,confidence,source_file','metric_date'"))throw new Error('structured source metric backup projection drifted');
console.log('LTS Health Apple bridge contract smoke passed');
