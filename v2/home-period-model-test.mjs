import assert from 'node:assert/strict';
import {homePeriodModel} from './src/home-period-model.js';

// Synthetic fixtures only. Pure import deliberately has no location/window stub.
const today='2026-10-13';
const shift=n=>new Date(Date.parse(`${today}T12:00:00Z`)+n*86400000).toISOString().slice(0,10);
const status=Object.fromEntries(['nutrition','sourceMetrics','metrics','workouts','exercises','sets','body','labs','treatments','polarSessions'].map(key=>[key,'ready']));
const empty=()=>({nutrition:[],sourceMetrics:[],metrics:[],workouts:[],exercises:[],sets:[],body:[],labs:[],treatments:[],polarSessions:[]});
const food=(date,protein=100,energy=2000,source='Synthetic food')=>({nutrition_date:date,source,protein_g:protein,calories_kcal:energy});
const metric=(date,type,value,source='Synthetic watch',unit='h',canonical='candidate')=>({metric_date:date,metric_type:type,value,unit,source_name:source,source_family:'synthetic',canonical_status:canonical});
const sleep=(date,value=8,source='Synthetic watch')=>metric(date,'sleep_duration_h',value,source);
const water=(date,value=1000,source='Synthetic water')=>metric(date,'dietary_water_ml',value,source,'mL','canonical');
const body=(date,fat=15,muscle=40,device='Synthetic model')=>({source_record_id:`body:${date}`,measured_at:date,fat_mass_kg:fat,skeletal_muscle_mass_kg:muscle,body_fat_pct:20,weight_kg:80,source:'Synthetic assessment',device_name:device});
function workout(data,date,index,sets=2){
  const id=`workout:${index}`,exercise=`exercise:${index}`;
  data.workouts.push({source_record_id:id,workout_date:date,is_canonical:true,record_status:'validated',workout_type:'Synthetic training',location:'Synthetic gym',duration_minutes:30});
  data.exercises.push({source_record_id:exercise,workout_source_record_id:id,workout_date:date,exercise:'Synthetic press',muscle_group:'Peito',machine:'Synthetic machine',order_index:1});
  for(let i=0;i<sets;i++)data.sets.push({source_record_id:`set:${index}:${i}`,workout_source_record_id:id,exercise_source_record_id:exercise,workout_date:date,set_index:i,phase:i===0?'working':'drop',weight:10,reps_numeric:8});
}
function deepFreeze(value){for(const item of Object.values(value))if(item&&typeof item==='object')deepFreeze(item);return Object.freeze(value);}

