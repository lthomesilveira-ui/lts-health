import assert from 'node:assert/strict';
import {receiveSummary} from '../functions/_shared/receive-summary.mjs';
const rows=Array.from({length:30},(_,i)=>({metric_type:'dietary_protein_g',metric_date:`2026-09-${String(i+1).padStart(2,'0')}`,source_family:'synthetic',source_name:'PRIVATE_SOURCE',value:12345}));
let s=receiveSummary({outcome:'accepted',metrics:rows,acceptedMetrics:30,automationPeriod:'PRIVATE_HEADER'});
assert.equal(s.nutrition_dates_observed,30);assert.equal(s.nutrition_first_date_observed,'2026-09-01');assert.equal(s.nutrition_last_date_observed,'2026-09-30');assert.equal(s.automation_period,'unknown');assert.equal(s.coverage_verified,false);
s=receiveSummary({outcome:'accepted',metrics:rows.filter((_,i)=>i!==15),acceptedMetrics:29});assert.equal(s.nutrition_dates_observed,29);
s=receiveSummary({outcome:'accepted',metrics:[...rows,...rows.map(r=>({...r,source_name:'OTHER_PRIVATE'}))],acceptedMetrics:60});assert.equal(s.nutrition_dates_observed,30);assert.equal(s.nutrition_origin_summaries.length,2);assert.deepEqual(s.nutrition_origin_summaries.map(x=>x.dates),[30,30]);
for(const code of ['invalid_date','unsupported_unit','json_required'])assert.equal(receiveSummary({outcome:'validation_rejected',validationCode:code}).validation_code,code);
assert.equal(receiveSummary({validationCode:'PRIVATE_VALUE'}).validation_code,null);
for(const secret of ['PRIVATE_SOURCE','OTHER_PRIVATE','12345'])assert.ok(!JSON.stringify(s).includes(secret));
assert.equal(receiveSummary({outcome:'accepted',metrics:rows,acceptedMetrics:0}).outcome,'accepted_without_writes');
console.log('Summary: exact observed dates/gaps, separate origins, whitelist, no raw values, zero writes.');
// Counters are private, bounded observations of this request, not daily coverage.
assert.ok(!Object.hasOwn(receiveSummary(), 'ignored_basal_blocks'));
assert.ok(!Object.hasOwn(receiveSummary({ignoredBasalBlocks:1}), 'ignored_basal_points'));
for(const [blocks,points,ignored] of [[0,0,0],[1,0,0],[2,3,4],[80,2500,2500]]){
 const summary=receiveSummary({ignoredBasalBlocks:blocks,ignoredBasalPoints:points,ignoredPoints:ignored});
 assert.equal(summary.ignored_basal_blocks,blocks);assert.equal(summary.ignored_basal_points,points);assert.equal(summary.coverage_verified,false);
}
for(const [blocks,points,ignored] of [[-1,0,0],[81,0,0],[1,2501,2501],[1,2,1],[0,1,1],[1.5,0,0],[1,'PRIVATE_COUNTER',1],[null,null,0]]){
 const summary=receiveSummary({ignoredBasalBlocks:blocks,ignoredBasalPoints:points,ignoredPoints:ignored});
 assert.ok(!Object.hasOwn(summary,'ignored_basal_blocks'));assert.ok(!Object.hasOwn(summary,'ignored_basal_points'));
}
console.log('Private basal counters: absent stays unknown; only bounded integer pairs survive.');
