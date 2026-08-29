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
  if(!screen.includes('Métricas por origem'))throw new Error(`${label}: provenance domain count missing from Data availability`);
  const panel=page.locator('.provenancePanel');
  await panel.waitFor();
  const text=(await panel.textContent())||'';
  if(!text.includes('Proveniência das métricas'))throw new Error(`${label}: provenance heading missing`);
  if(!text.includes('test device'))throw new Error(`${label}: fixture source family missing`);
  if(!text.includes('1 candidato'))throw new Error(`${label}: candidate count missing`);
  if(text.includes('7100'))throw new Error(`${label}: raw metric value leaked into provenance summary`);
  if(text.includes('source_payload')||text.includes('source-metric-candidate-1'))throw new Error(`${label}: technical/raw provenance leaked into summary`);
  if(!text.includes('não são somadas à Timeline'))throw new Error(`${label}: non-counting guardrail missing`);

  await page.goto('http://127.0.0.1:4173/?fixture=1&fixtureError=sourceMetrics#dados',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Dados');
  const failed=(await page.locator('.provenancePanel').textContent())||'';
  if(!failed.includes('Proveniência indisponível agora'))throw new Error(`${label}: provenance failure state missing`);
  if(failed.includes('0 canônico')||failed.includes('0 candidato'))throw new Error(`${label}: failed provenance domain was presented as numeric zero`);
  const availability=(await page.locator('#screenHost').textContent())||'';
  if(!availability.includes('Métricas por origem')||!availability.includes('indisponível agora'))throw new Error(`${label}: failed provenance domain availability is not explicit`);

  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: provenance caused horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: page errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health source provenance smoke passed');
