import assert from 'node:assert/strict';
import {test} from 'node:test';
import {healthDashboardCalendar} from '../src/health-dashboard-model.js';
import {syntheticNutritionPlanRow} from './documented-nutrition-plan-fixture.mjs';
import {makeDocumentaryNumericPair} from './documentary-numeric-reading-fixture.mjs';
// The inherited report reader imports the legacy shell; all report functions
// remain data-only. These stubs prohibit real auth/network or browser use.
globalThis.location={search:'?fixture'};globalThis.window={};
const {calendarReport:report,calendarReportCalendar:calendar}=await import('../src/calendar-report-model.js');
const today='2024-03-11';
const domains=['body','nutrition','sourceMetrics','metrics','workouts','exercises','sets','workoutEvidence','polarSessions','labs','treatments','regimens','goals','nutritionPlans','meals'];
const status=()=>Object.fromEntries(domains.map(key=>[key,'ready']));
const empty=()=>Object.fromEntries(domains.map(key=>[key,[]]));
const add=(date,n)=>new Date(Date.parse(date+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const food=(date,value=100,extra={})=>({nutrition_date:date,source:'Synthetic food A',protein_g:value,calories_kcal:value*20,water_ml:value*10,carbs_g:value*2,fat_g:value/2,fiber_g:value/10,...extra});
const device=(date,type,value,extra={})=>({metric_date:date,metric_type:type,value,unit:type==='steps'?'count':'kcal',source_name:'Synthetic device A',source_family:'synthetic',canonical_status:'candidate',...extra});
function filled(start='2024-02-26',days=14){const data=empty();for(let i=0;i<days;i++){const date=add(start,i);data.nutrition.push(food(date,i<7?100:110));data.sourceMetrics.push(device(date,'steps',5000+i),device(date,'active_energy_kcal',300+i));}return data;}
const metric=(result,key='protein')=>result.metricsByKey[key];
const bounds=(cal)=>[cal.bounds.start,cal.bounds.end,cal.bounds.days,cal.bounds.closedDays];
function training(){
  const data=filled();
  for(const [i,date] of ['2024-03-01','2024-03-06','2024-03-11'].entries()){
    const id=`synthetic-workout-${i}`,eid=`${id}-e`;
    data.workouts.push({source_record_id:id,workout_date:date,is_canonical:true,record_status:'validated',workout_type:'Synthetic workout',location:'Synthetic location',source:'Synthetic log',duration_minutes:30});
    data.exercises.push({source_record_id:eid,workout_source_record_id:id,workout_date:date,exercise:'Synthetic press',machine:'Synthetic station',muscle_group:'Synthetic literal group',source:'Synthetic log'});
    for(const [j,phase] of ['working','drop'].entries())data.sets.push({source_record_id:`${eid}-${j}`,exercise_source_record_id:eid,workout_source_record_id:id,workout_date:date,set_index:j+1,phase,weight:20+i*5,weight_unit:'kg',reps_numeric:8,technique:'Synthetic normal',failure:false,near_failure:false,source:'Synthetic log'});
    data.polarSessions.push({source_record_id:`synthetic-polar-${i}`,workout_date:date,session_name:'Synthetic device workout',source_name:'Synthetic Polar',duration_minutes:30});
  }
  return data;
}
const lab=(id,date,value,extra={})=>({source_record_id:`synthetic-lab-${id}`,collection_date:date,biomarker:'Synthetic marker',result_numeric:value,result_raw:String(value),unit:'u/L',laboratory:'Synthetic lab',method:'Synthetic method',reference_range:'1 a 20',...extra});
const deepFreeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(deepFreeze);Object.freeze(value);}return value;};

