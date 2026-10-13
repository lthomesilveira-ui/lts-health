import assert from 'node:assert/strict';
globalThis.location={search:'?fixture=1'};
const {bodyIntervalModel}=await import('./src/body-interval-model.js');
const status=Object.fromEntries(['body','segmental','workouts','exercises','sets','nutrition','sourceMetrics','metrics','labs'].map(key=>[key,'ready']));
const today='2024-03-12';
const body=(date,extra={})=>({source_record_id:`body-${date}`,measured_at:date,weight_kg:80,skeletal_muscle_mass_kg:30,fat_mass_kg:20,body_fat_pct:25,body_water_l:40,source:'Synthetic BIA',source_file:`synthetic-${date}.pdf`,...extra});
const workout=(id,date,extra={})=>({source_record_id:id,workout_date:date,is_canonical:true,record_status:'validated',duration_minutes:30,...extra});
const metric=(date,type,value,extra={})=>({source_record_id:`synthetic-${date}-${type}`,metric_date:date,metric_type:type,value,unit:type==='sleep_duration_h'?'h':type==='dietary_energy_kcal'?'kcal':type==='dietary_water_ml'?'mL':'g',source_name:'Food via Apple Health',source_family:'test',canonical_status:'candidate',source_file:'synthetic-export.zip',...extra});
const data={
  body:[body('2024-02-20'),body('2024-03-01'),body('2024-03-11',{device_name:'Synthetic Model B',weight_kg:79,skeletal_muscle_mass_kg:29.5,fat_mass_kg:20.5,body_fat_pct:26,body_water_l:39}),body('2024-03-13',{weight_kg:900})],
  segmental:[
    {measured_at:'2024-03-01',body_source_record_id:'body-2024-03-01',source_file:'comparison-synthetic.pdf',lean_right_arm_kg:4.3,lean_left_arm_kg:4.1,fat_right_arm_kg:1},
    {measured_at:'2024-03-11',source_file:'synthetic-2024-03-11.pdf',lean_right_arm_kg:4,lean_left_arm_kg:4.2,fat_right_arm_kg:1.1}
  ],
  workouts:[workout('outside','2024-02-20',{created_at:'2024-03-05'}),workout('start','2024-03-01'),workout('a','2024-03-02'),workout('b','2024-03-11',{duration_minutes:null}),workout('future','2024-03-13'),workout('not-canonical','2024-03-03',{is_canonical:false}),workout('quarantine','2024-03-04',{record_status:'quarantined'})],
  exercises:[
    {source_record_id:'ex-a',workout_source_record_id:'a',muscle_group:'Peitoral'},
    {source_record_id:'ex-b',workout_source_record_id:'b',muscle_group:'peito'},
    {source_record_id:'ex-c',workout_source_record_id:'b',muscle_group:'BICEPS'},
    {source_record_id:'ex-d',workout_source_record_id:'a',muscle_group:null},
    {source_record_id:'ex-old',workout_source_record_id:'outside',muscle_group:'Costas'},
    {source_record_id:'ex-bad-date',workout_source_record_id:'a',workout_date:'2024-02-01',muscle_group:'Costas'}
  ],
  sets:[...['working','warmup','other',null,'drop','rest_pause'].map((phase,i)=>({source_record_id:`set-${i}`,exercise_source_record_id:'ex-a',workout_source_record_id:'a',phase})),
    {exercise_source_record_id:'ex-b',workout_source_record_id:'b',phase:'working'},
    {exercise_source_record_id:'ex-c',workout_source_record_id:'b',phase:'working'},
    {exercise_source_record_id:'ex-d',workout_source_record_id:'a'},
    {exercise_source_record_id:'ex-a',workout_source_record_id:'b',phase:'working'},
    {exercise_source_record_id:'ex-a',workout_source_record_id:'a',workout_date:'2024-02-01',phase:'working'},
    {exercise_source_record_id:'ex-old',workout_source_record_id:'outside',phase:'working'}],
  nutrition:[
    {nutrition_date:'2024-03-01',source:'Food A',protein_g:900,calories_kcal:9000},
    {nutrition_date:'2024-03-02',source:'Food A',protein_g:100,calories_kcal:2000,water_ml:1000},
    {nutrition_date:'2024-03-03',source:'Food A',protein_g:null,calories_kcal:2200},
    {nutrition_date:'2024-03-04',source:'Food B',protein_g:150,calories_kcal:null,water_ml:2000},
    {nutrition_date:'2024-03-05',source:'Food A',protein_g:500},
    {nutrition_date:'2024-03-05',source:'Food A',protein_g:600},
    {nutrition_date:'2024-03-06',source:null,protein_g:999},
    {nutrition_date:'2024-03-13',source:'Food A',protein_g:9999}
  ],
  sourceMetrics:[
    metric('2024-03-02','dietary_protein_g',120),metric('2024-03-02','dietary_energy_kcal',1900),
    metric('2024-03-03','dietary_protein_g',0),metric('2024-03-03','dietary_energy_kcal',2100),
    metric('2024-03-04','dietary_protein_g',80),metric('2024-03-04','dietary_protein_g',180),metric('2024-03-04','dietary_energy_kcal',2300),
    metric('2024-03-06','dietary_protein_g',88,{canonical_status:'held'}),
    metric('2024-03-07','dietary_protein_g',888,{canonical_status:'canonical'}),
    metric('2024-03-01','sleep_duration_h',20,{source_name:'Polar Flow'}),
    metric('2024-03-02','sleep_duration_h',7,{source_name:'Polar Flow'}),
    metric('2024-03-03','sleep_duration_h',9,{source_name:'Polar Flow'}),
    metric('2024-03-02','sleep_duration_h',7,{source_name:'Polar Flow via Apple Health',source_family:'apple_health'}),
    metric('2024-03-03','sleep_duration_h',9,{source_name:'Polar Flow via Apple Health',source_family:'apple_health'}),
    metric('2024-03-04','sleep_duration_h',6,{source_name:'Other Watch'}),
    metric('2024-03-05','sleep_duration_h',7,{source_name:'Polar Flow'}),metric('2024-03-05','sleep_duration_h',7,{source_name:'Polar Flow'}),
    metric('2024-03-11','sleep_duration_h',99,{source_name:'Polar Flow'}),
    metric('2024-03-13','sleep_duration_h',23,{source_name:'Polar Flow'}),
    metric('2024-03-02','dietary_water_ml',1000,{source_name:'Water A',canonical_status:'canonical'}),
    metric('2024-03-03','dietary_water_ml',2500,{source_name:'Water A',canonical_status:'canonical'}),
    metric('2024-03-04','dietary_water_ml',500,{source_name:'Water B'}),
    metric('2024-03-05','dietary_water_ml',4000,{source_name:'Water B'}),metric('2024-03-05','dietary_water_ml',4500,{source_name:'Water B'})
  ],
  metrics:[],
  labs:[
    {collection_date:'2024-03-01',biomarker:'Outside',result_numeric:99},
    {collection_date:'2024-03-02',biomarker:'Synthetic A',result_numeric:5,result_raw:'5',unit:'u',reference_range:'2–8'},
    {collection_date:'2024-03-11',biomarker:'Synthetic B',result_numeric:null,result_raw:'Presente'},
    {collection_date:'2024-03-13',biomarker:'Future',result_numeric:100}
  ]
};
const snapshot=JSON.stringify(data);
function deepFreeze(value){if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(deepFreeze);}return value;}
deepFreeze(data);
let m=bodyIntervalModel(data,status,{},today);
assert.equal(m.available,true);
assert.deepEqual(m.selection,{start:'2024-03-01',end:'2024-03-11',defaulted:true});
assert.equal(m.options.at(-1).date,'2024-03-11');
assert.match(m.options.at(-1).label,/11\/03\/2024/);
assert.deepEqual(m.interval,{start:'2024-03-02',end:'2024-03-11',days:10,closedDays:10,openToday:false,startExcluded:true,endIncluded:true,assessmentStart:'2024-03-01',assessmentEnd:'2024-03-11'});
assert.equal(m.body.changes.weight_kg,-1);
assert.equal(m.body.measurements.find(row=>row.key==='body_fat_pct').deltaUnit,'p.p.');
assert.equal(m.body.comparability.reason,'unknown_model');
assert.equal(m.body.comparability.confirmed,false);
assert.equal(m.body.comparability.previousLabel,'Synthetic BIA · Modelo não informado');
assert.equal(m.segmental.previous.linkedBy,'body_source_record_id');
assert.equal(m.segmental.latest.linkedBy,'source_file');
assert.ok(Math.abs(m.segmental.parts[0].delta+.3)<1e-9);
assert.ok(Math.abs(m.segmental.parts[1].delta-.1)<1e-9,'left and right preserved');
assert.equal(m.segmental.comparability.reason,'unknown_model');
assert.equal(m.training.sessions,2,'import date does not determine event inclusion');
assert.equal(m.training.exercises,4);
assert.equal(m.training.sets,7);
assert.equal(m.training.extensions,2);
assert.equal(m.training.totalSets,9);
assert.deepEqual(m.training.phases,{working:3,warmup:1,other:1,unknown:2});
assert.equal(m.training.recordedMinutes,30);
assert.equal(m.training.durationCoverage,1);
assert.equal(m.training.durationTotal,2);
assert.equal(m.training.durationComplete,false);
assert.equal(m.training.minutes,null);
const invalidDuration=bodyIntervalModel({...data,workouts:data.workouts.map(row=>row.source_record_id==='a'?{...row,duration_minutes:-30}:row)},status,{},today);
assert.equal(invalidDuration.training.durationCoverage,0);
assert.equal(invalidDuration.training.recordedMinutes,null,'negative duration is missing, not a negative sum');
assert.equal(m.training.groupRows.find(row=>row.label==='Peito').primary,5);
assert.equal(m.training.groupRows.find(row=>row.label==='Peito').extensions,2);
assert.equal(m.training.groupRows.find(row=>row.label==='Peito').sessions,2);
assert.equal(m.training.groupRows.find(row=>row.label==='Não informado').primary,1);
const foodA=m.nutrition.canonical.sources.find(source=>source.label==='Food A');
assert.equal(foodA.means.protein_g,100);
assert.equal(foodA.means.calories_kcal,2100);
assert.equal(foodA.counts.protein_g,1);
assert.equal(foodA.counts.calories_kcal,2);
assert.equal(foodA.intervalDays,10);
assert.equal(m.nutrition.canonical.means.protein_g,null);
assert.equal(m.nutrition.canonical.ambiguousDays,1);
assert.equal(m.nutrition.canonical.unknownDays,1);
const candidate=m.nutrition.candidates.sources.find(source=>source.status==='candidate');
assert.equal(candidate.means.protein_g,60);
assert.equal(candidate.counts.protein_g,2);
assert.equal(candidate.counts.calories_kcal,3);
assert.equal(candidate.means.calories_kcal,2100);
assert.equal(candidate.ambiguousDays,1);
assert.equal(candidate.intervalDays,10);
assert.equal(m.nutrition.candidates.sources.find(source=>source.status==='held').means.protein_g,88);
assert.equal(m.nutrition.sources.length,4,'canonical, candidate and held origins stay distinct');
assert.equal(m.sleep.sources.find(source=>source.label==='Polar Flow').mean,8);
assert.equal(m.sleep.sources.find(source=>source.label==='Polar Flow').days,2);
assert.equal(m.sleep.sources.find(source=>source.label==='Polar Flow').ambiguousDays,1);
assert.equal(m.sleep.mirrors.length,2);
assert.equal(m.sleep.uniqueEvidenceCount,3,'mirrored sleep is not independent evidence');
assert.equal(m.sleep.recordedDays,3);
assert.equal(m.sleep.mean,undefined,'no pooled sleep mean');
assert.equal(m.water.mean,undefined,'no pooled water mean');
assert.equal(m.water.sources.length,4);
assert.equal(m.water.sources.find(source=>source.label==='Water A').mean,1750);
assert.equal(m.water.sources.find(source=>source.label==='Water B').mean,500);
assert.equal(m.water.sources.find(source=>source.label==='Water B').ambiguousDays,1);
assert.equal(m.labs.count,2);
assert.equal(m.labs.numericCount,1);
assert.equal(m.labs.rows[0].reference_range,'2–8');
assert.equal(m.endDayEvents.workouts,1);
assert.equal(m.endDayEvents.labs,1);
assert.equal(m.endDayOrderingConfirmed,false);
assert.ok(m.warnings.some(text=>text.includes('horário relativo')));
assert.equal(JSON.stringify(data),snapshot,'model never mutates source objects');

