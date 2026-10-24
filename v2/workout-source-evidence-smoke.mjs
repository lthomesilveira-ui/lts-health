import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const migration=fs.readFileSync(new URL('../supabase/migrations/20260903195000_add_workout_source_evidence.sql',import.meta.url),'utf8');
const dataLayer=fs.readFileSync(new URL('./src/data-layer.js',import.meta.url),'utf8');
const evidenceModule=fs.readFileSync(new URL('./src/workout-evidence.js',import.meta.url),'utf8');
const sourceStatusModule=fs.readFileSync(new URL('./src/source-status.js',import.meta.url),'utf8');
const trainingReference=fs.readFileSync(new URL('./src/training-reference-v2.js',import.meta.url),'utf8');
const homeReference=fs.readFileSync(new URL('./src/home-cockpit.js',import.meta.url),'utf8');

if(!migration.includes('health_workout_source_evidence'))throw new Error('evidence table migration missing');
if(!migration.includes("source_family,\n  source_name"))throw new Error('structured source identity missing');
if(migration.includes('source_payload'))throw new Error('raw source_payload must not exist in workout evidence table');
if(!migration.includes("like '%polar%'"))throw new Error('explicit Polar provenance backfill guard missing');
if(!dataLayer.includes("workoutEvidence:()=>fetchAll('health_workout_source_evidence'"))throw new Error('workout evidence loader missing');
if(/health_workout_source_evidence[^\n]*source_payload/.test(dataLayer))throw new Error('source_payload leaked into workout evidence loader');
if(!dataLayer.includes('decorateWorkoutProvenance'))throw new Error('workout provenance decoration missing');
if(!evidenceModule.includes("evidence_status)==='confirmed'"))throw new Error('only confirmed evidence may label telemetry source');
if(!trainingReference.includes("'Energia estimada'")||!trainingReference.includes("'FC média · trecho'"))throw new Error('partial telemetry labels missing from Training');
const homeTraining=homeReference.slice(homeReference.indexOf('function trainingPanel'),homeReference.indexOf('export function nutritionPanel'));
if(homeTraining.includes('calories_kcal')&&!homeTraining.includes('estimada'))throw new Error('Home must qualify any displayed workout energy as estimated');
if(sourceStatusModule.includes("contains(workouts,['source','source_file'],'polar')"))throw new Error('Polar source status still depends on workout display/source text');
if(!sourceStatusModule.includes("confirmedWorkoutEvidence(workoutEvidence,'polar_flow')"))throw new Error('Polar source status is not driven by structured workout evidence');

