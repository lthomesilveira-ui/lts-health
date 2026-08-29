import { readFile } from 'node:fs/promises';

const fn=await readFile('supabase/functions/health-apple-sync-batch/index.ts','utf8');
const migration=await readFile('supabase/migrations/20260829190410_add_source_daily_metrics_for_apple_bridge.sql','utf8');
const backup=await readFile('v2/src/data-layer.js','utf8');

for(const token of [
  "const canonicalActivity=new Set(['active_energy_kcal','exercise_minutes','stand_hours'])",
  "sourceFamily==='apple_activity_summary'&&canonicalActivity.has(metric)",
  "row.source_family==='apple_activity_summary'&&ids.has(row.metric_type+'|'+row.metric_date)",
  "canonical_status:'candidate'",
  "rows.length>1000"
]){
  if(!fn.includes(token))throw new Error(`Apple bridge contract missing: ${token}`);
}
if(/canonicalActivity[^\n]*steps/.test(fn))throw new Error('steps must not be canonicalized automatically');
if(/canonicalActivity[^\n]*oxygen_saturation_pct/.test(fn))throw new Error('oxygen saturation must not be canonicalized automatically');
if(!fn.includes("allowed=new Set(['active_energy_kcal','exercise_minutes','stand_hours','steps','sleep_duration_h','resting_heart_rate_bpm','heart_rate_avg_bpm','hrv_sdnn_ms','respiratory_rate_bpm','oxygen_saturation_pct','weight_kg'])"))throw new Error('allowed Apple bridge metric set drifted');
if(/for\(const row of normalized\)\{if\(ids\.has/.test(fn))throw new Error('candidate source rows can be incorrectly marked canonical by metric/date collision');
if(!migration.includes('enable row level security'))throw new Error('Apple source metric table must have RLS enabled');
for(const op of ['select','insert','update','delete'])if(!migration.includes(`health_source_daily_metrics_${op}_own`))throw new Error(`missing ${op} own-row policy`);
if(!migration.includes("canonical_status in ('candidate','canonical','held','superseded')"))throw new Error('canonical status constraint missing');
if(!migration.includes('check (value >= 0)'))throw new Error('nonnegative metric value constraint missing');
if(backup.includes("source_file,source_payload','metric_date'"))throw new Error('raw source payload must not be exported in structured backup');
if(!backup.includes("source_record_id,metric_date,metric_type,value,unit,source_name,source_family,canonical_status,confidence,source_file','metric_date'"))throw new Error('structured source metric backup projection drifted');
console.log('LTS Health Apple bridge contract smoke passed');
