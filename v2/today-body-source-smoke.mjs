import { chromium } from 'playwright';

const base='http://127.0.0.1:4173/?fixture=1#hoje';
const waitToday=page=>page.waitForSelector('[data-executive-dashboard]');
const compositionCard=page=>page.locator('.cockpitStatus[data-route="bio"]');
const compositionModule=page=>page.locator('.cockpitModule.body');

async function renderScenario(page,bodyRows,expectedText){
  await page.evaluate(async rows=>{
    const {state}=await import('./src/core.js');
    state.data.body=rows;
    state.domainStatus.body='ready';
    state.ui.analysisPeriod='all';
    const period=document.getElementById('analysisPeriod');
    if(!period)throw new Error('analysisPeriod missing before Today scenario rerender');
    period.value='all';
    period.dispatchEvent(new Event('change',{bubbles:true}));
  },bodyRows);
  await page.waitForFunction(expected=>{
    const card=document.querySelector('.cockpitStatus[data-route="bio"]');
    return Boolean(card?.textContent?.includes(expected));
  },expectedText);
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
      {source_record_id:'body-a',measured_at:'2026-07-01T09:00:00Z',weight_kg:80.0,skeletal_muscle_mass_kg:40.1,body_fat_pct:18.2,source_family:'inbody'},
      {source_record_id:'body-b',measured_at:'2026-08-01T09:00:00Z',weight_kg:79.5,skeletal_muscle_mass_kg:41.3,body_fat_pct:17.4,source_family:'technogym'}
    ],'79,5 kg');
    let card=(await compositionCard(page).textContent())||'';
    if(!card.includes('79,5 kg'))throw new Error(`${label}: latest body weight disappeared after a known source change`);
    if(!card.includes('41,3 kg músculo'))throw new Error(`${label}: latest muscle value disappeared after a known source change`);
    if(!card.includes('17,4% gordura'))throw new Error(`${label}: latest body-fat value disappeared after a known source change`);
    if(!card.includes('Sem comparação entre origens diferentes.'))throw new Error(`${label}: source-change limitation is not explicit in the current body card`);
    if(card.includes('Em revisão'))throw new Error(`${label}: source change was mislabeled as an ambiguous current measurement`);
    const module=(await compositionModule(page).textContent())||'';
    if(!module.includes('17,4%')||!module.includes('79,5 kg')||!module.includes('41,3 kg'))throw new Error(`${label}: latest body measurement is not preserved in the current composition module`);
    const review=(await page.locator('.cockpitReview').textContent())||'';
    if(!review.includes('Sem comparação entre origens diferentes.'))throw new Error(`${label}: source-change review is not explicit`);

    await renderScenario(page,[
      {source_record_id:'body-only',measured_at:'2026-08-15T09:00:00Z',weight_kg:79.0,skeletal_muscle_mass_kg:42.2,body_fat_pct:16.8,source_family:'inbody'}
    ],'79,0 kg');
    card=(await compositionCard(page).textContent())||'';
    if(!card.includes('79,0 kg')||!card.includes('42,2 kg músculo')||!card.includes('16,8% gordura'))throw new Error(`${label}: a single preserved body measurement is not shown as current`);
    if(card.includes('Em revisão'))throw new Error(`${label}: single preserved body measurement was mislabeled as ambiguous`);

    await renderScenario(page,[
      {source_record_id:'body-dup-1',measured_at:'2026-08-20T09:00:00Z',weight_kg:79.1,skeletal_muscle_mass_kg:42.0,body_fat_pct:17.0,source_family:'inbody'},
      {source_record_id:'body-dup-2',measured_at:'2026-08-20T10:00:00Z',weight_kg:79.2,skeletal_muscle_mass_kg:42.4,body_fat_pct:16.7,source_family:'technogym'}
    ],'Em revisão');
    card=(await compositionCard(page).textContent())||'';
    if(!card.includes('Em revisão'))throw new Error(`${label}: duplicate latest-day measurements should stay in review`);
    if(card.includes('42,0')||card.includes('42,4')||card.includes('17,0')||card.includes('16,7')||card.includes('79,1')||card.includes('79,2'))throw new Error(`${label}: Today silently selected one ambiguous latest-day measurement`);

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
