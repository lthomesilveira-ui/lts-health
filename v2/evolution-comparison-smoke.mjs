import { chromium } from 'playwright';

const base='http://127.0.0.1:4173/?fixture=1#evolucao';

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Evolução');

  if((await page.locator('[data-segmental-date]').count())!==2)throw new Error(`${label}: segmental dates missing`);
  if((await page.locator('#segmentalCompareDate option').count())!==1)throw new Error(`${label}: free comparison selector missing`);
  let text=(await page.textContent('#screenHost'))||'';
  for(const expected of ['Diferença entre 01/01/2026 e 01/02/2026','Braço D +0,20 kg','Tronco -0,40 kg','apenas descritivo']){
    if(!text.includes(expected))throw new Error(`${label}: default segmental comparison missing ${expected}`);
  }

  await page.click('[data-segmental-date="2026-01-01"]');
  await page.waitForFunction(()=>document.querySelector('[data-segmental-date="2026-01-01"]')?.classList.contains('active'));
  if(await page.inputValue('#segmentalCompareDate')!=='2026-02-01')throw new Error(`${label}: comparison date did not switch away from selected primary date`);
  text=(await page.textContent('#screenHost'))||'';
  if(!text.includes('Diferença entre 01/02/2026 e 01/01/2026')||!text.includes('Braço D -0,20 kg'))throw new Error(`${label}: reverse free segmental comparison missing`);

  await page.evaluate(async()=>{
    const{state}=await import('./src/core.js');
    const latest=state.data.segmental.find(r=>String(r.measured_at).startsWith('2026-02-01'));
    state.data.segmental.push({...latest,source_record_id:'segmental-ambiguous-duplicate',lean_right_arm_kg:99.99,lean_left_arm_kg:98.88,lean_trunk_kg:97.77,fat_trunk_kg:96.66,source:'Duplicado segmentar de teste'});
    document.querySelector('[data-segmental-date="2026-01-01"]')?.click();
  });
  await page.waitForFunction(()=>document.querySelector('#screenHost')?.textContent?.includes('1 data com mais de uma medição ficou fora da comparação.'));
  text=(await page.textContent('#screenHost'))||'';
  if((await page.locator('[data-segmental-date]').count())!==1)throw new Error(`${label}: ambiguous segmental date remains selectable`);
  if((await page.locator('#segmentalCompareDate').count())!==0)throw new Error(`${label}: ambiguous segmental date remains available as comparison`);
  for(const expected of ['1 data em revisão','última comparável 01/01/2026','Os registros foram preservados para revisão.'])if(!text.includes(expected))throw new Error(`${label}: segmental review summary missing ${expected}`);
  for(const forbidden of ['99,99 kg','98,88 kg','97,77 kg','96,66 kg'])if(text.includes(forbidden))throw new Error(`${label}: ambiguous segmental values contaminated evolution ${forbidden}`);
  const rawCount=await page.evaluate(async()=>{const{state}=await import('./src/core.js');return state.data.segmental.filter(r=>String(r.measured_at).startsWith('2026-02-01')).length;});
  if(rawCount!==2)throw new Error(`${label}: ambiguous segmental records were not preserved`);

  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: segmental comparison caused horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health v2 evolution comparison smoke passed');
