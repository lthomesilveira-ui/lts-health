import assert from 'node:assert/strict';
import test from 'node:test';
globalThis.location={search:'?fixture=1'};
const {homePeriodModel}=await import('../src/home-period-model.js');
const {homeEvidence}=await import('../src/home-evidence-insights.js');
const {homeUsefulContent,homeTrainingContextKey}=await import('../src/home-useful-content.js');
const status=Object.fromEntries(['body','nutrition','sourceMetrics','metrics','workouts','exercises','sets','labs','goals','waterReferences','treatments','polarSessions'].map(key=>[key,'ready']));
const empty=()=>({body:[],nutrition:[],sourceMetrics:[],metrics:[],workouts:[],exercises:[],sets:[],labs:[],goals:[],waterReferences:[],treatments:[],polarSessions:[]});
const model=(data,period='30',ui={},today='2024-08-01',state=status)=>{const m=homePeriodModel(data,state,period,ui,today);m.evidence=homeEvidence(data,state,m,ui);return m;};
const content=(data,period='30',ui={},today='2024-08-01',state=status)=>homeUsefulContent(data,state,model(data,period,ui,today,state),ui);
const body=(date,weight=80,fat=20,muscle=30,extra={})=>({source_record_id:`body:${date}`,measured_at:date,source:'Synthetic assessment',device_name:'Synthetic model',weight_kg:weight,fat_mass_kg:fat,skeletal_muscle_mass_kg:muscle,...extra});
function addExercise(data,{name='Synthetic press',machine='Synthetic machine',place='Synthetic gym',dates=['2024-07-03','2024-07-25'],loads=[40,40],reps=8,phase=null,id='press',extra={}}={}){
  dates.forEach((date,index)=>{const w=`workout:${id}:${index}`,e=`exercise:${id}:${index}`,s=`set:${id}:${index}`;
    data.workouts.push({source_record_id:w,workout_date:date,source:'Synthetic training diary',location:place,is_canonical:true});
    data.exercises.push({source_record_id:e,workout_source_record_id:w,exercise:name,machine,source:'Synthetic exercise diary'});
    data.sets.push({source_record_id:s,workout_source_record_id:w,exercise_source_record_id:e,weight:loads[index]??loads.at(-1),weight_unit:'kg',reps_numeric:reps,phase,source:'Synthetic set diary',...extra});
  });
}
const day=(n,month='07')=>`2024-${month}-${String(n).padStart(2,'0')}`;
function foodData(){const data=empty();for(let i=1;i<=12;i++)data.nutrition.push({source_record_id:`food:${i}`,nutrition_date:day(i),source:'Synthetic diary',calories_kcal:i<=6?2400:1800,protein_g:i<=6?120:90});for(let i=1;i<=6;i++)data.workouts.push({source_record_id:`food-workout:${i}`,workout_date:day(i),is_canonical:true});return data;}

for(const [period,expected]of [['30','2024-07-03'],['90','2024-05-04'],['365','2023-08-03'],['all','2022-01-01']])test(`${period}: body endpoints and all domains share the selected calendar`,()=>{
  const data=empty();data.body=['2022-01-01','2023-08-03','2024-05-04','2024-07-03','2024-07-25','2024-08-02'].map((date,i)=>body(date,80+i,20+i,30+i));
  addExercise(data,{dates:['2024-05-04','2024-07-03','2024-07-25'],loads:[20,30,40]});
  data.nutrition=data.body.map(row=>({nutrition_date:row.measured_at,source:'Synthetic diary',calories_kcal:1500}));
  const m=model(data,period),result=homeUsefulContent(data,status,m);
  assert.equal(result.body.first.date,expected);assert.equal(result.body.latest.date,'2024-07-25');
  assert.ok(result.training.contexts.every(context=>context.dates.every(date=>date>=m.bounds.start&&date<=m.bounds.end)));
  assert.ok(result.nutrition.dates.every(date=>date>=m.bounds.start&&date<m.today));
  assert.ok(!JSON.stringify(result).includes('2024-08-02'));
});

