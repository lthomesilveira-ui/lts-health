import assert from 'node:assert/strict';

globalThis.location={search:'?fixture'};
const {state}=await import('../src/core.js');
const {exerciseHistoryModel,exerciseHistoryTitle,recordedExerciseSeries,renderExerciseHistory}=await import('../src/training-history.js');
const {renderProductTraining}=await import('../src/training-reference-v2.js');
const {renderProductTraining:renderFallback}=await import('../src/product-layout-v2.js');

// Entirely invented loads, dates, names and record identities. No personal data.
function fixture(){
  const workout=(id,date,extra={})=>({source_record_id:id,workout_date:date,is_canonical:true,record_status:'validated',workout_type:'Sessão de teste',location:'Local sintético',source:'Relato sintético',...extra});
  const workouts=[workout('synthetic-old','2025-05-02'),workout('synthetic-current','2025-05-09')];
  const exercises=workouts.map((w,index)=>({source_record_id:`synthetic-exercise-${index}`,workout_source_record_id:w.source_record_id,workout_date:w.workout_date,exercise:'Exercício inventado <literal>',machine:'Aparelho de teste',source:'Relato sintético',source_text:'Registro original <preservado>',notes:'Observação sintética'}));
  const sets=exercises.flatMap((e,index)=>[17,23,31,39].map((weight,setIndex)=>({source_record_id:`synthetic-set-${index}-${setIndex}`,workout_source_record_id:e.workout_source_record_id,exercise_source_record_id:e.source_record_id,workout_date:e.workout_date,set_index:setIndex+1,weight,weight_unit:'kg',phase:null,reps_numeric:7,source:'Relato sintético',...(setIndex===2?{reps_raw:'4 + 1,5 parcial',technique:'Pausa <literal>',near_failure:true,notes:'Movimento registrado'}:{}),...(setIndex===3?{phase:'rest_pause',failure:true}:{} )})));
  return {workouts,exercises,sets};
}
function reset(){
  state.data=fixture();state.domainStatus={workouts:'ready',exercises:'ready',sets:'ready'};state.errors={};
  state.ui={productExerciseId:'synthetic-exercise-1',productTrainingView:'exercise',openWorkout:'synthetic-current'};
}
reset();
const before=JSON.stringify(state.data);
let model=exerciseHistoryModel(state.ui.productExerciseId),html=renderExerciseHistory();
assert.equal(exerciseHistoryTitle(),'Exercício inventado <literal>');
for(const render of [renderProductTraining,renderFallback])assert.match(render(),/<h1[^>]*>Exercício inventado &lt;literal&gt;<\/h1>/);
assert.equal(model.occurrences.length,2);assert.equal(model.points.length,0,'unknown phases cannot become working-set points');
assert.deepEqual(model.occurrences[0].series[0].points.map(p=>p.value),[17,23,31,39]);
assert.equal(model.occurrences[0].series[0].points[3].step,'Rest-pause');
assert.match(html,/Último registro/);assert.match(html,/09\/05\/2025/);assert.match(html,/2 ocorrências no histórico/);
assert.ok(html.indexOf('09/05/2025')<html.indexOf('02/05/2025'),'newest session leads');
assert.match(html,/3 séries registradas \+ 1 prolong\./);
assert.match(html,/4 \+ 1,5 parcial/);assert.match(html,/Pausa &lt;literal&gt;/);assert.match(html,/falha relatada/);assert.match(html,/quase falha relatada/);
assert.match(html,/fase não informada/);assert.match(html,/Rest-pause/);assert.match(html,/Origem: Relato sintético/);
assert.match(html,/Registro original &lt;preservado&gt;/);assert.match(html,/Movimento registrado/);
assert.equal((html.match(/<circle /g)||[]).length,8,'all numerical observed sets have isolated dots');
assert.doesNotMatch(html,/<path|ltsDepthLine|Não há pontos numéricos exatos|id="productExerciseUnit"|id="productExercisePoint"/);
assert.ok(html.indexOf('ltsExerciseRecordedSets')<html.indexOf('ltsExerciseRecordedPlots'),'literal set readout precedes the compact plot');
assert.equal(JSON.stringify(state.data),before,'reading and plotting never mutate records');