test('default is the preceding complete Monday–Sunday week, including Sunday and year boundaries',()=>{
  assert.deepEqual(bounds(calendar({},today)),['2024-03-04','2024-03-10',7,7]);
  assert.deepEqual(bounds(calendar({},'2024-03-10')),['2024-02-26','2024-03-03',7,7]);
  assert.deepEqual(bounds(calendar({},'2026-01-05')),['2025-12-29','2026-01-04',7,7]);
  assert.deepEqual(bounds(calendar({},'2024-01-01')),['2023-12-25','2023-12-31',7,7]);
  assert.equal(calendar({},today).partial,false);
});
test('calendar months handle leap/nonleap February, differing lengths and January rollover',()=>{
  const cases=[['2024-03-08','2024-02-01','2024-02-29',29],['2023-03-08','2023-02-01','2023-02-28',28],['2024-05-02','2024-04-01','2024-04-30',30],['2024-01-10','2023-12-01','2023-12-31',31],['2100-03-01','2100-02-01','2100-02-28',28]];
  for(const [day,start,end,n] of cases){const result=calendar({calendarReportMode:'month'},day);assert.deepEqual(bounds(result),[start,end,n,n]);assert.equal(result.comparisonDays,Math.min(n,result.previousBounds.days));}
  assert.equal(calendar({calendarReportMode:'month'},'2024-04-01').comparisonDays,29);
  assert.equal(calendar({calendarReportMode:'month'},'2024-03-01').previousComparisonBounds.end,'2024-01-29');
});
test('current weeks/months are explicitly partial through today, future days never form coverage',()=>{
  const week=calendar({calendarReportSelection:'current'},'2024-03-08');
  assert.deepEqual(bounds(week),['2024-03-04','2024-03-08',5,4]);assert.equal(week.nominalBounds.end,'2024-03-10');assert.equal(week.comparisonDays,4);assert.equal(week.previousComparisonBounds.end,'2024-02-29');assert.equal(week.partial,true);
  const month=calendar({calendarReportMode:'month',calendarReportSelection:'current'},'2024-03-31');
  assert.equal(month.bounds.closedDays,30);assert.equal(month.comparisonDays,29);assert.equal(month.comparisonBounds.end,'2024-03-29');
  const first=calendar({calendarReportSelection:'current'},today);assert.equal(first.bounds.closedDays,0);assert.equal(first.comparisonBounds,null);assert.equal(first.comparisonDays,0);
});
test('explicit history selects containing week/month, without reading generic global UI',()=>{
  assert.deepEqual(bounds(calendar({calendarReportSelection:'date',calendarReportDate:'2024-02-29'},today)),['2024-02-26','2024-03-03',7,7]);
  assert.deepEqual(bounds(calendar({calendarReportMode:'month',calendarReportSelection:'date',calendarReportDate:'2024-02'},today)),['2024-02-01','2024-02-29',29,29]);
  assert.equal(calendar({mode:'month',selection:'current',date:'2020-01-01'},today).mode,'week');
  assert.equal(calendar({calendarReportSelection:'date',calendarReportDate:today},today).partial,true);
});
test('invalid/future selected dates fall back visibly; malformed today is rejected',()=>{
  for(const value of ['2024-02-30','2025-01-01','','not-a-date']){const result=calendar({calendarReportSelection:'date',calendarReportDate:value},today);assert.equal(result.selection,'last');assert.equal(result.selectionAdjusted,true);assert.ok(result.selectionNotice);}
  for(const value of ['2024-02-30','bad','2024-03-11T10:00:00',new Date('bad')])assert.throws(()=>calendar({},value),RangeError);
});
test('instant dates use BRT at midnight, year transitions and timezone-independent calendar arithmetic',()=>{
  assert.equal(calendar({},'2024-03-11T01:30:00Z').today,'2024-03-10');
  assert.equal(calendar({},new Date('2024-03-11T03:00:00Z')).today,'2024-03-11');
  assert.equal(calendar({},'2025-01-01T00:00:00Z').today,'2024-12-31');
  assert.equal(calendar({},'2024-03-10T23:30:00-03:00').today,'2024-03-10');
});
test('explicit dashboard calendar recomputes counts and rejects future, invalid, overlapping or unequal comparison windows',()=>{
  const make=explicit=>healthDashboardCalendar({},status(),{dashboardCalendar:explicit},today);
  assert.deepEqual(make({bounds:{start:'2024-03-04',end:'2024-03-10',days:900,closedDays:900}}).bounds,{start:'2024-03-04',end:'2024-03-10',days:7,closedEnd:'2024-03-10',closedDays:7,includesToday:false});
  for(const explicit of [null,{}, {bounds:{start:'2024-03-04',end:'2024-03-12'}},{bounds:{start:'2024-03-10',end:'2024-03-04'}},{bounds:{start:'2024-02-30',end:'2024-03-10'}},{bounds:{start:'2024-03-04',end:'2024-03-10'},previousBounds:{start:'2024-03-04',end:'2024-03-10'}},{bounds:{start:'2024-03-04',end:'2024-03-10'},previousBounds:{start:'2024-02-26',end:'2024-03-02'}}])assert.throws(()=>make(explicit),RangeError);
});
test('weekly metrics reuse strict comparability, source identity and all requested nutrients and existing variables',()=>{
  const model=report(filled(),status(),{},today);
  assert.deepEqual(model.metrics.map(row=>row.key),['water','protein','energy','carbs','fat','fiber','steps','activeEnergy']);
  for(const item of model.metrics){assert.equal(item.count,7);assert.equal(item.expectedDays,7);assert.equal(item.comparison.comparable,true);assert.equal(item.comparison.samePositions,true);assert.equal(item.comparison.currentDays,7);}
  assert.equal(metric(model).value,110);assert.equal(metric(model).comparison.previous,100);assert.equal(metric(model).comparison.delta,10);assert.deepEqual(model.todayMetrics,[]);
});
test('whole-month mean is distinct from the common-prefix delta for 31 vs29 days',()=>{
  const data=empty();for(let i=0;i<29;i++)data.nutrition.push(food(add('2024-02-01',i),100));for(let i=0;i<31;i++)data.nutrition.push(food(add('2024-03-01',i),i<29?110:1000));
  const model=report(data,status(),{calendarReportMode:'month'},'2024-04-10'),item=metric(model);
  assert.equal(item.count,31);assert.equal(item.expectedDays,31);assert.equal(item.value,(29*110+2000)/31);assert.equal(item.comparison.current,110);assert.equal(item.comparison.previous,100);assert.equal(item.comparison.delta,10);assert.equal(item.comparison.commonPrefixDays,29);assert.equal(item.comparison.currentBounds.end,'2024-03-29');assert.match(item.comparison.note,/durações diferentes/);
});
test('macronutrients retain independent coverage, recorded zero, invalid scalars and partial-day exclusions',()=>{
  const data=empty();
  data.nutrition=[food('2024-03-04',100,{carbs_g:200,fat_g:0,fiber_g:null}),food('2024-03-05',100,{carbs_g:null,fat_g:40,fiber_g:20}),food('2024-03-06',100,{carbs_g:400,fat_g:80,fiber_g:30,knownPartial:true}),food('2024-03-07',100,{carbs_g:false,fat_g:-1,fiber_g:'invalid'})];
  const result=report(data,status(),{},today);
  assert.equal(result.metricsByKey.carbs.value,200);assert.equal(result.metricsByKey.carbs.count,1);
  assert.equal(result.metricsByKey.fat.value,20);assert.equal(result.metricsByKey.fat.count,2);
  assert.equal(result.metricsByKey.fiber.value,20);assert.equal(result.metricsByKey.fiber.count,1);
  for(const key of ['carbs','fat','fiber']){assert.equal(result.metricsByKey[key].expectedDays,7);assert.equal(result.metricsByKey[key].comparison.delta,null);}
});
test('nutrient source copies are never added and carbohydrate aliases remain ambiguous on the same day',()=>{
  const data=empty();data.nutrition=[food('2024-03-04',100,{carbs_g:200})];
  data.sourceMetrics=[device('2024-03-04','dietary_carbs_g',200,{unit:'g',canonical_status:'canonical'}),device('2024-03-05','dietary_carbohydrates_g',250,{unit:'g',canonical_status:'canonical'})];
  const result=report(data,status(),{},today),carbs=result.metricsByKey.carbs;
  assert.equal(carbs.value,225);assert.equal(carbs.count,2);assert.equal(carbs.sources.length,2);
  data.sourceMetrics.push(device('2024-03-05','dietary_carbs_g',250,{unit:'g',canonical_status:'canonical'}));
  const pinned=report(data,status(),{calendarReportSources:{carbs:carbs.source.key}},today).metricsByKey.carbs;
  assert.equal(pinned.value,200);assert.equal(pinned.count,1);assert.equal(pinned.ambiguousDays,1);
  data.sourceMetrics.push(device('2024-03-06','dietary_fat_g',500,{unit:'mg',canonical_status:'canonical'}));
  assert.equal(report(data,status(),{},today).metricsByKey.fat.invalidRows,1);
});
test('zero stays observed, missing/invalid/partial/duplicates never become zero or enter means',()=>{
  const data=empty();data.nutrition=[food('2024-03-04',0),food('2024-03-05',null),food('2024-03-06',false),food('2024-03-07',-1),food('2024-03-08',100,{knownPartial:true}),food('2024-03-09',150),food('2024-03-09',150)];
  const item=metric(report(data,status(),{},today));assert.equal(item.value,0);assert.equal(item.count,1);assert.equal(item.expectedDays,7);assert.equal(item.points.at(-1).value,null);assert.equal(item.ambiguousDays,1);assert.equal(item.points[4].value,100);assert.equal(item.points[4].eligible,false);assert.equal(item.comparison.delta,null);
});
test('today is visible only in an open report and excluded from daily means, counts and differences',()=>{
  const data=filled('2024-02-26',15);data.nutrition.find(row=>row.nutrition_date===today).protein_g=99999;
  const first=report(data,status(),{calendarReportSelection:'current'},today);assert.equal(metric(first).value,null);assert.equal(metric(first).count,0);assert.equal(metric(first).expectedDays,0);assert.equal(metric(first).comparison.reason,'no_closed_days');assert.equal(first.todayMetrics.find(row=>row.key==='protein').value,99999);
  const selected=report(data,status(),{calendarReportSelection:'current'},'2024-03-08');assert.equal(metric(selected).count,4);assert.equal(metric(selected).comparison.comparable,false);assert.equal(metric(selected).comparison.reason,'insufficient_coverage');
  assert.deepEqual(report(data,status(),{},today).todayMetrics,[]);
});
test('five days /70% and identical relative positions are both mandatory',()=>{
  const data=filled();data.nutrition=data.nutrition.filter(row=>!['2024-03-02','2024-03-03','2024-03-09','2024-03-10'].includes(row.nutrition_date));
  let item=metric(report(data,status(),{},today));assert.equal(item.count,5);assert.equal(item.comparison.comparable,true);assert.equal(item.comparison.currentCoverage,5/7);
  data.nutrition=data.nutrition.filter(row=>row.nutrition_date!=='2024-03-08');item=metric(report(data,status(),{},today));assert.equal(item.comparison.comparable,false);assert.equal(item.comparison.samePositions,false);
  data.nutrition=data.nutrition.filter(row=>row.nutrition_date!=='2024-03-01');item=metric(report(data,status(),{},today));assert.equal(item.comparison.reason,'insufficient_coverage');assert.equal(item.comparison.currentDays,4);
});
test('same count with different missing-day positions suppresses delta',()=>{
  const data=filled();data.nutrition=data.nutrition.filter(row=>!['2024-02-26','2024-03-05'].includes(row.nutrition_date));
  const item=metric(report(data,status(),{},today));assert.equal(item.count,6);assert.equal(item.comparison.previousDays,6);assert.equal(item.comparison.reason,'different_coverage_positions');assert.equal(item.comparison.delta,null);
});
test('month coverage uses the comparison prefix denominator, and demands70%',()=>{
  const data=empty();for(const start of ['2024-02-01','2024-03-01'])for(let i=0;i<20;i++)data.nutrition.push(food(add(start,i),100));
  let item=metric(report(data,status(),{calendarReportMode:'month'},'2024-04-01'));assert.equal(item.comparison.currentCoverage,20/29);assert.equal(item.comparison.comparable,false);
  for(const start of ['2024-02-01','2024-03-01'])data.nutrition.push(food(add(start,20),100));item=metric(report(data,status(),{calendarReportMode:'month'},'2024-04-01'));assert.equal(item.comparison.comparable,true);
});
test('explicit origin stays selected across history; missing request never falls back',()=>{
  const data=filled();data.nutrition.push(food(today,900,{source:'Synthetic newer B'}));
  const defaultResult=report(data,status(),{},today);assert.equal(metric(defaultResult).source.label,'Synthetic food A');assert.equal(metric(defaultResult).value,110);assert.equal(metric(defaultResult).lastObservedOutsidePeriod,false);assert.equal(metric(defaultResult).sourceSelectionMode,'automatic');
  const ui={calendarReportSources:{protein:'Synthetic food A'},dashboardSources:{protein:'Synthetic newer B'}};
  const chosen=report(data,status(),ui,today);assert.equal(metric(chosen).value,110);assert.equal(ui.dashboardSources.protein,'Synthetic newer B');
  const missing=report(data,status(),{calendarReportSources:{protein:'nonexistent'}},today);assert.equal(metric(missing).requestedSourceMissing,true);assert.equal(metric(missing).value,null);assert.equal(metric(missing).source,null);
});
test('canonical/candidate/held, units and devices remain separate; overlap blocks steps differences',()=>{
  const data=filled();for(const sourceStatus of ['candidate','held'])for(let i=0;i<14;i++)data.sourceMetrics.push(device(add('2024-02-26',i),'dietary_protein_g',999,{unit:'g',source_name:'Synthetic mirror',canonical_status:sourceStatus}));
  data.sourceMetrics.push(device('2024-03-10','dietary_protein_g',999,{unit:'kg'}));
  let model=report(data,status(),{calendarReportSources:{protein:'Synthetic food A'}},today);assert.equal(metric(model).value,110);assert.equal(metric(model).sources.length,3);
  for(const row of data.sourceMetrics)if(row.metric_type==='steps')row.source_name='Synthetic watch | phone';
  model=report(data,status(),{},today);assert.equal(metric(model,'steps').comparison.reason,'overlap_unresolved');assert.equal(metric(model,'steps').comparison.delta,null);
});
test('failed/loading origins do not reuse stale arrays or invent zero counts',()=>{
  const data=training();
  for(const failure of ['error','loading','unavailable']){
    const states={...status(),nutrition:failure,sourceMetrics:failure,metrics:failure,workouts:failure,labs:failure,treatments:failure};
    const model=report(data,states,{},today);for(const item of model.metrics)assert.equal(item.value,null);assert.equal(model.training.sessions,null);assert.equal(model.labs.count,null);assert.equal(model.protocol.count,null);
  }
  const partial=report(filled(),{...status(),sourceMetrics:'error'},{},today);assert.equal(metric(partial).value,110);assert.equal(metric(partial).comparison.reason,'partial_sources');
  const loaded=report(empty(),status(),{},today);assert.equal(loaded.training.sessions,0);assert.equal(loaded.protocol.count,0);assert.equal(loaded.labs.count,0);assert.equal(metric(loaded).value,null);
});
test('training keeps canonical sessions, Polar and main sets/extensions separate without inferred muscle roles',()=>{
  const model=report(training(),status(),{},today),t=model.training;
  assert.equal(t.sessions,1);assert.equal(t.polar.sessions,1);assert.equal(t.recordedMinutes,30);assert.equal(t.sessionSummaries.length,1);assert.equal(t.recordedGroups[0].primary,1);assert.equal(t.recordedGroups[0].extensions,1);assert.equal(t.groupRoles.primary,null);assert.equal(t.groupRoles.secondary,null);assert.equal(t.sessionComparison.delta,null);
  assert.equal(t.progression.comparable.length,1);assert.equal(t.progression.comparable[0].delta,5);assert.equal(t.progression.comparable[0].previous.date,'2024-03-01');assert.equal(t.progression.comparable[0].latest.date,'2024-03-06');assert.equal(t.progression.comparable[0].conditionsConfirmed,false);
});
test('training today and unknown effort never create comparable progression',()=>{
  let data=training();let model=report(data,status(),{calendarReportSelection:'current'},today);assert.equal(model.training.todaySessions.length,1);assert.equal(model.training.progression.comparable.length,0);
  delete data.sets.find(row=>row.phase==='working'&&row.workout_date==='2024-03-06').near_failure;
  model=report(data,status(),{},today);assert.equal(model.training.progression.comparable.length,0);assert.equal(model.training.sessionComparison.comparable,false);
});
test('session-comment conflict excluded by strict71 cannot reappear through reduced dashboard shape',()=>{
  const data=training(),original=data.workouts.find(row=>row.workout_date==='2024-03-06');data.workouts.push({...original,session_comment:'Conflicting synthetic detail'});
  const t=report(data,status(),{},today).training;assert.equal(t.sessions,0);assert.equal(t.partial,true);assert.equal(t.excludedSessions.length,1);assert.equal(t.recordedGroups.length,0);assert.equal(t.progression.comparable.length,0);assert.equal(t.sessionSummaries.length,0);
});
test('exercise identity reused under another parent and mismatched sets stay excluded globally',()=>{
  const data=training(),exercise=data.exercises.find(row=>row.workout_date==='2024-03-06');data.exercises.push({...exercise,workout_source_record_id:'synthetic-workout-0',workout_date:'2024-03-01'});
  const t=report(data,status(),{},today).training;assert.equal(t.sessions,1);assert.equal(t.recordedGroups.length,0);assert.equal(t.partial,true);assert.equal(t.progression.comparable.length,0);assert.equal(t.sessionSummaries[0].coverage.exercises.excluded,1);
});
test('exams have dated collections and immediately prior compatible baseline, including outside report',()=>{
  const data=empty();data.labs=[lab('old','2024-02-01',4),lab('current','2024-03-08',5),lab('today',today,6)];
  const result=report(data,status(),{},today).labs;assert.equal(result.collectionCount,1);assert.equal(result.comparisons[0].delta,1);assert.equal(result.comparisons[0].baselineOutsideWindow,true);assert.equal(result.comparisons[0].previousDate,'2024-02-01');assert.deepEqual(result.todayCollections,[]);
  const current=report(data,status(),{calendarReportSelection:'current'},today).labs;assert.equal(current.collectionCount,1);assert.equal(current.todayCollections.length,1);assert.equal(current.collections[0].date,today);assert.match(current.note,/resultados pontuais/);
});
test('lab limits, method/reference changes and intervening notes block arithmetic',()=>{
  for(const extra of [{result_raw:'<5',result_numeric:5},{method:'Other synthetic method'},{reference_range:'2 a 30'}]){
    const data=empty();data.labs=[lab('prior','2024-02-01',4),lab('current','2024-03-08',5,extra)];assert.equal(report(data,status(),{},today).labs.comparisons[0].delta,null);
  }
  const data=empty();data.labs=[lab('prior','2024-02-01',4),lab('note','2024-03-05',null,{result_raw:'Synthetic note'}),lab('current','2024-03-08',5)];
  const comparison=report(data,status(),{},today).labs.comparisons[0];assert.equal(comparison.previousDate,'2024-03-05');assert.equal(comparison.delta,null);
});
test('documentary numeric73 proof survives laboratoryReport without editing original result',()=>{
  const data=empty(),pair=makeDocumentaryNumericPair();data.labs=[pair.previous,pair.current];
  const result=report(data,status(),{calendarReportMode:'month',calendarReportSelection:'date',calendarReportDate:'2024-07'},'2024-08-01');assert.equal(result.labs.comparisons[0].delta,1);assert.equal(result.labs.comparisons[0].baselineOutsideWindow,true);assert.equal(data.labs[0].result_raw,'73,4(1)');
});
test('a month with no collection does not manufacture daily lab coverage or adherence',()=>{
  const model=report(empty(),status(),{calendarReportMode:'month'},today);assert.equal(model.labs.collectionCount,0);assert.equal(model.labs.comparisons.length,0);assert.equal(model.labs.coverage,undefined);assert.match(model.labs.note,/sem meta de frequência/);
});
test('plan comparison uses identical explicit calendar, latest documented version and opt-in retrospection',()=>{
  const data=filled();data.nutritionPlans=[syntheticNutritionPlanRow('2024-03-08')];
  let model=report(data,status(),{},today);assert.equal(model.nutritionPlan.state,'retrospective_required');assert.deepEqual(model.nutritionPlan.calendar.bounds,model.calendar.bounds);assert.ok(model.nutritionPlan.metrics.every(row=>row.value===null&&row.delta===null));assert.equal(model.nutritionPlan.plan.clinical_start,null);
  model=report(data,status(),{nutritionPlanRetrospective:true},today);assert.equal(model.nutritionPlan.state,'ready');assert.match(model.nutritionPlan.comparisonLabel,/não indica adesão passada/);assert.equal(model.nutritionPlan.metrics.find(row=>row.key==='protein_g').value,110);
  const month=report(data,status(),{calendarReportMode:'month',nutritionPlanRetrospective:true},today);assert.equal(month.nutritionPlan.calendar.bounds.start,'2024-02-01');assert.equal(month.nutritionPlan.calendar.bounds.end,'2024-02-29');assert.equal(month.nutritionPlan.metrics.find(row=>row.key==='protein_g').expectedDays,29);
});
test('no arbitrary targets or causal protocol conclusions; ambiguous events excluded from count',()=>{
  const data=empty();data.goals=[{effective_from:'2024-01-01',protein_g:9999}];data.treatments=[{source_record_id:'synthetic-event',event_date:'2024-03-08',medication:'Synthetic event',source:'Synthetic log'}];
  let model=report(data,status(),{},today);assert.equal(model.nutritionPlan.plan,null);assert.equal(model.nutritionPlan.metrics.length,0);assert.equal(model.protocol.count,1);assert.match(model.protocol.note,/não explicam causalmente/);
  data.treatments.push({...data.treatments[0],medication:'Conflicting synthetic event'});model=report(data,status(),{},today);assert.equal(model.protocol.count,0);assert.equal(model.protocol.ambiguousCount,2);assert.equal(model.protocol.status,'partial');
});
test('inputs remain immutable, historical bounds exclude future observations and strings are inert',()=>{
  const data=training();data.nutrition.push(food('2025-01-01',99999));data.treatments=[{source_record_id:'synthetic-html',event_date:'2024-03-08',medication:'<img onerror="boom">'}];
  const ui={calendarReportSources:{protein:'Synthetic food A'}},before=structuredClone(data),states=status();deepFreeze(data);deepFreeze(ui);deepFreeze(states);
  const result=report(data,states,ui,today);assert.deepEqual(data,before);assert.equal(metric(result).value,110);assert.equal(result.protocol.rows[0].medication,'<img onerror="boom">');assert.equal(result.calendar.bounds.end,'2024-03-10');assert.ok(result.metrics.every(row=>row.points.every(point=>point.date<today)));
});

