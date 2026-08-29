import { chromium } from 'playwright';

const base='http://127.0.0.1:4173/?fixture=1';

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});

  await page.goto(`${base}#bio`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Bio');
  let text=(await page.textContent('#screenHost'))||'';
  if(!text.includes('Última medição · 01/02/2026'))throw new Error(`${label}: latest body date is not explicit`);
  if(!text.includes('2 medição(ões) no histórico carregado'))throw new Error(`${label}: body history count missing from latest summary`);

  const nav=viewport.width<720?'#mobileNav':'#primaryNav';
  await page.evaluate(async()=>{const {state}=await import('./src/core.js');state.ui.trainingPeriod='all';});
  await page.click(`${nav} [data-route="treinos"]`);
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Treinos');
  const latest=page.locator('.session.latest .sessionHead').first();
  if(await latest.count()!==1)throw new Error(`${label}: latest workout marker missing`);
  const latestText=(await latest.textContent())||'';
  for(const expected of ['02/02/2026','Peito + ombros','2 exercício(s) · 3 série(s)','mais recente']){
    if(!latestText.includes(expected))throw new Error(`${label}: latest workout summary missing ${expected}`);
  }

  await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    state.domainStatus.exercises='error';
    state.domainStatus.sets='error';
    state.ui.trainingPeriod='all';
  });
  await page.click(`${nav} [data-route="bio"]`);
  await page.click(`${nav} [data-route="treinos"]`);
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Treinos');
  const failedLatest=(await page.locator('.session.latest .sessionHead').first().textContent())||'';
  if(!failedLatest.includes('detalhes indisponíveis'))throw new Error(`${label}: failed workout detail domains not reported as unavailable`);
  if(failedLatest.includes('0 exercício')||failedLatest.includes('0 série'))throw new Error(`${label}: failed workout detail domains rendered false zero`);

  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health v2 homologation summary smoke passed');
