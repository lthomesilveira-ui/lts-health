import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {healthDashboardModel} from '../src/health-dashboard-model.js';
import {dashboardContext} from '../src/health-dashboard-context.js';
import {dashboardGuidance} from '../src/health-dashboard-guidance.js';
import {sourceDisplayLabel} from '../src/source-display.js';

// Shared deterministic synthetic fixture. This module performs no I/O when
// imported by the browser suite. No user records, accounts or credentials.
export const FIXED_TODAY='2026-10-17';
export const METRIC_KEYS=['water','protein','energy','activeEnergy','totalEnergy','steps','sleep'];
export const dateBefore=(today,age)=>new Date(Date.parse(`${today}T12:00:00Z`)-age*86400000).toISOString().slice(0,10);
export const dateLabel=date=>date.split('-').reverse().join('/');
export const numberLabel=(value,key)=>value==null?'—':Number(value).toLocaleString('pt-BR',{minimumFractionDigits:key==='sleep'?1:0,maximumFractionDigits:key==='sleep'?1:0});
const domains=['nutrition','sourceMetrics','metrics','body','segmental','workouts','workoutEvidence','exercises','sets','labs','treatments','regimens','docs','goals','waterReferences','polarSessions','meals','uploads'];
export function makeDashboardFixture(today=FIXED_TODAY,{sparse=false}={}){
  const date=age=>dateBefore(today,age),data=Object.fromEntries(domains.map(key=>[key,[]])),status=Object.fromEntries(domains.map(key=>[key,'ready']));
  const ages=sparse?[0,1,3,6,14,40,100,200,400]:Array.from({length:401},(_,age)=>age);
  for(const age of ages){
    const partial=sparse&&age===6;
    for(const [origin,offset] of [['A',0],['B',4000]]){
      // A is the stable default; B is a separate origin, never an additive sample.
      data.nutrition.push({source_record_id:`synthetic-food-${origin}-${age}`,nutrition_date:date(age),source:`Synthetic ${origin} food`,water_ml:age?((sparse&&age===1)?0:1000+age*10)+offset:9000+offset,protein_g:age?100+age+offset/20:900+offset/20,calories_kcal:age?2000+age*10+offset:9000+offset,knownPartial:partial});
      for(const [key,type,unit,value] of [['activeEnergy','active_energy_kcal','kcal',age?300+2*age+offset:7000+offset],['totalEnergy','total_energy_kcal','kcal',age?2300+5*age+offset:9900+offset],['steps','steps','count',age?5000+100*age+offset:99000+offset],['sleep','sleep_duration_h','h',age?6+age/200+offset/4000:12+offset/4000]]){
        if(sparse&&key==='totalEnergy')continue;
        data.sourceMetrics.push({source_record_id:`synthetic-${key}-${origin}-${age}`,metric_date:date(age),metric_type:type,unit,value,source_name:`Synthetic ${origin} watch`,source_family:'synthetic',canonical_status:'canonical',knownPartial:partial});
      }
    }
  }
  data.sourceMetrics.push({source_record_id:'synthetic-old-water',metric_date:date(40),metric_type:'dietary_water_ml',unit:'mL',value:5555,source_name:'Synthetic older water',source_family:'synthetic',canonical_status:'canonical'});
  for(const [index,age] of (sparse?[20,60]:[2,20,50,85,160,240,390]).entries())data.body.push({source_record_id:`synthetic-body-${age}`,measured_at:date(age),source:'Synthetic body',device_name:'Synthetic device',weight_kg:80+index,fat_mass_kg:16+index,skeletal_muscle_mass_kg:34-index/4,body_fat_pct:20+index});
  const workoutAges=sparse?[40,140]:[0,1,1,4,9,20,40,80,140,220,390];
  workoutAges.forEach((age,index)=>{
    const id=`synthetic-workout-${index}`,group=age>=40?'Pernas':'Peito';
    data.workouts.push({source_record_id:id,workout_date:date(age),workout_type:`Synthetic session ${index}`,location:'Synthetic gym',source:'Synthetic training log',is_canonical:true,record_status:'validated',duration_minutes:index===2?null:40,muscle_groups:[group]});
    for(let exercise=0;exercise<3;exercise++){
      const eid=`${id}-exercise-${exercise}`;
      data.exercises.push({source_record_id:eid,workout_source_record_id:id,workout_date:date(age),exercise:`Synthetic exercise ${exercise} — equipamento com descrição estendida`,order_index:exercise+1,machine:'Synthetic equipment',muscle_group:exercise===2?'Ombros':group});
      data.sets.push({source_record_id:`${eid}-set`,workout_source_record_id:id,exercise_source_record_id:eid,workout_date:date(age),set_index:1,phase:'working',weight:40,reps_numeric:8,weight_unit:'kg'});
    }
  });
  const lab=(marker,age,value,reference='10 a 18',method='Synthetic method')=>({source_record_id:`synthetic-lab-${marker}-${age}`,collection_date:date(age),report_date:date(age),biomarker:marker,result_numeric:value,result_raw:String(value),unit:'u',laboratory:'Synthetic laboratory',source:'Synthetic lab report',method,reference_range:reference});
  data.labs=[lab('Synthetic A marker',60,22),lab('Synthetic A marker',20,16),lab('Synthetic B changed reference',60,20,'10 a 18'),lab('Synthetic B changed reference',20,15,'5 a 20'),lab('Synthetic C unknown method',60,12,'10 a 18',''),lab('Synthetic C unknown method',20,13,'10 a 18','')];
  data.polarSessions=(sparse?[0,40]:[0,0,1,2,4,10,20,40]).map((age,index)=>({source_record_id:`synthetic-polar-${index}`,workout_date:date(age),recorded_start:`${date(age)}T${String(8+index).padStart(2,'0')}:00:00Z`,session_name:`Synthetic Polar session ${index}`,duration_minutes:index===2?null:35,heart_rate_avg:120,heart_rate_max:160,source_name:'Synthetic Polar'}));
  data.treatments=[{source_record_id:'synthetic-protocol-old',event_date:date(60),medication:'Synthetic protocol',event_type:'reported',source:'Synthetic protocol history'},{source_record_id:'synthetic-protocol-recent',event_date:date(2),medication:'Synthetic protocol',event_type:'planned',source:'Synthetic protocol history'},{source_record_id:'synthetic-protocol-today',event_date:today,medication:'Synthetic today protocol',event_type:'reported',source:'Synthetic protocol history'}];
  data.regimens=[{source_record_id:'synthetic-undated-regimen',medication:'Synthetic undated context',source:'Synthetic regimen register'}];
  data.docs=[{source_record_id:'synthetic-care-document',document_date:date(3),document_type:'care_followup',title:'Synthetic follow-up document',source:'Synthetic care report',care_context:{schema_version:1,title:'Synthetic care context',followups:[{key:'synthetic-pending',label:'Synthetic documented follow-up',status:'Registro pendente',resolved:false}]}}];
  data.goals=[{effective_from:date(400),water_ml:2400,protein_g:150,notes:'Synthetic personal target'}];
  data.waterReferences=[];
  const tableMap={nutrition:'health_daily_nutrition',sourceMetrics:'health_source_daily_metrics',metrics:'health_metrics',body:'health_body_composition',segmental:'health_segmental_composition',workouts:'health_workouts',workoutEvidence:'health_workout_source_evidence',exercises:'health_workout_exercises',sets:'health_workout_sets',labs:'health_lab_results',treatments:'health_medication_events',regimens:'health_medication_regimens',docs:'health_documents',goals:'health_personal_goals',polarSessions:'health_polar_sessions',meals:'health_nutrition_meals',uploads:'health_uploads'};
  const db=Object.fromEntries(Object.entries(tableMap).map(([key,table])=>[table,structuredClone(data[key])]));
  return {today,date,data,status,db,sparse};
}
export function expectedMetric(fixture,key,bounds,source='A'){
  const nutrition={water:'water_ml',protein:'protein_g',energy:'calories_kcal'},types={activeEnergy:'active_energy_kcal',totalEnergy:'total_energy_kcal',steps:'steps',sleep:'sleep_duration_h'};
  const rows=nutrition[key]?fixture.data.nutrition.filter(row=>row.source===`Synthetic ${source} food`).map(row=>({date:row.nutrition_date,value:row[nutrition[key]],partial:row.knownPartial})):fixture.data.sourceMetrics.filter(row=>row.metric_type===types[key]&&row.source_name===`Synthetic ${source} watch`).map(row=>({date:row.metric_date,value:row.value,partial:row.knownPartial}));
  const points=rows.filter(row=>row.date>=bounds.start&&row.date<=bounds.end&&!row.partial&&row.date<fixture.today&&row.value!=null);
  return {value:points.length?points.reduce((sum,row)=>sum+row.value,0)/points.length:null,count:points.length};
}
const card=(html,key)=>html.match(new RegExp(`<article[^>]+data-dashboard-card="${key}"[^>]*>([\\s\\S]*?)<\\/article>`))?.[1]||'';
const primary=html=>html.split('<details')[0];
const panel=(html,domain)=>html.match(new RegExp(`<article[^>]+data-study-domain="${domain}"[^>]*>([\\s\\S]*?)<\\/article>`))?.[1]||'';
const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze);}return value;};
const escapeRegex=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export async function runRenderTests(){
  globalThis.location={search:'?fixture=1'};
  const {renderHealthDashboard}=await import('../src/health-dashboard.js');
  const {state}=await import('../src/core.js');
  const stateBefore=structuredClone(state);
  for(const sparse of [false,true]){
    const f=makeDashboardFixture(FIXED_TODAY,{sparse}),before=structuredClone(f.data),ui=freeze({}),model=healthDashboardModel(f.data,f.status,ui,f.today);
    freeze(f.data);freeze(f.status);
    const html=renderHealthDashboard(f.data,f.status,ui,f.today);
    assert.equal((html.match(/data-dashboard-card=/g)||[]).length,7);
    assert.match(html,/data-health-dashboard/);assert.match(html,/data-dashboard-mode="period" aria-pressed="true"/);
    assert.match(html,/<option value="7" selected>/);assert.match(html,/hoje fora das médias/);
    for(const key of METRIC_KEYS){
      const expected=expectedMetric(f,key,model.bounds),metric=model.metricsByKey[key],content=card(html,key);
      assert.ok(content,key);assert.equal(metric.count,expected.count,`${key}: actual n`);
      assert.ok(metric.value===expected.value||Math.abs(metric.value-expected.value)<1e-10,`${key}: arithmetic mean`);
      assert.ok(content.includes(`<strong>${numberLabel(expected.value,key)}</strong>`),`${key}: displayed mean`);
      assert.match(content,new RegExp(`${expected.count}/7 dias usados na média`));
      assert.ok(content.includes(dateLabel(f.date(7)))&&content.includes(dateLabel(f.date(1))));
      assert.match(content,/Origens separadas não são somadas/);
    }
    if(!sparse){
      assert.match(card(html,'sleep'),/Variação menor que 0,1 h/, 'small nonzero changes are not displayed as a directional zero');
      assert.doesNotMatch(card(html,'sleep'),/[↑↓] 0,0 h/);
    }
    assert.deepEqual(f.data,before,'pure renderer leaves supplied records unchanged');
    assert.doesNotMatch(html,/\b(?:NaN|undefined|Infinity)\b/);
    const current=renderHealthDashboard(f.data,f.status,{dashboardMode:'day'},f.today);
    assert.match(current,/hoje parcial/);assert.match(current,/value="2026-10-17"/);assert.doesNotMatch(current,/data-dashboard-period/);
    assert.equal((current.match(/hoje parcial/g)||[]).length,1,'the shared day/partial context is stated once');
    assert.deepEqual([...current.matchAll(/data-dashboard-card="([^"]+)"/g)].map(match=>match[1]),METRIC_KEYS,'approved seven-card order is unchanged');
    for(const key of METRIC_KEYS){
      const content=primary(card(current,key));
      assert.doesNotMatch(content,/healthAggregation|healthMetricPeriod|Registro de hoje|O registro deste dia pode estar incompleto/,'daily date/partial copy is not repeated in each card');
    }
    assert.match(card(current,'water'),/<strong>9\.000<\/strong>/);
    const historical=renderHealthDashboard(f.data,f.status,{dashboardMode:'day',dashboardDate:f.date(1)},f.today);
    assert.match(historical,/dia encerrado; registros podem estar incompletos/);
    assert.match(card(historical,'water'),new RegExp(`<strong>${sparse?'0':'1\\.010'}<\\/strong>`));
    assert.doesNotMatch(card(historical,'water'),/Registro de hoje/);
    const signatures=[];
    for(const period of ['7','30','60','90','6m','1y','all']){
      const selection={dashboardPeriod:period},d=healthDashboardModel(f.data,f.status,selection,f.today),output=renderHealthDashboard(f.data,f.status,selection,f.today);
      signatures.push(d.bounds.start);
      for(const key of METRIC_KEYS){
        const expected=expectedMetric(f,key,d.bounds),content=card(output,key);
        assert.ok(content.includes(`<strong>${numberLabel(expected.value,key)}</strong>`),`${period}/${key}: selected-period value`);
        assert.ok(content.includes(`${expected.count}/${d.bounds.days} dias usados na média`),`${period}/${key}: selected-period coverage`);
        assert.ok(content.includes(dateLabel(d.bounds.start)),`${period}/${key}: selected-period date`);
      }
      assert.ok(panel(output,'training').includes(dateLabel(d.bounds.start)),`${period}: training period`);
      assert.match(output,new RegExp(`<option value="${period}" selected>`));
      assert.doesNotMatch(output,/\b(?:NaN|undefined|Infinity)\b/);
    }
    assert.equal(new Set(signatures).size,7,'all seven requested windows are distinct');
    const source=model.metricsByKey.water.sources.find(item=>item.label==='Synthetic B food').key;
    const alternative=renderHealthDashboard(f.data,f.status,{dashboardSources:{water:source}},f.today),altExpected=expectedMetric(f,'water',model.bounds,'B');
    assert.ok(card(alternative,'water').includes(`<strong>${numberLabel(altExpected.value,'water')}</strong>`));
    assert.equal(card(alternative,'protein'),card(html,'protein'),'changing water source does not change protein');
    const old=model.metricsByKey.water.sources.find(item=>item.label==='Synthetic older water').key;
    const older=card(renderHealthDashboard(f.data,f.status,{dashboardSources:{water:old}},f.today),'water');
    assert.match(older,/<strong>—<\/strong>/);
    assert.match(primary(older),new RegExp(`Último registro desta origem: ${escapeRegex(dateLabel(f.date(40)))}`),'global latest source date stays visible in an empty selected period');
    assert.equal((older.match(/Último registro/g)||[]).length,1,'latest-date provenance is not repeated inside the disclosure');
    const context=dashboardContext(f.data,f.status,{bounds:model.bounds,today:f.today,mode:model.mode});
    assert.equal(context.training.sessions,sparse?0:3);assert.equal(context.training.recordedDays,sparse?0:2);
    if(!sparse){
      assert.equal(context.training.groups.find(group=>group.label==='Peito').sessions,3,'three exercises never become three sessions');
      assert.equal(context.training.groups.find(group=>group.label==='Ombros').sessions,3);
      assert.match(panel(html,'training'),/3<span>sessões registradas/);assert.match(panel(html,'training'),/2<span>dias com treino registrado/);
      assert.match(panel(html,'training'),/Pernas: sem registro nesta janela/);
      assert.match(panel(html,'training'),/9 exercícios/);
      assert.match(panel(html,'training'),/9 séries registradas/);
      assert.match(panel(html,'training'),/Registros Polar/);
      assert.match(panel(html,'training'),/Synthetic Polar session/);
      assert.match(panel(html,'training'),/Os totais não são somados/);
      assert.match(panel(html,'training'),/Synthetic exercise 0/);
    }else{
      assert.match(panel(html,'training'),/último conhecido, fora do período/);
      assert.match(panel(html,'body'),/Última avaliação conhecida · fora do período/);
    }
    const labs=panel(html,'labs');
    assert.match(labs,/Último resultado conhecido · fora do período/);assert.match(labs,/aproximou da referência/);assert.match(labs,/Referência: 10 a 18/);assert.match(labs,/Última coleta:/);assert.match(labs,/resultados registrados em 2 coletas/);
    for(const age of [20,60])assert.ok(labs.includes(dateLabel(f.date(age))));
    assert.equal(context.labs.items.find(item=>item.biomarker==='Synthetic B changed reference').comparable,false);
    assert.equal(context.labs.items.find(item=>item.biomarker==='Synthetic C unknown method').comparable,false);
    const protocols=panel(html,'protocols');
    assert.match(protocols,/Synthetic protocol/);assert.match(protocols,/Cadastro de plano não confirma início ou uso atual/);assert.doesNotMatch(protocols,/Synthetic today protocol/);
    const past=renderHealthDashboard(f.data,f.status,{dashboardMode:'day',dashboardDate:f.date(40)},f.today);
    assert.ok(panel(past,'labs').includes(dateLabel(f.date(60))));assert.ok(!panel(past,'labs').includes(dateLabel(f.date(20))),'historical day hides later lab collections');
    assert.ok(!panel(past,'protocols').includes(dateLabel(f.date(2))),'historical day hides later protocol events');
    const guidance=dashboardGuidance(f.data,f.status,model,context);
    assert.ok(guidance.insights.length<=4);assert.ok(guidance.insights.every(item=>item.evidence&&item.text));
  }
  const empty=makeDashboardFixture();for(const key of Object.keys(empty.data))empty.data[key]=[];
  const unavailable=Object.fromEntries(Object.keys(empty.status).map(key=>[key,'error']));
  for(const status of [empty.status,unavailable])for(const dashboardPeriod of ['7','all']){
    const html=renderHealthDashboard(empty.data,status,{dashboardPeriod},empty.today);
    assert.equal((html.match(/data-dashboard-card=/g)||[]).length,7);assert.doesNotMatch(html,/\b(?:NaN|undefined|Infinity)\b/);assert.match(html,/(?:Sem registro|Ainda não há|Não foi possível|Cobertura indisponível)/);
  }
  const failedFixture=makeDashboardFixture();
  const failedHtml=renderHealthDashboard(failedFixture.data,{...failedFixture.status,metrics:'error',sourceMetrics:'error'}, {},failedFixture.today);
  assert.match(card(failedHtml,'steps'),/(?:falh|não (?:carreg|foi possível)|indisponível)/i,'failed metric reads are labelled distinctly from no observations');
  assert.match(card(failedHtml,'steps'),/<strong>—<\/strong>/,'failed sources never show stale recorded values');
  const emptyHtml=renderHealthDashboard(empty.data,empty.status,{},empty.today);
  assert.doesNotMatch(card(emptyHtml,'steps'),/(?:leitura falhou|falha de leitura)/i,'a successful empty read is not described as a failure');
  const conflictingTraining=makeDashboardFixture();
  conflictingTraining.data.workouts=[30,45].map(duration_minutes=>({source_record_id:'synthetic-conflicting-session',workout_date:conflictingTraining.date(1),workout_type:'Synthetic conflict session',is_canonical:true,record_status:'validated',source:'Synthetic conflicting log',duration_minutes}));
  conflictingTraining.data.exercises=[];conflictingTraining.data.sets=[];
  const conflictingTrainingHtml=panel(renderHealthDashboard(conflictingTraining.data,conflictingTraining.status,{},conflictingTraining.today),'training');
  assert.match(conflictingTrainingHtml,/(?:conflit|amb[ií]gu)/i,'conflicting workout rows must have a visible notice even when no session is eligible');
  assert.match(conflictingTrainingHtml,/0<span>sessões registradas/,'conflicting workout identity is never silently counted');
  const conflictingMetric=makeDashboardFixture();
  conflictingMetric.data.nutrition=[100,900].map((water_ml,index)=>({source_record_id:`synthetic-conflicting-water-${index}`,nutrition_date:conflictingMetric.date(1),source:'Synthetic conflicting diary',water_ml}));
  conflictingMetric.data.sourceMetrics=[];
  const conflictingMetricHtml=card(renderHealthDashboard(conflictingMetric.data,conflictingMetric.status,{},conflictingMetric.today),'water');
  assert.match(conflictingMetricHtml,/<strong>—<\/strong>/);
  assert.match(conflictingMetricHtml,/(?:conflit|amb[ií]gu|duplicad|mais de um valor)/i,'ambiguous daily metric is visibly distinguished from an absent day');
  assert.match(conflictingMetricHtml,/100 mL/,'first ambiguous metric value stays available for review');
  assert.match(conflictingMetricHtml,/900 mL/,'second ambiguous metric value stays available for review');
  // Laboratory displays preserve reported notation and precision. A numeric
  // field does not authorize dropping a censor or choosing a conflicting row.
  const laboratory=makeDashboardFixture();
  const lab=(id,age,numeric,raw,patch={})=>({source_record_id:id,collection_date:laboratory.date(age),biomarker:'Synthetic precision marker',result_numeric:numeric,result_raw:raw,unit:'u',reference_range:'0 a 10',method:'Synthetic precise method',laboratory:'Synthetic precise lab',source:'Synthetic precise report',...patch});
  laboratory.data.labs=[lab('synthetic-censored',2,4,'<4')];
  let renderedLabs=panel(renderHealthDashboard(laboratory.data,laboratory.status,{},laboratory.today),'labs');
  assert.ok(renderedLabs.includes('&lt;4'),'censored laboratory value remains explicitly censored');
  assert.doesNotMatch(renderedLabs,/Diferença registrada/);
  laboratory.data.labs=[lab('synthetic-decimal-before',4,.04,'0.04'),lab('synthetic-decimal-after',2,.05,'0.05')];
  renderedLabs=panel(renderHealthDashboard(laboratory.data,laboratory.status,{},laboratory.today),'labs');
  assert.match(renderedLabs,/0[.,]04/,'prior value does not round 0.04 to 0.0');
  assert.match(renderedLabs,/0[.,]05/,'latest value does not round 0.05 to 0.1');
  assert.match(renderedLabs,/Diferença registrada: \+0[.,]01 u/,'difference retains useful recorded precision');
  laboratory.data.labs=[lab('synthetic-conflict-a',2,4,'4'),lab('synthetic-conflict-b',2,9,'9')];
  renderedLabs=panel(renderHealthDashboard(laboratory.data,laboratory.status,{},laboratory.today),'labs');
  assert.match(renderedLabs,/>4(?:[.,]0)? u</,'first ambiguous observation is readable');
  assert.match(renderedLabs,/>9(?:[.,]0)? u</,'second ambiguous observation is readable');
  assert.doesNotMatch(renderedLabs,/Diferença registrada/,'ambiguous collection never gets a fabricated delta');
  const missingEvidence=makeDashboardFixture();const evidenceWarning=panel(renderHealthDashboard(missingEvidence.data,{...missingEvidence.status,workoutEvidence:'error'},{},missingEvidence.today),'training');assert.match(evidenceWarning,/Não foi possível atualizar as medidas do aparelho/);assert.match(evidenceWarning,/9 exercícios/);assert.match(evidenceWarning,/Registros Polar/);
  const conflictingEvidence=makeDashboardFixture();conflictingEvidence.data.workoutEvidence=['Synthetic A','Synthetic B'].map(source_name=>({source_record_id:'synthetic-conflicting-evidence',workout_source_record_id:conflictingEvidence.data.workouts[1].source_record_id,workout_date:conflictingEvidence.date(1),source_name,evidence_kind:'telemetry',evidence_status:'confirmed',field_names:['duration_minutes']}));assert.match(panel(renderHealthDashboard(conflictingEvidence.data,conflictingEvidence.status,{},conflictingEvidence.today),'training'),/medidas do aparelho que não puderam ser associadas/);
  const qualifiers=makeDashboardFixture();qualifiers.data.sets.forEach(row=>{row.reps_raw='8+2';row.reps_numeric=8;row.weight=4;row.weight_unit='plate_index';});
  const qualifiedTraining=panel(renderHealthDashboard(qualifiers.data,qualifiers.status,{},qualifiers.today),'training');assert.match(qualifiedTraining,/8\+2 repetições registradas/);assert.match(qualifiedTraining,/índice de placa/);
  for(const [weight,expected] of [[40,'40 kg'],[4.125,'4,125 kg'],[0.00001,'0,00001 kg']]){
    const precision=makeDashboardFixture();precision.data.sets.forEach(row=>{row.weight=weight;row.weight_unit='kg';});
    const text=panel(renderHealthDashboard(precision.data,precision.status,{},precision.today),'training');
    assert.ok(text.includes(expected),'recorded load retains significant decimal precision');assert.doesNotMatch(text,/40,0000000000 kg/,'no artificial trailing decimal zeros');
  }
  const candidateFixture=makeDashboardFixture();candidateFixture.data.sourceMetrics.forEach(row=>{row.canonical_status='candidate';});const candidateHtml=renderHealthDashboard(candidateFixture.data,candidateFixture.status,{},candidateFixture.today);assert.match(candidateHtml,/versão adicional do registro/);assert.doesNotMatch(candidateHtml,/Origem ainda não validada/);
  const candidateDay=renderHealthDashboard(candidateFixture.data,candidateFixture.status,{dashboardMode:'day'},candidateFixture.today);
  assert.match(primary(card(candidateDay,'activeEnergy')),/Registro adicional, ainda sem confirmação/,'unconfirmed active energy remains visible without opening details');
  const missingOriginDay=renderHealthDashboard(candidateFixture.data,candidateFixture.status,{dashboardMode:'day',dashboardSources:{water:'synthetic-missing-origin'}},candidateFixture.today);
  assert.match(primary(card(missingOriginDay,'water')),/origem escolhida não está disponível; nenhuma outra foi usada/,'an unavailable explicit daily origin never becomes an unexplained blank');
  const documentary=makeDashboardFixture();documentary.data.goals=[];documentary.data.nutrition=documentary.data.nutrition.filter(row=>row.nutrition_date<documentary.today);documentary.data.sourceMetrics=[];
  const docDate=documentary.date(3),checksum='a'.repeat(64);
  documentary.data.waterReferences=[{source_record_id:'synthetic-documentary-water',document_type:'medical_plan',document_date:docDate,source_file:'Synthetic plan.pdf',source:'Synthetic documentary source',checksum,water_reference:{schema_version:1,type:'documented_water_base',base_ml_per_day:3000,source_page:3,documented_on:docDate,source_sha256:checksum,date_basis:'document_update',clinical_start:'not_explicit',exercise_addition:'Synthetic exercise context; not calculated automatically.'}}];
  const documentaryCard=card(renderHealthDashboard(documentary.data,documentary.status,{dashboardMode:'day'},documentary.today),'water');
  assert.match(primary(documentaryCard),/Sem registro neste dia/);
  assert.match(primary(documentaryCard),new RegExp(`Último registro desta origem: ${escapeRegex(dateLabel(documentary.date(1)))}`),'missing water retains its most recent date above details');
  assert.doesNotMatch(primary(documentaryCard),/Referência documental/,'a documentary reference is secondary context, not a current target or water value');
  assert.match(documentaryCard,/<details[\s\S]*Referência documental: 3\.000 mL\/dia[\s\S]*Vigência clínica não confirmada/,'documentary amount, date and validity warning stay together in the disclosure');
  assert.match(primary(card(renderHealthDashboard(makeDashboardFixture().data,documentary.status,{dashboardMode:'day'},documentary.today),'water')),/Meta cadastrada: 2\.400 mL/,'a genuine personal target remains visible');
  const unsafe=makeDashboardFixture();unsafe.data.nutrition.forEach(row=>{row.source='Synthetic <img src=x onerror=alert(1)>';});
  const safe=renderHealthDashboard(unsafe.data,unsafe.status,{},unsafe.today);
  assert.ok(safe.includes('&lt;img'));assert.ok(!safe.includes('<img src=x'));
  const {periodReadabilityFixture}=await import('./period-readability-fixture.mjs'),{htmlText:visibleHtmlText}=await import('./consumer-language-html.mjs');
  for(const sparse of [false,true]){
    const f=periodReadabilityFixture({sparse}),before=structuredClone(f.data),d=healthDashboardModel(f.data,f.status,{},f.today),html=renderHealthDashboard(f.data,f.status,{},f.today);
    assert.equal((html.match(/class="healthPeriodContext"/g)||[]).length,1,'period calculation context appears once');
    assert.match(visibleHtmlText(html),/sem somar origens.*revisão.*fora da média/);
    for(const m of d.metrics){
      const content=card(html,m.key),top=primary(content);
      assert.doesNotMatch(top,/healthAggregation|healthMetricPeriod|healthSourceWindow|Hoje parcial/,'period source controls and repeated methodology are secondary');
      assert.ok(top.includes(sourceDisplayLabel(m.source,m.sources)),'full origin identity stays readable');
      assert.match(top,/Automática/);assert.match(top,new RegExp(`${m.count}/${m.expectedDays} dias usados na média`));
      assert.match(content,/<details[\s\S]*data-dashboard-source=/,'the source picker remains in the card disclosure');
    }
    assert.match(primary(card(html,'activeEnergy')),/Ainda não confirmado/);
    assert.match(primary(card(html,'steps')),/Parcial · 1 dia em revisão\. 1 dia divergente/);
    assert.doesNotMatch(primary(card(html,'steps')),/Resumo parcial|valores fracionados ou inválidos/,'specific steps warning replaces repeated generic/method text');
    assert.match(card(html,'steps'),/valores fracionados ou inválidos/,'full steps limitation remains available');
    assert.match(primary(card(html,'water')),/Último registro desta origem/);
    for(const source of [d.metricsByKey.protein.sources.find(source=>source.label==='Outro diário sintético').key,'synthetic-missing-origin']){
      const emptyCard=card(renderHealthDashboard(f.data,f.status,{dashboardSources:{protein:source}},f.today),'protein'),visible=visibleHtmlText(emptyCard);
      assert.match(visible,/Escolhida por você/);assert.match(visible,/origem com registros, não somadas/);assert.match(visible,/Ver fontes e detalhes/);
      assert.match(emptyCard,/<summary><span class="healthPeriodSourceException">/,'the visible empty-source warning itself is the native disclosure action');
      assert.match(visible,/Sem valor utilizável|Origem escolhida indisponível; nenhuma outra usada/);
    }
    assert.deepEqual(f.data,before,'period presentation never mutates observations');
  }
  assert.deepEqual(state,stateBefore,'pure renderer never writes shared application state');
  console.log('Health dashboard render: seven exact metrics, all windows, day/partial, source isolation, latest dates, sessions/groups, labs, protocols, empty/error states, escaping and pure inputs passed.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await runRenderTests();