test('moving calendar removes an endpoint and a persisted training context without substitution',()=>{
  const data=empty();data.body=[body('2024-07-03'),body('2024-07-25',79,21,29)];addExercise(data);
  addExercise(data,{id:'recent',name:'Synthetic row',dates:['2024-07-15','2024-07-26']});
  const ui={homeTrainingContext:homeTrainingContextKey('Synthetic press','Synthetic machine','Synthetic gym')};
  const before=content(data,'30',ui),after=content(data,'30',ui,'2024-08-02');
  assert.equal(before.body.metrics.weight_kg.delta,-1);assert.equal(before.body.metrics.fat_mass_kg.delta,1);assert.equal(before.training.selected.exercise,'Synthetic press');
  assert.equal(after.body.pair,false);assert.equal(after.body.metrics.weight_kg.delta,null);
  assert.equal(after.training.requestedContextMissing,true);assert.equal(after.training.selected,null);assert.deepEqual(after.training.summary,[]);
  assert.equal(after.training.contexts[0].exercise,'Synthetic row');assert.match(after.training.selectionMessage,/nenhuma substituição/);
});

test('body omits absent metrics, preserves explicit zero and exposes source/date/formula/IDs',()=>{
  const data=empty();data.body=[body('2024-07-05',80,null,30),body('2024-07-15',79,0,29,{source:'Synthetic second source',device_name:null})];
  const b=content(data).body;assert.equal(b.metrics.weight_kg.delta,-1);assert.equal(b.metrics.fat_mass_kg.delta,null);assert.equal(b.metrics.fat_mass_kg.latest,0);
  assert.equal(b.metrics.weight_kg.formula,'79 - 80');assert.equal(b.metrics.weight_kg.firstId,'body:2024-07-05');
  assert.match(b.metrics.weight_kg.lastSource,/Synthetic second source/);assert.doesNotMatch(b.text,/Gordura estimada:/);
  assert.match(b.context,/05\/07\/2024 → 15\/07\/2024/);assert.equal(b.conditionsConfirmed,false);
});

test('body excludes duplicate dates instead of choosing their largest or latest value',()=>{
  const data=empty();data.body=[body('2024-07-05',80),body('2024-07-05',85,null,null,{source_record_id:'duplicate'}),body('2024-07-10',79),body('2024-07-20',78),body('2024-07-25',70),body('2024-07-25',69,null,null,{source_record_id:'last-duplicate'})];
  const b=content(data).body;assert.deepEqual(b.ambiguousDates,['2024-07-05','2024-07-25']);assert.equal(b.first.date,'2024-07-10');assert.equal(b.latest.date,'2024-07-20');assert.equal(b.metrics.weight_kg.delta,-1);assert.match(b.context,/ficaram fora/);
});

test('single body date, absent selected origin and unavailable readings cannot generate differences',()=>{
  const data=empty();data.body=[body('2024-07-05')];assert.equal(content(data).body.metrics.weight_kg.delta,null);
  const absent=content(data,'30',{homeBodySource:'absent'}).body;assert.equal(absent.requestedSourceMissing,true);assert.equal(absent.latest,null);
  assert.equal(content(data,'30',{},'2024-08-01',{...status,body:'error'}).body.available,false);
});

