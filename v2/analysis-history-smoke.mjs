import { chromium } from 'playwright';

const base='http://127.0.0.1:4173/?fixture=1#analise';

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Análise');

  await page.selectOption('#analysisPeriod','all');
  await page.waitForFunction(()=>document.querySelector('#analysisPeriod')?.value==='all');
  const text=(await page.textContent('#screenHost'))||'';
  if(!text.includes('Resumo observado · todo o histórico'))throw new Error(`${label}: longitudinal summary did not follow selected period`);
  if(!text.includes('2 sessão(ões) de treino registrada(s)'))throw new Error(`${label}: workout evidence missing from longitudinal summary`);
  if(!text.includes('2 dia(s) com alimentação'))throw new Error(`${label}: nutrition evidence missing from longitudinal summary`);
  if(!text.includes('1 dia(s) com duração de sono'))throw new Error(`${label}: sleep evidence missing from longitudinal summary`);
  if(!text.includes('1 coleta(s) laboratorial(is)'))throw new Error(`${label}: lab evidence missing from longitudinal summary`);
  if(!text.includes('Limitações desta leitura')||!text.includes('Coincidência temporal')&&!text.includes('causalidade'))throw new Error(`${label}: evidence limitations are not explicit`);

  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: analysis caused horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: page errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health v2 longitudinal analysis smoke passed');