// One recorded load needs the original row, not a redundant mini-chart.
reset();state.data.sets=[state.data.sets[4]];html=renderExerciseHistory();
assert.match(html,/17 kg/);assert.match(html,/× 7/);assert.match(html,/fase não informada/);assert.doesNotMatch(html,/ltsExerciseRecordedPlot|Não há pontos numéricos exatos/);
reset();state.data.sets=state.data.sets.slice(4,7);state.data.sets[2].weight_unit='lb';html=renderExerciseHistory();
assert.equal((html.match(/<circle /g)||[]).length,2,'only the two-point kg group is plotted');assert.match(html,/31 lb/,'the lone lb original remains readable');assert.doesNotMatch(html,/Cargas desta sessão · lb/);
reset();

// Unknown equipment/location still preserves isolated per-session facts.
for(const unknown of [null,'unknown','não informado','not documented','unspecified']){
 reset();state.data.exercises.forEach(e=>e.machine=unknown);state.data.workouts.forEach(w=>w.location=unknown);
 model=exerciseHistoryModel(state.ui.productExerciseId);html=renderExerciseHistory();
 assert.equal(model.key,null);assert.equal(model.points.length,0);assert.equal(model.occurrences[0].series[0].points.length,4);
 assert.doesNotMatch(html,/ltsDepthLine|Não há pontos numéricos exatos/);assert.match(html,/sem comparação entre sessões/);
}
// Different units and phases remain separate; no numeric coercion of booleans.
const mixed=recordedExerciseSeries([
 {weight:12.125,weight_unit:'kg',phase:null}, {weight:4,weight_unit:'plate_index',phase:'drop'},
 {weight:0,weight_unit:'kg'}, {weight:'3.75',weight_unit:'lb'}, {weight:9,weight_unit:null},
 ...[true,false,[],{},null,'',Infinity,NaN,-1,'carga textual'].map(weight=>({weight,weight_unit:'kg'}))
]);
assert.deepEqual(mixed.map(g=>[g.unit,g.points.map(p=>p.value)]),[['kg',[12.125,0]],['plate_index',[4]],['lb',[3.75]],['',[9]]]);
reset();state.data.sets[4].weight=12.125;state.data.sets[5].weight_unit='plate_index';state.data.sets[5].source='Outra origem sintética';html=renderExerciseHistory();
assert.match(html,/12,125 kg/,'the literal load precision is preserved');assert.match(html,/placa \(sem conversão para kg\)/);assert.match(html,/Origem: Outra origem sintética/);

// The historical working-set chart is secondary, never an empty promise.
reset();state.data.sets.forEach(set=>set.phase='working');model=exerciseHistoryModel(state.ui.productExerciseId);html=renderExerciseHistory();
assert.equal(model.points.length,2);assert.match(html,/<details class="ltsExerciseComparison" data-disclosure="exercise-working-history">/);
assert.match(html,/class="ltsDepthLine"/);assert.match(html,/não é uma comparação de força/);assert.doesNotMatch(html,/id="productExerciseUnit"/,'a single unit needs no selector');
assert.ok(html.indexOf('ltsExerciseRecordedSets')<html.indexOf('ltsExerciseComparison'));
state.data.sets[4].weight_unit='lb';html=renderExerciseHistory();assert.match(html,/id="productExerciseUnit"/);
state.ui.productExerciseUnit='lb';assert.equal(exerciseHistoryModel(state.ui.productExerciseId,'lb').points.length,1);
state.ui.productExerciseUnit='kg';state.data.workouts[0].location='Outro local';assert.equal(exerciseHistoryModel(state.ui.productExerciseId,'kg').points.length,1);

