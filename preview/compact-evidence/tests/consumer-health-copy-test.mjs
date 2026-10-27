import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeDashboardFixture} from './health-dashboard-render-test.mjs';
import {sourceDisplayLabel,sourceDisplayNote,displaySource} from '../src/source-display.js';
import {userFacingError} from '../src/user-facing-errors.js';
globalThis.location={search:'?fixture=1'};
const {renderHealthDashboard}=await import('../src/health-dashboard.js');
const {renderProductTraining}=await import('../src/training-reference-v2.js');
const {renderProductLabs}=await import('../src/labs-layout-v2.js');
const {renderTimelineHub}=await import('../src/timeline-screen.js');
const {renderEvidenceInsights}=await import('../src/evidence-insights-view.js');
const {nutritionTrainingContrast}=await import('../src/evidence-insights.js');
const {state}=await import('../src/core.js');
const text=html=>html.replace(/<[^>]*>/g,' ');
const card=(html,key)=>html.match(new RegExp(`<article[^>]+data-dashboard-card="${key}"[^>]*>([\\s\\S]*?)<\\/article>`))?.[1]||'';
const primary=html=>html.replace(/<details\b[^>]*>[\s\S]*?<\/details>/g,'');
const blocked=/dados não conferidos|fonte candidata|canônic[oa]|canonical_status|source_record_id|payload|care_followup|valor elegível|datas inequívocas|deduplicação|não validada/i;
const f=makeDashboardFixture(),before=structuredClone(f.data);
const full=renderHealthDashboard(f.data,f.status,{},f.today);
assert.equal((full.match(/data-dashboard-card=/g)||[]).length,7);
assert.match(full,/7\/7 dias usados na média/);
assert.doesNotMatch(text(full),blocked);
assert.deepEqual(f.data,before,'presentation never mutates records');

const empty=Object.fromEntries(Object.keys(f.data).map(key=>[key,[]]));
const day=renderHealthDashboard(empty,f.status,{dashboardMode:'day'},f.today);
for(const key of ['water','protein','energy','activeEnergy','totalEnergy','steps','sleep']){
  const html=card(day,key);assert.match(html,/<strong>—<\/strong>/);assert.match(html,/Sem informação neste dia/);
  assert.doesNotMatch(primary(html),/não foi possível|falhou|consumo zero|origens separadas/i);
}
const failed=renderHealthDashboard(f.data,{...f.status,metrics:'error',sourceMetrics:'error'}, {},f.today);
assert.match(card(failed,'steps'),/Não foi possível atualizar passos/);
assert.match(card(failed,'steps'),/<strong>—<\/strong>/);
assert.doesNotMatch(card(failed,'steps'),/Sem informação neste dia/);
const partial=renderHealthDashboard(f.data,{...f.status,sourceMetrics:'error'}, {},f.today);
assert.match(card(partial,'water'),/Parte dos registros não carregou/);
assert.match(card(partial,'water'),/1\.040/);
assert.match(card(partial,'water'),/7\/7 dias usados na média/);

const conflict=structuredClone(empty);
conflict.sourceMetrics=[100,900].map((value,i)=>({source_record_id:`synthetic-water-${i}`,metric_date:f.date(1),metric_type:'dietary_water_ml',unit:'mL',value,source_name:'Synthetic water diary',source_family:'synthetic',canonical_status:'candidate'}));
const conflictHtml=card(renderHealthDashboard(conflict,f.status,{},f.today),'water');
assert.match(conflictHtml,/mais de um valor/);assert.match(conflictHtml,/100 mL/);assert.match(conflictHtml,/900 mL/);
assert.match(conflictHtml,/0\/7 dias usados na média/);
assert.match(primary(conflictHtml),/Ainda não confirmado/);
const held=structuredClone(conflict);held.sourceMetrics=held.sourceMetrics.slice(0,1).map(row=>({...row,canonical_status:'held'}));
assert.match(primary(card(renderHealthDashboard(held,f.status,{},f.today),'water')),/Registro com limitações/);
assert.doesNotMatch(text(primary(conflictHtml)),/candidate|candidata|não validada/);

