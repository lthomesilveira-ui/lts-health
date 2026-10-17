import assert from 'node:assert/strict';
import {healthDashboardModel,healthDashboardCalendar} from '../src/health-dashboard-model.js';
import {homePeriodModel,homePeriodSnapshot} from '../src/home-period-model.js';

// Synthetic records only. No network, credentials or persisted health data.
const today='2024-03-08';
const status=Object.fromEntries(['nutrition','sourceMetrics','metrics','body','workouts','exercises','sets','labs','treatments','polarSessions'].map(key=>[key,'ready']));
const empty=()=>Object.fromEntries(Object.keys(status).map(key=>[key,[]]));
const date=age=>new Date(Date.parse(`${today}T12:00:00Z`)-age*86400000).toISOString().slice(0,10);
const metric=(d,type,value,extra={})=>({metric_date:d,metric_type:type,value,unit:type==='steps'?'count':type==='sleep_duration_h'?'h':type==='dietary_water_ml'?'mL':type==='dietary_protein_g'?'g':'kcal',source_name:'Synthetic watch',source_family:'synthetic_device',canonical_status:'candidate',...extra});
const byKey=(model,key)=>model.metricsByKey[key];
const calendar=(period,t='2024-03-01')=>healthDashboardCalendar({},status,{dashboardPeriod:period},t);
assert.deepEqual(calendar('7').bounds,{start:'2024-02-23',end:'2024-02-29',days:7,closedEnd:'2024-02-29',closedDays:7,includesToday:false});
assert.equal(calendar('7').previousBounds.end,'2024-02-22');
assert.equal(calendar('7').previousBounds.days,7);
assert.equal(calendar('30').bounds.start,'2024-01-31');
assert.equal(calendar('60').bounds.days,60);
assert.equal(calendar('90').bounds.days,90);
assert.equal(calendar('6m','2024-08-31').bounds.start,'2024-02-29');
assert.equal(calendar('6m','2023-08-31').bounds.start,'2023-02-28');
assert.equal(calendar('6m','2024-08-31').bounds.end,'2024-08-30');
assert.equal(calendar('6m','2024-08-31').previousBounds.days,calendar('6m','2024-08-31').bounds.days);
assert.equal(calendar('1y','2024-02-29').bounds.start,'2023-02-28');
assert.equal(calendar('1y','2024-02-29').bounds.days,366);
assert.equal(calendar('1y','2025-03-01').bounds.days,365);
assert.equal(calendar('bad').period,'7');
assert.throws(()=>calendar('7','2023-02-29'),RangeError);
assert.equal(calendar('all').bounds.days,1);
assert.equal(calendar('all').emptyHistory,true);
assert.equal(calendar('all').bounds.start,calendar('all').bounds.end);
assert.equal(calendar('all').bounds.end,'2024-02-29');
assert.equal(calendar('all').previousBounds,null);
const dated=empty();dated.body.push({measured_at:'2023-12-31'});dated.nutrition.push({nutrition_date:'2024-01-02',source:'Synthetic food',protein_g:10});
assert.equal(healthDashboardCalendar(dated,status,{dashboardPeriod:'all'},today).bounds.start,'2023-12-31');
assert.equal(healthDashboardCalendar(dated,{...status,body:'error'},{dashboardPeriod:'all'},today).bounds.start,'2024-01-02');

const data=empty();
for(let age=0;age<15;age++){
  data.nutrition.push({nutrition_date:date(age),source:'Synthetic direct food',water_ml:age?1000:9999,protein_g:age?100:9999,calories_kcal:age?2000:99999});
  data.sourceMetrics.push(metric(date(age),'active_energy_kcal',age?400:9000),metric(date(age),'total_energy_kcal',age?2400:9999),metric(date(age),'steps',age?6000:99999),metric(date(age),'sleep_duration_h',age?8:24));
}
const before=structuredClone(data),model=healthDashboardModel(data,status,{},today);
assert.equal(model.mode,'period');assert.equal(model.period,'7');assert.equal(model.bounds.end,date(1));assert.equal(model.bounds.start,date(7));assert.equal(model.metrics.length,7);
for(const item of model.metrics){
  assert.equal(item.count,7);assert.equal(item.expectedDays,7);assert.equal(item.aggregation,'observed_mean');assert.equal(item.points.length,7);
  assert.equal(item.comparison.comparable,true);assert.equal(item.comparison.samePositions,true);assert.equal(item.comparison.delta,0);assert.ok(item.points.every(p=>p.date<today));
}
assert.equal(byKey(model,'water').value,1000);assert.equal(byKey(model,'water').todayValue,9999);
assert.equal(byKey(model,'protein').value,100);assert.equal(byKey(model,'energy').value,2000);
assert.equal(byKey(model,'activeEnergy').value,400);assert.equal(byKey(model,'totalEnergy').value,2400);
assert.equal(model.todayMetrics.find(item=>item.key==='water').partial,true);
assert.deepEqual(data,before,'pure model does not mutate inputs');

