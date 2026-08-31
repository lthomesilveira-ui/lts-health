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
  if(!text.includes('Última medição · 01/02/2026'))throw new Error(`${label}: deployed latest body date missing`);
  if(!text.includes('Massa muscular'))throw new Error(`${label}: readable muscle-mass label missing`);
  if(text.includes('MME')||text.includes('source_file')||text.includes('confidence'))throw new Error(`${label}: technical body-composition language leaked into deployed UI`);

  const nav=viewport.width<720?'#mobileNav':'#primaryNav';
  await page.evaluate(async()=>{const {state}=await import('./src/core.js');state.ui.trainingPeriod='all';});
  await page.click(`${nav} [data-route="treinos"]`);
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Treinos');
  const latestText=(await page.locator('.session.latest .sessionHead').first().textContent())||'';
  for(const expected of ['02/02/2026','2 exercício(s) · 3 série(s)','mais recente']){
    if(!latestText.includes(expected))throw new Error(`${label}: deployed latest workout summary missing ${expected}`);
  }
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