import { chromium } from 'playwright';

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});

  await page.goto('http://127.0.0.1:4173/?fixture=1#dados',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Dados');
  const screen=(await page.locator('#screenHost').textContent())||'';
  if(!screen.includes('Detalhes por origem'))throw new Error(`${label}: readable provenance section missing`);
  if(!screen.includes('Métricas de saúde'))throw new Error(`${label}: health metrics availability missing from Data screen`);
  const polar=page.locator('.sourceStatus').filter({hasText:'Polar Flow'});
  const polarText=(await polar.textContent())||'';
  if(!polarText.includes('com dados'))throw new Error(`${label}: confirmed structured Polar workout evidence is not reflected in source status`);
  const panel=page.locator('.provenancePanel');
  await panel.waitFor();
  const text=(await panel.textContent())||'';
  if(!text.includes('Dispositivo de teste')&&!text.includes('Outra origem'))throw new Error(`${label}: fixture source not represented in readable form`);
  if(!text.includes('Polar Flow')||!text.includes('telemetria de treino'))throw new Error(`${label}: structured workout evidence is missing from readable provenance details`);
  if(!text.includes('1 aguardando conferência'))throw new Error(`${label}: review count missing`);
  if(!text.includes('Cobertura complementar preservada'))throw new Error(`${label}: complementary coverage summary missing`);
  if(text.includes('7100'))throw new Error(`${label}: raw metric value leaked into source summary`);
  if(text.includes('source_payload')||text.includes('source-metric-candidate-1'))throw new Error(`${label}: technical/raw provenance leaked into summary`);
  if(!text.includes('Registros aguardando conferência permanecem separados dos dados confirmados')||!text.includes('Uma fonte não é somada a outra automaticamente'))throw new Error(`${label}: source separation guardrail missing`);
  if(/can[oô]nic|candidat/i.test(text))throw new Error(`${label}: internal canonical/candidate language is visible`);

  await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    const {renderDataHub}=await import('./src/data-screen.js');
    state.domainStatus.sourceMetrics='ready';
    state.data.sourceMetrics=[
      {source_record_id:'aw-steps-1',metric_date:'2026-01-01',metric_type:'steps',value:1001,unit:'count',source_name:'Apple Watch',source_family:'apple_watch',canonical_status:'candidate'},
      {source_record_id:'aw-steps-2',metric_date:'2026-01-03',metric_type:'steps',value:1002,unit:'count',source_name:'Apple Watch',source_family:'apple_watch',canonical_status:'held'},
      {source_record_id:'iphone-steps-1',metric_date:'2026-01-02',metric_type:'steps',value:2001,unit:'count',source_name:'iPhone',source_family:'iphone',canonical_status:'candidate'},
      {source_record_id:'iphone-steps-2',metric_date:'2026-01-04',metric_type:'steps',value:2002,unit:'count',source_name:'iPhone',source_family:'iphone',canonical_status:'candidate'},
      {source_record_id:'polar-sleep-1',metric_date:'2026-05-01',metric_type:'sleep_duration_h',value:7.1,unit:'h',source_name:'Polar Flow',source_family:'polar_flow',canonical_status:'candidate'},
      {source_record_id:'polar-sleep-2',metric_date:'2026-05-03',metric_type:'sleep_duration_h',value:7.2,unit:'h',source_name:'Polar Flow',source_family:'polar_flow',canonical_status:'candidate'},
      {source_record_id:'apple-sleep-1',metric_date:'2026-05-02',metric_type:'sleep_duration_h',value:6.8,unit:'h',source_name:'Apple Saúde',source_family:'healthkit_candidate',canonical_status:'candidate'},
      {source_record_id:'apple-sleep-2',metric_date:'2026-05-04',metric_type:'sleep_duration_h',value:6.9,unit:'h',source_name:'Apple Saúde',source_family:'healthkit_candidate',canonical_status:'held'},
      {source_record_id:'apple-canonical-activity',metric_date:'2026-05-04',metric_type:'active_energy_kcal',value:9999,unit:'kcal',source_name:'Apple Saúde',source_family:'apple_activity_summary',canonical_status:'canonical'}
    ];
    document.querySelector('#screenHost').innerHTML=renderDataHub();
  });
  await page.locator('.provenancePanel > summary').click();
  const coverage=page.locator('[data-complementary-coverage]');
  await coverage.waitFor();
  const coverageText=(await coverage.textContent())||'';
  if(!coverageText.includes('Apple Watch')||!coverageText.includes('iPhone')||!coverageText.includes('Polar Flow')||!coverageText.includes('Apple Saúde'))throw new Error(`${label}: complementary source families are not separated`);
  if(!coverageText.includes('Passos')||!coverageText.includes('Sono'))throw new Error(`${label}: complementary metric labels missing`);
  if(!coverageText.includes('count')||!coverageText.includes('h'))throw new Error(`${label}: complementary units missing`);
  if(!coverageText.includes('2registros')&&!coverageText.includes('2 registros'))throw new Error(`${label}: grouped coverage counts missing`);
  const coverageRows=coverage.locator('.coverageRow');
  if(await coverageRows.count()!==4)throw new Error(`${label}: overlapping Apple/Polar series were merged across source or metric boundaries`);
  const appleWatchRow=(await coverageRows.filter({hasText:'Apple Watch'}).textContent())||'';
  const iphoneRow=(await coverageRows.filter({hasText:'iPhone'}).textContent())||'';
  const polarSleepRow=(await coverageRows.filter({hasText:'Polar Flow'}).textContent())||'';
  const appleSleepRow=(await coverageRows.filter({hasText:'Apple Saúde'}).textContent())||'';
  for(const [name,row] of [['Apple Watch',appleWatchRow],['iPhone',iphoneRow],['Polar Flow',polarSleepRow],['Apple Saúde',appleSleepRow]]){
    if(!row.includes('2')||!row.includes('Período')||!row.includes('Unidade'))throw new Error(`${label}: ${name} coverage row missing count/period/unit`);
  }
  if(coverageText.includes('1001')||coverageText.includes('1002')||coverageText.includes('2001')||coverageText.includes('2002')||coverageText.includes('7.1')||coverageText.includes('7.2')||coverageText.includes('6.8')||coverageText.includes('6.9')||coverageText.includes('9999'))throw new Error(`${label}: raw metric values leaked into complementary coverage`);
  if(coverageText.includes('active_energy_kcal')||coverageText.includes('Energia ativa'))throw new Error(`${label}: canonical metric leaked into complementary-only coverage`);
  if(/can[oô]nic|candidat|held/i.test(coverageText))throw new Error(`${label}: internal source status leaked into complementary coverage`);
  if(!coverageText.includes('não calcula média, tendência nem combina fontes'))throw new Error(`${label}: non-combination guardrail missing from complementary coverage`);

  await page.goto('http://127.0.0.1:4173/?fixture=1&fixtureError=sourceMetrics#dados',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Dados');
  const failedPanel=page.locator('.provenancePanel');
  const failed=(await failedPanel.textContent())||'';
  if(!failed.includes('As origens das métricas não carregaram agora; evidências complementares de treino continuam exibidas.'))throw new Error(`${label}: partial provenance state missing`);
  if(!failed.includes('Polar Flow')||!failed.includes('telemetria de treino'))throw new Error(`${label}: available workout evidence disappeared during sourceMetrics failure`);
  if(failed.includes('Dispositivo de teste')||failed.includes('Outra origem'))throw new Error(`${label}: failed metric provenance remained visible`);
  if(await failedPanel.locator('[data-complementary-coverage]').count()!==0)throw new Error(`${label}: complementary metric coverage must fail closed when sourceMetrics fails`);
  const failedCards=failedPanel.locator('.provenanceCard');
  if(await failedCards.count()!==1)throw new Error(`${label}: partial provenance must show only available source domains`);
  const onlyCard=(await failedCards.first().textContent())||'';
  if(!onlyCard.includes('Polar Flow')||!onlyCard.includes('telemetria de treino'))throw new Error(`${label}: partial provenance card is not the available workout evidence`);
  const availability=(await page.locator('#screenHost').textContent())||'';
  if(!availability.includes('Detalhes por origem')||!availability.includes('As origens das métricas não carregaram agora'))throw new Error(`${label}: partial source-domain availability is not explicit`);
  const polarDuringMetricFailure=(await page.locator('.sourceStatus').filter({hasText:'Polar Flow'}).textContent())||'';
  if(!polarDuringMetricFailure.includes('com dados'))throw new Error(`${label}: sourceMetrics failure incorrectly hides confirmed Polar workout evidence`);

  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: provenance caused horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: page errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health source provenance smoke passed');
