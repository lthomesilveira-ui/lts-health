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
  if(text.includes('7100'))throw new Error(`${label}: raw metric value leaked into source summary`);
  if(text.includes('source_payload')||text.includes('source-metric-candidate-1'))throw new Error(`${label}: technical/raw provenance leaked into summary`);
  if(!text.includes('Registros aguardando conferência permanecem separados dos dados confirmados')||!text.includes('Uma fonte não é somada a outra automaticamente'))throw new Error(`${label}: source separation guardrail missing`);
  if(/can[oô]nic|candidat/i.test(text))throw new Error(`${label}: internal canonical/candidate language is visible`);

  await page.goto('http://127.0.0.1:4173/?fixture=1&fixtureError=sourceMetrics#dados',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Dados');
  const failedPanel=page.locator('.provenancePanel');
  const failed=(await failedPanel.textContent())||'';
  if(!failed.includes('As origens das métricas não carregaram agora; evidências complementares de treino continuam exibidas.'))throw new Error(`${label}: partial provenance state missing`);
  if(!failed.includes('Polar Flow')||!failed.includes('telemetria de treino'))throw new Error(`${label}: available workout evidence disappeared during sourceMetrics failure`);
  if(failed.includes('Dispositivo de teste')||failed.includes('Outra origem'))throw new Error(`${label}: failed metric provenance remained visible`);
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
