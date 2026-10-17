import assert from 'node:assert/strict';
import test from 'node:test';
import {dashboardGuidance} from '../src/health-dashboard-guidance.js';

const today='2025-03-20';
const status=Object.fromEntries(['goals','waterReferences','treatments','regimens','docs','labs','nutrition','sourceMetrics','metrics','workouts','exercises','sets','body','polarSessions'].map(key=>[key,'ready']));
const empty=()=>({goals:[],waterReferences:[],treatments:[],regimens:[],docs:[],labs:[],nutrition:[],sourceMetrics:[],metrics:[],workouts:[],exercises:[],sets:[],body:[],polarSessions:[]});
const point=(date,value,extra={})=>({date,value,sourceLabel:'Synthetic diary',...extra});
function dashboard({mode='day',date=today,start='2025-03-13',end='2025-03-19',water=[],protein=[],expected=7}={}){
  const bounds=mode==='day'?{start:date,end:date,days:1,closedDays:date===today?0:1}:{start,end,days:expected,closedDays:expected};
  const metrics=[{key:'water',available:true,availability:'ready',unit:'mL',points:water,expectedDays:mode==='day'?1:expected,source:{label:'Synthetic diary'}},{key:'protein',available:true,availability:'ready',unit:'g',points:protein,expectedDays:mode==='day'?1:expected,source:{label:'Synthetic diary'}}];
  return {mode,today,date,bounds,metrics,metricsByKey:Object.fromEntries(metrics.map(metric=>[metric.key,metric]))};
}
const run=(data={},view=dashboard(),state=status,context={})=>dashboardGuidance({...empty(),...data},state,view,context);
const target=(effective_from,water_ml=2000,protein_g=100,extra={})=>({effective_from,water_ml,protein_g,notes:'Synthetic agreed plan',...extra});
const insight=(result,key)=>result.insights.find(item=>item.id===`${key}-goal`);
const historical=(type='historical_protocol')=>target('2025-03-10',3000,160,{notes:JSON.stringify({type,documented_on:'2025-03-10',current_validity:'unconfirmed',source:'Synthetic archived plan',source_page:2,date_basis:'document_update',clinical_start:'not_explicit'})});
function waterDocument(date='2025-03-13',id='document:water'){
  const checksum='a'.repeat(64);
  return {source_record_id:id,document_date:date,document_type:'medical_plan',source_file:'Synthetic prescription.pdf',source:'Synthetic clinician',checksum,water_reference:{schema_version:1,type:'documented_water_base',base_ml_per_day:3000,source_page:3,source_sha256:checksum,documented_on:date,date_basis:'document_update',clinical_start:'not_explicit',exercise_addition:'Conditional exercise addition documented; never calculated here.'}};
}

test('Protected historical and documentary goal rows never become active or retroactive targets',()=>{
  for(const row of [historical(),historical('documented_water_base'),target('2025-03-10',3000,160,{notes:'{"type":"historical_protocol"}'})]){
    const result=run({goals:[row]},dashboard({water:[point(today,1000)],protein:[point(today,80)]}));
    for(const key of ['water','protein']){
      assert.equal(result.goals[key].target,null);assert.equal(result.goals[key].count,0);assert.equal(result.goals[key].delta,null);
      assert.match(insight(result,key).text,/Meta não confirmada/);
    }
  }
});

test('A target is applied only on and after its explicitly registered effective day',()=>{
  const data={goals:[target('2025-03-19')]};
  const before=run(data,dashboard({date:'2025-03-18',water:[point('2025-03-18',1900)]}));
  assert.equal(before.goals.water.target,null);assert.equal(before.goals.water.count,0);
  const after=run(data,dashboard({date:'2025-03-19',water:[point('2025-03-19',2000)]}));
  assert.equal(after.goals.water.target,2000);assert.equal(after.goals.water.count,1);assert.equal(after.goals.water.current.effectiveFrom,'2025-03-19');
  assert.match(insight(after,'water').title,/registro alcança a meta/);assert.doesNotMatch(insight(after,'water').text,/saúde boa|adequad[ao]s?\b|hidratad[ao]/i);
});