const changedModel={...data,body:[body('2024-03-01',{device_name:'Synthetic Model A'}),body('2024-03-11',{device_name:'Synthetic Model B',weight_kg:78})]};
assert.equal(bodyIntervalModel(changedModel,status,{},today).body.changes.weight_kg,-2,'different models retain descriptive differences');
assert.equal(bodyIntervalModel(changedModel,status,{},today).body.comparability.reason,'different_model');
const sameModel={...data,body:[body('2024-03-01',{device_name:'Synthetic Model B'}),body('2024-03-11',{device_name:'Synthetic Model B'})]};
assert.equal(bodyIntervalModel(sameModel,status,{},today).body.comparability.deviceComparable,true);
assert.equal(bodyIntervalModel(sameModel,status,{},today).body.comparability.confirmed,false,'same model does not prove identical conditions');
const nullMeasures=bodyIntervalModel({...data,body:[body('2024-03-01',{weight_kg:null}),body('2024-03-11',{weight_kg:0,body_water_l:-1})]},status,{},today);
assert.equal(nullMeasures.body.changes.weight_kg,null);
assert.equal(nullMeasures.body.measurements.find(row=>row.key==='weight_kg').current,0);
assert.equal(nullMeasures.body.changes.body_water_l,null);

for(const ui of [
  {bodyIntervalStart:'2024-03-11',bodyIntervalEnd:'2024-03-01'},
  {bodyIntervalStart:'2024-03-01',bodyIntervalEnd:'2024-03-01'},
  {bodyIntervalStart:'2024-03-02',bodyIntervalEnd:'2024-03-11'},
  {bodyIntervalStart:'2024-03-01'},
  {bodyIntervalStart:'2024-02-30',bodyIntervalEnd:'2024-03-11'},
  {bodyIntervalStart:'2024-03-01',bodyIntervalEnd:'2024-03-13'},
  {bodyIntervalStart:'2024-03-01T00:00:00Z',bodyIntervalEnd:'2024-03-11'}
]){const invalid=bodyIntervalModel(data,status,ui,today);assert.equal(invalid.available,false);assert.equal(invalid.interval,null);assert.equal(invalid.training,null,'invalid selection cannot silently choose another pair');}
assert.equal(bodyIntervalModel(data,status,{},'bad-date').reason,'invalid_today');
assert.equal(bodyIntervalModel({...data,body:[body('2024-03-01')]},status,{},today).reason,'insufficient');
assert.equal(bodyIntervalModel({...data,body:[]},status,{},today).reason,'insufficient');
assert.equal(bodyIntervalModel(data,{...status,body:'error'},{},today).reason,'unavailable');
const duplicateBody={...data,body:[...data.body,body('2024-03-11')]};
assert.equal(bodyIntervalModel(duplicateBody,status,{bodyIntervalStart:'2024-03-01',bodyIntervalEnd:'2024-03-11'},today).reason,'ambiguous_selection');
assert.deepEqual(bodyIntervalModel(duplicateBody,status,{},today).selection,{start:'2024-02-20',end:'2024-03-01',defaulted:true});
assert.equal(bodyIntervalModel(duplicateBody,status,{},today).ambiguousDates.length,1);

