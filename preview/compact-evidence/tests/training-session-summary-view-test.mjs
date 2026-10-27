import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
globalThis.location={search:'?fixture'};
const {state}=await import('../src/core.js');
const {renderProductTraining}=await import('../src/training-reference-v2.js');
const w={source_record_id:'synthetic-summary-current',workout_date:'2025-06-15',workout_type:'Sessão sintética',location:'Local de teste',is_canonical:true,record_status:'validated',duration_minutes:35,calories_kcal:280,notes:'SQL synthetic internal note must not be attributed to the user',session_comment:'Pausa tranquila depois do treino. <comentário literal>',raw_exercises:'Relato sintético\nAparelho de teste <sem HTML>\n12 kg × 9 repetições'};
const old={...w,source_record_id:'synthetic-summary-old',workout_date:'2025-06-10',session_comment:null,raw_exercises:null};
const exercise=(id,group,index)=>({source_record_id:id,workout_source_record_id:w.source_record_id,workout_date:w.workout_date,exercise:`Exercício ${index}`,machine:'Aparelho de teste',muscle_group:group,order_index:index});
const exercises=[exercise('synthetic-e1','Peito',1),exercise('synthetic-e2','Costas',2),exercise('synthetic-e3',null,3)];
const set=(id,e,index,phase,extra={})=>({source_record_id:id,workout_source_record_id:w.source_record_id,exercise_source_record_id:e,workout_date:w.workout_date,set_index:index,phase,weight:12,weight_unit:'kg',reps_numeric:9,...extra});
const sets=[set('synthetic-s1','synthetic-e1',1,'warmup'),set('synthetic-s2','synthetic-e1',2,'working',{failure:true}),set('synthetic-s3','synthetic-e2',1,null),set('synthetic-s4','synthetic-e3',1,'working'),set('synthetic-extension','synthetic-e1',3,'rest_pause',{failure:true})];
state.data={workouts:[w,old],exercises,sets,workoutEvidence:[]};
state.domainStatus={workouts:'ready',exercises:'ready',sets:'ready'};
state.ui={openWorkout:w.source_record_id,productTrainingView:'summary'};
const before=JSON.stringify(state.data),html=renderProductTraining();
assert.equal((html.match(/data-training-chart=/g)||[]).length,2);
assert.equal([...html.matchAll(/data-primary="(\d+)"/g)].reduce((n,m)=>n+Number(m[1]),0),4,'group chart reconciles to primary sets and excludes the extension');
assert.match(html,/data-training-duration="35"/);
assert.doesNotMatch(html,/ltsRefTrainPulse|ltsRefHrTrack/,'no decorative bars masquerade as recorded telemetry');
assert.match(html,/Como você terminou/);assert.match(html,/Pausa tranquila depois do treino\. &lt;comentário literal&gt;/);
assert.doesNotMatch(html,/SQL synthetic internal note/);assert.doesNotMatch(html,/<comentário literal>|<sem HTML>/);
assert.match(html,/Relato sintético\nAparelho de teste &lt;sem HTML&gt;/);
assert.match(html,/>4<\/b><span>séries registradas/);assert.match(html,/2 séries registradas \+ 1 prolong\./);
assert.match(html,/2 séries identificadas como trabalho/);assert.match(html,/1 de aquecimento/);assert.match(html,/1 sem tipo informado/);
assert.match(html,/Falha relatada em 1 série principal/);assert.doesNotMatch(html,/Falha relatada em 2/,'extension failure is not a second primary-series failure');
assert.match(html,/Grupo não informado/);assert.match(html,/participação principal e secundária/);
assert.equal((html.match(/data-disclosure="training-/g)||[]).length,2,'original and group distribution are secondary disclosures');
state.ui.openWorkout=old.source_record_id;let view=renderProductTraining();assert.doesNotMatch(view,/Como você terminou|comentário literal|Relato original deste treino/,'changing session cannot retain prior comment');
state.ui.openWorkout=w.source_record_id;
for(const domain of ['sets','exercises']){
 state.domainStatus[domain]='error';view=renderProductTraining();assert.doesNotMatch(view,/data-training-group=/,'failed child reads cannot leave group bars or stale counts');assert.match(view,/Como você terminou/);assert.match(view,/Relato original deste treino/);assert.match(view,/>—<\/b><span>séries registradas/);assert.match(view,/Parte dos detalhes/);assert.doesNotMatch(view,/Falha relatada em/);state.domainStatus[domain]='ready';
}
for(const value of [null,undefined,42,{},[],false,'','  ']){w.session_comment=value;assert.doesNotMatch(renderProductTraining(),/Como você terminou/);}
w.session_comment='Pausa tranquila depois do treino. <comentário literal>';
assert.equal(JSON.stringify(state.data),before,'read-only rendering never mutates records');
const loader=readFileSync(new URL('../src/data-layer.js',import.meta.url),'utf8');
assert.match(loader,/session_comment:source_payload->>user_reported_completion_note/);
assert.doesNotMatch(loader,/raw_user_text:source_payload|workouts:.*select\('\*'\)/,'comment uses a bounded projection');
console.log('Training summary view: explicit comment, escaped original report, literal group distribution, phase/failure boundaries, source errors and session switching passed.');