const sources=[{key:'z',label:'Apple Saúde · MyFitnessPal (Health Auto Export)',domain:'sourceMetrics',status:'candidate'},{key:'a',label:'Apple Saúde · MyFitnessPal (Health Auto Export)',domain:'sourceMetrics',status:'candidate'}];
assert.notEqual(sourceDisplayLabel(sources[0],sources),sourceDisplayLabel(sources[1],sources));
assert.equal(sourceDisplayLabel(sources[0],sources),sourceDisplayLabel(sources[0],[...sources].reverse()));
assert.match(sourceDisplayLabel(sources[0],sources),/MyFitnessPal via Saúde/);
assert.match(sourceDisplayNote(sources[0]),/Health Auto Export/,'original descriptive source name is available in the secondary explanation');
assert.equal(displaySource('healthkit_candidate'),'Apple Saúde');
assert.equal(displaySource('internal_source_name'),'Origem importada');
assert.equal(userFacingError(new Error('SQLSTATE payload canonical_status=broken')),'Não foi possível concluir agora. Tente novamente.');
assert.equal(userFacingError(new Error('Proteína diária: informe um valor positivo válido ou deixe em branco.')),'Proteína diária: informe um valor positivo válido ou deixe em branco.');

state.data=structuredClone(f.data);state.domainStatus={...f.status};state.errors={};state.ui={homePeriod:'all',productLabPeriod:'all',timelinePeriod:'all'};
state.data.labs=[{source_record_id:'synthetic-old-lab',collection_date:f.date(40),biomarker:'Synthetic lab marker',result_raw:'< 0,004',result_numeric:.004,unit:'mg/L',reference_range:'Ver condições no laudo',laboratory:'Synthetic lab',method:'Synthetic method'}];
const labHome=renderHealthDashboard(state.data,state.domainStatus,{},f.today);
assert.match(labHome,/Última coleta:/);assert.match(labHome,/fora do período/);assert.match(labHome,/&lt; 0,004 mg\/L/);
assert.match(renderProductLabs(),/&lt; 0,004 mg\/L/,'clinical censor and exact written precision survive');
const note='Nota clínica original: payload e source_record_id são palavras citadas; 8+2 repetições.';
state.data.exercises[0].notes=note;state.ui.openWorkout=state.data.workouts[0].source_record_id;state.ui.productTrainingView='exercises';
const training=renderProductTraining();
assert.ok(training.includes(note),'source clinical note is not filtered by its vocabulary');
assert.match(training,/<details class="ltsRefExerciseNotes">[\s\S]*?Nota clínica original/);
assert.doesNotMatch(text(primary(training)),blocked);
const timeline=renderTimelineHub();assert.match(timeline,/Acompanhamento de saúde/);assert.doesNotMatch(text(timeline),/care_followup/);
state.domainStatus.workouts='error';
assert.match(renderProductTraining(),/treinos não carregaram/);
// The analysis library is closed by default, but its select options are live
// and must use the same human labels as the Home and nutrition selectors.
const insightData={...f.data,sourceMetrics:['candidate','held'].flatMap(status=>[1,2].map(index=>({source_record_id:`synthetic-insight-${status}-${index}`,source_name:'Apple Saúde · MyFitnessPal (Health Auto Export)',source_family:'synthetic-insights',canonical_status:status,metric_date:f.date(index),metric_type:'dietary_energy_kcal',unit:'kcal',value:1234.5})))};
const insightBefore=structuredClone(insightData),bounds={start:f.date(7),end:f.date(1)};
const origins=nutritionTrainingContrast(insightData,f.status,bounds,'',f.today).sources;
for(const status of ['candidate','held']){
 const origin=origins.find(source=>source.status===status);assert.ok(origin);
 const html=renderEvidenceInsights(insightData,f.status,bounds,{reportNutritionSource:origin.key});
 assert.doesNotMatch(text(html.match(/<select id="reportNutritionSource"[\s\S]*?<\/select>/)?.[0]||''),/fonte candidata|fonte em revisão|arquivo conferido|Health Auto Export/);
 assert.ok(html.includes(`value="${origin.key.replaceAll('&','&amp;').replaceAll('"','&quot;')}" selected`),'source identity and requested selection survive presentation');
 assert.match(html,status==='candidate'?/Registro adicional/:/Registro com limitações/);
 assert.match(html,/Nome informado pela origem: Apple Saúde · MyFitnessPal \(Health Auto Export\)/,'full source name is retained in source details');
}
assert.deepEqual(insightData,insightBefore);
console.log('Consumer health copy: seven cards, empty/partial/conflicting/failed reads, source aliases, exact clinical text, latest labs, workouts and Timeline passed.');

const mainSource=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
assert.match(mainSource,/loadingState[\s\S]*?<span>Aguarde um instante\.<\/span>/,'loading copy is brief and consumer-facing');
assert.doesNotMatch(mainSource,/Os dados já carregados continuam preservados/);