for(const key of ['workouts','exercises','sets']){
  const failed=bodyIntervalModel(data,{...status,[key]:'error'},{},today);
  assert.equal(failed.training.sets,null);assert.equal(failed.training.phases,null);
  if(key==='workouts')assert.equal(failed.training.sessions,null);
}
for(const key of ['segmental','nutrition','sourceMetrics','labs']){
  const failed=bodyIntervalModel(data,{...status,[key]:'error'},{},today);
  if(key==='nutrition'){assert.equal(failed.nutrition.canonical.available,false);assert.equal(failed.nutrition.canonical.days,null);assert.equal(failed.nutrition.partial,true);assert.equal(failed.water.partial,true);assert.ok(failed.water.sources.every(source=>source.rows.every(row=>row.domain!=='nutrition')));}
  if(key==='sourceMetrics'){assert.equal(failed.nutrition.candidates.available,false);assert.equal(failed.nutrition.partial,true);assert.equal(failed.sleep.partial,true);assert.equal(failed.water.partial,true);assert.equal(failed.sleep.sources.length,0,'stale source metrics are not read after failure');assert.ok(failed.water.sources.every(source=>source.rows.every(row=>row.domain==='nutrition')));}
  if(key==='labs'){assert.equal(failed.labs.available,false);assert.equal(failed.labs.count,null);}
  if(key==='segmental')assert.equal(failed.segmental.available,false);
}
const allSourcesFailed=bodyIntervalModel(data,{...status,nutrition:'error',sourceMetrics:'error',metrics:'error'},{},today);
assert.equal(allSourcesFailed.nutrition.available,false);
assert.equal(allSourcesFailed.water.available,false);
assert.equal(allSourcesFailed.sleep.available,false);
assert.equal(allSourcesFailed.sleep.recordedDays,null);
const empty=bodyIntervalModel({body:data.body,segmental:[],workouts:[],exercises:[],sets:[],nutrition:[],sourceMetrics:[],labs:[]},status,{},today);
assert.equal(empty.training.sessions,0);
assert.equal(empty.training.sets,0);
assert.equal(empty.water.reason,'empty');
assert.equal(empty.water.sources.length,0);
assert.equal(empty.sleep.reason,'empty');
assert.equal(empty.nutrition.canonical.reason,'empty');
assert.equal(empty.labs.count,0);