// Zero is observed. Null, whitespace, boolean, negative, infinity and missing
// fields never become zero or enter the observed mean.
const sparse=empty();
sparse.nutrition=[{nutrition_date:date(1),source:'Synthetic food',water_ml:0,protein_g:0,calories_kcal:0},
  {nutrition_date:date(2),source:'Synthetic food',water_ml:null,protein_g:'',calories_kcal:false},
  {nutrition_date:date(3),source:'Synthetic food',water_ml:-1,protein_g:Infinity},
  {nutrition_date:date(4),source:'Synthetic food',water_ml:2000,knownPartial:true}];
const sp=healthDashboardModel(sparse,status,{},today);
assert.equal(byKey(sp,'water').value,0);assert.equal(byKey(sp,'water').count,1);assert.equal(byKey(sp,'water').expectedDays,7);
assert.equal(byKey(sp,'protein').value,0);assert.equal(byKey(sp,'energy').value,0);
assert.equal(byKey(sp,'water').points.find(p=>p.date===date(4)).value,2000);
assert.equal(byKey(sp,'water').points.find(p=>p.date===date(4)).eligible,false);
assert.equal(byKey(sp,'water').points.find(p=>p.date===date(5)).value,null);
assert.equal(byKey(sp,'water').availability,'partial');
assert.equal(healthDashboardModel(sparse,status,{dashboardMode:'day',dashboardDate:date(4)},today).day.partial,true);
assert.equal(byKey(sp,'totalEnergy').value,null);assert.equal(byKey(sp,'totalEnergy').count,0);

// Ambiguous repeats, even identical values, do not become a second daily sum.
const duplicates=structuredClone(data);
duplicates.nutrition.push({...duplicates.nutrition.find(r=>r.nutrition_date===date(1))});
duplicates.sourceMetrics.push(metric(date(1),'steps',6000));
const du=healthDashboardModel(duplicates,status,{},today);
assert.equal(byKey(du,'water').count,6);assert.equal(byKey(du,'water').points.find(p=>p.date===date(1)).value,null);
assert.equal(byKey(du,'steps').count,6);assert.equal(byKey(du,'steps').points.find(p=>p.date===date(1)).ambiguous,true);
assert.equal(byKey(du,'steps').comparison.comparable,false);

// Every conflicting value remains inspectable without creating an aggregate.
const conflict=empty();
conflict.nutrition=[{nutrition_date:date(1),source:'Synthetic conflicting water',water_ml:2000},
  {nutrition_date:date(1),source:'Synthetic conflicting water',water_ml:3000,knownPartial:true},
  {nutrition_date:date(2),source:'Synthetic conflicting water',water_ml:1000},
  {nutrition_date:date(3),source:'Synthetic conflicting water',water_ml:0},
  {nutrition_date:date(3),source:'Synthetic conflicting water',water_ml:0}];
