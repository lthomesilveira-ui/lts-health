import { chromium } from 'playwright';

const base='http://127.0.0.1:4173/?fixture=1#hoje';
const waitToday=page=>page.waitForSelector('[data-executive-dashboard]');

async function renderScenario(page,bodyRows){
  await page.evaluate(async rows=>{
    const {state}=await import('./src/core.js');
    state.data.body=rows;
    state.domainStatus.body='ready';
    location.hash='bio';
  },bodyRows);
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Composição corporal');
  await page.evaluate(()=>{location.hash='hoje';});
  await waitToday(page);
}

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.waitForSelector('#app:not(.hidden)');
    await waitToday(page);

    await renderScenario(page,[
      {source_record_id:'body-a',measured_at:'2026-07-01T09:00:00Z',skeletal_muscle_mass_kg:40.1,body_fat_pct:18.2,source_family:'inbody'},
      {source_record_id:'body-b',measured_at:'2026-08-01T09:00:00Z',skeletal_muscle_mass_kg:41.3,body_fat_pct:17.4,source_family:'technogym'}
    ]);
    let card=(await page.locator('.dashboardCurrent').filter({hasText:'Composição'}).textContent())||'';
    if(!card.includes('41,3 kg de massa muscular'))throw new Error(`${label}: latest body value disappeared after a known source change`);
    if(!card.includes('17,4% de gordura corporal'))throw new Error(`${label}: latest body-fat value disappeared after a known source change`);
    if(!card.includes('sem comparação entre origens diferentes'))throw new Error(`${label}: source-change limitation is not explicit in the current body card`);
    if(card.includes('Sem medição recente'))throw new Error(`${label}: source change was mislabeled as missing current measurement`);
    const panel=(await page.locator('.dashboardPanel').filter({hasText:'Evolução corporal'}).textContent())||'';
    if(!panel.includes('Sem comparação entre origens diferentes'))throw new Error(`${label}: source change is not explicit in the body evolution panel`);
    if(!panel.includes('medição mais recente continua preservada'))throw new Error(`${label}: preservation of the latest measurement is not explicit`);

    await renderScenario(page,[
      {source_record_id:'body-only',measured_at:'2026-08-15T09:00:00Z',skeletal_muscle_mass_kg:42.2,body_fat_pct:16.8,source_family:'inbody'}
    ]);
    card=(await page.locator('.dashboardCurrent').filter({hasText:'Composição'}).textContent())||'';
    if(!card.includes('42,2 kg de massa muscular')||!card.includes('16,8% de gordura corporal'))throw new Error(`${label}: a single preserved body measurement is not shown as current`);
    if(card.includes('Sem medição recente'))throw new Error(`${label}: single preserved body measurement was mislabeled as missing`);

    await renderScenario(page,[
      {source_record_id:'body-dup-1',measured_at:'2026-08-20T09:00:00Z',skeletal_muscle_mass_kg:42.0,body_fat_pct:17.0,source_family:'inbody'},
      {source_record_id:'body-dup-2',measured_at:'2026-08-20T10:00:00Z',skeletal_muscle_mass_kg:42.4,body_fat_pct:16.7,source_family:'technogym'}
    ]);
    card=(await page.locator('.dashboardCurrent').filter({hasText:'Composição'}).textContent())||'';
    if(!card.includes('Revisão necessária'))throw new Error(`${label}: duplicate latest-day measurements should stay in review`);
    if(card.includes('42,0')||card.includes('42,4'))throw new Error(`${label}: Today silently selected one ambiguous latest-day measurement`);

    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
    if(overflow>3)throw new Error(`${label}: Today body source state caused horizontal overflow ${overflow}px`);
    if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  }finally{
    await browser.close();
  }
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health v2 Today body source smoke passed');