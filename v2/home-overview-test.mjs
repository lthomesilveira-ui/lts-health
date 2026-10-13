import assert from 'node:assert/strict';
globalThis.location={search:'?fixture=1'};
const {homeCockpitModel}=await import('./src/home-cockpit.js');
const {renderHomeOverview}=await import('./src/home-overview.js');
const status=Object.fromEntries(['body','segmental','nutrition','sourceMetrics','workouts','exercises','sets','labs','treatments','polarSessions','goals','meals'].map(k=>[k,'ready']));
const data={body:[{measured_at:'2025-04-01',fat_mass_kg:20,skeletal_muscle_mass_kg:30,source:'Synthetic scan',device_name:'A'},{measured_at:'2025-04-10',fat_mass_kg:18,skeletal_muscle_mass_kg:31,source:'Synthetic scan',device_name:'B'}],nutrition:[],sourceMetrics:[],labs:[],workouts:[],goals:[]};
for(let i=1;i<=14;i++){const day=`2025-04-${String(i).padStart(2,'0')}`;data.nutrition.push({nutrition_date:day,source:'Synthetic food',protein_g:i<8?100:110,calories_kcal:i<8?2000:2100});}
const copy=structuredClone(data),c=homeCockpitModel(data,status,'30',{},'2025-04-15'),html=renderHomeOverview(c);
assert.match(html,/Sua evolução/);assert.match(html,/Rotina nas últimas duas semanas/);assert.match(html,/\+10 g\/d/);assert.match(html,/18,0 kg/);assert.match(html,/31,0 kg/);
assert.match(html,/data-overview-body-date/);assert.equal((html.match(/class="ltsOverviewPlotTitle"/g)||[]).length,2);assert.match(html,/Escalas verticais independentes/);assert.match(html,/Variação entre semanas/);
assert.match(html,/Valores e condições da comparação/);assert.match(html,/aparelho|Aparelho/);assert.doesNotMatch(html,/ganhou músculo|perdeu gordura|melhora da saúde|data-home-body-metric/);
assert.ok(html.indexOf('ltsOverviewReading')<html.indexOf('ltsOverviewGrid'));
assert.match(html,/data-home-workout|Nenhuma sessão registrada/);
assert.deepEqual(copy,data,'renderer preserves all source records');
const unavailable=renderHomeOverview(homeCockpitModel(data,{...status,body:'error',nutrition:'error',labs:'error',workouts:'error'},'30',{},'2025-04-15'));
assert.match(unavailable,/composição não carregou/);assert.match(unavailable,/treinos não carregaram/);assert.match(unavailable,/exames não carregaram/);assert.doesNotMatch(unavailable,/18,0 kg|31,0 kg/,'failed domain cannot reuse old values');
const injection=structuredClone(data);injection.workouts=[{workout_date:'2025-04-14',source_record_id:'x" onclick="evil()',workout_type:'<img src=x onerror=evil()>',is_canonical:true,record_status:'validated'}];
const escaped=renderHomeOverview(homeCockpitModel(injection,status,'30',{},'2025-04-15'));assert.match(escaped,/&lt;img/);assert.doesNotMatch(escaped,/<img|data-home-workout="x" onclick/);
console.log('Overview: real models, explicit weekly windows, missing data, source boundaries, XSS escaping and immutable records passed.');