test('Today remains partial and prompts a record check before distribution according to the plan',()=>{
  const result=run({goals:[target('2025-03-19')]},dashboard({water:[point(today,800,{eligible:false,partial:true})],protein:[point(today,60,{eligible:false,partial:true})]}));
  for(const key of ['water','protein']){
    const item=insight(result,key);assert.match(item.title,/registro parcial/);assert.match(item.text,/registrados até agora/);assert.match(item.text,/Confira o registro e distribua ao longo do dia conforme seu plano/);assert.doesNotMatch(item.text,/ingestão insuficiente|desidrat|deficien|coma mais|beba mais/i);assert.equal(result.goals[key].pairs[0].partial,true);
  }
});

test('Historical partial values never receive instructions to distribute intake today',()=>{
  const result=run({goals:[target('2025-03-10')]},dashboard({date:'2025-03-18',water:[point('2025-03-18',800,{knownPartial:true,eligible:false})]}));
  assert.match(insight(result,'water').text,/registro parcial/);assert.doesNotMatch(insight(result,'water').text,/até agora|distribua ao longo/);
});

test('Period comparisons pair actual and changing targets on the exact same dates',()=>{
  const result=run({goals:[target('2025-03-13',2000,100),target('2025-03-16',3000,150)]},dashboard({mode:'period',water:[point('2025-03-13',1800),point('2025-03-16',2800),point('2025-03-19',3200)],protein:[point('2025-03-13',120),point('2025-03-19',150)]}));
  assert.deepEqual(result.goals.water.pairs.map(item=>[item.date,item.actual,item.target]),[['2025-03-13',1800,2000],['2025-03-16',2800,3000],['2025-03-19',3200,3000]]);
  assert.equal(result.goals.water.meanActual,2600);assert.equal(result.goals.water.meanTarget,8000/3);assert.equal(result.goals.water.achievedCount,1);assert.equal(result.goals.water.count,3);assert.equal(result.goals.water.expectedDays,7);
  assert.equal(result.goals.protein.count,2);assert.equal(result.goals.protein.meanTarget,125);
  assert.match(insight(result,'water').evidence,/3\/7 dias pareados/);assert.match(insight(result,'water').text,/1\/3 dias pareados/);assert.match(insight(result,'water').evidence,/13\/03\/2025/);assert.match(insight(result,'water').evidence,/16\/03\/2025/);
});

test('Unconfirmed dates are excluded from both numerator means without inventing targets',()=>{
  const result=run({goals:[target('2025-03-16')]},dashboard({mode:'period',water:[point('2025-03-13',9999),point('2025-03-16',1800)]}));
  assert.equal(result.goals.water.count,1);assert.equal(result.goals.water.meanActual,1800);assert.equal(result.goals.water.meanTarget,2000);assert.equal(result.goals.water.status,'partial');
  assert.deepEqual(result.goals.water.unconfirmedDates,[{date:'2025-03-13',reason:'no_goal'}]);assert.match(insight(result,'water').text,/1 dia\(s\) com valor e sem meta confirmada ficaram fora/);
});

test('Missing is not zero; explicit zero survives and a missing day is not filled by aggregate value',()=>{
  const result=run({goals:[target('2025-03-10')]},dashboard({mode:'period',water:[point('2025-03-13',null),point('2025-03-14',undefined),point('2025-03-15',''),point('2025-03-16',false),point('2025-03-17',0)]}));
  assert.equal(result.goals.water.count,1);assert.equal(result.goals.water.meanActual,0);assert.equal(result.goals.water.missingRecordDays,6);
  const view=dashboard();view.metricsByKey.water.value=2400;
  const missing=run({goals:[target('2025-03-10')]},view);
  assert.equal(missing.goals.water.count,0);assert.equal(missing.goals.water.actual,null);assert.match(insight(missing,'water').text,/ausência de registro não significa zero/);
});

