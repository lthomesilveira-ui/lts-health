import fs from 'node:fs';
import { chromium } from 'playwright';

const migration=fs.readFileSync(new URL('../supabase/migrations/20260903195000_add_workout_source_evidence.sql',import.meta.url),'utf8');
const dataLayer=fs.readFileSync(new URL('./src/data-layer.js',import.meta.url),'utf8');
const evidenceModule=fs.readFileSync(new URL('./src/workout-evidence.js',import.meta.url),'utf8');
const sourceStatusModule=fs.readFileSync(new URL('./src/source-status.js',import.meta.url),'utf8');

if(!migration.includes('health_workout_source_evidence'))throw new Error('evidence table migration missing');
if(!migration.includes("source_family,\n  source_name"))throw new Error('structured source identity missing');
if(migration.includes('source_payload'))throw new Error('raw source_payload must not exist in workout evidence table');
if(!migration.includes("like '%polar%'"))throw new Error('explicit Polar provenance backfill guard missing');
if(!dataLayer.includes("workoutEvidence:()=>fetchAll('health_workout_source_evidence'"))throw new Error('workout evidence loader missing');
if(/health_workout_source_evidence[^\n]*source_payload/.test(dataLayer))throw new Error('source_payload leaked into workout evidence loader');
if(!dataLayer.includes('decorateWorkoutProvenance'))throw new Error('workout provenance decoration missing');
if(!evidenceModule.includes("evidence_status)==='confirmed'"))throw new Error('only confirmed evidence may label telemetry source');
if(sourceStatusModule.includes("contains(workouts,['source','source_file'],'polar')"))throw new Error('Polar source status still depends on workout display/source text');
if(!sourceStatusModule.includes("confirmedWorkoutEvidence(workoutEvidence,'polar_flow')"))throw new Error('Polar source status is not driven by structured workout evidence');

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});

await page.goto('http://127.0.0.1:4173/?fixture=1#treinos',{waitUntil:'domcontentloaded'});
await page.waitForSelector('#app:not(.hidden)');
await page.waitForFunction(()=>document.querySelector('.screenTitle h1')?.textContent?.trim()==='Treinos');

const trainingText=(await page.locator('#screenHost').textContent())||'';
if(!trainingText.includes('Registro LTS · telemetria: Polar Flow'))throw new Error('confirmed Polar telemetry provenance is not readable in Training');
if(!trainingText.includes('Registro LTS · telemetria: origem não explicitada no registro histórico'))throw new Error('historical telemetry without proven source is not labeled as unknown');
if(await page.locator('.session').count()!==2)throw new Error('complementary evidence created or removed a canonical workout session');

const contract=await page.evaluate(async()=>{
  const {state}=await import('./src/core.js');
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
  return {
    canonical,
    filteredIds:filtered.map(row=>row.workout_source_record_id),
    candidateSource:candidateOnly[0].source,
    candidateStatus:candidateOnly[0].telemetry_provenance_status,
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
if(contract.structuralStatus!=='ready')throw new Error('confirmed Polar evidence does not mark source as available when workout text is scrubbed');
if(contract.structuralCoverage.confirmedDate!=='2026-02-02')throw new Error('Polar confirmed date does not follow structured workout evidence');
if(contract.candidateEvidenceStatus!=='candidate')throw new Error('candidate Polar workout evidence was not preserved as candidate-only source state');
if(contract.candidateEvidenceCoverage.confirmedDate!==null||contract.candidateEvidenceCoverage.preservedDate!=='2026-02-02')throw new Error('candidate Polar workout evidence coverage was promoted or lost');
if(!contract.backupHasEvidence)throw new Error('structured backup lost workout evidence provenance');
if(contract.backupWorkoutSource!=='Teste')throw new Error('backup persisted display decoration instead of recorded workout provenance');
if(contract.backupHasDecoration)throw new Error('UI-only workout provenance decoration leaked into structured backup');
if(contract.backupText.includes('source_payload'))throw new Error('source_payload leaked into structured backup');
if(errors.length)throw new Error(`page errors: ${errors.join(' | ')}`);

await browser.close();
console.log('LTS Health workout source evidence smoke passed');
