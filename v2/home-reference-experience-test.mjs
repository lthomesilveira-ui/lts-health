import assert from 'node:assert/strict';
globalThis.location={search:'?fixture=1'};
const {renderReferenceHome,referencePeriodSummary}=await import('./src/home-reference-experience.js');
const status=Object.fromEntries(['body','workouts','exercises','sets','nutrition','sourceMetrics','metrics','labs','treatments','polarSessions'].map(k=>[k,'ready']));
const data={body:[{measured_at:'2025-01-01',source_record_id:'a',source:'Scan<script>',device_name:'A',fat_mass_kg:20,skeletal_muscle_mass_kg:30},{measured_at:'2025-03-15',source_record_id:'b',source:'Scan<script>',device_name:'B',fat_mass_kg:18,skeletal_muscle_mass_kg:31}],nutrition:[{nutrition_date:'2025-03-16',source:'Food<script>',protein_g:120,calories_kcal:2000}],workouts:[],exercises:[],sets:[],sourceMetrics:[],metrics:[],labs:[],treatments:[],polarSessions:[]};
const html=renderReferenceHome(data,status,'90',{},'2025-03-20');
assert.match(html,/18,0 kg/);assert.match(html,/31,0 kg/);assert.doesNotMatch(html,/>true</);assert.doesNotMatch(html,/<script>/);assert.match(html,/Food&lt;script&gt;/);
assert.equal((html.match(/class="refSignal /g)||[]).length,5);assert.equal((html.match(/class="refPanel /g)||[]).length,7);
assert.match(html,/escalas verticais independentes/);assert.match(html,/1\/89 dias encerrados/);assert.match(html,/Sem registro/);
assert.notEqual(referencePeriodSummary(data,status,'30',{},'2025-03-20'),referencePeriodSummary(data,status,'90',{},'2025-03-20'));
const failed=renderReferenceHome(data,{...status,body:'error',nutrition:'error',sourceMetrics:'error'},'90',{},'2025-03-20');assert.match(failed,/não carreg/);assert.doesNotMatch(failed,/18,0 kg|2\.000 kcal/);
const selected=renderReferenceHome(data,status,'90',{overviewBodyDate:'2025-01-01'},'2025-03-20');assert.match(selected,/20,0 kg/);
console.log('Reference renderer: 5 signals, 6 desktop panels, compact mobile hierarchy, selected body values, shared-period summary, source coverage, escaping and failures passed.');

const duplicate=renderReferenceHome({...data,body:[{measured_at:'2025-03-15',fat_mass_kg:12,skeletal_muscle_mass_kg:40},{measured_at:'2025-03-15',fat_mass_kg:20,skeletal_muscle_mass_kg:35}]},status,'90',{},'2025-03-20');
assert.doesNotMatch(duplicate,/value="2025-03-15"|Gordura <b>12,0 kg|Músculo <b>40,0 kg/);
assert.match(duplicate,/Selecione uma data sem conflito/);

const failedCounts=renderReferenceHome(data,{...status,workouts:'error',labs:'error'},'90',{},'2025-03-20');assert.match(failedCounts,/— séries · — prolongamentos/);assert.match(failedCounts,/— registros de marcadores/);
