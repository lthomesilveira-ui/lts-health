import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isApproximateTrainingLoad} from '../src/training-load-qualifier.js';
globalThis.location={search:'?fixture=1'};
const {state}=await import('../src/core.js');
const {renderProductTraining}=await import('../src/training-reference-v2.js');
const {exerciseHistoryModel,renderExerciseHistory}=await import('../src/training-history.js');

for(const notes of ['Peso aproximado',' Peso informado como aproximado; exemplo inventado. ','Carga informada como aproximada.','CARGA APROXIMADA'])assert.equal(isApproximateTrainingLoad({notes}),true);
for(const notes of ['Peso não aproximado','Não é peso aproximado','Tempo aproximado','Peso aproximado?','Peso exato','sem dados',null,{},17])assert.equal(isApproximateTrainingLoad({notes}),false);
assert.equal(isApproximateTrainingLoad({weight_is_approximate:true}),true);
for(const value of [false,null,undefined,'true',1,{}])assert.equal(isApproximateTrainingLoad({weight_is_approximate:value}),false,'only a real source boolean is authoritative');

const w={source_record_id:'synthetic-load-session',workout_date:'2026-01-02',workout_type:'Treino inventado',location:'Local inventado',is_canonical:true,record_status:'validated'};
const e={source_record_id:'synthetic-load-exercise',workout_source_record_id:w.source_record_id,workout_date:w.workout_date,order_index:1,exercise:'Exercício inventado',machine:'Máquina inventada',muscle_group:'Grupo inventado'};
const set=(id,extra={})=>({source_record_id:id,workout_source_record_id:w.source_record_id,exercise_source_record_id:e.source_record_id,workout_date:w.workout_date,set_index:1,phase:'working',weight:7.125,weight_unit:'kg',reps_raw:'8',reps_numeric:8,...extra});
const sets=[set('synthetic-load-approx',{weight_is_approximate:true}),set('synthetic-load-exact',{set_index:2,weight:6.25}),set('synthetic-load-legacy',{set_index:3,weight:5.5,notes:'Peso informado como aproximado; <texto literal>'})];
state.data={workouts:[w],exercises:[e],sets,workoutEvidence:[]};state.domainStatus={workouts:'ready',exercises:'ready',sets:'ready'};state.ui={openWorkout:w.source_record_id,productTrainingView:'exercises',productExerciseId:e.source_record_id,productExerciseUnit:'kg',productExercisePage:1};
const before=JSON.stringify(state.data),modelBefore=exerciseHistoryModel(e.source_record_id,'kg');
let html=renderProductTraining();assert.match(html,/≈ 7,125 kg/);assert.match(html,/≈ 5,5 kg/);assert.match(html,/>6,25 kg</);assert.equal((html.match(/carga aproximada/g)||[]).length,2);assert.doesNotMatch(html,/7,1 kg/,'the original decimal precision remains readable');
html=renderExerciseHistory();assert.match(html,/≈ 7,125 kg/);assert.match(html,/≈ 5,5 kg/);assert.match(html,/≈ carga aproximada/);assert.match(html,/Há cargas aproximadas entre os máximos registrados/);assert.match(html,/Inclui carga informada como aproximada/);assert.doesNotMatch(html,/<texto literal>/);assert.match(html,/&lt;texto literal&gt;/);
assert.deepEqual(exerciseHistoryModel(e.source_record_id,'kg'),modelBefore,'qualifying a displayed source never changes graph values, eligibility or arithmetic');assert.equal(JSON.stringify(state.data),before,'source records never mutate');
sets[0].weight_is_approximate=false;sets[2].notes=null;assert.doesNotMatch(renderProductTraining(),/≈|carga aproximada/);assert.doesNotMatch(renderExerciseHistory(),/Há cargas aproximadas|Inclui carga informada como aproximada/);
sets[0].weight=null;sets[0].weight_is_approximate=true;assert.doesNotMatch(renderProductTraining(),/≈|carga aproximada/,'a missing load is never given a numeric qualifier');
const loader=readFileSync(new URL('../src/data-layer.js',import.meta.url),'utf8');assert.match(loader,/weight_is_approximate:source_payload->weight_approximate/);assert.doesNotMatch(loader,/sets:\(\)=>fetchAll\([^\n]*,source_payload,/,'the source flag has a narrow projection');
console.log('Recorded training loads: explicit source flags and literal legacy qualifiers, exact/unknown distinction, decimal precision, session/history/plot context and unchanged records/calculations passed.');
