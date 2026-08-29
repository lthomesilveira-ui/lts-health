import { readFile } from 'node:fs/promises';

const fn=await readFile('supabase/functions/health-apple-sync-batch/index.ts','utf8');
const migration=await readFile('supabase/migrations/20260829190410_add_source_daily_metrics_for_apple_bridge.sql','utf8');
const backup=await readFile('v2/src/data-layer.js','utf8');

for(const token of [
  "const canonicalActivity=new Set(['active_energy_kcal','exercise_minutes','stand_hours'])",
  "const historicalExportFamilies=new Set(['apple_watch','iphone','polar_flow'])",
  "const maxRequestBytes=1_000_000",
  "const maxSourcePayloadBytes=8_192",
  "sourceFamily==='apple_activity_summary'&&canonicalActivity.has(metric)",
  "row.source_family==='apple_activity_summary'&&ids.has(row.metric_type+'|'+row.metric_date)",
  "canonical_status:'candidate'",
  "rows.length>1000",
  "error:'payload_too_large'",
  "reason:'source_payload_too_large'",
  "const sid=sourceId(sourceFamily,metric,d,sourceName)",
  "client_source_record_id:clientSourceRecordId"
]){
  if(!fn.includes(token))throw new Error(`Apple bridge contract missing: ${token}`);
}
if(/canonicalActivity[^\n]*steps/.test(fn))throw new Error('steps must not be canonicalized automatically');
if(/canonicalActivity[^\n]*oxygen_saturation_pct/.test(fn))throw new Error('oxygen saturation must not be canonicalized automatically');
if(!fn.includes("allowed=new Set(['active_energy_kcal','exercise_minutes','stand_hours','steps','sleep_duration_h','resting_heart_rate_bpm','heart_rate_avg_bpm','hrv_sdnn_ms','respiratory_rate_bpm','oxygen_saturation_pct','weight_kg'])"))throw new Error('allowed Apple bridge metric set drifted');
if(/const sid=providedId\|\|/.test(fn)||/const sid=clientSourceRecordId\|\|/.test(fn))throw new Error('client source_record_id can still control the Apple upsert identity');
if(!fn.includes("if(sourceFamily==='apple_activity_summary')return `activity_summary:${metric}:${d}`"))throw new Error('ActivitySummary source id no longer matches historical identity');
if(!fn.includes("return `apple_export:${sourceFamily}:${metric}:${d}:${md5(sourceName)}`"))throw new Error('Apple export source id no longer matches historical identity');
if(!fn.includes("return `apple_bridge:${JSON.stringify([sourceFamily,metric,d,sourceName])}`"))throw new Error('fallback Apple bridge source identity is not deterministic/unambiguous');
if(!fn.includes("new TextEncoder().encode(raw).length>maxRequestBytes"))throw new Error('actual request body size is not bounded');
if(!fn.includes("payloadSize(r.source_payload)>maxSourcePayloadBytes"))throw new Error('per-row source payload size is not bounded');
if(/for\(const row of normalized\)\{if\(ids\.has/.test(fn))throw new Error('candidate source rows can be incorrectly marked canonical by metric/date collision');
const payloadBlock=fn.match(/source_payload:\{[\s\S]*?\n\s*\},\n\s*updated_at/)?.[0]||'';
const spread='...(r.source_payload&&typeof r.source_payload===\'object\'?r.source_payload:{})';
const spreadAt=payloadBlock.indexOf(spread),clientIdAt=payloadBlock.indexOf('client_source_record_id:clientSourceRecordId'),batchAt=payloadBlock.indexOf('batch_id:batchId'),bridgeAt=payloadBlock.indexOf('bridge_version:clean(body?.bridge_version,80)'),sourceAt=payloadBlock.indexOf('original_source:sourceName');
if(spreadAt<0||clientIdAt<0||batchAt<0||bridgeAt<0||sourceAt<0)throw new Error('Apple provenance payload contract missing protected fields');
if(!(spreadAt<clientIdAt&&clientIdAt<batchAt&&batchAt<bridgeAt&&bridgeAt<sourceAt))throw new Error('client payload can overwrite server-normalized Apple provenance fields');
if(!migration.includes('enable row level security'))throw new Error('Apple source metric table must have RLS enabled');
for(const op of ['select','insert','update','delete'])if(!migration.includes(`health_source_daily_metrics_${op}_own`))throw new Error(`missing ${op} own-row policy`);
if(!migration.includes("canonical_status in ('candidate','canonical','held','superseded')"))throw new Error('canonical status constraint missing');
if(!migration.includes('check (value >= 0)'))throw new Error('nonnegative metric value constraint missing');
if(backup.includes("source_file,source_payload','metric_date'"))throw new Error('raw source payload must not be exported in structured backup');
if(!backup.includes("source_record_id,metric_date,metric_type,value,unit,source_name,source_family,canonical_status,confidence,source_file','metric_date'"))throw new Error('structured source metric backup projection drifted');
console.log('LTS Health Apple bridge contract smoke passed');
