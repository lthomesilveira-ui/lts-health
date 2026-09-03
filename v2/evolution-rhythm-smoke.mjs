import { chromium } from 'playwright';

const base='http://127.0.0.1:4173/?fixture=1#evolucao';

async function navigateToEvolution(page,viewport){
  if(viewport.width<720){
    await page.click('#mobileNav [data-route="bio"]');
    await page.click('#mobileNav [data-route="mais"]');
    await page.waitForSelector('#moreSheet:not(.hidden)');
    await page.click('#moreSheet [data-route="evolucao"]');
  }else{
    await page.click('#primaryNav [data-route="bio"]');
    await page.click('#primaryNav [data-route="evolucao"]');
  }
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Evolução');
}

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Evolução');
  await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    state.data.workouts=[
      {source_record_id:'rhythm-5',workout_date:'2026-02-15',workout_type:'Sessão E',record_status:'validated',is_canonical:true,source:'Teste'},
      {source_record_id:'rhythm-4',workout_date:'2026-02-15',workout_type:'Sessão D',record_status:'validated',is_canonical:true,source:'Teste'},
      {source_record_id:'rhythm-3',workout_date:'2026-02-13',workout_type:'Sessão C',record_status:'validated',is_canonical:true,source:'Teste'},
      {source_record_id:'rhythm-2',workout_date:'2026-02-09',workout_type:'Sessão B',record_status:'validated',is_canonical:true,source:'Teste'},
      {source_record_id:'rhythm-1',workout_date:'2026-02-08',workout_type:'Sessão A',record_status:'validated',is_canonical:true,source:'Teste'}
    ];
    state.domainStatus.workouts='ready';
  });
  await navigateToEvolution(page,viewport);
  const card=page.locator('.card:has-text("Ritmo semanal de treinos")');
  await card.waitFor();
  const text=(await card.textContent())||'';
  for(const expected of ['Dias com sessão estruturada','3d','4 sessões','1d','1 sessão','Atividade geral de outras fontes não entra nessa contagem']){
    if(!text.includes(expected))throw new Error(`${label}: missing weekly rhythm copy/count ${expected}`);
  }
  const bars=card.locator('.weeklyRhythm > div');
  if(await bars.count()!==12)throw new Error(`${label}: expected 12 calendar weeks`);
  const titles=await bars.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('title')));
  if(!titles.some(v=>v==='09/02/2026 a 15/02/2026'))throw new Error(`${label}: calendar week boundary missing`);
  if(!titles.some(v=>v==='02/02/2026 a 08/02/2026'))throw new Error(`${label}: prior calendar week boundary missing`);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health v2 evolution rhythm smoke passed');
