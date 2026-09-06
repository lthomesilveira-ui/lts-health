import {chromium} from 'playwright';
const base='http://127.0.0.1:4173/?fixture=1#analise';

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Insights');
  await page.waitForSelector('[data-coverage-priority]');

  const priorityText=(await page.textContent('[data-coverage-priority]'))||'';
  for(const expected of ['O que mais limita esta leitura agora','Sem registro de ingestão de água','não gera recomendação clínica']){
    if(!priorityText.includes(expected))throw new Error(`${label}: coverage-priority copy missing ${expected}`);
  }
  for(const forbidden of ['urgente','gravidade alta','risco clínico','normal/anormal','mudar protocolo']){
    if(priorityText.toLowerCase().includes(forbidden))throw new Error(`${label}: unsafe priority language leaked ${forbidden}`);
  }

  const synthetic=await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    const {referenceDayFor}=await import('./src/integrated-analysis.js');
    const {coveragePriorityModel,traceabilityModel,renderTraceabilityPanel}=await import('./src/evidence-priority.js');
    const data=structuredClone(state.data),status={...state.domainStatus};
    const referenceDay=referenceDayFor(data)||'2026-01-01';
    const structuredKeys=['body','workouts','nutrition','metrics','labs','docs','treatments'];
    for(const key of structuredKeys)status[key]='ready';
    status.sourceMetrics='ready';status.uploads='ready';status.quality='ready';status.workoutEvidence='ready';
    data.sourceMetrics=[
      {metric_date:referenceDay,metric_type:'steps',unit:'count',source_family:'apple_watch',source_name:'WATCH-PRIVATE-001',canonical_status:'candidate'},
      {metric_date:referenceDay,metric_type:'steps',unit:'count',source_family:'polar_flow',source_name:'POLAR-PRIVATE-002',canonical_status:'held'}
    ];
    data.uploads=[
      {status:'processed',original_filename:'PRIVATE-A.zip'},
      {status:'processing',original_filename:'PRIVATE-B.csv'},
      {status:'review_required',original_filename:'PRIVATE-C.pdf'}
    ];
    data.quality=[
      {status:'open',description:'PRIVATE ISSUE'},
      {status:'resolved',description:'PRIVATE RESOLVED'}
    ];
    data.workoutEvidence=[{source_record_id:'PRIVATE-LINK'}];
    const coverage=coveragePriorityModel(data,status,'all');
    const trace=traceabilityModel(data,status);
    const html=renderTraceabilityPanel(trace);
    const failedStatus={...status,workoutEvidence:'error'};
    const failedTrace=traceabilityModel(data,failedStatus);
    const failedHtml=renderTraceabilityPanel(failedTrace);
    const structuredFailures=structuredKeys.map(key=>{
      const model=traceabilityModel(data,{...status,[key]:'error'});
      return{key,partial:model.partial,html:renderTraceabilityPanel(model)};
    });
    return{
      sourceSeries:coverage.sourceSeries,
      contextRows:coverage.rows.filter(row=>row.key==='sources').length,
      trace,
      html,
      failedTrace,
      failedHtml,
      structuredFailures
    };
  });
  if(synthetic.sourceSeries!==2)throw new Error(`${label}: Apple/Polar preserved series were merged`);
  if(synthetic.contextRows!==1)throw new Error(`${label}: complementary mapping boundary is not surfaced`);
  if(synthetic.trace.preservedSeries!==2)throw new Error(`${label}: traceability merged source series`);
  if(synthetic.trace.partial)throw new Error(`${label}: complete traceability was marked partial`);
  if(!synthetic.failedTrace.partial)throw new Error(`${label}: workout evidence failure did not mark traceability partial`);
  if(synthetic.failedTrace.workoutEvidence!==null)throw new Error(`${label}: failed workout evidence was not represented as unavailable`);
  if(!synthetic.failedHtml.includes('algumas fontes não carregaram'))throw new Error(`${label}: partial traceability warning missing`);
  if(synthetic.failedHtml.includes('cadeia verificada'))throw new Error(`${label}: failed workout evidence still claimed verified chain`);
  for(const item of synthetic.structuredFailures){
    if(!item.partial)throw new Error(`${label}: structured domain ${item.key} failure did not mark traceability partial`);
    if(!item.html.includes('algumas fontes não carregaram'))throw new Error(`${label}: structured domain ${item.key} partial warning missing`);
    if(item.html.includes('cadeia verificada'))throw new Error(`${label}: structured domain ${item.key} failure still claimed verified chain`);
  }
  for(const forbidden of ['WATCH-PRIVATE-001','POLAR-PRIVATE-002','PRIVATE-A.zip','PRIVATE ISSUE','PRIVATE-LINK']){
    const rendered=[synthetic.html,synthetic.failedHtml,...synthetic.structuredFailures.map(item=>item.html)].join('');
    if(rendered.includes(forbidden))throw new Error(`${label}: traceability leaked private/raw identity ${forbidden}`);
  }

  const waterRow=page.locator('[data-coverage-priority] .coveragePriorityRow').filter({hasText:'Sem registro de ingestão de água'}).first();
  if(await waterRow.count()!==1)throw new Error(`${label}: hydration coverage row missing`);
  await waterRow.locator('button').click();
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Dados');
  await page.waitForSelector('[data-evidence-traceability]');
  const traceText=(await page.textContent('[data-evidence-traceability]'))||'';
  for(const expected of ['Rastreabilidade','Do arquivo recebido ao dado analisável','Separação de fontes preservada','não geram registros duplicados no histórico principal']){
    if(!traceText.includes(expected))throw new Error(`${label}: traceability copy missing ${expected}`);
  }
  for(const forbidden of ['source_payload','storage_path','raw_payload','WATCH-PRIVATE','POLAR-PRIVATE']){
    if(traceText.includes(forbidden))throw new Error(`${label}: internal field leaked ${forbidden}`);
  }

  await page.evaluate(()=>{location.hash='#analise';});
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Insights');
  await page.waitForSelector('[data-coverage-priority]');

  await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    const {referenceDayFor}=await import('./src/integrated-analysis.js');
    const referenceDay=referenceDayFor(state.data)||'2026-01-01';
    const oldDate=new Date(`${referenceDay}T00:00:00Z`);
    oldDate.setUTCDate(oldDate.getUTCDate()-60);
    const oldDay=oldDate.toISOString().slice(0,10);
    state.domainStatus.nutrition='ready';
    state.data.nutrition=[
      {nutrition_date:referenceDay,calories:2100,protein_g:160,carbs_g:190,fat_g:70,water_ml:null},
      {nutrition_date:oldDay,calories:2050,protein_g:155,carbs_g:185,fat_g:68,water_ml:900}
    ];
    const select=document.getElementById('analysisPeriod');
    select.value='all';
    select.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await page.waitForFunction(()=>{
    const text=document.querySelector('[data-coverage-priority]')?.textContent||'';
    return document.getElementById('analysisPeriod')?.value==='all'&&!text.includes('Sem registro de ingestão de água');
  });

  await page.selectOption('#analysisPeriod','30');
  await page.waitForFunction(()=>{
    const text=document.querySelector('[data-coverage-priority]')?.textContent||'';
    return document.getElementById('analysisPeriod')?.value==='30'&&text.includes('Sem registro de ingestão de água');
  });

  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health evidence priority and traceability smoke passed');
