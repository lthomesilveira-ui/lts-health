import assert from 'node:assert/strict';
import fs from 'node:fs';
globalThis.location={search:'?fixture=1'};
const {homePeriodModel}=await import('../../compact-evidence/src/home-period-model.js');
const {homeEvidence}=await import('../../compact-evidence/src/home-evidence-insights.js');
const {homeUsefulContent}=await import('../../compact-evidence/src/home-useful-content.js');
const {homeLabHistory}=await import('../../compact-evidence/src/home-lab-history.js');
const {studyFindings,labComparable}=await import('../src/study-findings.js');
const ready=Object.fromEntries(['body','segmental','workouts','exercises','sets','nutrition','sourceMetrics','metrics','labs','treatments','polarSessions','waterReferences'].map(key=>[key,'ready']));
const clone=value=>structuredClone(value);
const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);for(const item of Object.values(value))freeze(item);}return value;};
function model(data={},status=ready,period='90',ui={},today='2025-04-20'){
 const m=homePeriodModel(data,status,period,ui,today);m.evidence=homeEvidence(data,status,m,ui);m.useful=homeUsefulContent(data,status,m,ui);m.labsHistory=homeLabHistory(data,status,m,ui);
 return {m,result:studyFindings(data,status,m,ui)};
}
const body=[
 {source_record_id:'synthetic-body-a',measured_at:'2025-03-01',source:'Synthetic scale',device_name:'Example model',weight_kg:80,fat_mass_kg:20,skeletal_muscle_mass_kg:30},
 {source_record_id:'synthetic-body-b',measured_at:'2025-03-21',source:'Synthetic scale',device_name:'Example model',weight_kg:79,fat_mass_kg:21,skeletal_muscle_mass_kg:29}
];
function session(id,date,exercise='Exercise A',weight=10,extra={}){
 const workout={source_record_id:`synthetic-workout-${id}`,workout_date:date,is_canonical:true,source:'Synthetic log',location:'Example room',...extra.workout};
 const item={source_record_id:`synthetic-exercise-${id}`,workout_source_record_id:workout.source_record_id,exercise,machine:'Example machine',muscle_group:'Peito',source:'Synthetic log',...extra.exercise};
 const set={source_record_id:`synthetic-set-${id}`,workout_source_record_id:workout.source_record_id,exercise_source_record_id:item.source_record_id,weight,weight_unit:'kg',reps_numeric:8,set_index:1,source:'Synthetic log',...extra.set};
 return {workouts:[workout],exercises:[item],sets:[set]};
}
const merge=(...values)=>{const result={};for(const value of values)for(const[key,rows]of Object.entries(value))result[key]=[...(result[key]||[]),...rows];return result;};
const lab=(biomarker,date,value,extra={})=>({source_record_id:`synthetic-lab-${biomarker}-${date}`,biomarker,collection_date:date,result_numeric:value,result_raw:String(value),unit:'mg/L',laboratory:'Example lab',method:'Example method',reference_range:'2–8',...extra});
const food=(date,value,source='Synthetic food A',extra={})=>({source_record_id:`synthetic-food-${source}-${date}`,nutrition_date:date,source,calories_kcal:value,protein_g:value/10,...extra});
const find=(result,id)=>result.findings.find(item=>item.id===id)||(id==='routine'?result.routineContext||undefined:undefined);
let checks=0;
function test(name,callback){callback();checks++;console.log(`ok ${checks} - ${name}`);}

