import { chromium } from 'playwright';

const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/?fixture=1';
const forbidden=['candidate','canonical','source_family','ActivitySummary','count/min','MME','Não consolidado','Em validação'];

async function fontSize(page,selector){
  const value=await page.locator(selector).first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
  return Number(value||0);
}

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(`${base}#hoje`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('[data-executive-dashboard]');

  const shell=(await page.locator('body').textContent())||'';
  if(!shell.includes('Seu histórico de saúde'))throw new Error(`${label}: product subtitle missing`);
  if(!(await page.locator('[data-route="bio"]:visible').first().textContent())?.includes('Composição'))throw new Error(`${label}: composition navigation still uses internal shorthand`);
  const navSelector=viewport.width<720?'#mobileNav button:visible':'#primaryNav button:visible';
  const navFont=await fontSize(page,navSelector);
  if(navFont<(viewport.width<720?10.5:12))throw new Error(`${label}: navigation typography too small (${navFont}px)`);
  const heroFont=await fontSize(page,'.intelHero p');
  if(heroFont<12.5)throw new Error(`${label}: home supporting text too small (${heroFont}px)`);
  const cardDetail=await fontSize(page,'.intelCurrentCard small');
  if(cardDetail<10.8)throw new Error(`${label}: home card detail too small (${cardDetail}px)`);

  const routes=[['bio','Composição corporal'],['analise','Análise'],['timeline','Timeline'],['dados','Dados']];
  for(const[route,title]of routes){
    await page.evaluate(r=>{location.hash=r;},route);
    await page.waitForFunction(t=>document.querySelector('#screenHost h1')?.textContent===t,title);
    const text=(await page.locator('#screenHost').textContent())||'';
    for(const term of forbidden)if(text.includes(term))throw new Error(`${label}/${route}: implementation language visible: ${term}`);
    const titleSize=await fontSize(page,'.screenTitle h1');
    const descriptionSize=await fontSize(page,'.screenTitle p');
    if(titleSize<(viewport.width<720?25:30))throw new Error(`${label}/${route}: title typography too small (${titleSize}px)`);
    if(descriptionSize<12.5)throw new Error(`${label}/${route}: screen description too small (${descriptionSize}px)`);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
    if(overflow>3)throw new Error(`${label}/${route}: horizontal overflow ${overflow}px`);
  }

  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health product finish smoke passed');