// Older observations have a deliberately different distribution. No endpoint-
// anchored 7+7 implementation can pass these invariance/sensitivity assertions.
const data=empty();
for(let age=0;age<800;age++){
  const date=shift(-age),protein=age===0?9999:age<30?100:age<90?200:age<365?300:400;
  data.nutrition.push(food(date,protein,protein*20));
  data.sourceMetrics.push(sleep(date,age===0?1:age<30?8:age<90?6:age<365?5:4),water(date,age===0?99999:age<30?1000:age<90?2000:age<365?3000:4000));
}
for(const [index,age]of [5,20,45,80,150,300,500].entries()){
  const date=shift(-age);data.body.push(body(date,10+index,45-index));workout(data,date,index);
  data.labs.push({collection_date:date,biomarker:'Synthetic marker',result_numeric:index,unit:'u',laboratory:'Synthetic lab',method:'Synthetic method',reference_range:'0 a 10'});
}
data.treatments.push({event_date:shift(-60),medication:'Synthetic context'});
data.polarSessions.push({workout_date:shift(-50),duration_minutes:60,source_name:'Synthetic watch'});
const before=structuredClone(data);deepFreeze(data);
const m30=homePeriodModel(data,status,'30',{},today),m90=homePeriodModel(data,status,'90',{},today),m365=homePeriodModel(data,status,'365',{},today),all=homePeriodModel(data,status,'all',{},today);
assert.equal(m30.bounds.start,shift(-29));assert.equal(m90.bounds.start,shift(-89));assert.equal(m365.bounds.start,shift(-364));assert.equal(all.bounds.start,shift(-799));
assert.equal(m30.bounds.closedDays,29);assert.equal(m90.bounds.closedDays,89);assert.equal(m365.bounds.closedDays,364);assert.equal(all.bounds.closedDays,799);
assert.equal(m30.nutrition.means.protein_g,100);
assert.equal(m90.nutrition.means.protein_g,(29*100+60*200)/89);
assert.equal(m365.nutrition.means.protein_g,(29*100+60*200+275*300)/364);
assert.notEqual(m30.summary,m90.summary);assert.notEqual(m90.summary,m365.summary);assert.notEqual(m365.summary,all.summary);
assert.notDeepEqual(m30.insights,m90.insights);
assert.equal(m30.nutrition.caloriesPoints.length,30);assert.equal(m90.nutrition.proteinPoints.length,90);assert.equal(m365.sleep.points.length,365);assert.equal(all.water.points.length,800);
assert.equal(m30.body.rows.length,2);assert.equal(m90.body.rows.length,4);assert.equal(m365.body.rows.length,6);assert.equal(all.body.rows.length,7);
assert.equal(m30.training.sessions,2);assert.equal(m90.training.sessions,4);assert.equal(m365.training.sessions,6);assert.equal(all.training.sessions,7);
assert.equal(m30.labs.collectionCount,2);assert.equal(m90.labs.collectionCount,4);assert.equal(m365.labs.collectionCount,6);
assert.equal(m30.treatments.rows.length,0);assert.equal(m90.treatments.rows.length,1);assert.equal(m90.polar.rows.length,1);
assert.equal(m30.latestWorkout.workout_date,shift(-5));assert.equal(m30.training.points[0].unit,'sessões');
assert.equal(m90.training.primarySets,4);assert.equal(m90.training.extensions,4);assert.equal(m90.training.totalSets,8);
assert.equal(m90.training.groups[0].value,4);assert.equal(m90.training.setPoints[0].value,1);
assert.equal(m90.training.latestWorkout.setCount,1);assert.equal(m90.training.latestWorkout.extensionCount,1);
assert.equal(m30.nutrition.latest.date,today);assert.equal(m30.nutrition.latest.open,true);assert.equal(m30.nutrition.latest.protein_g,9999);
assert.equal(m30.water.mean,1000);assert.equal(m30.sleep.mean,8);assert.equal(m30.water.count,29);
assert.equal(m30.nutrition.counts.protein_g,29);assert.equal(m30.currentMetrics.find(metric=>metric.key==='protein_g').date,today);
assert.equal(m30.previous.bounds.days,30);assert.equal(m30.previous.bounds.closedDays,30);assert.equal(m30.previousBounds.start,shift(-59));assert.equal(m30.previousBounds.end,shift(-30));
assert.equal(m90.previousBounds.days,90);assert.equal(m90.previousBounds.start,shift(-179));assert.equal(m90.previousBounds.end,shift(-90));
assert.equal(m30.nutrition.comparison.protein_g.current,100);assert.equal(m30.nutrition.comparison.protein_g.previous,200);assert.equal(m30.nutrition.comparison.protein_g.delta,-100);
assert.equal(m30.nutrition.comparison.protein_g.currentDays,29);assert.equal(m30.nutrition.comparison.protein_g.previousDays,30);
assert.equal(m90.nutrition.comparison.protein_g.previous,300);assert.equal(m90.sleep.comparison.previous,5);
assert.equal(all.previous,null);assert.equal(all.previousBounds,null);assert.equal(all.sleep.comparison.delta,null);assert.equal(all.sleep.comparison.reason,'history_has_no_previous');
assert.deepEqual(data,before,'no source row or nested array is mutated');
assert.equal(typeof globalThis.location,'undefined','pure model requires no browser globals');
assert.equal(m30.previous.previous,undefined,'previous is standalone, never a recursive Home');

// Change exclusively days 31–90: 30-day answer stays identical, broader scopes change.
const changed=structuredClone(data);
for(const row of changed.nutrition)if(row.nutrition_date>=shift(-89)&&row.nutrition_date<=shift(-30))row.protein_g=500;
for(const row of changed.sourceMetrics)if(row.metric_type==='sleep_duration_h'&&row.metric_date>=shift(-89)&&row.metric_date<=shift(-30))row.value=10;
const changed30=homePeriodModel(changed,status,'30',{},today),changed90=homePeriodModel(changed,status,'90',{},today),changed365=homePeriodModel(changed,status,'365',{},today);
assert.equal(changed30.summary,m30.summary);assert.equal(changed30.nutrition.means.protein_g,m30.nutrition.means.protein_g);
assert.notEqual(changed90.summary,m90.summary);assert.notEqual(changed365.summary,m365.summary);
assert.notEqual(changed90.sleep.mean,m90.sleep.mean);assert.notEqual(changed90.nutrition.means.protein_g,m90.nutrition.means.protein_g);

