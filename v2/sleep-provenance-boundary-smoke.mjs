import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration = fs.readFileSync('supabase/migrations/20260830112700_enforce_sleep_candidate_status.sql','utf8');
const appleSync = fs.readFileSync('supabase/functions/health-apple-sync-batch/index.ts','utf8');
const dataLayer = fs.readFileSync('v2/src/data-layer.js','utf8');

assert.match(migration,/set\s+canonical_status\s*=\s*'candidate'/i,'historical sleep rows must be preserved as candidates');
assert.match(migration,/where\s+canonical_status\s*=\s*'canonical'[\s\S]*metric_type\s+like\s+'sleep_%'/i,'migration must target only canonical sleep metrics');
assert.match(migration,/health_source_daily_metrics_sleep_not_canonical/,'sleep canonical constraint missing');
assert.match(migration,/not\s*\(canonical_status\s*=\s*'canonical'\s+and\s+metric_type\s+like\s+'sleep_%'\)/i,'constraint must reject future canonical sleep rows');
assert.doesNotMatch(migration,/delete\s+from\s+public\.health_source_daily_metrics/i,'sleep correction must never delete source rows');

const canonicalSet = appleSync.match(/const canonicalActivity=new Set\(\[([^\]]+)\]\)/)?.[1] || '';
const canonicalMetrics = [...canonicalSet.matchAll(/'([^']+)'/g)].map(m=>m[1]);
assert.deepEqual(canonicalMetrics,['active_energy_kcal','exercise_minutes','stand_hours'],'Apple bridge canonical set must remain exactly the three validated activity metrics');
assert.match(appleSync,/canonical_status:'candidate'/,'incoming Apple/source metrics must start as candidates');
assert.match(appleSync,/sourceFamily==='apple_activity_summary'&&canonicalActivity\.has\(metric\)/,'only Apple ActivitySummary may enter automatic promotion');
assert.match(appleSync,/apple_export:\$\{sourceFamily\}:\$\{metric\}:\$\{d\}:\$\{md5\(sourceName\)\}/,'historical source identity must preserve source family/name separation');
assert.match(dataLayer,/visibleRows\.filter\(w=>w\.is_canonical!==false&&w\.record_status!=='quarantined'\)/,'training UI must exclude explicit noncanonical complementary workouts');

console.log('sleep/provenance boundary contract: ok');
