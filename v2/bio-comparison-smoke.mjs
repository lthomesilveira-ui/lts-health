import { chromium } from 'playwright';

const base='http://127.0.0.1:4173/?fixture=1#bio';

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Bio');

  if(await page.inputValue('#compareA')!=='2026-01-01')throw new Error(`${label}: initial comparison start is not reflected in selector`);
  if(await page.inputValue('#compareB')!=='2026-02-01')throw new Error(`${label}: initial comparison end is not reflected in selector`);
  let text=(await page.textContent('#screenHost'))||'';
  for(const expected of ['31 dias entre as medições','+1,0 kg','+1,0 kg','-1,3 %','+2']){
    if(!text.includes(expected))throw new Error(`${label}: initial Bio comparison missing ${expected}`);
  }

  await page.selectOption('#compareA','2026-02-01');
  await page.selectOption('#compareB','2026-01-01');
  await page.waitForFunction(()=>document.querySelector('.compareContext')?.textContent?.includes('ordem invertida'));
  if(await page.inputValue('#compareA')!=='2026-02-01'||await page.inputValue('#compareB')!=='2026-01-01')throw new Error(`${label}: reversed comparison selectors lost their state`);
  text=(await page.textContent('#screenHost'))||'';
  if(!text.includes('31 dias entre as medições · ordem invertida')||!text.includes('-1,0 kg'))throw new Error(`${label}: reversed comparison is not explicit`);

  await page.selectOption('#compareB','2026-02-01');
  await page.waitForFunction(()=>document.querySelector('.compareContext')?.textContent?.includes('Mesma data'));
  if(await page.inputValue('#compareA')!=='2026-02-01'||await page.inputValue('#compareB')!=='2026-02-01')throw new Error(`${label}: same-date comparison selectors lost their state`);

  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: Bio comparison caused horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health v2 Bio comparison smoke passed');