const cf=byKey(healthDashboardModel(conflict,status,{},today),'water'),cp=cf.points.find(point=>point.date===date(1));
assert.equal(cf.value,1000);assert.equal(cf.count,1);assert.equal(cf.ambiguousDays,2);
assert.equal(cf.duplicateCount,4);assert.equal(cf.extraDuplicateCount,2);
assert.equal(cp.value,null);assert.equal(cp.rawValue,null);assert.deepEqual(cp.rawValues,[2000,3000]);
assert.equal(cp.duplicateCount,2);assert.equal(cp.extraDuplicateCount,1);
assert.deepEqual(cp.observations.map(item=>item.value),[2000,3000]);
assert.deepEqual(cp.observations.map(item=>item.partial),[false,true]);
assert.ok(cp.observations.every(item=>item.date===date(1)&&item.source===cf.source.key&&item.sourceLabel==='Synthetic conflicting water'&&item.label==='Synthetic conflicting water'&&item.unit==='ml'&&item.ambiguous&&!item.eligible));
assert.deepEqual(cf.points.find(point=>point.date===date(3)).rawValues,[0,0]);
assert.deepEqual(cf.points.find(point=>point.date===date(4)).observations,[]);
assert.equal(cf.sources.find(source=>source.key===cf.source.key).ambiguousDays,2);
assert.equal(cf.sources.find(source=>source.key===cf.source.key).duplicateCount,4);
const conflictDay=byKey(healthDashboardModel(conflict,status,{dashboardMode:'day',dashboardDate:date(1)},today),'water');
assert.equal(conflictDay.value,null);assert.equal(conflictDay.count,0);assert.equal(conflictDay.ambiguousDays,1);assert.equal(conflictDay.duplicateCount,2);
assert.deepEqual(conflictDay.points[0].rawValues,[2000,3000]);
assert.deepEqual(byKey(du,'steps').points.find(point=>point.date===date(1)).rawValues,[6000,6000]);

// Last received date preserves temporal evidence, including today's conflicting
// or null observations, without promoting an origin in the value-based ranking.
const received=empty();
received.nutrition=[{nutrition_date:date(2),source:'Synthetic older value',water_ml:1000},
  {nutrition_date:today,source:'Synthetic older value',water_ml:2000},
  {nutrition_date:today,source:'Synthetic older value',water_ml:3000},
  {nutrition_date:date(1),source:'Synthetic recent value',water_ml:1200},
  {nutrition_date:today,source:'Synthetic null only',water_ml:null}];
const defaultReceived=byKey(healthDashboardModel(received,status,{},today),'water');
assert.equal(defaultReceived.source.label,'Synthetic recent value','conflicting/null today does not change ranking');
const receivedKey=defaultReceived.sources.find(source=>source.label==='Synthetic older value').key;
const receipt=byKey(healthDashboardModel(received,status,{dashboardMode:'day',dashboardSources:{water:receivedKey}},today),'water');
assert.equal(receipt.lastReceivedDate,today);assert.equal(receipt.lastObservedDate,date(2));
assert.equal(receipt.value,null);assert.equal(receipt.todayValue,null);assert.equal(receipt.points[0].ambiguous,true);
assert.deepEqual(receipt.points[0].rawValues,[2000,3000]);
assert.equal(receipt.sources.find(source=>source.key===receivedKey).lastReceivedDate,today);
assert.equal(receipt.sources.find(source=>source.key===receivedKey).lastReportedDate,date(2));
assert.equal(receipt.sources.find(source=>source.label==='Synthetic null only').lastReceivedDate,today);
assert.equal(receipt.sources.find(source=>source.label==='Synthetic null only').lastReportedDate,null);

// Equal counts alone are insufficient: missing-day positions must match.
const mismatch=structuredClone(data);
mismatch.nutrition=mismatch.nutrition.filter(r=>![date(1),date(9)].includes(r.nutrition_date));
assert.equal(byKey(healthDashboardModel(mismatch,status,{},today),'protein').comparison.reason,'different_coverage_positions');
const matched=structuredClone(data);matched.nutrition=matched.nutrition.filter(r=>![date(1),date(8)].includes(r.nutrition_date));
assert.equal(byKey(healthDashboardModel(matched,status,{},today),'protein').comparison.comparable,true);
assert.equal(byKey(healthDashboardModel(matched,status,{},today),'protein').comparison.currentDays,6);
const low=empty();low.nutrition=[1,2,8,9].map(age=>({nutrition_date:date(age),source:'Synthetic food',protein_g:100}));
assert.equal(byKey(healthDashboardModel(low,status,{},today),'protein').comparison.reason,'insufficient_coverage');