// A non-working unit must not hide eligible working points in another unit.
reset();state.data.sets[4].phase='working';state.data.sets[4].weight_unit='lb';
model=exerciseHistoryModel(state.ui.productExerciseId,'kg');assert.deepEqual(model.units,['lb']);assert.equal(model.selectedUnit,'lb');assert.equal(model.points.length,1);
// Several sessions on one date never collapse into a maximum point.
reset();state.data.workouts[0].workout_date='2025-05-09';state.data.exercises[0].workout_date='2025-05-09';state.data.sets.forEach(set=>{set.phase='working';set.workout_date='2025-05-09';});
model=exerciseHistoryModel(state.ui.productExerciseId);assert.equal(model.points.length,0);assert.equal(model.ambiguous,2);assert.equal(model.occurrences.length,2);assert.match(renderExerciseHistory(),/sessões na mesma data/);
// All occurrences remain reachable while only the real first page says latest.
reset();
for(let index=0;index<12;index++){
 const workout={...state.data.workouts[0],source_record_id:`synthetic-extra-${index}`,workout_date:`2025-04-${String(index+1).padStart(2,'0')}`};
 const exercise={...state.data.exercises[0],source_record_id:`synthetic-extra-e-${index}`,workout_source_record_id:workout.source_record_id,workout_date:workout.workout_date};
 state.data.workouts.push(workout);state.data.exercises.push(exercise);
 state.data.sets.push({...state.data.sets[0],source_record_id:`synthetic-extra-s-${index}`,exercise_source_record_id:exercise.source_record_id,workout_source_record_id:workout.source_record_id,workout_date:workout.workout_date});
}
html=renderExerciseHistory();assert.equal((html.match(/class="ltsExerciseSession(?: |")/g)||[]).length,8);assert.match(html,/1–8 de 14/);
state.ui.productExercisePage=2;html=renderExerciseHistory();assert.equal((html.match(/class="ltsExerciseSession(?: |")/g)||[]).length,6);assert.match(html,/9–14 de 14/);assert.doesNotMatch(html,/Último registro/);assert.match(html,/01\/04\/2025/);

