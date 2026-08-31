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
  const panel=page.locator('.provenancePanel');
  await panel.waitFor();
  const text=(await panel.textContent())||'';
  if(!text.includes('Dispositivo de teste')&&!text.includes('Outra origem'))throw new Error(`${label}: fixture source not represented in readable form`);
  if(!text.includes('1 aguardando conferência'))throw new Error(`${label}: review count missing`);
  if(text.includes('7100'))throw new Error(`${label}: raw metric value leaked into source summary`);
  if(text.includes('source_payload')||text.includes('source-metric-candidate-1'))throw new Error(`${label}: technical/raw provenance leaked into summary`);
  if(!text.includes('Registros aguardando conferência permanecem separados dos dados confirmados')||!text.includes('Uma fonte não é somada a outra automaticamente'))throw new Error(`${label}: source separation guardrail missing`);
  if(/can[oô]nic|candidat/i.test(text))throw new Error(`${label}: internal canonical/candidate language is visible`);

  await page.goto('http://127.0.0.1:4173/?fixture=1&fixtureError=sourceMetrics#dados',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Dados');
  const failed=(await page.locator('.provenancePanel').textContent())||'';
  if(!failed.includes('Não foi possível carregar as origens das métricas agora.'))throw new Error(`${label}: provenance failure state missing`);
  if(/\b0\s+(confirmado|aguardando)/i.test(failed))throw new Error(`${label}: failed provenance domain was presented as numeric zero`);
  const availability=(await page.locator('#screenHost').textContent())||'';
  if(!availability.includes('Detalhes por origem')||!availability.includes('Não foi possível carregar as origens das métricas agora.'))throw new Error(`${label}: failed source-domain availability is not explicit`);

  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: provenance caused horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: page errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health source provenance smoke passed');