// Devices, unit variants, status and domains are separate identities. Source
// selection is global and does not silently change with the requested interval.
const origins=empty();
origins.sourceMetrics=[metric(date(1),'steps',6000,{source_name:'Synthetic watch'}),metric(date(1),'steps',4000,{source_name:'Synthetic phone'}),
  metric(date(1),'steps',9999,{source_name:'Synthetic watch',unit:'steps'}),metric(date(1),'steps',123,{unit:'km'}),
  metric(date(1),'sleep_duration_h',25),metric(date(1),'total_energy_kcal',1000,{unit:'kJ'}),
  metric(date(20),'active_energy_kcal',500,{canonical_status:'canonical',source_name:'Synthetic old summary'}),
  metric(date(1),'active_energy_kcal',700,{canonical_status:'candidate',source_name:'Synthetic new export'})];
const org=healthDashboardModel(origins,status,{},today);
assert.equal(byKey(org,'steps').sources.length,3);assert.equal(byKey(org,'steps').invalidRows,1);
assert.equal(byKey(org,'sleep').value,null);assert.equal(byKey(org,'totalEnergy').value,null);
assert.equal(byKey(org,'activeEnergy').source.label,'Synthetic new export');assert.equal(byKey(org,'activeEnergy').source.status,'candidate');
const watch=byKey(org,'steps').sources.find(s=>s.label==='Synthetic watch'&&s.unit==='count').key;
const selected=healthDashboardModel(origins,status,{dashboardSources:{steps:watch}},today);
assert.equal(byKey(selected,'steps').value,6000);assert.equal(byKey(selected,'steps').count,1);
const old=byKey(org,'activeEnergy').sources.find(s=>s.label==='Synthetic old summary').key;
assert.equal(byKey(healthDashboardModel(origins,status,{dashboardSources:{activeEnergy:old}},today),'activeEnergy').value,null);
assert.equal(byKey(healthDashboardModel(origins,status,{dashboardPeriod:'30',dashboardSources:{activeEnergy:old}},today),'activeEnergy').value,500);
assert.equal(byKey(healthDashboardModel(origins,status,{dashboardSources:{steps:'not present'}},today),'steps').value,null);
assert.equal(byKey(healthDashboardModel(origins,status,{dashboardSources:{steps:'not present'}},today),'steps').requestedSourceMissing,true);
assert.equal(byKey(healthDashboardModel(origins,status,{dashboardPeriod:'30'},today),'activeEnergy').source.key,byKey(org,'activeEnergy').source.key);

const overlap=empty();overlap.sourceMetrics=[metric(date(1),'steps',12345,{source_name:'Synthetic watch|Synthetic phone'})];
const ov=byKey(healthDashboardModel(overlap,status,{},today),'steps');
assert.equal(ov.value,12345);assert.equal(ov.unresolvedOverlap,true);assert.equal(ov.count,1);
assert.equal(ov.points.find(p=>p.date===date(1)).rawValue,12345);assert.equal(ov.comparison.reason,'overlap_unresolved');assert.match(ov.warning,/deduplicação entre dispositivos não confirmada/);

// Day view reports that day's recorded value; today is explicitly partial.
const day=healthDashboardModel(data,status,{dashboardMode:'day'},today);
assert.equal(day.date,today);assert.equal(day.bounds.days,1);assert.equal(day.day.partial,true);
assert.equal(byKey(day,'water').value,9999);assert.equal(byKey(day,'water').aggregation,'recorded_day');assert.equal(byKey(day,'water').comparison.reason,'day_view');
const historical=healthDashboardModel(data,status,{dashboardMode:'day',dashboardDate:date(1)},today);
assert.equal(byKey(historical,'water').value,1000);assert.equal(byKey(historical,'water').partial,false);assert.equal(historical.day.partial,false);
assert.equal(healthDashboardModel(data,status,{dashboardMode:'day',dashboardDate:'2030-01-01'},today).date,today);
assert.equal(healthDashboardModel(data,status,{dashboardMode:'day',dashboardDate:'2023-02-29'},today).date,today);