test('Known partial and ineligible historical dates are visible but excluded from period comparisons',()=>{
  const result=run({goals:[target('2025-03-10')]},dashboard({mode:'period',water:[point('2025-03-13',500,{partial:true,eligible:false}),point('2025-03-14',600,{eligible:false}),point('2025-03-15',2000,{eligible:true})]}));
  assert.equal(result.goals.water.points.length,3);assert.equal(result.goals.water.count,1);assert.equal(result.goals.water.meanActual,2000);assert.equal(result.goals.water.excludedRecordedDays,2);assert.equal(result.goals.water.missingRecordDays,4);assert.deepEqual(result.goals.water.partialDates,['2025-03-13']);
});

test('A period containing today defensively withholds today from closed-day comparison',()=>{
  const result=run({goals:[target('2025-03-10')]},dashboard({mode:'period',end:today,expected:8,water:[point('2025-03-19',2000),point(today,300)]}));
  assert.equal(result.goals.water.count,1);assert.equal(result.goals.water.meanActual,2000);assert.deepEqual(result.goals.water.partialDates,[today]);
});

test('Same-day goal ambiguity, cleared fields and newer protected versions block fallback',()=>{
  const older=target('2025-03-10'),view=dashboard({water:[point(today,1500)],protein:[point(today,70)]});
  for(const latest of [[target('2025-03-19'),target('2025-03-19')],[target('2025-03-19',null,null)],[{...historical(),effective_from:'2025-03-19'}]]){
    const result=run({goals:[older,...latest]},view);
    assert.equal(result.goals.water.target,null);assert.equal(result.goals.protein.target,null);assert.equal(result.goals.water.count,0);
  }
});

test('Invalid targets and invalid effective dates are never normalized into daily goals',()=>{
  for(const value of [true,false,0,-1,'',Infinity,30001]){
    const result=run({goals:[target('2025-03-10',value)]},dashboard({water:[point(today,100)]}));assert.equal(result.goals.water.target,null);
  }
  for(const effective_from of ['2025-02-30','not-a-date','2025-03-10T00:00:00Z'])assert.equal(run({goals:[target(effective_from)]}).goals.water.target,null);
});

test('Duplicate daily metric values are ambiguous even if identical',()=>{
  const view=dashboard({water:[point(today,1800),point(today,1800)]});
  const result=run({goals:[target('2025-03-10')]},view);
  assert.equal(result.goals.water.count,0);assert.deepEqual(result.goals.water.ambiguousDates,[today]);
});

test('Independent water documentary reference is shown without daily target or exercise arithmetic',()=>{
  const result=run({goals:[historical('documented_water_base')],waterReferences:[waterDocument()]},dashboard({water:[point(today,1800)]}));
  assert.equal(result.goals.documentedWater.value,3000);assert.equal(result.goals.documentedWater.isDailyTarget,false);assert.equal(result.goals.documentedWater.clinicalStart,'not_explicit');
  assert.equal(result.goals.water.target,null);assert.equal(result.goals.water.delta,null);assert.equal(result.goals.water.count,0);assert.match(insight(result,'water').text,/Meta não confirmada/);
  assert.equal(run({waterReferences:[waterDocument()]},dashboard({date:'2025-03-12'})).goals.documentedWater,null);
  assert.equal(run({waterReferences:[waterDocument()]},dashboard(),{...status,waterReferences:'error'}).goals.documentedWater,null);
});

