import fs from 'node:fs';
import assert from 'node:assert/strict';

const sleepMigration = fs.readFileSync('supabase/migrations/20260830112700_enforce_sleep_candidate_status.sql','utf8');
const canonicalMigration = fs.readFileSync('supabase/migrations/20260830114000_enforce_current_source_canonical_boundary.sql','utf8');
const appleSync = fs.readFileSync('supabase/functions/health-apple-sync-batch/index.ts','utf8');
const dataLayer = fs.readFileSync('v2/src/data-layer.js','utf8');

assert.match(sleepMigration,/create or replace function public\.health_source_daily_metrics_preserve_status\(\)/i,'sleep migration must preserve the existing status guard through a compatible function replacement');
assert.match(sleepMigration,/old\.canonical_status in \('held','superseded'\)[\s\S]*new\.canonical_status in \('candidate','canonical'\)[\s\S]*new\.canonical_status := old\.canonical_status/i,'held and superseded statuses must remain protected');
assert.match(sleepMigration,/set\s+canonical_status\s*=\s*'candidate'/i,'historical sleep rows must be preserved as candidates');
assert.match(sleepMigration,/where\s+canonical_status\s*=\s*'canonical'[\s\S]*metric_type\s+like\s+'sleep_%'/i,'sleep migration must target only canonical sleep metrics');
assert.match(sleepMigration,/health_source_daily_metrics_sleep_not_canonical/,'sleep canonical constraint missing');
assert.doesNotMatch(sleepMigration,/delete\s+from\s+public\.health_source_daily_metrics/i,'sleep correction must never delete source rows');
assert.doesNotMatch(sleepMigration,/drop\s+trigger\s+if\s+exists\s+health_source_daily_metrics_preserve_status_trg/i,'sleep correction must not remove the global status-preservation trigger');

assert.match(canonicalMigration,/create or replace function public\.health_source_daily_metrics_preserve_status\(\)/i,'canonical boundary migration must preserve the status guard');
assert.match(canonicalMigration,/old\.canonical_status in \('held','superseded'\)[\s\S]*new\.canonical_status in \('candidate','canonical'\)[\s\S]*new\.canonical_status := old\.canonical_status/i,'canonical boundary must keep held/superseded protection');
assert.match(canonicalMigration,/old\.canonical_status = 'canonical'[\s\S]*new\.canonical_status = 'candidate'[\s\S]*old\.source_family = 'apple_activity_summary'[\s\S]*old\.metric_type in \('active_energy_kcal','exercise_minutes','stand_hours'\)[\s\S]*new\.canonical_status := old\.canonical_status/i,'only currently validated ActivitySummary canonical rows may resist demotion');
assert.match(canonicalMigration,/where\s+canonical_status = 'canonical'[\s\S]*and not \([\s\S]*source_family = 'apple_activity_summary'[\s\S]*metric_type in \('active_energy_kcal','exercise_minutes','stand_hours'\)/i,'legacy rows outside the current canonical contract must be demoted without deletion');
assert.match(canonicalMigration,/health_source_daily_metrics_current_canonical_boundary/,'current canonical boundary constraint missing');
assert.match(canonicalMigration,/canonical_status <> 'canonical'[\s\S]*source_family = 'apple_activity_summary'[\s\S]*metric_type in \('active_energy_kcal','exercise_minutes','stand_hours'\)/i,'database constraint must fail closed to the exact current canonical contract');
assert.doesNotMatch(canonicalMigration,/delete\s+from\s+public\.health_source_daily_metrics/i,'canonical correction must never delete source rows');
assert.doesNotMatch(canonicalMigration,/drop\s+trigger\s+if\s+exists\s+health_source_daily_metrics_preserve_status_trg/i,'canonical correction must not remove the global status-preservation trigger');

const canonicalSet = appleSync.match(/const canonicalActivity=new Set\(\[([^\]]+)\]\)/)?.[1] || '';
const canonicalMetrics = [...canonicalSet.matchAll(/'([^']+)'/g)].map(m=>m[1]);
assert.deepEqual(canonicalMetrics,['active_energy_kcal','exercise_minutes','stand_hours'],'Apple bridge canonical set must remain exactly the three validated activity metrics');
assert.match(appleSync,/canonical_status:'candidate'/,'incoming Apple/source metrics must start as candidates');
assert.match(appleSync,/sourceFamily==='apple_activity_summary'&&canonicalActivity\.has\(metric\)/,'only Apple ActivitySummary may enter automatic promotion');
assert.match(appleSync,/apple_export:\$\{sourceFamily\}:\$\{metric\}:\$\{d\}:\$\{md5\(sourceName\)\}/,'historical source identity must preserve source family/name separation');
assert.match(dataLayer,/visibleRows\.filter\(w=>w\.is_canonical!==false&&w\.record_status!=='quarantined'\)/,'training UI must exclude explicit noncanonical complementary workouts');

console.log('sleep/provenance boundary contract: ok');
