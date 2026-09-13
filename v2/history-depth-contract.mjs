import assert from 'node:assert/strict';
globalThis.location={search:'?fixture=1'};
const {state}=await import('./src/core.js');
const {validDay,pageOf,seriesWindow}=await import('./src/history-tools.js');
const {labGroups,labCohorts,labResultText,renderProductLabs}=await import('./src/labs-layout-v2.js');
const {compositionModel,linkedSegmental,renderProductComposition}=await import('./src/composition-layout-v2.js');
const {trainingHistoryModel,exerciseHistoryModel}=await import('./src/training-history.js');

assert.equal(validDay('2026-02-30'),'');assert.equal(validDay('2024-02-29'),'2024-02-29');assert.equal(validDay('2026-02-03T10:00:00Z'),'2026-02-03');
const arr=Array.from({length:41},(_,i)=>i);assert.deepEqual(pageOf(arr,4,12).rows,[36,37,38,39,40]);assert.equal(pageOf(arr,-1).page,1);assert.equal(pageOf(arr,Infinity).page,1);
const numeric=(date,value,extra={})=>({collection_date:date,biomarker:'Marcador sintético',laboratory:'Origem A',unit:'u',result_numeric:value,...extra});
const labs=[numeric('2026-01-01',0),numeric('2026-01-10',2),numeric('2026-01-20',3),numeric('2026-01-20',4),numeric('2026-02-30',8),numeric('2026-03-01',5,{result_raw:'< 5'}),numeric('2026-01-01',80,{unit:'outra unidade'}),numeric('2026-01-02',90,{unit:'outra unidade'}),numeric('2026-01-01',7,{laboratory:'Origem B'}),numeric('2026-01-02',8,{laboratory:'Origem B'}),numeric('2026-01-01',17,{method:'Método B'}),numeric('2026-01-02',18,{method:'Método B'}),numeric('2026-01-01',101,{laboratory:'',source:'',source_file:''}),numeric('2026-01-02',102,{laboratory:'',source:'',source_file:''}),numeric('2026-01-01',103,{unit:''}),numeric('2026-01-02',104,{unit:''})];
const group=labGroups(labs)[0],cohorts=labCohorts(group),base=cohorts.find(c=>c.origin==='Origem A'&&c.unit==='u'&&!c.method);
assert.deepEqual(base.rows.map(r=>r.result_numeric),[0,2]);assert.deepEqual(base.ambiguousDates,['2026-01-20']);assert.equal(cohorts.length,6);assert.ok(cohorts.filter(c=>!c.unit||!c.origin).every(c=>c.rows.length===0));
assert.equal(labResultText(numeric('2026-01-01',0,{result_raw:'0'})),'0 u');assert.equal(labResultText(numeric('2026-01-01',5,{result_raw:'5 u'})),'5 u');
state.data={labs:[...labs,...Array.from({length:30},(_,i)=>({source_record_id:`text-${i}`,collection_date:'2026-01-01',biomarker:`Texto ${i}`,result_raw:'Resultado textual',unit:'',source:'Origem'}))]};state.errors={};state.domainStatus={labs:'ready'};
let html=renderProductLabs();assert.ok(html.includes('Texto 29'),'all markers must be selectable');assert.ok(html.includes('productLabMarkerSelect'));
state.ui.productLabMarker='texto 29';html=renderProductLabs();assert.ok(html.includes('Resultado textual'));assert.ok(!html.includes('ltsDepthLine'),'textual result must not create curve');
state.errors.labs='test';html=renderProductLabs();assert.ok(html.includes('ltsDepthError'));assert.ok(!html.includes('ltsLabsHero'));state.errors={};

const body=Array.from({length:30},(_,i)=>({source_record_id:`body-${i}`,measured_at:`2025-${String(Math.floor(i/28)+1).padStart(2,'0')}-${String(i%28+1).padStart(2,'0')}`,source:'Origem',weight_kg:70+i%3,body_fat_pct:20,skeletal_muscle_mass_kg:30}));
state.data={body,segmental:[]};state.ui={};state.domainStatus={body:'ready',segmental:'ready'};
let m=compositionModel();assert.equal(m.recent.length,12);assert.equal(m.history.total,30);state.ui.productCompositionPeriod='all';m=compositionModel();assert.equal(m.recent.length,30);
assert.equal(seriesWindow(body,'measured_at','all').length,30);assert.equal(seriesWindow(body,'measured_at','recent').length,12);
const seg={measured_at:body[0].measured_at,source:'Origem',lean_right_arm_kg:0};assert.equal(linkedSegmental(body[0],body,[seg]).row,seg);assert.equal(linkedSegmental(body[0],body,[{...seg,source:'Outra'}]).row,null);assert.equal(linkedSegmental({...body[0],source_file:'A'},body,[{...seg,source_file:'B'}]).row,null);assert.equal(linkedSegmental(body[0],[...body,{...body[0],source_record_id:'duplicate'}],[seg]).row,null);
state.data.body=[...body,{...body[0],source_record_id:'duplicate'}];m=compositionModel();assert.equal(m.unique.length,29);assert.equal(m.all.length,31);state.ui.productCompositionRecord='duplicate';html=renderProductComposition();assert.ok(html.includes('data-composition-view="detail"'));assert.ok(html.includes('múltiplos registros'));
state.errors.body='test';assert.ok(!renderProductComposition().includes('ltsCompositionHero'));state.errors={};

const workouts=Array.from({length:40},(_,i)=>({source_record_id:`w-${i}`,workout_date:`2025-01-${String(i%28+1).padStart(2,'0')}`,workout_type:`Sessão ${i}`,location:i===3?'Outro local':'Local',is_canonical:true,record_status:'validated'}));
const exercises=workouts.map((w,i)=>({source_record_id:`ex-${i}`,workout_source_record_id:w.source_record_id,exercise:'Exercício',machine:i===4?'Outro equipamento':i===5?'':'Equipamento'}));
const sets=exercises.map((e,i)=>({source_record_id:`s-${i}`,exercise_source_record_id:e.source_record_id,workout_source_record_id:e.workout_source_record_id,phase:i===6?'drop':i===7?'warmup':'working',weight:i,weight_unit:i===8?'plate_index':'kg',reps_numeric:10}));
state.data={workouts,exercises,sets};state.ui={productTrainingPage:4};state.domainStatus={workouts:'ready',exercises:'ready',sets:'ready'};
const before=JSON.stringify(state.data),history=trainingHistoryModel();assert.equal(history.page.total,40);assert.equal(history.page.rows.length,4);state.ui.productTrainingQuery='Exercício';assert.equal(trainingHistoryModel().rows.length,40);
const exerciseModel=exerciseHistoryModel('ex-0','kg');assert.equal(exerciseModel.occurrences.length,40);assert.equal(exerciseModel.same.length,37);assert.ok(exerciseModel.units.includes('plate_index'));assert.ok(!exerciseModel.points.some(p=>[3,4,5,6,7,8].includes(p.value)));
assert.equal(exerciseHistoryModel('ex-5','kg').key,null);assert.equal(JSON.stringify(state.data),before,'presentation cannot mutate health data');
console.log('Functional depth contracts passed: full history, exact dates, missing/error states, units, methods, provenance and nonmutation.');
