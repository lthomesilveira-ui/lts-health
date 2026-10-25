import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
globalThis.location={search:'?fixture=1'};
const {state,setGlobalPeriod}=await import('../src/core.js');
const {compositionModel,renderProductComposition}=await import('../src/composition-layout-v2.js');
const {descriptiveBodyPoints,renderEvolutionOverview}=await import('../src/evolution-overview.js');
const {exerciseDirectoryModel,renderExerciseDirectory,exerciseHistoryModel}=await import('../src/training-history.js');
const {changesFixture}=await import('./dashboard-changes-fixture.mjs');
const f=changesFixture();Object.assign(state.data,f.data);Object.assign(state.domainStatus,f.status);state.ui={homePeriod:'7'};
state.data.body=Array.from({length:41},(_,i)=>({source_record_id:'observed-'+i,measured_at:`2026-${String(1+Math.floor(i/5)).padStart(2,'0')}-${String(i%5+1).padStart(2,'0')}`,source:'Synthetic report',device_name:null,weight_kg:90-i/10,body_fat_pct:20-i/20}));
assert.equal(compositionModel().period,'365','Composition starts in its independent recent-year window');assert.equal(state.ui.productCompositionPeriod,undefined);
for(const home of ['30','90','all']){setGlobalPeriod(home);assert.equal(compositionModel().period,'365','Home cannot overwrite the implicit Composition window');}
state.ui.homePeriod='7';state.ui.productCompositionPeriod='all';
assert.equal(compositionModel().period,'all');assert.equal(compositionModel().all.length,41);assert.equal(compositionModel().windowRows.length,41);assert.equal(compositionModel().source,'all');
let html=renderProductComposition();assert.match(html,/41 medições no histórico/);assert.doesNotMatch(html,/class="ltsDepthLine"/);assert.match(html,/data-ux-scroll="productCompositionHistory"/);
assert.equal(descriptiveBodyPoints(state.data.body,'weight_kg','2026-10-24').length,41);assert.ok(descriptiveBodyPoints(state.data.body,'weight_kg').every(p=>p.cohort===null));
const points=descriptiveBodyPoints([...state.data.body,{...state.data.body[0],source_record_id:'duplicate'}, {...state.data.body[0],measured_at:'2099-01-01'},{...state.data.body[0],measured_at:'not-a-date'}],'weight_kg','2026-10-24');assert.equal(points.length,42,'duplicate-date observations remain, future/invalid dates do not become plotted facts');
for(const unknown of ['',null,'unknown','não informado','Modelo não informado','unspecified','not recorded','-']){
 state.data.body=f.data.body.map(r=>({...r,device_name:unknown}));state.ui.productCompositionSource=compositionModel().origins[0][0];
 html=renderProductComposition();assert.doesNotMatch(html,/class="ltsDepthLine"|data-disclosure="product-composition-compare"/,'unknown model must never generate a comparable line');
}
state.data.body=f.data.body.map(r=>({...r,source_record_id:'reused'}));state.ui.productCompositionRecord='reused';assert.equal(compositionModel().record,null);html=renderEvolutionOverview();assert.equal((html.match(/data-evolution-body="reused" disabled/g)||[]).length,1,'selected ambiguous record stays disabled; all original points remain selectable');assert.equal((html.match(/class="ltsEvolutionMark/g)||[]).length,2);
state.ui={productCompositionPeriod:'90',productLabPeriod:'365',dashboardPeriod:'7'};setGlobalPeriod('30');assert.equal(state.ui.homePeriod,'30');assert.equal(state.ui.productCompositionPeriod,'90');assert.equal(state.ui.productLabPeriod,'365');assert.equal(state.ui.dashboardPeriod,'7');
state.ui={};state.data.exercises=f.data.exercises.map(e=>({...e,machine:null}));state.data.workouts=f.data.workouts.map(w=>({...w,location:null}));state.data.sets=f.data.sets.map(s=>({...s,technique:null,reps_raw:'4 + 1,5 parcial'}));
assert.equal(exerciseDirectoryModel().length,1);assert.equal(exerciseDirectoryModel()[0].occurrences.length,2);assert.equal(exerciseDirectoryModel()[0].setCount,2);assert.equal(exerciseHistoryModel('exercise-0').occurrences.length,2);assert.equal(exerciseHistoryModel('exercise-0').points.length,0);
html=renderExerciseDirectory();assert.match(html,/data-depth-exercise="exercise-1"/);assert.match(html,/não há estimativa de força/);
for(const unknown of ['unknown','não informado','not documented','unspecified','not recorded','—']){state.data.exercises.forEach(e=>e.machine=unknown);state.data.workouts.forEach(w=>w.location=unknown);assert.equal(exerciseHistoryModel('exercise-0').points.length,0);assert.equal(exerciseHistoryModel('exercise-0').occurrences.length,2);}
state.data.exercises.push({...state.data.exercises[1]});assert.equal(exerciseHistoryModel('exercise-1'),null);assert.ok(exerciseHistoryModel('exercise-0').occurrences.filter(o=>o.exercise.source_record_id==='exercise-1').every(o=>o.sets.length===0));state.data.exercises.pop();
state.data.workouts.push({...state.data.workouts[1],workout_date:'2026-10-16'});const group=exerciseDirectoryModel()[0];assert.equal(group.entry.exercise.source_record_id,'exercise-0');assert.equal(group.occurrences.length,2);assert.equal(group.occurrences.filter(o=>o.ambiguous).length,1);assert.match(renderExerciseDirectory(),/identidade ambígua/);
state.domainStatus.body='loading';state.domainStatus.labs='idle';html=renderEvolutionOverview();assert.match(html,/Carregando medições/);assert.match(html,/Carregando exames/);assert.doesNotMatch(html,/data-evolution-body=/);assert.doesNotMatch(html,/2 resultados preservados/);
state.domainStatus.labs='error';assert.match(renderEvolutionOverview(),/Leitura indisponível/);
state.domainStatus.body='ready';state.data.body=[{source_record_id:'<img onerror=x>',measured_at:'2026-01-01',weight_kg:80,source:'<script>bad</script>'}];html=renderEvolutionOverview();assert.doesNotMatch(html,/<script>bad/);assert.match(html,/&lt;script&gt;/);
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.match(index,/data-route="evolucao"[^>]*>[\s\S]{0,150}?Evolução/);
console.log('Evolution access: all observed body points, unknown-model safeguards, ambiguous links, named exercise history, independent windows, loading/error isolation, escaping and correct navigation passed.');