const unlinked=bodyIntervalModel({...data,segmental:[{...data.segmental[0],body_source_record_id:'wrong-id'},{...data.segmental[1],source_file:'unrelated.pdf'}]},status,{},today);
assert.equal(unlinked.segmental.reason,'unlinked');
assert.equal(unlinked.segmental.parts[0].delta,null);
assert.equal(unlinked.segmental.previous.row,null,'date alone is not evidence of a link');
const duplicateSegment=bodyIntervalModel({...data,segmental:[...data.segmental,data.segmental[1]]},status,{},today);
assert.equal(duplicateSegment.segmental.reason,'ambiguous');
assert.equal(duplicateSegment.segmental.latest.row,null);
assert.equal(duplicateSegment.segmental.parts[0].delta,null);

const currentDay={...data,body:[body('2024-03-01'),body(today)],nutrition:[{nutrition_date:'2024-03-02',source:'Daily Food',protein_g:100,calories_kcal:2000,water_ml:1000},{nutrition_date:today,source:'Daily Food',protein_g:10,calories_kcal:100,water_ml:100}],sourceMetrics:[metric('2024-03-02','dietary_protein_g',100),metric(today,'dietary_protein_g',10),metric('2024-03-02','sleep_duration_h',8,{source_name:'Watch'}),metric(today,'sleep_duration_h',1,{source_name:'Watch'})]};
const open=bodyIntervalModel(currentDay,status,{},today);
assert.equal(open.interval.openToday,true);
assert.equal(open.interval.closedDays,10);
assert.equal(open.nutrition.canonical.sources[0].means.protein_g,100);
assert.equal(open.nutrition.canonical.source.means.protein_g,100);
assert.equal(open.nutrition.canonical.sources[0].openDays,1);
assert.equal(open.nutrition.candidates.sources[0].means.protein_g,100);
assert.equal(open.nutrition.candidates.sources[0].openDays,1);
assert.equal(open.sleep.sources[0].mean,8);
assert.equal(open.sleep.sources[0].openDays,1);
assert.equal(open.water.sources[0].mean,1000);
assert.equal(open.water.sources[0].openDays,1);
assert.ok(open.warnings.some(text=>text.includes('hoje está aberto')));
const onlyToday=bodyIntervalModel({...currentDay,body:[body('2024-03-11'),body(today)]},status,{},today);
assert.equal(onlyToday.interval.closedDays,0);
assert.equal(onlyToday.nutrition.canonical.sources[0].means.protein_g,null);
assert.equal(onlyToday.nutrition.canonical.sources[0].counts.protein_g,0);
assert.equal(onlyToday.sleep.sources[0].mean,null);

