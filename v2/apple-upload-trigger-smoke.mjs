import { readFile } from 'node:fs/promises';

const parser=await readFile('supabase/functions/health-inspect-upload/index.ts','utf8');
const router=await readFile('supabase/migrations/20260831025515_route_noncanonical_metrics_to_source_review.sql','utf8');
const migration=await readFile('supabase/migrations/20260903172500_recognize_apple_activity_summary_payload.sql','utf8');

const appleStart=parser.indexOf('async function importApple');
const appleEnd=parser.indexOf('async function inspectApple');
if(appleStart<0||appleEnd<=appleStart)throw new Error('Apple import block missing');
const apple=parser.slice(appleStart,appleEnd);
const sleepStart=apple.indexOf('const sleep=new Map');
if(sleepStart<0)throw new Error('Apple sleep parser block missing');
const activityBlock=apple.slice(0,sleepStart),sleepBlock=apple.slice(sleepStart);

for(const token of [
  "const canonicalMetrics:any[]=[],sourceMetrics:any[]=[]",
  "method:'ActivitySummary'",
  "source:'Apple Health export'",
  "source_record_id:`apple_sleep_review:${originalId}`",
  "metric_type:'sleep_duration_h'",
  "source_family:'healthkit_candidate'",
  "canonical_status:'candidate'",
  "method:'sleep_interval_union'",
  "routed_from:'health_inspect_upload'",
  "original_source_record_id:originalId",
  "await upsertBatches(sb,'health_source_daily_metrics',sourceMetrics)",
  "sb.from('health_metrics').upsert(canonicalMetrics",
  "parserVersion='inspect-v8-apple-routing'"
])if(!parser.includes(token))throw new Error(`Apple direct routing contract missing: ${token}`);

if(!activityBlock.includes('canonicalMetrics.push'))throw new Error('ActivitySummary stable metrics no longer use canonical staging');
if(activityBlock.includes('sourceMetrics.push'))throw new Error('ActivitySummary stable metrics were routed as candidates');
if(!sleepBlock.includes('sourceMetrics.push'))throw new Error('Apple sleep no longer writes directly to source evidence');
if(sleepBlock.includes('canonicalMetrics.push'))throw new Error('Apple sleep can still enter canonical metric staging');
if(/health_metrics'\)\.upsert\(sourceMetrics/.test(apple))throw new Error('noncanonical source metrics can still be written to health_metrics');
if(!apple.includes("const imported=canonicalMetrics.length+sourceMetrics.length"))throw new Error('Apple import accounting no longer includes both destinations');

for(const token of [
  "new.source_payload->>'method'",
  "= 'activitysummary'",
  "new.metric_type in ('active_energy_kcal','exercise_minutes','stand_hours')",
  "new.metric_type like 'sleep_%'",
  "execute function health_private.route_review_metric_to_source_evidence()"
])if(!migration.toLowerCase().includes(token.toLowerCase()))throw new Error(`ActivitySummary payload routing contract missing: ${token}`);

if(!router.includes('health_private.route_review_metric_to_source_evidence()'))throw new Error('review metric router function is no longer the defense-in-depth destination');
if(!router.includes("canonical_status = 'candidate'"))throw new Error('review metric router no longer preserves routed evidence as candidate');

const stable=[...migration.matchAll(/new\.metric_type in \(([^)]+)\)/g)].map(m=>m[1]).join(',');
for(const metric of ['active_energy_kcal','exercise_minutes','stand_hours'])if(!stable.includes(`'${metric}'`))throw new Error(`stable ActivitySummary metric missing: ${metric}`);
for(const forbidden of ['sleep_duration_h','steps','hrv_sdnn_ms','resting_heart_rate_bpm','oxygen_saturation_pct'])if(stable.includes(`'${forbidden}'`))throw new Error(`${forbidden} must not be accepted as stable ActivitySummary output`);

const activityMethodAt=migration.indexOf("new.source_payload->>'method'");
const stableAt=migration.indexOf("new.metric_type in ('active_energy_kcal','exercise_minutes','stand_hours')");
if(activityMethodAt<0||stableAt<activityMethodAt)throw new Error('ActivitySummary payload marker must remain inside the stable-metric exception');

console.log('LTS Health Apple upload direct-routing smoke passed');