// Every current observation/point/selection is contained in the same window.
for(const model of [m30,m90,m365,all]){
  const check=date=>assert.ok(date>=model.bounds.start&&date<=model.bounds.end,date);
  model.dates.forEach(check);model.currentMetrics.forEach(point=>check(point.date));
  for(const domain of ['body','training','nutrition','sleep','water','labs','treatments','polar']){
    for(const row of model[domain].rows)check(row.date);
    for(const source of model[domain].sources||[])source.rows.forEach(row=>check(row.date));
  }
  for(const rows of Object.values(model.body.series))rows.forEach(point=>check(point.date));
  for(const domain of ['training','nutrition','sleep','water'])for(const point of model[domain].points||[])check(point.date);
  model.previous?.dates.forEach(date=>assert.ok(date>=model.previousBounds.start&&date<=model.previousBounds.end));
}

// Source origin, metric denominators and explicit selection remain independent.
const multiple=empty();
multiple.nutrition.push(food(shift(-1),100,null),food(shift(-2),null,2000),food(shift(-3),0,0),food(shift(-1),900,9000,'Other synthetic food'));
multiple.sourceMetrics.push(metric(shift(-1),'dietary_protein_g',300,'Synthetic candidate','g'),metric(shift(-1),'dietary_energy_kcal',3000,'Synthetic candidate','kcal'),sleep(shift(-1),8,'Watch A'),sleep(shift(-1),6,'Watch B'),water(shift(-1),0,'Water A'),water(shift(-1),2000,'Water B'));
multiple.metrics.push({measured_at:shift(-1),metric_type:'sleep_duration_h',value:7,unit:'h',source:'Canonical watch'});
let m=homePeriodModel(multiple,status,'30',{reportNutritionSource:'synthetic food',homeSleepSource:'watch a',homeWaterSource:'water a'},today);
assert.equal(m.nutrition.sources.length,3);assert.equal(m.nutrition.means.protein_g,50);assert.equal(m.nutrition.counts.protein_g,2);assert.equal(m.nutrition.means.calories_kcal,1000);assert.equal(m.nutrition.counts.calories_kcal,2);
assert.equal(m.sleep.sources.length,3);assert.equal(m.sleep.mean,8);assert.equal(m.water.sources.length,2);assert.equal(m.water.mean,0);assert.equal(m.water.count,1);
assert.equal(m.water.points.length,1);assert.equal(m.water.points[0].value,0);assert.equal(m.water.coverage.recordedDays,1);
assert.equal(m.nutrition.comparison.protein_g.delta,null);assert.equal(m.nutrition.comparison.protein_g.reason,'source_not_observed');
const candidate=m.nutrition.sources.find(source=>source.label==='Synthetic candidate');
assert.equal(candidate.means.protein_g,300);assert.equal(candidate.means.calories_kcal,3000);assert.equal(candidate.status,'candidate');
m=homePeriodModel(multiple,status,'30',{homeNutritionSource:candidate.key,homeSleepSource:'watch b',homeWaterSource:'water b'},today);
assert.equal(m.nutrition.means.protein_g,300);assert.equal(m.sleep.mean,6);assert.equal(m.water.mean,2000);
m=homePeriodModel(multiple,status,'30',{homeSleepSource:'missing source'},today);
assert.equal(m.sleep.source,null);assert.equal(m.sleep.mean,null);assert.equal(m.sleep.requestedSourceMissing,true,'no substituted source on an explicit selection');

// Sparse evidence stays descriptive even when five recent days exist in each
// full selected period; there is never a silent 7+7 fallback.
const sparse=empty();
for(const age of [1,2,3,4,5,31,32,33,34,35]){sparse.nutrition.push(food(shift(-age),age<30?100:200));sparse.sourceMetrics.push(sleep(shift(-age),7));}
m=homePeriodModel(sparse,status,'30',{},today);
assert.equal(m.nutrition.means.protein_g,100);assert.equal(m.nutrition.comparison.protein_g.comparable,false);assert.equal(m.nutrition.comparison.protein_g.reason,'insufficient_coverage');
assert.equal(m.nutrition.comparison.protein_g.delta,null);assert.equal(m.sleep.comparison.delta,null);
assert.match(m.insights.find(item=>item.kind==='nutrition').text,/5\/29/);assert.match(m.comparisonRule.description,/descritivo/);
assert.doesNotMatch(JSON.stringify(m.insights),/duas semanas|7\+7/);

