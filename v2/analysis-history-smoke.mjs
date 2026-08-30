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
  const text=(await page.textContent('#screenHost'))||'';
  if(!text.includes('Resumo observado · todo o histórico'))throw new Error(`${label}: longitudinal summary did not follow selected period`);
  if(!text.includes('2 sessão(ões) de treino registrada(s)'))throw new Error(`${label}: workout evidence missing from longitudinal summary`);
  if(!text.includes('2 dia(s) com alimentação'))throw new Error(`${label}: nutrition evidence missing from longitudinal summary`);
  if(!text.includes('3 dia(s) com duração de sono'))throw new Error(`${label}: sleep evidence missing from longitudinal summary`);
  if(!text.includes('1 data(s) de coleta laboratorial'))throw new Error(`${label}: same-day lab sources inflated longitudinal collection count`);
  if(!text.includes('Datas de coleta · todo o histórico'))throw new Error(`${label}: lab metric does not explain that it counts collection dates`);
  if(!text.includes('1 data(s) de coleta'))throw new Error(`${label}: coverage did not keep same-day lab sources on one collection date`);
  if(!text.includes('1')||!text.includes('treinos com sono comparável'))throw new Error(`${label}: single-source sleep pairing was not retained`);
  if(!text.includes('1 treino(s) têm mais de um registro de sono'))throw new Error(`${label}: ambiguous multi-source sleep was not surfaced`);
  if(!text.includes('Noites com mais de um registro de sono ficam fora da média'))throw new Error(`${label}: overlap guardrail is missing`);
  if(text.includes('média registrada 7,2 h'))throw new Error(`${label}: overlapping sleep sources were averaged together`);
  if(!text.includes('Limitações desta leitura')||(!text.includes('Coincidência temporal')&&!text.includes('causalidade')))throw new Error(`${label}: evidence limitations are not explicit`);

  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: analysis caused horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: page errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health v2 longitudinal analysis smoke passed');