test('empty/unavailable evidence never fills the three slots',()=>{
 assert.deepEqual(model().result.findings,[]);
 assert.deepEqual(model({body,labs:[lab('Marker A','2025-03-21',3)]},{...ready,body:'error',labs:'error'}).result.findings,[]);
 assert.equal(studyFindings().reason,'invalid_calendar');
});
test('three evidence families use real event dates and joint body endpoints',()=>{
 const data=merge({body},session('a','2025-03-03'),session('b','2025-03-18','Exercise A',12),{nutrition:[food('2025-03-07',1800)],labs:[lab('Marker A','2025-02-14',5),lab('Marker A','2025-03-21',6)]});
 const {result}=model(data);
 assert.deepEqual(result.findings.map(item=>item.id),['body','routine','labs']);
 const b=find(result,'body');assert.equal(b.evidence.metrics.length,3);assert.equal(b.evidence.jointMetrics,true);
 assert.match(b.text,/Peso caiu 1 kg; Gordura estimada subiu 1 kg; Músculo estimado caiu 1 kg/);
 assert.equal(b.dates.start,'2025-03-01');assert.equal(b.dates.end,'2025-03-21');
 assert.ok(b.evidence.metrics.every(metric=>metric.firstDate===b.dates.start&&metric.lastDate===b.dates.end));
 assert.match(b.limits.join(' '),/Condições das avaliações não confirmadas/);
 assert.equal(result.interval.interval.start,'2025-03-02');assert.equal(result.interval.interval.days,20);
 assert.equal(find(result,'routine').action.start,'2025-03-01');
});
test('single assessment is a state; missing endpoints are never joined',()=>{
 let result=model({body:[body[0]]}).result;
 assert.equal(result.findings.length,1);assert.equal(find(result,'body').evidence.kind,'single_body_observation');assert.equal(result.interval,null);
 const data={body:[{...body[0],weight_kg:null,skeletal_muscle_mass_kg:null},{...body[1],fat_mass_kg:null,skeletal_muscle_mass_kg:null}]};
 result=model(data).result;
 assert.equal(find(result,'body').evidence.jointMetrics,false);assert.equal(find(result,'body').evidence.kind,'single_body_observation');
 assert.doesNotMatch(find(result,'body').text,/caiu|subiu/);
});
test('zero survives; negatives, booleans and missing values are not body values',()=>{
 const data={body:[{...body[0],weight_kg:-1,fat_mass_kg:0,skeletal_muscle_mass_kg:false},{...body[1],weight_kg:0,fat_mass_kg:0,skeletal_muscle_mass_kg:''}]};
 const b=find(model(data).result,'body');
 assert.equal(b.evidence.metrics.length,1);assert.equal(b.evidence.metrics[0].delta,0);assert.match(b.text,/se manteve em 0 kg/);assert.doesNotMatch(b.text,/-1|caiu/);
});
test('ambiguous body dates stay excluded rather than silently picked',()=>{
 const extra={...body[0],source_record_id:'synthetic-duplicate',weight_kg:90};
 let result=model({body:[body[0],extra,body[1]]}).result;
 assert.equal(result.interval,null);assert.equal(find(result,'body').evidence.ambiguousDates[0],'2025-03-01');
 result=model({body:[body[0],extra]}).result;assert.deepEqual(result.findings,[]);
});
test('selected body source constrains both finding and interval',()=>{
 const different={...body[0],source:'Other synthetic scale',source_record_id:'synthetic-other'};
 const key=JSON.stringify(['synthetic scale','example model']);
 const {result}=model({body:[...body,different]},ready,'90',{homeBodySource:key});
 assert.equal(result.interval.available,true);assert.equal(find(result,'body').action.context.homeBodySource,key);
 assert.ok(result.interval.options.every(item=>item.source==='Synthetic scale'));
 assert.deepEqual(model({body},ready,'90',{homeBodySource:'missing-source'}).result.findings,[]);
});
test('period and current day drive all endpoints instead of a frozen photograph',()=>{
 const data={body,labs:[lab('Marker A','2025-02-14',5),lab('Marker A','2025-04-05',6)]};
 const earlier=model(data,ready,'90',{},'2025-03-21').result;
 const later=model(data,ready,'30',{},'2025-04-20').result;
 assert.equal(earlier.interval.interval.openToday,true);assert.equal(later.interval,null);
 assert.equal(later.bounds.start,'2025-03-22');assert.equal(later.labTrajectories[0].priorOutside,true);
 assert.match(later.labTrajectories[0].text,/fora do período selecionado/);
 assert.equal(later.labTrajectories[0].periodHistory.length,1);
});
test('routine uses the interval after first assessment through last, never ingestion dates',()=>{
 const data=merge({body},session('before','2025-02-28'),session('first','2025-03-01'),session('inside','2025-03-07','Exercise A',10,{workout:{imported_at:'2030-01-01'}}),session('last','2025-03-21'),session('after','2025-03-22'),{nutrition:[food('2025-03-01',9999),food('2025-03-03',1000),food('2025-03-21',2000),food('2025-03-22',8888)]});
 const routine=find(model(data).result,'routine');
 assert.equal(routine.evidence.training.sessions,2);assert.equal(routine.evidence.training.recordedDays,2);
 const source=routine.evidence.nutrition.sources[0];assert.equal(source.metrics.calories_kcal.mean,1500);assert.equal(source.days,2);
 assert.deepEqual(source.dates,['2025-03-03','2025-03-21']);assert.equal(routine.dates.start,'2025-03-02');
 assert.match(routine.limits.join(' '),/não está confirmado se ocorreram antes/);
});
test('food outside the body interval cannot create or explain an interval finding',()=>{
 const result=model({body,nutrition:[food('2025-03-25',9999)]}).result;
 assert.equal(find(result,'routine'),undefined);assert.doesNotMatch(find(result,'body').text,/aliment|calor|prote/);
});
test('overlapping food sources retain separate means, dates and selection',()=>{
 const data={body,nutrition:[food('2025-03-03',1000),food('2025-03-04',2000),food('2025-03-03',4000,'Synthetic food B'),food('2025-03-25',3000,'Synthetic food C')]};
 const {m}=model(data),selected=m.nutrition.sources.find(source=>source.label==='Synthetic food B').key;
 let routine=find(model(data,ready,'90',{reportNutritionSource:selected}).result,'routine');
 assert.equal(routine.evidence.nutrition.sources.length,2);assert.equal(routine.evidence.nutrition.pooledMean,null);
 assert.deepEqual(routine.evidence.nutrition.sources.map(source=>source.metrics.calories_kcal.mean),[1500,4000]);
 assert.equal(routine.evidence.nutrition.overlaps.length,1);assert.equal(routine.action.context.reportNutritionSource,selected);
 const absent=m.nutrition.sources.find(source=>source.label==='Synthetic food C').key;
 routine=find(model(data,ready,'90',{reportNutritionSource:absent}).result,'routine');
 assert.equal(routine.evidence.nutrition.selectedSourceMissing,true);assert.equal(routine.action.context.reportNutritionSource,absent);
});
test('today, flagged partials, negatives and ambiguity stay outside food means; zero is observed',()=>{
 const data={body,nutrition:[food('2025-03-03',0),food('2025-03-04',-1),food('2025-03-05',3000,'Synthetic food A',{knownPartial:true}),food('2025-03-06',500),food('2025-03-06',700),food('2025-03-21',9000)]};
 const routine=find(model(data,ready,'90',{},'2025-03-21').result,'routine'),source=routine.evidence.nutrition.sources[0];
 assert.equal(source.metrics.calories_kcal.mean,0);assert.equal(source.metrics.calories_kcal.count,1);
 assert.equal(source.partialDays,1);assert.equal(source.ambiguousDays,1);assert.equal(source.openDays,1);assert.equal(routine.evidence.nutrition.closedIntervalDays,19);
 assert.match(routine.limits.join(' '),/Hoje está parcial/);
});
test('verified imported partial nutrition is retained but cannot enter a mean',()=>{
 const row={source_record_id:'synthetic-reviewed',metric_date:'2025-03-05',metric_type:'dietary_energy_kcal',value:1234,unit:'kcal',canonical_status:'candidate',source_family:'myfitnesspal',source_name:'MyFitnessPal via Apple Health',source_file:'synthetic-export.xml'};
 row.nutrition_review={schema:'apple_nutrition_source_review_v1',method:'sum_distinct_meal_samples_v1',status:'verified',source_file:row.source_file,source_sha256:'a'.repeat(64),original_source:'MyFitnessPal',metric_date:row.metric_date,source_record_id:row.source_record_id,metric_type:row.metric_type,unit:row.unit,verified_value:row.value,exported_at:'2025-03-05T10:00:00-03:00',sample_count:2,duplicate_count:0};
 const routine=find(model({body,sourceMetrics:[row]}).result,'routine');
 assert.equal(routine.evidence.nutrition.sources[0].partialDays,1);assert.equal(routine.evidence.nutrition.sources[0].metrics.calories_kcal.count,0);
 assert.equal(routine.hasSupportedConclusion,false);assert.match(routine.text,/não explicam/);
});
test('source outages stay unknown rather than no workouts or complete coverage',()=>{
 const result=model({body,nutrition:[food('2025-03-03',1000)]},{...ready,workouts:'error',sourceMetrics:'error'}).result;
 const routine=find(result,'routine');assert.equal(routine.evidence.training.sessions,null);assert.equal(routine.evidence.nutrition.partial,true);
 assert.match(routine.limits.join(' '),/Treinos não carregaram/);assert.match(routine.limits.join(' '),/integração alimentar está indisponível/);
});
test('duplicate session identity does not inflate totals or preserve child comparisons',()=>{
 const one=session('a','2025-03-03'),two=session('b','2025-03-18');
 const data=merge({body},one,two,{workouts:[{...one.workouts[0],imported_at:'2030-01-01'}]});
 const routine=find(model(data).result,'routine');assert.equal(routine.evidence.training.sessions,1);
 assert.equal(routine.evidence.training.comparisons.allPairs.length,0);assert.ok(routine.evidence.training.duplicates.length>0);
});
test('warmup, working, unknown and extensions remain visibly separate',()=>{
 const s=session('a','2025-03-03');
 const base=s.sets[0];s.sets=['working','warmup','unknown','drop','rest_pause','adjustment'].map((phase,i)=>({...base,source_record_id:`synthetic-phase-${i}`,phase,set_index:i}));
 const t=find(model(merge({body},s)).result,'routine').evidence.training;
 assert.deepEqual(t.phases,{working:1,warmup:1,other:1,unknown:1});assert.equal(t.extensions,2);assert.equal(t.totalSets,6);
});
test('recurrence describes the whole eligible set, including lower and equal loads',()=>{
 const data=merge({body},session('a1','2025-03-03','Exercise A',10),session('a2','2025-03-18','Exercise A',8),session('b1','2025-03-04','Exercise B',0),session('b2','2025-03-19','Exercise B',0),session('z1','2025-03-05','Exercise Z',1),session('z2','2025-03-20','Exercise Z',100));
 const routine=find(model(data).result,'routine'),comparison=routine.evidence.training.comparisons;
 assert.equal(comparison.allPairs.length,3);assert.equal(comparison.strictDocumentaryPairs,0);assert.equal(comparison.recordedCompatiblePairs,0);
 assert.ok(comparison.allPairs.every(pair=>pair.classification==='descriptive'&&!pair.conditionsConfirmed));
 assert.match(routine.text,/Exercise Z teve carga registrada maior/);assert.match(routine.text,/Exercise B manteve a carga registrada/);assert.doesNotMatch(routine.text,/Exercise A|maiores, menores, iguais|par\(es\)/);assert.match(routine.limits.join(' '),/Não estima força/);
 assert.equal(comparison.allPairs.find(pair=>pair.exercise==='Exercise B').first.value,0);
 assert.ok(comparison.allPairs.find(pair=>pair.exercise==='Exercise A').delta<0);
 // Later date/recurrence, not size of gain, decides order. Make A as recent as Z.
 data.workouts.find(row=>row.source_record_id==='synthetic-workout-a2').workout_date='2025-03-20';
 const reordered=find(model(data).result,'routine').evidence.training.comparisons;
 assert.equal(reordered.pairs[0].exercise,'Exercise A');
});
test('apparatus, phase and effort mismatches remove pairs but preserve observations',()=>{
 const explicit={set:{phase:'working',technique:'Example execution',failure:false,near_failure:false}};
 const data=merge({body},session('a','2025-03-03','Exercise A',10,explicit),session('b','2025-03-18','Exercise A',12,explicit));
 let comparison=find(model(data).result,'routine').evidence.training.comparisons;
 assert.equal(comparison.recordedCompatiblePairs,1);assert.equal(comparison.strictDocumentaryPairs,0);
 for(const change of ['machine','phase','effort']){
  const variant=clone(data);if(change==='machine')variant.exercises[1].machine='Other example machine';if(change==='phase')variant.sets[1].phase='warmup';if(change==='effort')variant.sets[1].failure=true;
  comparison=find(model(variant).result,'routine').evidence.training.comparisons;
  assert.equal(comparison.recordedCompatiblePairs,0);assert.equal(comparison.allPairs.length,0);assert.equal(comparison.history.length,2);
 }
 const invalid=clone(data);invalid.sets[0].weight=-1;comparison=find(model(invalid).result,'routine').evidence.training.comparisons;
 assert.equal(comparison.allPairs.length,0);assert.equal(comparison.history.length,2);
});
test('equal windows include dates and denominators without assuming real frequency',()=>{
 const data=merge({body},session('a','2025-03-03','Exercise A',10,{exercise:{muscle_group:'Peito'}}),session('b','2025-03-18','Exercise B',10,{exercise:{muscle_group:'Costas'}}),session('c','2025-03-19','Exercise C',10,{exercise:{muscle_group:'Costas'}}));
 const routine=find(model(data).result,'routine'),windows=routine.evidence.training.windows;
 assert.equal(windows.earlier.days,10);assert.equal(windows.later.days,10);assert.equal(windows.earlier.end,'2025-03-11');assert.equal(windows.later.start,'2025-03-12');
 assert.equal(windows.earlier.sessions,1);assert.equal(windows.later.sessions,2);assert.equal(windows.coverageEstablished,false);
 assert.match(routine.text,/duas janelas de 10 dias/);assert.match(routine.text,/0\/1 → 2\/2 sessões/);
 const odd=model({...data,body:[body[0],{...body[1],measured_at:'2025-03-22'}]}).result;
 assert.equal(find(odd,'routine').evidence.training.windows.omittedMiddleDays,1);
});
test('laboratory ranking is documentary, then comparable/recent/name, never biggest delta',()=>{
 const labs=[lab('Z Marker','2025-02-01',1),lab('Z Marker','2025-03-20',900),lab('A Marker','2025-02-01',5),lab('A Marker','2025-03-20',5),lab('B Marker','2025-02-01',7),lab('B Marker','2025-03-20',6),lab('C Marker','2025-02-01',3),lab('C Marker','2025-03-20',4)];
 let {m}=model({labs});
 m.labsHistory.candidates.find(item=>item.row.biomarker==='Z Marker').document={date:'2025-03-21',source:'synthetic-review.pdf',documentId:'synthetic-document'};
 let result=studyFindings({labs},ready,m);
 assert.deepEqual(result.labTrajectories.map(item=>item.row.biomarker),['Z Marker','A Marker','B Marker']);
 assert.equal(result.findings.length,1);assert.equal(result.labTrajectories.length,3);
 ({m}=model({labs}));result=studyFindings({labs},ready,m);assert.deepEqual(result.labTrajectories.map(item=>item.row.biomarker),['A Marker','B Marker','C Marker']);
 assert.equal(result.labTrajectories[0].delta,0);assert.equal(result.labTrajectories[1].delta,-1);
});
test('method changes suppress comparable delta and preserve both own references',()=>{
 const labs=[lab('Marker A','2025-02-01',0,{reference_range:'0–5'}),lab('Marker A','2025-03-20',3,{method:'Other method',reference_range:'1–7'})];
 const result=model({labs}).result,t=result.labTrajectories[0];
 assert.equal(t.comparable,false);assert.equal(t.delta,null);assert.equal(t.previous.result_numeric,0);
 assert.deepEqual(t.references.map(item=>item.value),['0–5','1–7']);assert.match(t.text,/valores separados/);
 assert.equal(result.labObservations.length,2);assert.equal(find(result,'labs'),undefined);assert.doesNotMatch(t.text,/→/);
});
test('units, labs and ambiguous collection dates never manufacture a laboratory pair',()=>{
 for(const extra of [{unit:'g/L'},{laboratory:'Other example lab'}]){
  const result=model({labs:[lab('Marker A','2025-02-01',2),lab('Marker A','2025-03-20',3,extra)]}).result;
  assert.equal(result.labTrajectories.length,0);assert.equal(result.labObservations.length,2);
 }
 const result=model({labs:[lab('Marker A','2025-02-01',2),lab('Marker A','2025-03-20',3),lab('Marker A','2025-03-20',4)]}).result;
 assert.equal(result.labTrajectories.length,0);assert.equal(result.labObservations.length,3);
});
test('isolated and inequality results remain observations, never a trend',()=>{
 const labs=[lab('Isolated marker','2025-03-20',3),lab('Censored marker','2025-02-01',2),lab('Censored marker','2025-03-20',3,{result_raw:'<3'})];
 const result=model({labs}).result;assert.equal(result.labTrajectories.length,0);assert.equal(find(result,'labs'),undefined);assert.equal(result.labObservations.length,3);
});
test('body action and laboratory action carry period and origin without changing inputs',()=>{
 const data=merge({body},session('a','2025-03-03'),session('b','2025-03-18'),{nutrition:[food('2025-03-03',1000)],labs:[lab('Marker A','2025-02-01',2),lab('Marker A','2025-03-20',3)]});
 const ui={homeTrainingContext:'synthetic-training-choice',homeLabKey:'synthetic-unavailable-choice'};
 const {m}=model(data,ready,'90',ui),before=JSON.stringify({data,m,ui});freeze(data);freeze(m);freeze(ui);
 const result=studyFindings(data,ready,m,ui);
 assert.equal(JSON.stringify({data,m,ui}),before);
 for(const finding of result.findings){assert.equal(finding.action.context.homePeriod,'90');assert.equal(finding.action.context.homeTrainingContext,ui.homeTrainingContext);assert.equal(finding.action.context.reportNutritionSource,m.nutrition.source.key);}
 assert.equal(find(result,'body').action.context.homeLabKey,ui.homeLabKey);assert.equal(find(result,'labs').action.context.homeLabKey,result.labTrajectories[0].key);
});
test('counts or coverage alone do not occupy a finding slot',()=>{
 const data=merge({body},session('a','2025-03-03'),{nutrition:[food('2025-03-03',1000)]});
 const result=model(data).result;
 assert.deepEqual(result.findings.map(item=>item.id),['body']);
 assert.equal(result.routineContext.hasSupportedConclusion,false);
 assert.equal(find(result,'body').evidence.routine.training.sessions,1);
 assert.equal(find(result,'body').evidence.routine.nutrition.sources[0].metrics.calories_kcal.mean,1000);
});
test('changing session counts alone is not a distribution change',()=>{
 const data=merge({body},session('a','2025-03-03','Exercise A'),session('b','2025-03-18','Exercise B'),session('c','2025-03-19','Exercise C'));
 const result=model(data).result;
 assert.equal(result.routineContext.evidence.training.windows.earlier.sessions,1);assert.equal(result.routineContext.evidence.training.windows.later.sessions,2);
 assert.equal(result.routineContext.hasSupportedConclusion,false);assert.equal(result.findings.some(item=>item.id==='routine'),false);
});
test('laboratory signed values are preserved without inventing a nonnegative range',()=>{
 const result=model({labs:[lab('Synthetic signed marker','2025-02-01',-2),lab('Synthetic signed marker','2025-03-20',0)]}).result;
 assert.equal(result.labTrajectories[0].delta,2);assert.equal(result.labTrajectories[0].previous.result_numeric,-2);assert.equal(result.labTrajectories[0].row.result_numeric,0);
});
test('small differences remain visible and absent method labels are not comparable',()=>{
 const b=find(model({body:[{...body[0],weight_kg:80.01},{...body[1],weight_kg:80}]}).result,'body');
 assert.match(b.text,/Peso caiu 0,01 kg/);
 let result=model({labs:[lab('Small marker','2025-02-01',0.004),lab('Small marker','2025-03-20',0.005)]}).result;
 assert.match(result.labTrajectories[0].text,/0,004 mg\/L → 0,005 mg\/L/);
 result=model({labs:[lab('Unknown method marker','2025-02-01',2,{method:'Não informado'}),lab('Unknown method marker','2025-03-20',3,{method:'Não informado'})]}).result;
 assert.equal(result.labTrajectories[0].comparable,false);assert.equal(result.labTrajectories[0].delta,null);
});
test('a laboratory top finding requires comparability or explicit documentary priority',()=>{
 for(const method of [null,'Não informado','Other method']){
  const labs=[lab('Marker A','2025-02-01',2),lab('Marker A','2025-03-20',3,{method})];
  let {m,result}=model({labs});
  assert.equal(result.labTrajectories.length,1);assert.equal(result.labObservations.length,2);assert.equal(find(result,'labs'),undefined);
  m.labsHistory.candidates[0].document={date:'2025-03-21',source:'synthetic-document.pdf',documentId:'synthetic-document'};
  result=studyFindings({labs},ready,m);
  const finding=find(result,'labs');assert.ok(finding);assert.equal(finding.title,'Observações documentadas');assert.equal(finding.presentation,'separate_observations');
  assert.equal(finding.action.label,'Conferir observações e laudo');assert.equal(finding.evidence.kind,'laboratory_documented_observations');
  assert.match(finding.text,/01\/02\/2025: 2 mg\/L; 20\/03\/2025: 3 mg\/L/);assert.doesNotMatch(finding.text,/→|delta|Diferença/);
  assert.equal(finding.evidence.trajectories[0].delta,null);
 }
});
test('unsupported lab observations stay in history but outside promoted finding evidence',()=>{
 const labs=[lab('Comparable marker','2025-02-01',2),lab('Comparable marker','2025-03-20',3),lab('Unknown marker','2025-02-01',2,{method:null}),lab('Unknown marker','2025-03-20',3,{method:null})];
 const result=model({labs}).result;
 assert.equal(result.labTrajectories.length,2);assert.equal(result.labObservations.length,4);assert.equal(find(result,'labs').evidence.trajectories.length,1);
 assert.equal(find(result,'labs').evidence.trajectories[0].row.biomarker,'Comparable marker');
});
test('routine names at most two exercises and retains each selected pair dates',()=>{
 const data=merge({body},session('a1','2025-03-03','Exercise A',10),session('a2','2025-03-20','Exercise A',10),session('b1','2025-03-04','Exercise B',12),session('b2','2025-03-19','Exercise B',14),session('z1','2025-03-05','Exercise Z',1),session('z2','2025-03-18','Exercise Z',100));
 const routine=find(model(data).result,'routine');
 assert.match(routine.text,/Exercise A manteve a carga registrada: 10 kg × 8 repetições \(03\/03\/2025 e 20\/03\/2025\)/);
 assert.match(routine.text,/Exercise B teve carga registrada maior: 12 → 14 kg × 8 repetições \(04\/03\/2025 e 19\/03\/2025\)/);
 assert.doesNotMatch(routine.text,/Exercise Z|maiores, menores, iguais/);assert.equal(routine.evidence.training.comparisons.allPairs.length,3);
});
test('divergent cohorts of one exercise name the selected repetition pair and its dates',()=>{
 const data=merge({body},session('a1','2025-03-03','Exercise A',10),session('a2','2025-03-18','Exercise A',12),session('b1','2025-03-05','Exercise A',20,{set:{reps_numeric:12}}),session('b2','2025-03-20','Exercise A',18,{set:{reps_numeric:12}}));
 const routine=find(model(data).result,'routine');
 assert.equal(routine.evidence.training.comparisons.allPairs.length,2);
 assert.match(routine.text,/Exercise A teve carga registrada menor: 20 → 18 kg × 12 repetições \(05\/03\/2025 e 20\/03\/2025\)/);
 assert.doesNotMatch(routine.text,/03\/03\/2025|18\/03\/2025|cargas maiores/);
});
test('renderer can reuse the same laboratory comparability guard',()=>{
 assert.equal(labComparable(null),false);assert.equal(labComparable(undefined),false);
 const {m}=model({labs:[lab('Marker A','2025-02-01',2),lab('Marker A','2025-03-20',3)]});
 assert.equal(labComparable(m.labsHistory.selected),true);
 const unknown={...m.labsHistory.selected,row:{...m.labsHistory.selected.row,method:'Não informado'},previous:{...m.labsHistory.selected.previous,method:'Não informado'}};
 assert.equal(labComparable(unknown),false);
});
test('module remains isolated, read-only, and independent of literal patient data',()=>{
 const source=fs.readFileSync(new URL('../src/study-findings.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/\b(fetch|XMLHttpRequest|createClient|localStorage|sessionStorage|document\.querySelector)\b/);
 assert.doesNotMatch(source,/\b20\d\d-\d\d-\d\d\b/);
 assert.doesNotMatch(source,/supabase|health-inbox|UTILITY_MATRIX/);
});
console.log(`${checks} synthetic findings contracts passed.`);
