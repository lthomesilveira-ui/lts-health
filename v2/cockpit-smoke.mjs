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
  for(const expected of ['Cockpit LTS Health','Composição','Último treino','Nutrição','Hidratação','Exames','Protocolos','Insights','Evolução e cobertura'])if(!text.includes(expected))throw new Error(`${label}: cockpit missing ${expected}`);
  if(!text.includes('Nenhum registro de água foi importado'))throw new Error(`${label}: hydration gap is not explicit`);
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