test('protocol identity conflicts across dates are excluded before selecting the calendar',()=>{
  const data=empty();data.treatments=[{source_record_id:'synthetic-global-event',event_date:'2024-03-08',medication:'Synthetic A'},{source_record_id:'synthetic-global-event',event_date:'2024-02-01',medication:'Synthetic B'}];
  const model=report(data,status(),{},today);assert.equal(model.protocol.count,0);assert.equal(model.protocol.ambiguousCount,1);assert.equal(model.protocol.status,'partial');
});
test('summary states factual comparable averages, not an adherence or improvement score',()=>{
  const model=report(filled(),status(),{},today),summary=model.summary.items.join(' ');assert.match(summary,/média registrada de 1\.000 para 1\.100 mL/);assert.match(summary,/média registrada de 100 para 110 g/);assert.match(summary,/dias equivalentes/);assert.equal(model.score,undefined);
});

test('stricter71 rejection of latest session never promotes an older session or longer gap',()=>{
  const data=training(),original=data.workouts.find(row=>row.workout_date==='2024-03-06');data.workouts.push({...original,raw_exercises:'Conflicting source text'});
  const result=report(data,status(),{},today).training;assert.equal(result.lastRecordAmbiguous,true);assert.equal(result.lastObservedDate,'2024-03-06');assert.equal(result.latest,null);assert.equal(result.lastRegistered,null);assert.equal(result.daysSinceLast,null);assert.equal(result.gapLabel,null);
});