const db={
 health_workouts:[
  {source_record_id:'workout-2',workout_date:'2026-02-02',workout_type:'Peito + ombros',location:'Academia de teste',duration_minutes:52,calories_kcal:430,heart_rate_avg:121,heart_rate_max:148,muscle_groups:['Peito','Ombros'],record_status:'validated',is_canonical:true,source:'Teste'},
  {source_record_id:'workout-1',workout_date:'2026-01-28',workout_type:'Costas + braços',location:'Academia de teste',duration_minutes:48,calories_kcal:390,heart_rate_avg:117,heart_rate_max:143,muscle_groups:['Costas','Bíceps','Tríceps'],record_status:'validated',is_canonical:true,source:'Teste'}
 ],
 health_workout_exercises:[
  {source_record_id:'ex-1',workout_source_record_id:'workout-2',workout_date:'2026-02-02',order_index:1,exercise:'Supino máquina',machine:'Máquina de teste',muscle_group:'Peito',source:'Teste'},
  {source_record_id:'ex-2',workout_source_record_id:'workout-2',workout_date:'2026-02-02',order_index:2,exercise:'Voador',machine:'Máquina de teste',muscle_group:'Peito',source:'Teste'},
  {source_record_id:'ex-3',workout_source_record_id:'workout-1',workout_date:'2026-01-28',order_index:1,exercise:'Puxada alta',machine:'Máquina de teste',muscle_group:'Costas',source:'Teste'}
 ],
 health_workout_sets:[
  {source_record_id:'set-1',exercise_source_record_id:'ex-1',workout_source_record_id:'workout-2',workout_date:'2026-02-02',set_index:1,phase:'working',weight:80,weight_unit:'kg',reps_numeric:10,reps_raw:'10',source:'Teste'},
  {source_record_id:'set-2',exercise_source_record_id:'ex-1',workout_source_record_id:'workout-2',workout_date:'2026-02-02',set_index:2,phase:'working',weight:90,weight_unit:'kg',reps_numeric:8,reps_raw:'8',source:'Teste'},
  {source_record_id:'set-3',exercise_source_record_id:'ex-2',workout_source_record_id:'workout-2',workout_date:'2026-02-02',set_index:1,phase:'working',weight:60,weight_unit:'kg',reps_numeric:12,reps_raw:'12',source:'Teste'},
  {source_record_id:'set-4',exercise_source_record_id:'ex-3',workout_source_record_id:'workout-1',workout_date:'2026-01-28',set_index:1,phase:'working',weight:55,weight_unit:'kg',reps_numeric:10,reps_raw:'10',source:'Teste'}
 ],
 health_workout_source_evidence:[{source_record_id:'workout-evidence-polar-1',workout_source_record_id:'workout-2',workout_date:'2026-02-02',source_family:'polar_flow',source_name:'Polar Flow',evidence_kind:'telemetry',evidence_status:'confirmed',field_names:['duration_minutes','calories_kcal','heart_rate_avg','heart_rate_max'],confidence:'high',source_file:'synthetic-source'}],
 health_source_daily_metrics:[{source_record_id:'source-metric-candidate-1',metric_date:'2026-02-02',metric_type:'steps',value:7100,unit:'count',source_name:'Dispositivo de teste',source_family:'test_device',canonical_status:'candidate',confidence:'high',source_file:'synthetic-source'}]
};
// Authenticated synthetic transport. All unrecognized reads and every write fail closed.
const tables=['health_personal_goals','health_polar_sessions','health_body_composition','health_segmental_composition','health_workouts','health_workout_source_evidence','health_workout_exercises','health_workout_sets','health_lab_results','health_documents','health_medication_events','health_medication_regimens','health_uploads','health_ingestion_previews','health_data_quality_issues','health_daily_nutrition','health_nutrition_meals','health_activity_records','health_metrics','health_source_daily_metrics'];
function installService(db,tables){
 window.__qaDb=db;window.__qaDenied=[];window.__qaCalls=[];window.__qaSession={user:{id:'synthetic-evidence-owner'}};
 window.__qaHaeStatus={configured:false,received:false};
 const deny=target=>{window.__qaDenied.push(target);throw Error('Synthetic gate forbids '+target);};
 const failure=message=>({data:null,error:{message}});
 function query(table){
  if(!tables.includes(table))return deny('unrecognized table '+table);
  let start=0,end=999,projection='*';const filters=[],orders=[];
  const read=()=>{
   window.__qaCalls.push({table,projection});
   if(!window.__qaSession)return failure('Synthetic session expired');
   if(window.__qaFailProjection&&projection.includes(window.__qaFailProjection))return failure('Synthetic domain read failure');
   const rows=(window.__qaDb[table]||[]).filter(row=>filters.every(([key,value])=>row[key]===value)).slice().sort((a,b)=>{for(const[key,asc]of orders){const c=String(a[key]??'').localeCompare(String(b[key]??''));if(c)return asc?c:-c;}return 0;});
   return {data:structuredClone(rows.slice(start,end+1)),error:null};
  };
  const q={select(value){projection=value;return q;},eq(key,value){filters.push([key,value]);return q;},is(key,value){filters.push([key,value]);return q;},range(a,b){start=a;end=b;return q;},order(key,options={}){orders.push([key,options.ascending!==false]);return q;},limit(n){end=start+n-1;return q;},
   async maybeSingle(){const r=read();return r.error?r:r.data.length>1?failure('Multiple rows'):{data:r.data[0]||null,error:null};},
   then(resolve,reject){return Promise.resolve(read()).then(resolve,reject);}};
  for(const action of ['insert','update','upsert','delete'])q[action]=()=>deny(table+' '+action);
  return q;
 }
 window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:window.__qaSession},error:null}),onAuthStateChange:callback=>{window.__qaAuthCallback=callback;return{data:{subscription:{unsubscribe(){}}}};},signOut:async()=>{window.__qaSession=null;window.__qaAuthCallback?.('SIGNED_OUT',null);return{error:null};}},from:query,
  functions:{invoke:async(name,args)=>{
   const action=args?.body?.action;window.__qaCalls.push({name,action});
   if(action!=='status'||!['health-polar-connection','health-auto-export-connection'].includes(name))return deny('invoke '+name+' '+action);
   if(!window.__qaSession||window.__qaHaeError&&name==='health-auto-export-connection')return failure('Synthetic connection unavailable');
   return {data:name==='health-auto-export-connection'?structuredClone(window.__qaHaeStatus):{configured:false,connected:false},error:null};
  }},rpc:name=>deny('rpc '+name),storage:{from:name=>({upload:()=>deny('upload '+name),remove:()=>deny('remove '+name)})}})};
}
const service=`(${installService.toString()})(${JSON.stringify(db)},${JSON.stringify(tables)});`;
const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/';
const parsed=new URL(base);
assert.equal(parsed.protocol,'http:');assert.ok(['127.0.0.1','localhost'].includes(parsed.hostname),'synthetic gate only targets loopback');assert.ok(['/','/v2/'].includes(parsed.pathname));assert.equal(parsed.search,'','exercise the actual renderer, never fixture mode');assert.equal(parsed.hash,'');
const external=[];
async function isolate(page){
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.href==='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'&&route.request().method()==='GET')return route.fulfill({contentType:'application/javascript',body:service});
  if(url.origin===parsed.origin&&route.request().method()==='GET')return route.continue();
  external.push({url:url.href,method:route.request().method()});return route.abort();
 });
}
const browser=await chromium.launch({headless:true});
try{
const page=await browser.newPage({viewport:{width:1280,height:900},serviceWorkers:'block'});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await isolate(page);
await page.goto(base+'#treinos',{waitUntil:'domcontentloaded'});
await page.waitForSelector('#app:not(.hidden) .ltsTrainingReference');
await page.waitForFunction(()=>document.querySelector('#syncText')?.textContent==='Atualizado');
await page.waitForSelector('.ltsTrainingReference[data-workout-id="workout-2"]');
assert.equal(await page.locator('.ltsTrainingReference').getAttribute('data-workout-id'),'workout-2');
assert.equal(await page.locator('.ltsRefHrPanel header>small').innerText(),'Polar Flow','confirmed telemetry origin is readable in the actual training summary');
await page.locator('[data-depth-training-view="history"]').first().click();
await page.waitForSelector('[data-training-total="2"]');
assert.deepEqual(await page.locator('[data-depth-workout]').evaluateAll(nodes=>nodes.map(node=>node.dataset.depthWorkout)),['workout-2','workout-1'],'complementary evidence must not create or remove a canonical session');
await page.locator('[data-depth-workout="workout-1"]').click();
await page.waitForSelector('.ltsTrainingReference[data-workout-id="workout-1"]');
assert.equal(await page.locator('.ltsRefHrPanel header>small').innerText(),'Registro LTS · telemetria: origem não explicitada no registro histórico','unproven historical telemetry stays unknown');

const contract=await page.evaluate(async()=>{
  const {state,fixtureMode}=await import('./src/core.js');
  if(fixtureMode||state.session?.user?.id!=='synthetic-evidence-owner')throw Error('actual authenticated synthetic route required');
  const {sourceStatusFor,sourceCoverageFor}=await import('./src/source-status.js');
  const {visibleWorkoutEvidence,decorateWorkoutProvenance}=await import('./src/workout-evidence.js');
  const {buildStructuredBackup}=await import('./src/data-layer.js');
  const canonical=state.data.workouts.map(row=>row.source_record_id);
  const filtered=visibleWorkoutEvidence(state.data.workouts,[
    ...state.data.workoutEvidence,
    {source_record_id:'orphan',workout_source_record_id:'shadow-workout',workout_date:'2099-01-01',source_family:'polar_flow',source_name:'Polar Flow',evidence_kind:'telemetry',evidence_status:'confirmed'}
  ]);
  const candidateOnly=decorateWorkoutProvenance([
    {source_record_id:'candidate-workout',duration_minutes:30,source:'workout log (annotated text from user)',is_canonical:true,record_status:'validated'}
  ],[
    {source_record_id:'candidate-evidence',workout_source_record_id:'candidate-workout',source_family:'polar_flow',source_name:'Polar Flow',evidence_kind:'telemetry',evidence_status:'candidate'}
  ]);
  const partialTelemetry=decorateWorkoutProvenance([
    {source_record_id:'partial-workout',duration_minutes:53,calories_kcal:427,heart_rate_avg:106,source:'Registro LTS',is_canonical:true,record_status:'validated'}
  ],[
    {source_record_id:'partial-evidence',workout_source_record_id:'partial-workout',source_family:'polar_flow',source_name:'Polar Flow',evidence_kind:'telemetry',evidence_status:'confirmed',field_names:['partial_duration_minutes','partial_heart_rate_avg','estimated_session_calories_kcal']}
  ])[0];
  const recordedWorkouts=state.data.workouts;
  const recordedEvidence=state.data.workoutEvidence;
  const recordedSourceMetrics=state.data.sourceMetrics;
  state.data.workouts=recordedWorkouts.map(row=>({...row,source:'Registro LTS',source_file:null}));
  const structuralStatus=sourceStatusFor('polar_flow');
  const structuralCoverage=sourceCoverageFor('polar_flow');
  state.data.workoutEvidence=recordedEvidence.map(row=>({...row,evidence_status:'candidate'}));
  state.data.sourceMetrics=(recordedSourceMetrics||[]).filter(row=>String(row.source_family||'').toLowerCase()!=='polar_flow');
  const candidateEvidenceStatus=sourceStatusFor('polar_flow');
  const candidateEvidenceCoverage=sourceCoverageFor('polar_flow');
  state.data.workouts=recordedWorkouts;
  state.data.workoutEvidence=recordedEvidence;
  state.data.sourceMetrics=recordedSourceMetrics;
  const backup=await buildStructuredBackup(()=>{});
  let failedBackup=null;
  window.__qaFailProjection='water_reference';
  try{await buildStructuredBackup(()=>{});}catch(error){failedBackup={message:error.message,domains:error.domains};}
  finally{window.__qaFailProjection=null;}
  if(failedBackup?.message!=='backup_incomplete:waterReferences'||JSON.stringify(failedBackup.domains)!==JSON.stringify(['waterReferences']))throw Error('failed water-reference read must reject the whole backup');
  return {
    canonical,
    backupComplete:backup.complete&&backup.structured_complete&&backup.domains.includes('waterReferences')&&Array.isArray(backup.data.waterReferences),
    filteredIds:filtered.map(row=>row.workout_source_record_id),
    candidateSource:candidateOnly[0].source,
    candidateStatus:candidateOnly[0].telemetry_provenance_status,
    partialTelemetry:{
      partial:partialTelemetry.telemetry_is_partial,
      partialHeartRate:partialTelemetry.telemetry_heart_rate_is_partial,
      estimatedEnergy:partialTelemetry.telemetry_energy_is_estimated,
      source:partialTelemetry.source
    },
    structuralStatus,
    structuralCoverage,
    candidateEvidenceStatus,
    candidateEvidenceCoverage,
    backupHasEvidence:Array.isArray(backup.data.workoutEvidence)&&backup.data.workoutEvidence.length===1,
    backupWorkoutSource:backup.data.workouts?.[0]?.source,
    backupHasDecoration:backup.data.workouts?.some(row=>'telemetry_provenance_status' in row||'source_recorded' in row),
    backupText:JSON.stringify(backup)
  };
});

if(contract.filteredIds.includes('shadow-workout'))throw new Error('orphan/noncanonical workout evidence crossed the structured workout boundary');
if(!contract.filteredIds.every(id=>contract.canonical.includes(id)))throw new Error('workout evidence is linked outside visible canonical workouts');
if(contract.candidateStatus!=='unknown'||contract.candidateSource.includes('Polar Flow'))throw new Error('candidate evidence was presented as confirmed telemetry provenance');
if(!contract.partialTelemetry.partial||!contract.partialTelemetry.partialHeartRate||!contract.partialTelemetry.estimatedEnergy)throw new Error('partial/estimated telemetry evidence was not preserved in the UI model');
if(!contract.partialTelemetry.source.includes('Polar Flow'))throw new Error('confirmed partial telemetry source was not preserved');
if(contract.structuralStatus!=='ready')throw new Error('confirmed Polar evidence does not mark source as available when workout text is scrubbed');
if(contract.structuralCoverage.confirmedDate!=='2026-02-02')throw new Error('Polar confirmed date does not follow structured workout evidence');
if(contract.candidateEvidenceStatus!=='candidate')throw new Error('candidate Polar workout evidence was not preserved as candidate-only source state');
if(contract.candidateEvidenceCoverage.confirmedDate!==null||contract.candidateEvidenceCoverage.preservedDate!=='2026-02-02')throw new Error('candidate Polar workout evidence coverage was promoted or lost');
if(!contract.backupComplete)throw new Error('backup lost required domain completeness');
if(!contract.backupHasEvidence)throw new Error('structured backup lost workout evidence provenance');
if(contract.backupWorkoutSource!=='Teste')throw new Error('backup persisted display decoration instead of recorded workout provenance');
if(contract.backupHasDecoration)throw new Error('UI-only workout provenance decoration leaked into structured backup');
if(contract.backupText.includes('source_payload'))throw new Error('source_payload leaked into structured backup');
if(errors.length)throw new Error(`page errors: ${errors.join(' | ')}`);

assert.deepEqual(await page.evaluate(()=>window.__qaDenied),[],'no mutating SDK calls');
assert.deepEqual(external,[],'no remote or non-GET requests');
await page.close();
console.log('LTS Health workout source evidence smoke passed: actual renderer, provenance boundaries and complete/failed backup reads.');
}finally{await browser.close();}
