import { chromium } from 'playwright';

async function noOverflow(page,label,route){const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);if(overflow>3)throw new Error(`${label}/${route}: horizontal overflow ${overflow}px`);}
async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto('http://127.0.0.1:4173/?fixture=1#hoje',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent?.includes('estado de saúde'));
  const text=(await page.locator('#screenHost').textContent())||'';
  for(const expected of ['Cockpit LTS Health','Composição','Último treino','Nutrição','Hidratação','Atividade & sono','Exames','Protocolos','Insights','Evolução e cobertura'])if(!text.includes(expected))throw new Error(`${label}: cockpit missing ${expected}`);
  if(!text.includes('Nenhum registro de água foi importado'))throw new Error(`${label}: hydration gap is not explicit`);
  const activitySleepPanel=(await page.locator('.cockpitActivitySleep').textContent())||'';
  for(const expected of ['Atividade & sono','Atividade diária confirmada','Sem atividade diária confirmada','Sono sem evidência estruturada por origem'])if(!activitySleepPanel.includes(expected))throw new Error(`${label}: activity/sleep panel missing ${expected}`);
  const boundary=await page.evaluate(async()=>{
    const {activitySleepSnapshot}=await import('./src/today-screen.js');
    const status={metrics:'ready',sourceMetrics:'ready'};
    const data={metrics:[
      {measured_at:'2026-02-01T12:00:00Z',metric_type:'active_energy_kcal',value:600,unit:'kcal',source:'Apple Health ActivitySummary'},
      {measured_at:'2026-02-02T12:00:00Z',metric_type:'active_energy_kcal',value:650,unit:'kcal',source:'Apple Health ActivitySummary'},
      {measured_at:'2026-02-02T12:00:00Z',metric_type:'exercise_minutes',value:50,unit:'min',source:'Apple Health ActivitySummary'},
      {measured_at:'2026-02-02T12:00:00Z',metric_type:'stand_hours',value:12,unit:'h',source:'Apple Health ActivitySummary'},
      {measured_at:'2099-01-01T12:00:00Z',metric_type:'active_energy_kcal',value:9999,unit:'kcal',source:'Other Device'}
    ],sourceMetrics:[
      {metric_date:'2026-01-31',metric_type:'sleep_duration_h',value:7,unit:'h',canonical_status:'candidate',source_name:'Apple Watch',source_family:'apple_watch'},
      {metric_date:'2026-02-01',metric_type:'sleep_duration_h',value:7.2,unit:'h',canonical_status:'candidate',source_name:'Apple Watch',source_family:'apple_watch'},
      {metric_date:'2026-01-31',metric_type:'sleep_duration_h',value:6.6,unit:'h',canonical_status:'held',source_name:'Polar Flow',source_family:'polar_flow'},
      {metric_date:'2026-02-01',metric_type:'sleep_duration_h',value:6.8,unit:'h',canonical_status:'held',source_name:'Polar Flow',source_family:'polar_flow'}
    ]};
    const s=activitySleepSnapshot(data,status);
    return{energy:s.activeEnergy.row?.value,exercise:s.exercise.row?.value,stand:s.stand.row?.value,activityLatest:s.activityLatest,sources:s.sleepSources.map(x=>({label:x.label,days:x.days,lastValue:x.lastValue,lastDate:x.lastDate}))};
  });
  if(boundary.energy!==650||boundary.exercise!==50||boundary.stand!==12||boundary.activityLatest!=='2026-02-02')throw new Error(`${label}: approved Apple daily activity boundary failed`);
  if(boundary.sources.length!==2)throw new Error(`${label}: overlapping sleep sources were merged`);
  const apple=boundary.sources.find(s=>s.label==='Apple Watch'),polar=boundary.sources.find(s=>s.label==='Polar Flow');
  if(!apple||!polar||apple.days!==2||polar.days!==2||apple.lastValue!==7.2||polar.lastValue!==6.8)throw new Error(`${label}: sleep provenance by source was not preserved`);
  const protocolCardText=(await page.locator('.cockpitMetric[data-route="tratamentos"]').textContent())||'';
  if(!protocolCardText.includes('2 cadastro(s)')||!protocolCardText.includes('1 evento(s)')||!protocolCardText.includes('3 item(ns) distintos'))throw new Error(`${label}: cockpit protocol card does not combine safe context and historical events`);
  const charts=page.locator('.cockpitChart svg');if(await charts.count()<2)throw new Error(`${label}: expected scaled cockpit charts`);
  const axisLabels=page.locator('.cockpitAxisLabels text');if(await axisLabels.count()<4)throw new Error(`${label}: chart scale labels missing`);
  await noOverflow(page,label,'hoje');

  await page.locator('[data-route="analise"]:visible').first().click();
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Insights');
  const insightText=(await page.locator('#screenHost').textContent())||'';
  if(!insightText.includes('Resumo executivo')||!insightText.includes('Protocolos')||!insightText.includes('Situação atual não inferida'))throw new Error(`${label}: executive insight digest missing protocol context`);
  if(await page.locator('.analysisDigestCard').count()<5)throw new Error(`${label}: insight digest too thin`);
  await noOverflow(page,label,'insights');

  await page.evaluate(()=>{location.hash='#tratamentos'});
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Protocolos');
  const protocolText=(await page.locator('#screenHost').textContent())||'';
  for(const expected of ['Cadastros de contexto','Eventos históricos','Mapa de protocolos','Protocolo de teste','Suplementação de teste','Situação atual não inferida'])if(!protocolText.includes(expected))throw new Error(`${label}: protocols missing ${expected}`);
  if(protocolText.includes('source_payload'))throw new Error(`${label}: private regimen field leaked`);
  await noOverflow(page,label,'protocolos');

  await page.locator('[data-route="mais"]:visible').first().click();const moreText=(await page.locator('#moreSheet').textContent())||'';if(!moreText.includes('Protocolos')||!moreText.includes('Exames'))throw new Error(`${label}: promoted navigation labels missing`);
  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await browser.close();
}
await run({width:1440,height:1000},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health cockpit smoke passed');