// No old source, last workout or body measurement is borrowed into current.
const priorOnly=empty();workout(priorOnly,shift(-31),'old');priorOnly.body.push(body(shift(-31)));priorOnly.labs.push({collection_date:shift(-31),biomarker:'Old marker',reference_range:'1 a 2'});
priorOnly.nutrition.push(food(shift(-31),999,9999,'Old source'),food(shift(-1),100,1000,'New source'));
m=homePeriodModel(priorOnly,status,'30',{},today);
assert.equal(m.latestWorkout,null);assert.equal(m.body.latest,null);assert.equal(m.body.rows.length,0);assert.equal(m.labs.count,0);
assert.equal(m.previous.training.sessions,1);assert.equal(m.previous.body.rows.length,1);assert.equal(m.previous.labs.count,1);
assert.equal(m.previous.nutrition.source,null);assert.equal(m.nutrition.comparison.protein_g.reason,'source_not_observed');
assert.equal(m.nutrition.comparison.protein_g.previous,null);

// Failed sources cannot leak stale data or produce an apparently complete trend.
m=homePeriodModel(data,{...status,body:'error',workouts:'error',nutrition:'error',metrics:'error'},'30',{},today);
assert.equal(m.body.available,false);assert.equal(m.body.status,'error');assert.equal(m.body.rows.length,0);assert.equal(m.latestWorkout,null);assert.equal(m.training.status,'error');
assert.equal(m.nutrition.means.protein_g,null);assert.equal(m.nutrition.status,'partial');assert.equal(m.sleep.status,'partial');assert.equal(m.sleep.comparison.delta,null);
m=homePeriodModel(data,{...status,sourceMetrics:'error'},'30',{},today);
assert.equal(m.nutrition.means.protein_g,100);assert.equal(m.nutrition.status,'partial');assert.equal(m.nutrition.comparison.protein_g.reason,'partial_sources');
assert.equal(m.water.mean,null);assert.equal(m.sleep.mean,null);
m=homePeriodModel(data,{...status,sets:'error'},'30',{},today);
assert.equal(m.training.sessions,2);assert.equal(m.training.primarySets,null);assert.equal(m.training.extensions,null);assert.equal(m.training.setPoints.length,0);assert.equal(m.training.status,'partial');

// Ambiguous duplicates are omitted, not counted twice or silently averaged.
const duplicates=empty();
duplicates.nutrition.push(food(shift(-1),100),food(shift(-1),200),food(shift(-2),0));
duplicates.sourceMetrics.push(sleep(shift(-1),8),sleep(shift(-1),8),water(shift(-1),1000),water(shift(-1),2000),water(shift(-2),0));
workout(duplicates,shift(-1),'d');duplicates.sets.push({...duplicates.sets[0]});
duplicates.body.push(body(shift(-1)),body(shift(-1),99));
m=homePeriodModel(duplicates,status,'30',{},today);
assert.equal(m.nutrition.means.protein_g,0);assert.equal(m.nutrition.counts.protein_g,1);assert.equal(m.nutrition.duplicates.find(row=>row.metric==='protein_g').conflicting,true);
assert.equal(m.sleep.count,0);assert.equal(m.sleep.duplicates[0].conflicting,false);assert.equal(m.water.mean,0);assert.equal(m.water.count,1);assert.equal(m.water.duplicates[0].conflicting,true);
assert.equal(m.training.primarySets,0);assert.equal(m.training.extensions,1);assert.equal(m.training.duplicates.length,1);
assert.equal(m.body.latest,null);assert.equal(m.body.series.fat.length,0);assert.equal(m.body.ambiguousDates.length,1);
duplicates.workouts.push({...duplicates.workouts[0]});m=homePeriodModel(duplicates,status,'30',{},today);
assert.equal(m.training.sessions,0);assert.equal(m.training.primarySets,0);assert.equal(m.latestWorkout,null);

