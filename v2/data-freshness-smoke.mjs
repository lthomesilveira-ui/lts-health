import { chromium } from 'playwright';

async function run(viewport,label,fixtureError=''){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
  const query=fixtureError?`?fixture=1&fixtureError=${encodeURIComponent(fixtureError)}#dados`:'?fixture=1#dados';
  await page.goto(`http://127.0.0.1:4173/${query}`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Dados');

  const body=(await page.locator('#screenHost').textContent())||'';
  if(fixtureError==='sourceMetrics'){
    if(!body.includes('Não foi possível carregar as origens das métricas agora.'))throw new Error(`${label}: sourceMetrics failure must remain unavailable`);
    if(body.includes('dados até 02/02/2026'))throw new Error(`${label}: failed sourceMetrics must not display stale fixture freshness`);
  }else{
    const panel=(await page.locator('.provenancePanel').textContent())||'';
    if(!panel.includes('dados até 02/02/2026'))throw new Error(`${label}: real metric_date freshness missing`);
    if(!panel.includes('Registros aguardando conferência permanecem separados dos dados confirmados.'))throw new Error(`${label}: source separation note missing`);
    if(!body.includes('Passos, frequência cardíaca em repouso, variabilidade da frequência cardíaca, frequência respiratória, peso e sono ficam separados até conferência'))throw new Error(`${label}: Apple plain-language validation scope drifted`);
    if(!body.includes('Fontes diferentes de sono continuam separadas'))throw new Error(`${label}: sleep source separation guardrail missing`);
    if(!body.includes('O arquivo direto do MyFitnessPal é a fonte preferida'))throw new Error(`${label}: direct MyFitnessPal preference drifted`);
    if(!body.includes('Totais recebidos pelo Apple Saúde ficam separados até conferência'))throw new Error(`${label}: MyFitnessPal-via-Apple review boundary drifted`);
  }

  for(const forbidden of ['ActivitySummary','candidate','canonical','canônico','candidato','source_family','count/min']){
    if(body.includes(forbidden))throw new Error(`${label}: technical source language visible: ${forbidden}`);
  }
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
await run({width:390,height:844},'mobile-failed-sourceMetrics','sourceMetrics');
console.log('LTS Health data freshness smoke passed');