test('training chooses recurrence and recency before favorable deltas and shows distinct exercises',()=>{
  const data=empty();
  addExercise(data,{id:'fall',name:'Synthetic recurring fall',dates:['2024-07-06','2024-07-12','2024-07-24'],loads:[90,80,70]});
  addExercise(data,{id:'flat',name:'Synthetic newer flat',dates:['2024-07-10','2024-07-27'],loads:[40,40]});
  addExercise(data,{id:'gain',name:'Synthetic older increase',dates:['2024-07-08','2024-07-20'],loads:[10,100]});
  addExercise(data,{id:'same',name:'Synthetic recurring fall',machine:'Other synthetic machine',dates:['2024-07-05','2024-07-26'],loads:[15,25]});
  const t=content(data).training;assert.deepEqual(t.summary.map(row=>row.exercise),['Synthetic recurring fall','Synthetic newer flat']);
  assert.equal(t.summary[0].summaries[0].delta,-20);assert.equal(t.summary[1].summaries[0].delta,0);assert.equal(t.summary.length,2);
  assert.match(t.context,/não confirmam a estação física/);assert.match(t.summary[0].summaries[0].phaseLabel,/não informada/);
  assert.match(t.summary[0].summaries[0].effortLabel,/não informado/);
});

test('training groups every repetition cohort, preserves effort/phase separation and all source history',()=>{
  const data=empty();addExercise(data,{reps:8,loads:[50,45],id:'r8'});addExercise(data,{reps:10,loads:[40,45],id:'r10'});
  addExercise(data,{reps:6,loads:[60,65],id:'effort',phase:'working',extra:{failure:true,near_failure:false}});
  addExercise(data,{reps:12,loads:[20,20],id:'different',machine:'Other synthetic machine',dates:['2024-07-13']});
  const one=data.sets[0];data.sets.push({...one,source_record_id:'extension',phase:'drop',weight:10,reps_numeric:18});
  const t=content(data).training;assert.equal(t.contexts.length,1);assert.equal(t.selected.cohorts.length,3);assert.deepEqual(t.selected.summaries.map(row=>row.reps),[6,8,10]);
  assert.equal(t.detail.contexts.length,2);assert.equal(t.selected.details.contexts.length,2);assert.ok(t.selected.details.contexts.some(context=>context.machine==='Other synthetic machine'));assert.equal(t.detail.history.length,8);assert.ok(t.detail.history.some(row=>row.set.source_record_id==='extension'));
  assert.ok(t.selected.sourceSetIds.includes('set:r8:0'));assert.ok(t.selected.sources.includes('Synthetic training diary'));
  assert.equal(t.selected.physicalStationConfirmed,false);assert.equal(t.selected.summaries[0].phaseConfirmedFromOriginal,false);
});

test('explicit training choice persists and a missing key never falls back',()=>{
  const data=empty();addExercise(data);addExercise(data,{name:'Synthetic row',id:'row'});
  const key=homeTrainingContextKey('Synthetic row','Synthetic machine','Synthetic gym');const t=content(data,'30',{homeTrainingContext:key}).training;
  assert.equal(t.selected.key,key);assert.equal(t.selectedByUser,true);assert.equal(t.summary[1].exercise,'Synthetic press');
  const missing=content(data,'30',{homeTrainingContext:'missing'}).training;assert.equal(missing.selected,null);assert.equal(missing.requestedContextMissing,true);assert.equal(missing.summary.length,0);
});

test('ambiguous training loads never turn into a selected maximum',()=>{
  const data=empty();addExercise(data);data.sets.push({...data.sets[0],source_record_id:'conflict',weight:999});
  const t=content(data).training;assert.equal(t.selected,null);assert.equal(t.contexts.length,0);
});

test('nutrition compares only a selected origin and has per-variable groups and dates',()=>{
  const data=foodData();data.nutrition.push(...data.nutrition.map(row=>({...row,source:'Other synthetic diary',calories_kcal:9000,protein_g:900})));
  const m=model(data,'90'),key=m.nutrition.sources.find(source=>source.label==='Synthetic diary').key;
  const n=content(data,'90',{homeNutritionSource:key}).nutrition;const energy=n.metrics.calories_kcal;
  assert.equal(energy.training.mean,2400);assert.equal(energy.other.mean,1800);assert.equal(energy.training.count,6);assert.equal(energy.other.count,6);assert.equal(energy.comparisonEligible,true);
  assert.equal(energy.difference,600);assert.equal(energy.overall.mean,2100);assert.equal(n.metrics.protein_g.overall.mean,105);assert.equal(n.pooledMean,null);
  assert.deepEqual(energy.training.dates,[1,2,3,4,5,6].map(i=>day(i)));assert.equal(n.sourceKey,key);assert.match(n.text,/demais dias com diário/);assert.match(n.context,/não confirmam descanso/);
});

