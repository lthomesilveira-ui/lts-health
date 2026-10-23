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
// Official labels: https://help.healthyapps.dev/en/health-auto-export/automations/rest-api/
// Tokens: https://help.healthyapps.dev/en/health-auto-export/automations/deep-link/
const periodCases=[['none','none'],['default','default'],['lastsync','lastsync'],['today','today'],['yesterday','yesterday'],['previous7days','previous7days'],['Default','default'],['Today','today'],['Yesterday','yesterday'],['Since Last Sync','lastsync'],['Previous 7 Days','previous7days'],['previous7Days','previous7days'],['  DEFAULT  ','default'],['  sInCe LaSt SyNc  ','lastsync']];
const baseline=receiveSummary({outcome:'accepted',metrics:rows,acceptedMetrics:30,basalCandidatePoints:2,acceptedBasalCandidates:2});
for(const [input,expected] of periodCases){
 const actual=receiveSummary({outcome:'accepted',metrics:rows,acceptedMetrics:30,basalCandidatePoints:2,acceptedBasalCandidates:2,automationPeriod:input});
 assert.deepEqual(actual,{...baseline,automation_period:expected});
 assert.equal(actual.coverage_verified,false);assert.equal(actual.basal_coverage_verified,false);assert.equal(actual.requested_interval,'unknown');
}
const invalidPeriods=[undefined,null,'',' ',true,false,0,1,[],{},new String('Today'),{toString(){throw Error('must not coerce');}},'PRIVATE_HEADER','realtime','Today,Yesterday','Since  Last Sync','Previous 7 Days extra','Default\n','\tToday','Today\r\nPRIVATE_HEADER','Today\0','Today\u007f','Today\u0085','\u00a0Today','Ｔoday','Today😀','Today\ud800',' '.repeat(65)+'Today','a'.repeat(100000)];
for(const input of invalidPeriods){
 const actual=receiveSummary({outcome:'accepted',metrics:rows,acceptedMetrics:30,basalCandidatePoints:2,acceptedBasalCandidates:2,automationPeriod:input});
 assert.deepEqual(actual,baseline);assert.ok(!JSON.stringify(actual).includes('PRIVATE_HEADER'));
}
console.log(`Period diagnostics: ${periodCases.length} documented label/token cases and ${invalidPeriods.length} invalid/unknown cases; no coverage or payload expansion.`);
// Water diagnostics use only exact-name counts after successful normalization.
const waterRow={metric_type:'dietary_water_ml',metric_date:'2026-09-01',source_name:'PRIVATE_WATER_SOURCE',value:765.4321};
const observedWater=(waterBlocks,metrics=[])=>receiveSummary({outcome:'accepted',waterBlocks,metrics,acceptedMetrics:metrics.length});
assert.equal(observedWater(0).water_observation,'absent');
assert.equal(observedWater(1).water_observation,'empty');
assert.equal(observedWater(80).water_blocks_observed,80);
const waterSummary=observedWater(2,[waterRow,{...waterRow,source_name:'OTHER_PRIVATE_WATER'},{...waterRow,metric_date:'2026-09-02'}]);
assert.equal(waterSummary.water_observation,'present');assert.equal(waterSummary.water_blocks_observed,2);assert.equal(waterSummary.water_metrics_observed,3);assert.equal(waterSummary.water_dates_observed,2);
assert.equal(waterSummary.coverage_verified,false);assert.equal(waterSummary.requested_interval,'unknown');
for(const invalid of [undefined,null,-1,81,1.5,'1',true,[],{},NaN,Infinity])assert.ok(!Object.hasOwn(observedWater(invalid),'water_observation'));
assert.ok(!Object.hasOwn(observedWater(0,[waterRow]),'water_observation'));
assert.equal(observedWater(1,Array(2500).fill(waterRow)).water_metrics_observed,2500);
assert.ok(!Object.hasOwn(observedWater(1,Array(2501).fill(waterRow)),'water_observation'));
for(const outcome of ['rate_limited','ingestion_failed']){
 const summary=receiveSummary({outcome,waterBlocks:1,metrics:[waterRow],acceptedMetrics:1});
 assert.equal(summary.water_observation,'present');assert.equal(summary.accepted_metrics,0);assert.ok(!Object.hasOwn(summary,'water_metrics_persisted'));
}
const noWrites=receiveSummary({outcome:'accepted',waterBlocks:1,metrics:[waterRow],acceptedMetrics:0});
assert.equal(noWrites.outcome,'accepted_without_writes');assert.equal(noWrites.water_observation,'present');
for(const secret of ['PRIVATE_WATER_SOURCE','OTHER_PRIVATE_WATER','765.4321','2026-09-01','2026-09-02'])assert.ok(!JSON.stringify(waterSummary).includes(secret));
console.log('Water diagnostics: absent/empty/present differ from unobserved; bounded counts only, no values/sources/dates, no persistence or coverage claim.');