test('Failed domain reads cannot reuse stale goals, values, events or documents',()=>{
  const data={goals:[target('2025-03-10')],treatments:[{event_date:'2025-03-19',medication:'Synthetic medication',event_type:'taken',source:'Synthetic diary'}],docs:[{document_date:'2025-03-19',document_type:'medical_plan',title:'Synthetic plan'}]};
  const view=dashboard({water:[point(today,1800)]});
  assert.equal(run(data,view,{...status,goals:'error'}).goals.water.count,0);
  view.metricsByKey.water.availability='error';assert.equal(run(data,view).goals.water.available,false);
  const result=run(data,view,{...status,treatments:'error',regimens:'error',docs:'error'});
  assert.equal(result.protocols.available,false);assert.equal(result.protocols.status,'error');assert.deepEqual(result.protocols.events,[]);assert.deepEqual(result.protocols.items,[]);
});

test('Protocol context uses last event up to the window end, marks external context and excludes future',()=>{
  const result=run({treatments:[{source_record_id:'old',event_date:'2025-03-10',medication:'Synthetic A',event_type:'taken',source:'Synthetic diary'},{source_record_id:'in',event_date:'2025-03-17',medication:'Synthetic A',event_type:'reported',source:'Synthetic diary'},{source_record_id:'future',event_date:'2025-03-21',medication:'Synthetic future medication',event_type:'planned',source:'Synthetic diary'},{source_record_id:'outside',event_date:'2025-03-01',medication:'Synthetic B',event_type:'stopped',source:'Synthetic diary'}],regimens:[{medication:'Synthetic undated protocol',source:'Synthetic registry'},{medication:'Synthetic future regimen',effective_from:'2025-03-21'}],docs:[{source_record_id:'doc-future',document_date:'2025-03-21',document_type:'medical_plan',title:'Synthetic future plan'},{source_record_id:'doc-old',document_date:'2025-03-01',document_type:'medical_plan',title:'Synthetic old plan',source:'Synthetic document'}]},dashboard({mode:'period'}));
  const a=result.protocols.items.find(item=>item.name==='Synthetic A'),b=result.protocols.items.find(item=>item.name==='Synthetic B'),undated=result.protocols.items.find(item=>item.name==='Synthetic undated protocol');
  assert.equal(a.date,'2025-03-17');assert.equal(a.inPeriod,true);assert.equal(a.eventType,'reported');assert.equal(a.inPeriodCount,1);assert.equal(a.currentUseConfirmed,false);
  assert.equal(b.date,'2025-03-01');assert.equal(b.inPeriod,false);assert.match(b.temporalContext,/antes do período/);
  assert.equal(undated.date,null);assert.match(undated.temporalContext,/Cadastro sem data/);assert.equal(undated.currentUseConfirmed,false);
  assert.doesNotMatch(JSON.stringify(result),/Synthetic future/);assert.equal(result.protocols.events.length,3);assert.match(result.protocols.context,/não confirma uso atual/);
  assert.ok(result.protocols.items.every(item=>!Object.hasOwn(item,'dose')));
});

test('Same-day different protocol events are preserved without silently choosing adherence',()=>{
  const result=run({treatments:[{event_date:'2025-03-19',medication:'Synthetic A',event_type:'planned'},{event_date:'2025-03-19',medication:'Synthetic A',event_type:'reported'}]},dashboard({mode:'period'}));
  assert.equal(result.protocols.items[0].events.length,2);assert.match(result.protocols.items[0].eventLabel,/Planejamento registrado/);assert.match(result.protocols.items[0].eventLabel,/Relato registrado/);assert.equal(result.protocols.items[0].currentUseConfirmed,false);
});