// Source identity controls grouping; chart titles must use its human label.
const {homeCockpitModel,nutritionPanel}=await import('../src/home-cockpit.js');
const chartBefore=structuredClone(f.data);
const nutritionHtml=nutritionPanel(homeCockpitModel(f.data,f.status,'30',{},f.today));
const chartTitles=[...nutritionHtml.matchAll(/<title>([\s\S]*?)<\/title>/g)].map(m=>m[1]).join(' ');
assert.ok(chartTitles.length>0,'exercise real nutrition chart titles');
assert.doesNotMatch(chartTitles,/canonical|&quot;nutrition&quot;|\[&quot;/,'internal source tuples never reach point titles');
assert.deepEqual(f.data,chartBefore,'presentation retains all original observations and grouping identities');

// A real recovery select and evidence list must not print transport units.
const {renderUsefulReports}=await import('../src/reports-screen.js');
const {renderRecoveryDepth}=await import('../src/recovery-layout-v2.js');
state.data=structuredClone(f.data);state.domainStatus={...f.status};state.ui={reportPeriod:'30',analysisPeriod:'30'};
state.data.sourceMetrics.push(...[1,2].map(i=>({source_record_id:`synthetic-step-copy-${i}`,metric_date:f.date(i),metric_type:'steps',unit:'count',value:1000+i,source_name:'Synthetic watch',source_family:'synthetic',canonical_status:'candidate'})));
const recoveryBefore=structuredClone(state.data);
const recoveryHtml=renderUsefulReports()+renderRecoveryDepth();
assert.match(recoveryHtml,/Synthetic watch[\s\S]*?passos/);
assert.doesNotMatch(text(recoveryHtml),/\bcount\b/,'transport count is presented as passos');
assert.deepEqual(state.data,recoveryBefore,'display units preserve source records');

// Historical text-only sessions do not become a zero baseline for set growth.
const {reportBounds,trainingSummary}=await import('../src/reports-model.js');
const windows=reportBounds('30');
state.ui={analysisPeriod:'30'};state.data=structuredClone(f.data);state.domainStatus={...f.status};
state.data.workouts=[{source_record_id:'synthetic-text-prior',workout_date:windows.previous.end,is_canonical:true,notes:'Synthetic preserved original: 3 x 8',duration_minutes:30},{source_record_id:'synthetic-structured-current',workout_date:windows.current.start,is_canonical:true,duration_minutes:30}];
state.data.exercises=[{source_record_id:'synthetic-current-ex',workout_source_record_id:'synthetic-structured-current',exercise:'Synthetic exercise'}];
state.data.sets=[{workout_source_record_id:'synthetic-structured-current',exercise_source_record_id:'synthetic-current-ex',set_index:1}];
const setsBefore=structuredClone(state.data),priorSummary=trainingSummary(state.data,state.domainStatus,windows.previous);
assert.equal(priorSummary.sets,0,'original structured row count is retained');
assert.equal(priorSummary.setCoverage,0);assert.equal(priorSummary.setComplete,false);
let periodHtml=renderUsefulReports().match(/<tr><th scope="row">Séries estruturadas<\/th>([\s\S]*?)<\/tr>/)?.[1]||'';
assert.match(periodHtml,/Sem séries estruturadas/);assert.match(periodHtml,/0 de 1 sessões/);assert.match(periodHtml,/Cobertura incompleta/);assert.doesNotMatch(periodHtml,/\+1/);
state.data.workouts.push({source_record_id:'synthetic-text-current',workout_date:windows.current.end,is_canonical:true,notes:'Preserved original series',duration_minutes:30});
const mixedSummary=trainingSummary(state.data,state.domainStatus,windows.current);
assert.equal(mixedSummary.sets,1);assert.equal(mixedSummary.setCoverage,1);assert.equal(mixedSummary.setTotal,2);assert.equal(mixedSummary.setComplete,false);
periodHtml=renderUsefulReports().match(/<tr><th scope="row">Séries estruturadas<\/th>([\s\S]*?)<\/tr>/)?.[1]||'';
assert.match(periodHtml,/1 de 2 sessões/);assert.match(periodHtml,/Cobertura incompleta/);
state.data.workouts.pop();assert.deepEqual(state.data,setsBefore,'original notes and records survive period presentation');
const noSession=trainingSummary({...state.data,workouts:[]},state.domainStatus,windows.current);
assert.equal(noSession.sets,0);assert.equal(noSession.setComplete,true,'known empty session selection is distinct from missing details');
