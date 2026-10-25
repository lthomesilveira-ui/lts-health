import assert from 'node:assert/strict';
globalThis.location={search:'?fixture=1'};
const {healthDashboardModel}=await import('../src/health-dashboard-model.js');
const {renderHealthDashboard}=await import('../src/health-dashboard.js');
const today='2024-08-21',status=Object.fromEntries(['nutrition','sourceMetrics','metrics','body','workouts','exercises','sets','workoutEvidence','labs','treatments','regimens','goals','docs','waterReferences','nutritionPlans','polarSessions','meals'].map(key=>[key,'ready']));
const data={nutrition:[{nutrition_date:today,source:'Synthetic food without water',water_ml:null,protein_g:120,calories_kcal:2100}],sourceMetrics:[{
 source_record_id:'synthetic-water-old',metric_date:'2024-08-08',metric_type:'dietary_water_ml',value:1750,unit:'mL',source_family:'health_auto_export',source_name:'Synthetic water bridge',canonical_status:'canonical',confidence:'authenticated_auto_export',updated_at:'2024-08-09T11:20:00Z'
}]};
const card=html=>html.match(/<article[^>]*data-dashboard-card="water"[^>]*>([\s\S]*?)<\/article>/)[1];
for(const ui of [{dashboardMode:'day'},{dashboardMode:'period',dashboardPeriod:'7'}]){
 const before=structuredClone(data),m=healthDashboardModel(data,status,ui,today).metricsByKey.water,html=card(renderHealthDashboard(data,status,ui,today));
 assert.equal(m.value,null);assert.equal(m.count,0);
 assert.equal(m.lastMetricDate,'2024-08-08');
 assert.equal(m.latestRecorded.value,1750);
 assert.match(html,/<strong>—<\/strong>/);
 assert.match(html,/Sem informação/);
 assert.match(html,/Último valor desta origem: <b>1\.750 mL<\/b> · 08\/08\/2024/);
 assert.match(html,/Recebido em 09\/08\/2024, 08:20 \(Brasília\)/);
 assert.doesNotMatch(html,/<strong>0<\/strong>|Último registro: 21\/08\/2024/);
 assert.deepEqual(data,before);
}
// Opening the actual historical day restores its value; a later day never
// carries it forward, and a true zero remains different from an absent field.
const historical={dashboardMode:'day',dashboardDate:'2024-08-08'};
assert.equal(healthDashboardModel(data,status,historical,today).metricsByKey.water.value,1750);
assert.match(card(renderHealthDashboard(data,status,historical,today)),/<strong>1\.750<\/strong>/);
const zero=structuredClone(data);zero.sourceMetrics.push({...zero.sourceMetrics[0],source_record_id:'synthetic-water-zero',metric_date:today,value:0,updated_at:'2024-08-21T14:00:00Z'});
const zeroHtml=card(renderHealthDashboard(zero,status,{dashboardMode:'day'},today));
assert.match(zeroHtml,/<strong>0<\/strong>/);assert.doesNotMatch(zeroHtml,/Sem informação|data-last-known/);
const explicit={dashboardMode:'day',dashboardSources:{water:JSON.stringify(['nutrition','synthetic food without water','canonical','ml'])}};
const blank=healthDashboardModel(data,status,explicit,today).metricsByKey.water;
assert.equal(blank.latestRecorded,null);assert.equal(blank.lastMetricDate,null);
assert.doesNotMatch(card(renderHealthDashboard(data,status,explicit,today)),/Último valor desta origem|Último registro: 21\/08\/2024/);
const conflict=structuredClone(data);conflict.sourceMetrics.push({...conflict.sourceMetrics[0],source_record_id:'synthetic-conflict-a',metric_date:today,value:1500},{...conflict.sourceMetrics[0],source_record_id:'synthetic-conflict-b',metric_date:today,value:1800});
const conflictMetric=healthDashboardModel(conflict,status,{dashboardMode:'day'},today).metricsByKey.water;
assert.equal(conflictMetric.value,null);assert.equal(conflictMetric.ambiguousDays,1);assert.equal(conflictMetric.latestRecorded.value,1750);
const failed=card(renderHealthDashboard(data,{...status,nutrition:'error',sourceMetrics:'error'},{dashboardMode:'day'},today));
assert.match(failed,/Não foi possível atualizar/);assert.doesNotMatch(failed,/data-last-known/);
const beforeSource=healthDashboardModel(data,status,{dashboardMode:'day',dashboardDate:'2024-08-01'},today).metricsByKey.water;
assert.equal(beforeSource.latestRecorded,null,'do not disclose a future observation as the previous known value');
console.log('Water continuity: missing/zero/conflict/failure, original timestamps, historical reopening, explicit empty origin and no mutation passed.');
