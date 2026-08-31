import { chromium } from 'playwright';

const base='http://127.0.0.1:4173/?fixture=1#analise';

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Análise');

  await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    state.data.metrics.push(
      {source_record_id:'sleep-watch',measured_at:'2026-02-01T08:00:00Z',metric_type:'sleep_duration_h',value:7.1,unit:'h',source:'Apple Watch'},
      {source_record_id:'sleep-ring',measured_at:'2026-02-01T08:10:00Z',metric_type:'sleep_duration_h',value:7.4,unit:'h',source:'RingConn'},
      {source_record_id:'sleep-single',measured_at:'2026-01-27T08:00:00Z',metric_type:'sleep_duration_h',value:6.8,unit:'h',source:'Polar'}
    );
    const firstLab=state.data.labs[0];
    if(firstLab){
      const collectionDay=String(firstLab.collection_date||'').slice(0,10);
      state.data.labs.push({...firstLab,id:'same-day-second-source',source_record_id:'same-day-second-source',source:'Outro laboratório',collection_date:`${collectionDay}T23:45:00Z`});
    }
  });

  await page.selectOption('#analysisPeriod','all');
  await page.waitForFunction(()=>document.querySelector('.analysisNarrative')?.textContent?.includes('Resumo observado · todo o histórico'));
  let text=(await page.textContent('#screenHost'))||'';
  if(!text.includes('Resumo observado · todo o histórico'))throw new Error(`${label}: longitudinal summary did not follow selected period`);
  if(!text.includes('2 sessão(ões) de treino registrada(s)'))throw new Error(`${label}: workout evidence missing from longitudinal summary`);
  if(!text.includes('2 dia(s) com alimentação'))throw new Error(`${label}: nutrition evidence missing from longitudinal summary`);
  if(!text.includes('3 dia(s) com sono confirmado'))throw new Error(`${label}: confirmed sleep evidence missing from longitudinal summary`);
  if(!text.includes('1 data(s) de exames'))throw new Error(`${label}: same-day lab sources inflated longitudinal collection count`);
  if(!text.includes('Datas de exames · todo o histórico'))throw new Error(`${label}: lab metric does not explain that it counts exam dates`);
  if(!text.includes('1 data(s) de coleta'))throw new Error(`${label}: coverage did not keep same-day lab sources on one collection date`);
  if(!text.includes('1')||!text.includes('treinos com sono confirmado comparável'))throw new Error(`${label}: single-source sleep pairing was not retained`);
  if(!text.includes('1 treino(s) têm mais de um registro confirmado'))throw new Error(`${label}: ambiguous multi-source sleep was not surfaced`);
  if(!text.includes('Fontes sobrepostas não são somadas nem escolhidas automaticamente.'))throw new Error(`${label}: overlap guardrail is missing`);
  if(text.includes('média registrada 7,2 h'))throw new Error(`${label}: overlapping sleep sources were averaged together`);
  if(!text.includes('O que ainda limita a análise')||(!text.includes('coincidência temporal')&&!text.includes('causalidade')))throw new Error(`${label}: evidence limitations are not explicit`);

  await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    const sameDay=state.data.workouts[0];
    state.data.workouts.push({...sameDay,source_record_id:'workout-same-day-second',workout_type:'Segunda sessão no mesmo dia'});
  });
  await page.selectOption('#analysisPeriod','all');
  await page.waitForFunction(()=>document.querySelector('.analysisNarrative')?.textContent?.includes('3 sessão(ões) de treino registrada(s)'));
  text=(await page.textContent('#screenHost'))||'';
  if(!text.includes('67% das sessões do período têm alimentação registrada no mesmo dia'))throw new Error(`${label}: same-day multiple workout sessions were undercounted in nutrition coverage`);
  if(!text.includes('Alimentação: 2 de 3 treino(s) do período têm registro de alimentação no mesmo dia.'))throw new Error(`${label}: nutrition limitation did not count matching workout sessions`);
  if(text.includes('33% das sessões do período têm alimentação registrada no mesmo dia'))throw new Error(`${label}: nutrition coverage still mixed unique days with workout sessions`);
  await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    state.data.workouts=(state.data.workouts||[]).filter(row=>row.source_record_id!=='workout-same-day-second');
  });

  await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    state.data.metrics=(state.data.metrics||[]).filter(row=>row.metric_type!=='sleep_duration_h');
    state.data.sourceMetrics=[
      {source_record_id:'pending-sleep-1',metric_date:'2026-02-01',metric_type:'sleep_duration_h',value:7.2,unit:'h',source_name:'Apple Watch',source_family:'apple_watch',canonical_status:'candidate'},
      {source_record_id:'pending-sleep-2',metric_date:'2026-01-27',metric_type:'sleep_duration_h',value:6.9,unit:'h',source_name:'Polar Flow',source_family:'polar_flow',canonical_status:'held'}
    ];
    state.domainStatus.sourceMetrics='ready';
  });
  await page.selectOption('#analysisPeriod','all');
  await page.waitForFunction(()=>document.querySelector('.analysisNarrative')?.textContent?.includes('sono registrado'));
  text=(await page.textContent('#screenHost'))||'';
  if(!text.includes('2 dia(s) com sono registrado'))throw new Error(`${label}: preserved sleep was still treated as no data`);
  if(!text.includes('registros existentes, ainda fora das médias'))throw new Error(`${label}: preserved sleep boundary is not user-visible`);
  if(text.includes('0 dia(s) com sono')||text.includes('sem registros no período'))throw new Error(`${label}: false empty sleep state returned despite preserved evidence`);
  if(text.includes('média registrada 7,1 h')||text.includes('média registrada 6,9 h'))throw new Error(`${label}: pending sleep entered averages`);

  for(const forbidden of ['source_family','ActivitySummary','count/min',' count','canonical','canônico','candidato']){
    if(text.includes(forbidden))throw new Error(`${label}: technical language leaked into analysis: ${forbidden}`);
  }
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: analysis caused horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: page errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health v2 longitudinal analysis smoke passed');