test('nutrition threshold is per metric; missing field values never become zero',()=>{
  const data=foodData();data.nutrition[0].protein_g=null;data.nutrition[1].protein_g=null;
  const n=content(data,'90').nutrition;assert.equal(n.metrics.calories_kcal.comparisonEligible,true);assert.equal(n.metrics.protein_g.comparisonEligible,false);
  assert.equal(n.metrics.protein_g.training.count,4);assert.equal(n.metrics.protein_g.overall.count,10);assert.equal(n.metrics.protein_g.training.mean,120);
  assert.match(n.text,/Proteína média observada/);assert.match(n.text,/01\/07\/2024|03\/07\/2024/);
  assert.equal(n.metrics.fiber_g.overall.mean,null);assert.equal(n.metrics.fiber_g.overall.count,0);
});

test('nutrition insufficient groups retain exact existing means, dates and explicit zero',()=>{
  const data=foodData();data.nutrition=data.nutrition.slice(0,8);data.nutrition[0].calories_kcal=0;
  const n=content(data,'90').nutrition;assert.equal(n.metrics.calories_kcal.comparisonEligible,false);assert.equal(n.metrics.calories_kcal.training.count,6);assert.equal(n.metrics.calories_kcal.other.count,2);
  assert.equal(n.metrics.calories_kcal.overall.mean,1950);assert.equal(n.metrics.calories_kcal.overall.dates.length,8);assert.match(n.text,/Média|média observada/);
});

test('nutrition duplicate values are excluded per metric without inflating date counts',()=>{
  const data=foodData();data.nutrition.push({...data.nutrition[0],source_record_id:'duplicate',protein_g:null});
  const n=content(data,'90').nutrition;assert.equal(n.metrics.calories_kcal.training.count,5);assert.equal(n.metrics.calories_kcal.overall.count,11);
  assert.equal(n.metrics.protein_g.training.count,5,'upstream ambiguous source field is not repaired by this module');
  assert.ok(!n.metrics.calories_kcal.training.dates.includes('2024-07-01'));
});

test('nutrition excludes current/future dates, partial exports and invalid source reviews',()=>{
  const data=foodData();const makeMetric=(date,value,exportDate='2024-07-13')=>{const id=`metric:${date}`;return {source_record_id:id,metric_date:date,metric_type:'dietary_energy_kcal',value,unit:'kcal',source_family:'myfitnesspal',source_name:'MyFitnessPal via Apple Health',source_file:'synthetic.zip',canonical_status:'candidate',nutrition_review:{schema:'apple_nutrition_source_review_v1',method:'sum_distinct_meal_samples_v1',status:'verified',source_record_id:id,metric_date:date,metric_type:'dietary_energy_kcal',unit:'kcal',verified_value:value,source_file:'synthetic.zip',source_sha256:'a'.repeat(64),original_source:'MyFitnessPal',exported_at:`${exportDate}T12:00:00-03:00`,sample_count:1,duplicate_count:0}};};
  data.sourceMetrics=[makeMetric('2024-07-12',2000),makeMetric('2024-07-13',10)];
  data.nutrition.push({nutrition_date:'2024-08-01',source:'Synthetic diary',calories_kcal:9999},{nutrition_date:'2024-08-02',source:'Synthetic diary',calories_kcal:9999});
  let m=model(data,'90');const key=m.nutrition.sources.find(source=>source.domain==='sourceMetrics').key;
  const n=content(data,'90',{homeNutritionSource:key}).nutrition;assert.equal(n.metrics.calories_kcal.overall.mean,2000);assert.deepEqual(n.metrics.calories_kcal.overall.dates,['2024-07-12']);assert.deepEqual(n.knownPartialDates,['2024-07-13']);assert.equal(n.sourceStatus,'candidate');assert.equal(n.reviewVerified,true);
  const diary=m.nutrition.sources.find(source=>source.domain==='nutrition').key;assert.equal(content(data,'90',{homeNutritionSource:diary}).nutrition.metrics.calories_kcal.overall.count,12);
  data.sourceMetrics[0].nutrition_review.verified_value=999;const invalid=content(data,'90',{homeNutritionSource:key}).nutrition;assert.equal(invalid.metrics.calories_kcal.overall.mean,null);
});

