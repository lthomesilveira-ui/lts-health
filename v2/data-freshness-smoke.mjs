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
    if(!body.includes('Proveniência indisponível agora.'))throw new Error(`${label}: sourceMetrics failure must remain unavailable`);
    if(body.includes('dados até 02/02/2026'))throw new Error(`${label}: failed sourceMetrics must not display stale fixture freshness`);
  }else{
    const panel=(await page.locator('.provenancePanel').textContent())||'';
    if(!panel.includes('dados até 02/02/2026'))throw new Error(`${label}: real metric_date freshness missing`);
    if(!panel.includes('A data exibida é a maior data realmente carregada'))throw new Error(`${label}: freshness provenance note missing`);
    if(!body.includes('peso e sono podem chegar como candidatos com origem preservada'))throw new Error(`${label}: Apple source-preserving sleep scope drifted`);
    if(!body.includes('intervalos sobrepostos da mesma origem são unidos antes do total diário'))throw new Error(`${label}: sleep overlap guardrail missing`);
    if(!body.includes('Calorias, proteína, carboidratos, gordura e fibra podem chegar pelo Apple Saúde'))throw new Error(`${label}: MyFitnessPal candidate nutrition copy drifted`);
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