test('read diagnostics distinguish one failed origin with no surviving value from an observed empty source',()=>{
  const states={...status(),sourceMetrics:'error'},result=report(empty(),states,{},today);
  for(const key of ['water','protein','energy','carbs','fat','fiber','steps','activeEnergy']){
    const item=metric(result,key),survivor=['water','protein','energy','carbs','fat','fiber'].includes(key)?'nutrition':'metrics';
    assert.deepEqual(item.domainStates,{[survivor]:'ready',sourceMetrics:'error'});assert.deepEqual(item.failedDomains,['sourceMetrics']);assert.equal(item.readError,true);assert.equal(item.partialRead,true);assert.equal(item.readComplete,false);assert.equal(item.readStatus,'partial');assert.equal(item.coverageUnavailable,true);assert.equal(item.value,null);assert.equal(item.count,0);assert.match(item.readNote,/não carregou/);
  }
  assert.match(result.summary.items.join(' '),/Não é possível confirmar/);
  const loaded=metric(report(empty(),status(),{},today));assert.equal(loaded.readComplete,true);assert.equal(loaded.coverageUnavailable,false);assert.equal(loaded.readError,false);assert.equal(loaded.partialRead,false);assert.equal(loaded.readNote,null);
});
test('a surviving loaded source retains its values and coverage while exposing the failed read',()=>{
  const data=filled();data.metrics=data.sourceMetrics.map(row=>({...row,measured_at:row.metric_date,source:'Synthetic surviving canonical'}));
  const result=report(data,{...status(),sourceMetrics:'error'},{},today);
  for(const key of ['water','protein','energy','carbs','fat','fiber','steps','activeEnergy']){
    const item=metric(result,key);assert.notEqual(item.value,null);assert.equal(item.count,7);assert.equal(item.expectedDays,7);assert.equal(item.readError,true);assert.equal(item.partialRead,true);assert.equal(item.coverageUnavailable,false);assert.match(item.readNote,/somente os registros disponíveis/);assert.equal(item.comparison.delta,null);
  }
});
test('known partial observations are independent of read failures and loading diagnostics',()=>{
  const data=filled();data.nutrition.find(row=>row.nutrition_date==='2024-03-08').knownPartial=true;
  const item=metric(report(data,status(),{},today));assert.equal(item.availability,'partial');assert.equal(item.knownPartial,true);assert.equal(item.count,6);assert.equal(item.readStatus,'ready');assert.equal(item.readError,false);assert.equal(item.partialRead,false);assert.equal(item.readComplete,true);assert.equal(item.coverageUnavailable,false);assert.equal(item.readNote,null);
});
test('all failed or loading origins retain unavailable coverage rather than a false zero-observation claim',()=>{
  for(const state of ['error','loading','unavailable']){
    const result=report(filled(),{...status(),nutrition:state,metrics:state,sourceMetrics:state},{},today);
    for(const item of result.metrics){assert.equal(item.readStatus,state);assert.equal(item.partialRead,false);assert.equal(item.readHasReadySource,false);assert.equal(item.readComplete,false);assert.equal(item.coverageUnavailable,true);assert.equal(item.value,null);assert.equal(item.readError,state==='error');assert.equal(item.readPending,state==='loading');}
  }
  const partial=report(empty(),{...status(),sourceMetrics:'loading'},{},today).metricsByKey.steps;assert.equal(partial.readStatus,'partial');assert.equal(partial.readPending,true);assert.equal(partial.readError,false);assert.equal(partial.coverageUnavailable,true);assert.match(partial.readNote,/carregando/);
});
test('today carries the same read diagnostics, including an observed zero from a surviving source',()=>{
  const data=empty();data.nutrition=[food(today,0)];
  const result=report(data,{...status(),sourceMetrics:'error'},{calendarReportSelection:'current'},today);
  const protein=result.todayMetrics.find(item=>item.key==='protein'),steps=result.todayMetrics.find(item=>item.key==='steps');
  assert.equal(protein.value,0);assert.equal(protein.readError,true);assert.equal(protein.coverageUnavailable,false);assert.equal(steps.value,null);assert.equal(steps.coverageUnavailable,true);assert.deepEqual(steps.failedDomains,['sourceMetrics']);
});
