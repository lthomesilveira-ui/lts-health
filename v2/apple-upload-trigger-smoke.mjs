import { readFile } from 'node:fs/promises';

const parser=await readFile('supabase/functions/health-inspect-upload/index.ts','utf8');
const router=await readFile('supabase/migrations/20260831025515_route_noncanonical_metrics_to_source_review.sql','utf8');
const migration=await readFile('supabase/migrations/20260903172500_recognize_apple_activity_summary_payload.sql','utf8');

for(const token of [
  "method:'ActivitySummary'",
  "source:'Apple Health export'",
  "method:'sleep_interval_union'",
  "metric_type:'sleep_duration_h'"
])if(!parser.includes(token))throw new Error(`Apple XML parser contract missing: ${token}`);

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

console.log('LTS Health Apple upload trigger smoke passed');