test('Care is a dated documentary snapshot, with no inferred dose or future start',()=>{
  const care={schema_version:1,title:'Synthetic follow-up',consultation_date:'2025-03-11',baseline:[{name:'Synthetic baseline',reported_dose:'PRIVATE-DOSE-DO-NOT-COPY',source_date:'2025-03-10'}],products:[{name:'Synthetic product',start_date:'2025-03-25',status:'Start not recorded'}],followups:[{key:'review',label:'Review synthetic plan',resolved:false},{key:'done',label:'Completed synthetic note',resolved:true}]};
  const result=run({docs:[{document_date:'2025-03-12',document_type:'care_followup',source:'Synthetic visit summary',care_context:care},{document_date:'2025-03-25',document_type:'care_followup',care_context:{...care,title:'Synthetic future care'}}]},dashboard({mode:'period'}));
  assert.equal(result.protocols.care.date,'2025-03-12');assert.equal(result.protocols.care.pendingCount,1);assert.equal(result.protocols.care.products[0].startDate,null);assert.equal(result.protocols.care.inPeriod,false);assert.match(result.protocols.care.temporalContext,/12\/03\/2025/);
  assert.match(result.insights.find(item=>item.id==='care-followup').evidence,/Situação atual não confirmada/);assert.doesNotMatch(JSON.stringify(result),/PRIVATE-DOSE|Synthetic future care/);
});

test('Labs keep source, date, unit and reference as consultation context without clinical labels',()=>{
  const result=run({labs:[{collection_date:'2025-03-10',biomarker:'Synthetic marker',result_numeric:12,result_raw:'12',unit:'u/L',reference_range:'2–10',laboratory:'Synthetic laboratory'},{collection_date:'2025-03-25',biomarker:'Synthetic future lab'}]},dashboard({mode:'period'}));
  const item=result.insights.find(item=>item.id==='laboratory-context');
  assert.match(item.evidence,/10\/03\/2025/);assert.match(item.evidence,/Coleta anterior ao período/);assert.equal(item.evidenceItems[0].unit,'u/L');assert.equal(item.evidenceItems[0].reference,'2–10');assert.match(item.text,/não definem diagnóstico nem ajuste de medicação/);assert.doesNotMatch(JSON.stringify(result),/Synthetic future lab/);
});

test('Training insight only describes recorded distribution and never infers missed exercise',()=>{
  const context={training:{available:true,sessions:2,recordedDays:2,latest:{date:'2025-03-18',source:'Synthetic workout log'},missingGroups:[{label:'Synthetic group'}]}};
  const result=run({},dashboard({mode:'period'}),status,context),item=result.insights.find(item=>item.id==='training-context');
  assert.match(item.text,/sem registro nesta janela/);assert.match(item.text,/ausência de registro não confirma/);assert.match(item.evidence,/18\/03\/2025/);
});

test('At most four useful insights, every action is routed, and input data is unchanged',()=>{
  const data={...empty(),goals:[target('2025-03-10')],labs:[{collection_date:'2025-03-19',biomarker:'Synthetic marker',unit:'u',laboratory:'Synthetic lab'}],docs:[{document_date:'2025-03-19',document_type:'care_followup',care_context:{schema_version:1,followups:[{label:'Synthetic review'}]}}]};
  const view=dashboard({water:[point(today,1000)],protein:[point(today,100)]}),before=structuredClone({data,view,status});
  const result=dashboardGuidance(data,status,view,{training:{available:true,sessions:1,recordedDays:1,latest:{date:'2025-03-19',source:'Synthetic log'}}});
  assert.equal(result.insights.length,4);assert.ok(result.insights.every(item=>item.action.route&&item.action.label&&item.evidence));assert.deepEqual({data,view,status},before);
});

