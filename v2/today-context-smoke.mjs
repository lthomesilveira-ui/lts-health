import { chromium } from 'playwright';

const base='http://127.0.0.1:4173/?fixture=1#hoje';

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Hoje');
  await page.waitForSelector('.todayContextGrid');
  if((await page.locator('.todayContextGrid > article').count())!==5)throw new Error(`${label}: recent-context grid should have five evidence cards`);
  const text=(await page.locator('.todayContextSection').textContent())||'';
  for(const expected of ['Contexto recente','peso +1,0 kg','MME +1,0 kg','gordura -1,3 p.p.','Duas sessões mais recentes','4 tipo(s) de métrica em 02/02/2026','2 resultado(s) na coleta mais recente','Progressão de treino','Supino máquina: 85 → 90 kg (+5,0)']){
    if(!text.includes(expected))throw new Error(`${label}: missing recent-context fact: ${expected}`);
  }
  const metrics=(await page.locator('.todayMetricGrid').textContent())||'';
  for(const expected of ['Energia ativa','Exercício','Horas em pé','Sono'])if(!metrics.includes(expected))throw new Error(`${label}: missing validated Apple metric ${expected}`);
  for(const forbidden of ['Passos','FC de repouso'])if(metrics.includes(forbidden))throw new Error(`${label}: unsupported automatic Apple metric leaked into Today: ${forbidden}`);
  const sectionCopy=(await page.locator('.todaySection').filter({hasText:'Atividade e sono'}).first().textContent())||'';
  if(!sectionCopy.includes('energia ativa, minutos de exercício, horas em pé e duração do sono'))throw new Error(`${label}: validated Apple metric scope is not explicit`);
  if(!text.includes('sem transformar coincidências em causa ou meta'))throw new Error(`${label}: recent-context limitation is not explicit`);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: recent-context section caused horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health v2 Today recent-context smoke passed');