const coincident={...data,sourceMetrics:[metric('2024-03-02','sleep_duration_h',7,{source_name:'Watch A'}),metric('2024-03-02','sleep_duration_h',7,{source_name:'Watch B'})]};
assert.equal(bodyIntervalModel(coincident,status,{},today).sleep.mirrors.length,0,'equal values from unrelated devices are not declared mirrors');
const differentFiles={...data,sourceMetrics:[metric('2024-03-02','sleep_duration_h',7,{source_name:'Polar Flow'}),metric('2024-03-02','sleep_duration_h',7,{source_name:'Polar Flow via Apple Health',source_file:'different.zip'})]};
assert.equal(bodyIntervalModel(differentFiles,status,{},today).sleep.mirrors.length,0);
const invalidDuplicate={...data,sourceMetrics:[metric('2024-03-02','sleep_duration_h',7,{source_name:'Watch'}),metric('2024-03-02','sleep_duration_h',99,{source_name:'Watch'}),metric('2024-03-02','dietary_water_ml',1000),metric('2024-03-02','dietary_water_ml',-100)]};
assert.equal(bodyIntervalModel(invalidDuplicate,status,{},today).sleep.sources[0].mean,null,'an invalid conflicting duplicate cannot disappear before ambiguity checks');
assert.equal(bodyIntervalModel(invalidDuplicate,status,{},today).water.sources.find(source=>source.label==='Food via Apple Health').mean,null);
console.log('Body interval: explicit pair, event dates, descriptive differences, verified segment links, phased training, source-specific nutrition/sleep/water, mirror evidence, contextual labs, unavailable/empty separation, open day and immutability passed.');
