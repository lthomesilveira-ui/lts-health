import { chromium } from 'playwright';

const base='http://127.0.0.1:4173/?fixture=1#timeline';

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Timeline');
  let text=(await page.textContent('#screenHost'))||'';
  for(const expected of ['Sono','Passos','FC de repouso','61,0 bpm','Visão cruzada por dia','Tratamento registrado']){
    if(!text.includes(expected))throw new Error(`${label}: Timeline missing ${expected}`);
  }
  if(!text.includes('não demonstra causa'))throw new Error(`${label}: causal guardrail missing`);
  if(text.includes('Confirmação registrada'))throw new Error(`${label}: treatment operational state leaked into Timeline`);
  if(/\btaken\b/i.test(text))throw new Error(`${label}: treatment event_type leaked into Timeline`);

  await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    state.data.body=[...(state.data.body||[]),{source_record_id:'missing-body-fields',measured_at:'2026-02-03',weight_kg:null,skeletal_muscle_mass_kg:null,body_fat_pct:null,source:'Fixture de interface'}];
    state.data.metrics=[...(state.data.metrics||[]),{source_record_id:'missing-metric-value',measured_at:'2026-02-03T12:00:00Z',metric_type:'weight_kg',value:null,unit:'kg',source:'Fixture de interface'}];
    state.ui.timelinePeriod='all';state.ui.timelineYear='2026';state.ui.timelineQuery='';state.ui.timelineDomain='all';
  });
  const nav=viewport.width<720?'#mobileNav':'#primaryNav';
  await page.click(`${nav} [data-route="bio"]`);
  if(viewport.width<720){await page.click(`${nav} [data-route="mais"]`);await page.click('#moreSheet [data-route="timeline"]');}
  else{await page.click(`${nav} [data-route="mais"]`);await page.click('#moreSheet [data-route="timeline"]');}
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Timeline');
  text=(await page.textContent('#screenHost'))||'';
  if(!text.includes('Composição corporal registrada'))throw new Error(`${label}: missing body fields were not rendered neutrally`);
  if(!text.includes('Registro disponível'))throw new Error(`${label}: missing metric value was not rendered neutrally`);
  if(text.includes('Peso — kg')||text.includes('MME — kg'))throw new Error(`${label}: missing body values leaked as pseudo-measurements`);
  if(text.includes('Confirmação registrada')||/\btaken\b/i.test(text))throw new Error(`${label}: treatment operational context reappeared after rerender`);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health v2 Timeline smoke passed');