// Missing, blank, booleans, negatives, wrong units, invalid and future dates.
const invalid=empty();
for(const date of ['2026-02-30','2026-13-01',shift(1),'not a date']){invalid.nutrition.push(food(date,9999));invalid.sourceMetrics.push(sleep(date,22),water(date,99999));invalid.body.push(body(date));}
invalid.nutrition.push(food(shift(-1),null,''),food(shift(-2),true,-2),food(shift(-3),0,0));
invalid.sourceMetrics.push(sleep(shift(-1),25),sleep(shift(-2),-1),metric(shift(-3),'sleep_duration_h',60,'Wrong unit','min'),water(shift(-1),-1),water(shift(-2),null));
m=homePeriodModel(invalid,status,'30',{},today);
assert.equal(m.nutrition.means.protein_g,0);assert.equal(m.nutrition.counts.protein_g,1);assert.equal(m.nutrition.counts.calories_kcal,1);assert.equal(m.sleep.count,0);assert.equal(m.water.count,0);assert.equal(m.body.rows.length,0);
assert.ok(m.dates.every(date=>date<=today));
assert.throws(()=>homePeriodModel({},status,'30',{},'2026-02-30'),RangeError);

// Local calendar boundaries and late imports use observation dates, not receipt.
const boundary=empty();boundary.nutrition.push({...food(shift(-29),10),created_at:today},{...food(shift(-30),999),created_at:today},food(`${today}T00:05:00-03:00`,9999));
boundary.sourceMetrics.push({...sleep(shift(-20),8),imported_at:shift(2)});
boundary.body.push(body(shift(-29)),body(shift(-1)));
m=homePeriodModel(boundary,status,'30',{overviewBodyDate:shift(-29)},today);
assert.equal(m.nutrition.means.protein_g,10);assert.equal(m.nutrition.rows.length,2);assert.equal(m.nutrition.rows.at(-1).open,true);assert.equal(m.sleep.mean,8);
assert.equal(m.body.selectedDate,shift(-29));assert.equal(m.selectedDate,shift(-29));assert.equal(m.selected.body[0].date,shift(-29));
m=homePeriodModel(boundary,status,'30',{overviewBodyDate:shift(-50)},today);assert.equal(m.body.selectedDate,shift(-1));
const leap=homePeriodModel(empty(),status,'30',{},'2024-03-01');assert.equal(leap.bounds.start,'2024-02-01');assert.equal(leap.bounds.closedDays,29);assert.equal(leap.previousBounds.start,'2024-01-02');assert.equal(leap.previousBounds.end,'2024-01-31');

// Body graph cohorts never certify tissue change or connect unknown models.
const bodySources=empty();bodySources.body.push(body(shift(-10),20,40,'Model A'),body(shift(-2),15,42,'Model B'));
m=homePeriodModel(bodySources,status,'30',{},today);assert.equal(m.body.changes.fat_mass_kg,-5);assert.equal(m.body.comparability.sameModel,false);assert.equal(m.body.comparability.reason,'different_model');assert.equal(m.body.comparability.confirmed,false);assert.notEqual(m.body.series.fat[0].cohort,m.body.series.fat[1].cohort);
bodySources.body[1].device_name='Model A';m=homePeriodModel(bodySources,status,'30',{},today);assert.equal(m.body.comparability.sameModel,true);assert.equal(m.body.comparability.conditionsConfirmed,false);assert.equal(m.body.comparability.confirmed,false);
delete bodySources.body[1].device_name;m=homePeriodModel(bodySources,status,'30',{},today);assert.equal(m.body.series.fat[1].cohort,null);assert.equal(m.body.comparability.reason,'unknown_model');

// A set from another session/date/exercise cannot attach to the latest session.
const mismatch=empty();workout(mismatch,shift(-1),'m');
mismatch.sets.push({...mismatch.sets[0],source_record_id:'foreign',workout_date:shift(-2)},{...mismatch.sets[0],source_record_id:'foreign-ex',exercise_source_record_id:'other'});
m=homePeriodModel(mismatch,status,'30',{},today);assert.equal(m.training.primarySets,1);assert.equal(m.training.extensions,1);assert.equal(m.training.latestExercises[0].recordedSets.length,2);
assert.ok(!('load' in m.training)&&!('tonnage' in m.training),'training does not manufacture global apparatus load');

const noData=homePeriodModel(empty(),status,'all',{},today);assert.equal(noData.bounds.start,today);assert.equal(noData.bounds.closedDays,0);assert.equal(noData.body.status,'empty');assert.equal(noData.water.mean,null);assert.equal(noData.latestWorkout,null);
console.log('Home period model: pure import, 30/90/365/all sensitivity, same-window summaries/series, equal previous windows, explicit source/variable coverage, zero vs missing, today/late dates/leap year, source failures, duplicate isolation, recorded sets/extensions, body comparability, selected dates, lab references and non-mutation passed.');
