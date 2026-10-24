import assert from 'node:assert/strict';
globalThis.location={search:'?fixture=1'};
const {dashboardChanges,dashboardChangeAction}=await import('../src/dashboard-changes.js');
const {renderHealthDashboard}=await import('../src/health-dashboard.js');
const {compositionModel}=await import('../src/composition-layout-v2.js');
const {labsModel,renderProductLabs}=await import('../src/labs-layout-v2.js');
const {renderProductTraining}=await import('../src/training-reference-v2.js');
const {state}=await import('../src/core.js');
const {changesFixture}=await import('./dashboard-changes-fixture.mjs');
const model=f=>dashboardChanges(f.data,f.status,f.ui,f.today);
const domain=(f,key)=>model(f).domains.find(d=>d.key===key);
const f=changesFixture(),before=structuredClone(f),result=model(f);
assert.deepEqual(result.domains.map(x=>x.key),['body','training','labs'],'training cannot be truncated by goals, care or labs');
assert.ok(result.domains.every(x=>x.state==='comparison'));
assert.equal(domain(f,'body').rows[0].change,'diminuiu 1 kg');
assert.equal(domain(f,'training').rows[0].change,'aumentou 5 kg');
assert.equal(domain(f,'labs').rows[0].change,'aumentou 1 u');
assert.equal(domain(f,'labs').rows[0].current,'13 u','raw result keeps its unit');
for(const device of ['',null,'unknown','não informado','Modelo não informado','-']){
 const x=changesFixture();x.data.body.forEach(r=>r.device_name=device);
 assert.equal(domain(x,'body').state,'current');assert.ok(domain(x,'body').rows.every(r=>!r.change));
}
for(const field of ['source','device_name']){
 const x=changesFixture();x.data.body[1][field]='Different origin';assert.equal(domain(x,'body').state,'current');
}
{
 const x=changesFixture();x.data.body.push({...x.data.body[1],source_record_id:'conflict'});
 assert.equal(domain(x,'body').state,'missing');assert.deepEqual(domain(x,'body').actions,[]);
}
{
 const x=changesFixture();x.data.body[1].source_record_id=x.data.body[0].source_record_id;
 assert.equal(domain(x,'body').state,'current');assert.deepEqual(domain(x,'body').actions,[]);
 assert.ok(domain(x,'body').rows.every(r=>!r.change),'reused identity must not compare or open the wrong record');
}
for(const field of ['phase','technique','failure','near_failure','weight_unit','source']){
 const x=changesFixture();delete x.data.sets[1][field];assert.equal(domain(x,'training').state,'missing',field+' stays unknown');
}
{
 const x=changesFixture();x.data.sets.push({...x.data.sets[1],source_record_id:'other-set',weight:100});
 assert.equal(domain(x,'training').state,'missing','conflicting loads never choose the maximum');
}
for(const [table,field] of [['sets','technique'],['sets','source'],['exercises','machine'],['exercises','source'],['workouts','location'],['workouts','source']]){
 for(const placeholder of ['unknown','não informado','não registrado','unknown equipment']){
  const x=changesFixture();x.data[table].forEach(r=>r[field]=placeholder);
  assert.equal(domain(x,'training').state,'missing',table+'.'+field+' placeholder is not a known condition');
 }
}
{
 const x=changesFixture();
 for(const [i,date] of ['2026-10-14','2026-10-16'].entries()){
  x.data.workouts.push({...x.data.workouts[0],source_record_id:'new-workout-'+i,workout_date:date});
  x.data.exercises.push({...x.data.exercises[0],source_record_id:'new-exercise-'+i,workout_source_record_id:'new-workout-'+i,workout_date:date,exercise:'New synthetic exercise'});
  x.data.sets.push({...x.data.sets[0],source_record_id:'new-set-'+i,workout_source_record_id:'new-workout-'+i,exercise_source_record_id:'new-exercise-'+i,workout_date:date,weight:7});
 }
 assert.match(domain(x,'training').summary,/New synthetic exercise/);
 assert.equal(domain(x,'training').rows[0].change,'sem mudança numérica','fresh unchanged comparison outranks older changed load');
}
for(const patch of [{method:'Different method'},{reference_range:'1 a 30 u'},{result_raw:'<13'},{unit:'different'}]){
 const x=changesFixture();Object.assign(x.data.labs[1],patch);assert.ok(domain(x,'labs').rows.every(r=>!r.change));
}
{
 const x=changesFixture();x.data.labs.push({...x.data.labs[1],source_record_id:'other-lab',result_numeric:15,result_raw:'15'});
 assert.ok(domain(x,'labs').rows.every(r=>!r.change));assert.deepEqual(domain(x,'labs').actions,[]);
}
{
 const x=changesFixture();x.ui={dashboardMode:'day',dashboardDate:'2026-10-12'};
 assert.ok(domain(x,'body').rows.every(r=>r.currentDate==='2026-10-11'&&!r.change));
 assert.ok(domain(x,'labs').rows.every(r=>r.currentDate==='2026-10-11'&&!r.change));
 assert.equal(domain(x,'training').state,'missing');
}
for(const action of result.domains.flatMap(d=>d.actions)){
 assert.deepEqual(dashboardChangeAction(action.key,f.data,f.status,f.ui,f.today),action);
 Object.assign(state.data,structuredClone(f.data));Object.assign(state.domainStatus,f.status);state.ui={...f.ui,...action.ui};
 if(action.route==='bio')assert.equal(compositionModel().record.source_record_id,action.ui.productCompositionRecord);
 if(action.route==='treinos')assert.match(renderProductTraining(),new RegExp('data-workout-id="'+action.ui.openWorkout+'"'));
 if(action.route==='saude'){
  assert.equal(labsModel().latest.source_record_id,'lab-1');
  state.data.labs.push({...f.data.labs[1],source_record_id:'later-lab',collection_date:'2026-10-16',result_numeric:17,result_raw:'17'});
  assert.equal(labsModel().latest.source_record_id,'lab-1','historical action never silently opens later result');
  assert.ok(labsModel().history.rows.every(r=>r.collection_date<=action.ui.productLabAsOf));
  assert.match(renderProductLabs(),/data-lab-asof/);assert.match(renderProductLabs(),/data-lab-clear-asof/);
  state.ui.productLabAsOf=null;assert.equal(labsModel().latest.source_record_id,'later-lab');
 }
}
{
 const x=changesFixture();x.data.labs.forEach((r,i)=>{r.laboratory=null;r.source='Synthetic source '+i;});
 const action=domain(x,'labs').actions[0];assert.ok(action);
 Object.assign(state.data,structuredClone(x.data));Object.assign(state.domainStatus,x.status);state.ui={...x.ui,...action.ui};
 assert.equal(labsModel().cohort.key,action.ui.productLabCohort,'missing lab retains exact fallback source cohort');
 assert.equal(labsModel().latest.source_record_id,'lab-1');
}
assert.equal(dashboardChangeAction('constructor',f.data,f.status,f.ui,f.today),null);
const stale=domain(f,'body').actions.at(-1).key,x=changesFixture();x.data.body.pop();
assert.equal(dashboardChangeAction(stale,x.data,x.status,x.ui,x.today),null,'stale action cannot silently open a different record');
for(const key of ['body','labs','sets']){
 const x=changesFixture();x.status[key]='error';assert.equal(domain(x,key==='sets'?'training':key).state,'unavailable');
}
const html=renderHealthDashboard(f.data,f.status,f.ui,f.today);
assert.equal((html.match(/data-dashboard-change-domain=/g)||[]).length,3);
assert.equal((html.match(/data-dashboard-card=/g)||[]).length,7,'accepted daily grid remains seven metrics');
assert.match(html,/diminuiu 1 kg/);assert.match(html,/aumentou 5 kg/);assert.match(html,/13 u/);
assert.doesNotMatch(html,/Prévia · somente leitura/,'production has no readonly badge without the actual guard');
globalThis.LTSPreviewReadOnly={};assert.match(renderHealthDashboard(f.data,f.status,f.ui,f.today),/Prévia · somente leitura/);delete globalThis.LTSPreviewReadOnly;
assert.match(html,/não definem melhora, piora clínica/);assert.match(html,/não comprovação de ganho de força/);
const attack=changesFixture();attack.data.labs.forEach(r=>r.biomarker='<img src=x onerror=alert(1)>');
assert.doesNotMatch(renderHealthDashboard(attack.data,attack.status,attack.ui,attack.today),/<img src=x/);
assert.deepEqual(f,before,'all source records and UI inputs remain unchanged');
console.log('Dashboard changes: fixed domain slots, honest comparisons, missing/conflict states, exact record drilldowns, historical cutoff, guard label and escaping passed.');
