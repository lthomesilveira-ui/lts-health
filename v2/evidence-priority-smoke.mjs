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
    status.sourceMetrics='ready';status.uploads='ready';status.quality='ready';
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
    return{
      sourceSeries:coverage.sourceSeries,
      contextRows:coverage.rows.filter(row=>row.key==='sources').length,
      trace,
      html
    };
  });
  if(synthetic.sourceSeries!==2)throw new Error(`${label}: Apple/Polar preserved series were merged`);
  if(synthetic.contextRows!==1)throw new Error(`${label}: complementary mapping boundary is not surfaced`);
  if(synthetic.trace.preservedSeries!==2)throw new Error(`${label}: traceability merged source series`);
  for(const forbidden of ['WATCH-PRIVATE-001','POLAR-PRIVATE-002','PRIVATE-A.zip','PRIVATE ISSUE','PRIVATE-LINK']){
    if(synthetic.html.includes(forbidden))throw new Error(`${label}: traceability leaked private/raw identity ${forbidden}`);
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

  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health evidence priority and traceability smoke passed');