test('nutrition absent chosen source and failed workout read do not imply missing consumption or rest',()=>{
  const data=foodData();const missing=content(data,'90',{homeNutritionSource:'absent'}).nutrition;assert.equal(missing.source,null);assert.equal(missing.requestedSourceMissing,true);assert.equal(missing.metrics.calories_kcal.overall.count,0);
  const failed=content(data,'90',{},'2024-08-01',{...status,workouts:'error'}).nutrition;assert.equal(failed.trainingAvailable,false);assert.equal(failed.metrics.calories_kcal.other.count,0);assert.equal(failed.metrics.calories_kcal.overall.count,12);assert.equal(failed.metrics.calories_kcal.comparisonEligible,false);
  assert.match(failed.context,/não indica ausência de consumo/);assert.match(failed.context,/separação dos dias não foi realizada/);
});

test('duplicate workout identity still establishes only one registered date for nutrition',()=>{
  const data=foodData();data.workouts.push({...data.workouts[0]});const n=content(data,'90').nutrition;
  assert.equal(n.metrics.calories_kcal.training.count,6);assert.equal(n.workoutDates.length,6);assert.equal(n.metrics.calories_kcal.other.count,6);
});

test('defensive nutrition path excludes partial/open/mismatched rows and ambiguous metrics',()=>{
  const data=foodData(),m=model(data,'90');const source=m.nutrition.source.key;
  m.nutrition.closedRows.push({date:'2024-07-14',source,calories_kcal:999,knownPartial:true},{date:'2024-07-15',source,calories_kcal:999,open:true},{date:'2024-07-16',source:'different',calories_kcal:999},{date:'2024-07-17',source,calories_kcal:999},{date:'2024-07-17',source,calories_kcal:999});
  const n=homeUsefulContent(data,status,m).nutrition;assert.equal(n.excludedRows.length,3);assert.equal(n.metrics.calories_kcal.overall.count,12);assert.deepEqual(n.metrics.calories_kcal.overall.ambiguousDates,['2024-07-17']);
});

test('pure results do not mutate deeply frozen inputs or require browser state',()=>{
  const data=foodData();data.body=[body('2024-07-03'),body('2024-07-25',79,21,29)];addExercise(data);
  const m=model(data,'90'),ui={},before=JSON.stringify({data,m,ui});
  const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};freeze(data);freeze(m);freeze(ui);
  const a=homeUsefulContent(data,status,m,ui),b=homeUsefulContent(data,status,m,ui);assert.deepEqual(a,b);assert.equal(JSON.stringify({data,m,ui}),before);assert.equal(Object.hasOwn(a,'labs'),false);
});


test('nutrition comparison requires five observed values in each group, independently of unrelated source failure',()=>{
  const data=foodData();data.nutrition=data.nutrition.filter(row=>!['2024-07-06','2024-07-12'].includes(row.nutrition_date));
  const n=content(data,'90',{},'2024-08-01',{...status,sourceMetrics:'error'}).nutrition;
  assert.equal(n.metrics.calories_kcal.training.count,5);assert.equal(n.metrics.calories_kcal.other.count,5);assert.equal(n.metrics.calories_kcal.comparisonEligible,true);
  data.nutrition=data.nutrition.filter(row=>row.nutrition_date!=='2024-07-11');assert.equal(content(data,'90').nutrition.metrics.calories_kcal.comparisonEligible,false);
});