// Failed domains never use stale values. Partial loading blocks comparisons.
const failed=healthDashboardModel(data,{...status,nutrition:'error'}, {},today);
assert.equal(byKey(failed,'water').value,null);assert.equal(byKey(failed,'water').availability,'partial');
assert.equal(byKey(healthDashboardModel(data,{...status,sourceMetrics:'error',metrics:'error'},{},today),'steps').availability,'error');
assert.equal(byKey(healthDashboardModel(data,{...status,metrics:'error'},{},today),'activeEnergy').comparison.reason,'partial_sources');

// Review metadata and explicit knownPartial flags are excluded from means.
const reviewData=empty();
const partial=metric(date(1),'dietary_protein_g',400,{source_name:'Synthetic reviewed',knownPartial:true});
reviewData.sourceMetrics=[partial,metric(date(2),'dietary_protein_g',100,{source_name:'Synthetic reviewed'}),metric(date(3),'dietary_protein_g',999,{source_name:'Synthetic reviewed',nutrition_review:{status:'invalid'}})];
const rv=byKey(healthDashboardModel(reviewData,status,{},today),'protein');
assert.equal(rv.value,100);assert.equal(rv.count,1);assert.equal(rv.points.find(p=>p.date===date(3)).eligible,false);

// A verified export taken on its source day stays partial even after today
// advances; source-review metadata is preserved without trusting a status alone.
const verified=empty();
for(const [age,value] of [[1,999],[2,110]]){
  const row=metric(date(age),'dietary_protein_g',value,{source_name:'MyFitnessPal via Apple Health',source_family:'myfitnesspal',source_file:'synthetic-export.xml',source_record_id:`synthetic-reviewed-${age}`});
  row.nutrition_review={schema:'apple_nutrition_source_review_v1',method:'sum_distinct_meal_samples_v1',status:'verified',source_file:row.source_file,source_sha256:'a'.repeat(64),original_source:'MyFitnessPal',metric_date:row.metric_date,source_record_id:row.source_record_id,metric_type:row.metric_type,unit:'g',verified_value:value,exported_at:`${date(1)}T12:00:00-03:00`,sample_count:1,duplicate_count:0};
  verified.sourceMetrics.push(row);
}
const vr=byKey(healthDashboardModel(verified,status,{},today),'protein');
assert.equal(vr.value,110);assert.equal(vr.count,1);assert.equal(vr.points.find(p=>p.date===date(1)).knownPartial,true);
assert.equal(vr.points.find(p=>p.date===date(1)).reviewVerified,true);

const differentUnits=empty();
for(let age=1;age<=14;age++)differentUnits.sourceMetrics.push(metric(date(age),'steps',100,{unit:age<=7?'count':'steps'}));
const unitsModel=healthDashboardModel(differentUnits,status,{},today);
assert.equal(byKey(unitsModel,'steps').sources.length,2);assert.equal(byKey(unitsModel,'steps').comparison.comparable,false);
assert.equal(byKey(unitsModel,'steps').comparison.previousDays,0);
const differentSources=empty();
for(let age=1;age<=14;age++)differentSources.sourceMetrics.push(metric(date(age),'sleep_duration_h',8,{source_name:age<=7?'Synthetic current':'Synthetic previous'}));
assert.equal(byKey(healthDashboardModel(differentSources,status,{},today),'sleep').comparison.previousDays,0);

// New snapshot export leaves the old calendar and calculations untouched.
const legacy=homePeriodModel(data,status,'30',{},today);
assert.equal(legacy.bounds.end,today);assert.equal(legacy.bounds.days,30);
const snap=homePeriodSnapshot(data,status,model.bounds,{},today,model.previousBounds);
assert.deepEqual(snap.bounds,model.bounds);assert.deepEqual(snap.previousBounds,model.previousBounds);
for(const key of ['body','training','nutrition','water','sleep','labs','treatments','polar','coverage','insights','selected','currentMetrics'])assert.ok(Object.hasOwn(snap,key),key);
assert.equal(snap.nutrition.means.protein_g,100);
assert.deepEqual(healthDashboardModel(data,status,{dashboardPeriod:'all'},today).previousBounds,null);
console.log('Health dashboard model: calendar, zero/null, gaps, partials, sources, units, comparisons and snapshot contracts passed.');