// Reused/missing identities and contradictory parent links cannot attach facts.
reset();state.data.exercises.push({...state.data.exercises[1],workout_source_record_id:'missing'});model=exerciseHistoryModel(state.ui.productExerciseId);assert.ok(model);assert.equal(model.occurrences[0].ambiguousIdentity,true);assert.equal(model.occurrences[0].sets.length,0);
reset();state.data.exercises.push({...state.data.exercises[0]});model=exerciseHistoryModel(state.ui.productExerciseId);assert.equal(model.occurrences.filter(o=>o.ambiguousIdentity).length,2);assert.ok(model.occurrences.filter(o=>o.ambiguousIdentity).every(o=>!o.sets.length&&!o.series.length));
reset();state.data.workouts.push({...state.data.workouts[1]});assert.equal(exerciseHistoryModel(state.ui.productExerciseId),null);
for(const id of [null,undefined,'','  ',0,false]){
 reset();state.data.exercises[1].source_record_id=id;state.ui.productExerciseId=id;assert.equal(exerciseHistoryModel(id),null);
}
reset();state.data.sets.push({...state.data.sets[4],workout_source_record_id:'another-session',weight:999});model=exerciseHistoryModel(state.ui.productExerciseId);assert.equal(model.occurrences[0].sets.length,3);assert.match(renderExerciseHistory(),/999 kg/,'conflicting original remains readable');assert.ok(model.occurrences[0].series.every(group=>group.points.every(point=>point.value!==999)));assert.match(renderExerciseHistory(),/Registros originais não atribuídos/);
reset();state.data.sets[4].workout_source_record_id='synthetic-old';state.data.sets[5].source_record_id=null;state.data.sets[6].workout_date='2025-06-01';model=exerciseHistoryModel(state.ui.productExerciseId);assert.equal(model.occurrences[0].sets.length,2);assert.equal(model.occurrences[0].excludedSets,2);assert.match(renderExerciseHistory(),/Registros originais não atribuídos/);assert.match(renderExerciseHistory(),/17 kg/);assert.match(renderExerciseHistory(),/4 \+ 1,5 parcial/);
for(const date of ['2025-06-01','2025-05-09invalid','2025-02-30']){reset();state.data.exercises[1].workout_date=date;assert.equal(exerciseHistoryModel(state.ui.productExerciseId).occurrences[0].sets.length,0);}
reset();state.data.sets[4].workout_date='2025-05-09invalid';assert.equal(exerciseHistoryModel(state.ui.productExerciseId).occurrences[0].sets.length,3);
// Redundant fields can be absent without erasing an exact exercise-linked original.
for(const missing of [null,undefined,'','  ']){
 reset();state.data.sets[4].source_record_id=missing;state.data.sets[4].workout_source_record_id=missing;state.data.sets[4].workout_date=missing;
 model=exerciseHistoryModel(state.ui.productExerciseId);assert.equal(model.occurrences[0].sets.length,4);assert.equal(model.occurrences[0].unassignedSets.length,0);assert.match(renderExerciseHistory(),/17 kg/);assert.equal(model.occurrences[0].series[0].points.length,4);
}
reset();state.data.sets.forEach(set=>{delete set.source_record_id;delete set.workout_source_record_id;delete set.workout_date;});
model=exerciseHistoryModel(state.ui.productExerciseId);assert.equal(model.occurrences.reduce((total,item)=>total+item.sets.length,0),8);assert.equal((renderExerciseHistory().match(/<circle /g)||[]).length,8);assert.equal(model.points.length,0,'missing phases remain missing, never working');
// Every rejected original remains visible, including its original detail/source.
reset();state.data.sets[4].workout_date='2025-06-01';state.data.sets[4].notes='Detalhe não atribuído <literal>';state.data.sets[4].source='Origem não atribuída';state.data.sets[4].reps_raw='3 + 0,5 parcial';
model=exerciseHistoryModel(state.ui.productExerciseId);html=renderExerciseHistory();assert.equal(model.occurrences[0].sets.length+model.occurrences[0].unassignedSets.length,model.occurrences[0].originalSets.length);assert.match(html,/3 \+ 0,5 parcial/);assert.match(html,/Detalhe não atribuído &lt;literal&gt;/);assert.match(html,/Origem não atribuída/);assert.match(html,/data informada nesta série diverge/);assert.equal(model.occurrences[0].series[0].points.length,3);
reset();state.data.workouts[1].is_canonical=false;assert.equal(exerciseHistoryModel(state.ui.productExerciseId),null);
reset();state.data.workouts[1].record_status='quarantined';assert.equal(exerciseHistoryModel(state.ui.productExerciseId),null);
reset();state.data.sets=[];html=renderExerciseHistory();assert.match(html,/Registro original &lt;preservado&gt;/);assert.doesNotMatch(html,/<svg|Não há pontos numéricos exatos/);
reset();state.data.sets.forEach(set=>set.weight=null);html=renderExerciseHistory();assert.match(html,/Carga não informada/);assert.match(html,/4 \+ 1,5 parcial/);assert.doesNotMatch(html,/<svg|Não há pontos numéricos exatos/);
for(const key of ['workouts','exercises','sets']){reset();state.domainStatus[key]='error';html=renderExerciseHistory();assert.match(html,/não carregou por completo/);assert.doesNotMatch(html,/ltsExerciseRecordedSets|<svg/);}
reset();state.ui.productExerciseId='absent';assert.equal(exerciseHistoryTitle(),'Histórico do exercício');assert.match(renderExerciseHistory(),/Escolha um exercício/);
reset();state.data.exercises[0].exercise='Outro nome';state.ui.productExerciseId='synthetic-exercise-0';html=renderProductTraining();assert.match(html,/<h1[^>]*>Outro nome<\/h1>/);assert.doesNotMatch(html,/Exercício inventado/,'switching history cannot retain the previous exercise name');
console.log('Exercise history reading: named title, latest original sets first, isolated recorded dots, preserved partial reps/effort/source, secondary eligible comparison, strict identities, units, empty/error states and no mutation passed.');