test('The real dashboard model integrates through metricsByKey and source labels, without pooled records',async()=>{
  globalThis.location={search:'?fixture=1'};
  const {healthDashboardModel}=await import('../src/health-dashboard-model.js');
  const data={...empty(),goals:[target('2025-03-13')],nutrition:[{nutrition_date:'2025-03-18',water_ml:1500,protein_g:80,source:'Synthetic selected diary'},{nutrition_date:today,water_ml:600,protein_g:40,source:'Synthetic selected diary'}]};
  const period=healthDashboardModel(data,status,{dashboardMode:'period',dashboardPeriod:'7'},today),result=dashboardGuidance(data,status,period,{});
  assert.equal(result.goals.water.count,1);assert.equal(result.goals.water.meanActual,1500);assert.equal(result.goals.water.expectedDays,7);assert.match(insight(result,'water').evidence,/Synthetic selected diary/);assert.doesNotMatch(insight(result,'water').evidence,/\["nutrition"/);
  const daily=dashboardGuidance(data,status,healthDashboardModel(data,status,{dashboardMode:'day'},today),{});
  assert.equal(daily.goals.water.count,1);assert.equal(daily.goals.water.actual,600);assert.match(insight(daily,'water').text,/até agora/);
});

test('Unmatched units and explicitly ambiguous points cannot be compared to a target',()=>{
  const wrongUnit=run({goals:[target('2025-03-10')]},dashboard({water:[point(today,2,{unit:'L'})]}));
  assert.equal(wrongUnit.goals.water.count,0);assert.equal(wrongUnit.goals.water.actual,null);
  const ambiguous=run({goals:[target('2025-03-10')]},dashboard({water:[point(today,2000,{ambiguous:true})]}));
  assert.equal(ambiguous.goals.water.count,0);
});

test('Latest same-day protocol documents are preserved and care ambiguity never picks a winner',()=>{
  const docs=['a','b'].map(id=>({source_record_id:id,document_date:'2025-03-19',document_type:'care_followup',title:`Synthetic visit ${id}`,care_context:{schema_version:1,followups:[{label:`Synthetic pending ${id}`}]}}));
  const result=run({docs},dashboard({mode:'period'}));
  assert.equal(result.protocols.items.length,2);assert.equal(result.protocols.care.available,false);assert.equal(result.protocols.care.status,'ambiguous');assert.equal(result.insights.some(item=>item.id==='care-followup'),false);
});

test('Historical numeric references remain visible with date and source, never as effective targets',()=>{
  const row={...historical(),notes:JSON.stringify({type:'historical_protocol',documented_on:'2025-03-10',current_validity:'unconfirmed',source:'Synthetic archived plan',protein_rule:'gt'})};
  const result=run({goals:[row]},dashboard({protein:[point(today,90)],water:[point(today,1200)]}));
  assert.deepEqual(result.goals.protein.current.reference,{value:160,unit:'g',documentedOn:'2025-03-10',source:'Synthetic archived plan',rule:'gt',isDailyTarget:false,currentValidity:'unconfirmed'});
  assert.match(insight(result,'protein').text,/mais de 160 g\/dia/);assert.match(insight(result,'protein').text,/10\/03\/2025/);
  assert.match(insight(result,'protein').evidence,/Synthetic archived plan/);assert.doesNotMatch(insight(result,'protein').text,/Revise o plano com seu profissional|alcança a meta|abaixo da meta/);
  assert.equal(result.goals.protein.target,null);assert.equal(result.goals.protein.delta,null);assert.equal(result.goals.protein.count,0);
  assert.equal(result.goals.water.current.reference.value,3000);assert.equal(result.goals.water.target,null);
});

test('Historical references obey latest-version ambiguity, cleared values and documentary dates',()=>{
  const old=historical();
  for(const goals of [[old,{...old}],[old,target('2025-03-19',null,null)],[old,{...historical(),effective_from:'2025-03-19',notes:JSON.stringify({type:'historical_protocol',source:'Synthetic newer source',documented_on:'2025-03-25'})}]]){
    const result=run({goals});
    assert.equal(result.goals.protein.current.reference??null,null);assert.doesNotMatch(insight(result,'protein').text,/160 g\/dia/);assert.equal(result.goals.protein.target,null);
  }
  for(const value of [true,0,-1,2001])assert.equal(run({goals:[{...old,protein_g:value}]}).goals.protein.current.reference,null);
});

test('Awaited nutrition plan is explained from the latest dated follow-up, without inventing a new target',()=>{
  const docs=[{document_date:'2025-03-18',document_type:'care_followup',source:'Synthetic visit',care_context:{schema_version:1,followups:[{key:'nutrition_plan',label:'Receive nutrition plan',resolved:false}]}}];
  const result=run({goals:[historical()],docs},dashboard({protein:[point(today,90)]}));
  const item=insight(result,'protein');assert.equal(item.title,'Proteína: plano alimentar aguardado');assert.match(item.text,/18\/03\/2025/);assert.match(item.text,/160 g\/dia/);assert.match(item.text,/plano alimentar como aguardado/);assert.equal(item.action.route,'tratamentos');assert.equal(result.goals.protein.target,null);
  assert.doesNotMatch(insight(run({goals:[historical()],docs},dashboard({date:'2025-03-17'})),'protein').text,/plano alimentar como aguardado/);
  docs[0].care_context.followups[0].resolved=true;
  assert.doesNotMatch(insight(run({goals:[historical()],docs}),'protein').text,/plano alimentar como aguardado/);
  docs[0].care_context.followups[0].resolved=false;
  assert.doesNotMatch(insight(run({goals:[historical()],docs},dashboard(),{...status,docs:'error'}),'protein').text,/plano alimentar como aguardado/);
});

test('New water document is identified while the historical reference cannot become a daily goal',()=>{
  const result=run({goals:[historical()],waterReferences:[waterDocument()]},dashboard({water:[point(today,1700)]}));
  const item=insight(result,'water');assert.equal(item.title,'Água: referência no plano');assert.match(item.text,/3\.000 mL\/dia como base/);assert.match(item.text,/data de início não está explícita/);assert.match(item.evidence,/Synthetic prescription.pdf, página 3/);assert.match(item.evidence,/Referência histórica/);assert.equal(result.goals.water.target,null);assert.equal(result.goals.water.count,0);assert.equal(result.goals.water.delta,null);
});

test('Application alias is descriptive and never confirms current use or a dose',()=>{
  const result=run({treatments:[{source_record_id:'synthetic-application',event_date:'2025-03-19',medication:'Synthetic protocol',event_type:'application',source:'Synthetic diary'}]},dashboard({mode:'period'}));
  const item=result.protocols.items[0];assert.equal(item.eventLabel,'Aplicação registrada');assert.equal(item.eventType,'application');assert.equal(item.currentUseConfirmed,false);assert.equal(Object.hasOwn(item,'dose'),false);
});

test('Regimen documentary dates and statuses remain separate from explicitly confirmed start dates',()=>{
  const regimen={source_record_id:'synthetic-plan',medication:'Synthetic plan item',document_date:'2025-03-17',recorded_status:'planned_start_unconfirmed',start_date:'2025-03-18',started_by_user_confirmation:false,source:'Synthetic document'};
  const item=run({regimens:[regimen]},dashboard({mode:'period'})).protocols.items[0];
  assert.equal(item.date,'2025-03-17');assert.equal(item.startDate,null);assert.equal(item.eventLabel,'Plano documentado · início não registrado');assert.match(item.temporalContext,/não é data de início/);assert.equal(item.currentUseConfirmed,false);
  const confirmed=run({regimens:[{...regimen,started_by_user_confirmation:true}]}).protocols.items[0];
  assert.equal(confirmed.date,'2025-03-17');assert.equal(confirmed.startDate,'2025-03-18');assert.match(confirmed.eventLabel,/Início relatado/);assert.equal(confirmed.currentUseConfirmed,false);
  for(const value of [false,'true',null])assert.equal(run({regimens:[{...regimen,started_by_user_confirmation:value}]}).protocols.items[0].startDate,null);
  assert.equal(run({regimens:[{...regimen,started_by_user_confirmation:true,start_date:'2025-03-25'}]}).protocols.items[0].startDate,null);
  assert.equal(run({regimens:[{...regimen,document_date:'2025-03-25'}]}).protocols.items.length,0);
  const undated=run({regimens:[{...regimen,document_date:null}]}).protocols.items[0];assert.equal(undated.date,null);assert.equal(undated.startDate,null);
});
