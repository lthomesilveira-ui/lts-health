import { chromium } from 'playwright';

const base=process.env.LTS_HEALTH_BASE_URL||'https://lthomesilveira-ui.github.io/lts-health/v2/?fixture=1';

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});

  await page.goto(`${base}#bio`,{waitUntil:'networkidle'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Composição corporal');
  let text=(await page.textContent('#screenHost'))||'';
  await page.waitForSelector('.domainHero');
  const latestBody=(await page.locator('.domainHero').textContent())||'';
  if(!latestBody.includes('Última medição')||!latestBody.includes('01/02/2026'))throw new Error(`${label}: deployed latest body date is not explicit`);
  if(!latestBody.includes('2 medições preservadas'))throw new Error(`${label}: deployed body history count is missing`);
  if(!text.includes('Massa muscular'))throw new Error(`${label}: readable muscle-mass label missing`);
  if(text.includes('MME')||text.includes('source_file')||text.includes('confidence'))throw new Error(`${label}: technical body-composition language leaked into deployed UI`);
  if(await page.locator('.domainChartCard').count()!==1)throw new Error(`${label}: body composition lost its single primary chart`);
  if(await page.locator('details.uxDisclosure[open]').count())throw new Error(`${label}: secondary body sections start expanded`);

  const nav=viewport.width<720?'#mobileNav':'#primaryNav';
  await page.evaluate(async()=>{const {state}=await import('./src/core.js');state.ui.trainingPeriod='all';});
  await page.click(`${nav} [data-route="treinos"]`);
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Treinos');
  const latestText=(await page.locator('.session.latest .sessionHead').first().textContent())||'';
  for(const expected of ['02/02/2026','Peito + ombros','2 exercícios · 3 séries','mais recente']){
    if(!latestText.includes(expected))throw new Error(`${label}: deployed latest workout summary missing ${expected}`);
  }
  if(await page.locator('details.uxDisclosure[open]').count())throw new Error(`${label}: secondary training sections start expanded`);
  text=(await page.textContent('#screenHost'))||'';
  for(const stale of ['exercício(s)','série(s)','sessão(ões)'])if(text.includes(stale))throw new Error(`${label}: mechanical copy is visible: ${stale}`);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: deployed interface has horizontal overflow ${overflow}px`);
  const overlap=viewport.width<720?await page.evaluate(()=>{
    const host=document.querySelector('#screenHost'),nav=document.querySelector('#mobileNav');
    if(!host||!nav)return 999;
    return host.getBoundingClientRect().bottom-nav.getBoundingClientRect().top;
  }):0;
  if(overlap>2)throw new Error(`${label}: deployed mobile content overlaps navigation by ${overlap}px`);
  if(errors.length)throw new Error(`${label}: deployed browser errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health v2 deployed homologation smoke passed');
