import { chromium } from 'playwright';

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
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);if(overflow>3)throw new Error(`${label}: horizontal overflow ${overflow}px`);
  await page.locator('[data-route="analise"]:visible').first().click();await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Análise');
  await page.locator('[data-route="mais"]:visible').first().click();const moreText=(await page.locator('#moreSheet').textContent())||'';if(!moreText.includes('Protocolos')||!moreText.includes('Exames'))throw new Error(`${label}: promoted navigation labels missing`);
  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await browser.close();
}
await run({width:1440,height:1000},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health cockpit smoke passed');
