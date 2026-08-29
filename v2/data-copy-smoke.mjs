import { chromium } from 'playwright';

const base='http://127.0.0.1:4173/?fixture=1#dados';

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Dados');
  await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    state.data.uploads=[
      {id:'u1',created_at:'2026-02-04T12:00:00Z',original_filename:'a.zip',source_type:'apple_health',status:'uploaded'},
      {id:'u2',created_at:'2026-02-03T12:00:00Z',original_filename:'mfp.zip',source_type:'myfitnesspal',status:'imported'},
      {id:'u3',created_at:'2026-02-02T12:00:00Z',original_filename:'lab.pdf',source_type:'fleury',status:'review_required'},
      {id:'u4',created_at:'2026-02-01T12:00:00Z',original_filename:'bad.zip',source_type:'other',status:'rejected'}
    ];
    state.data.quality=[{status:'open',category:'workout_parsing',entity_name:'INTERNAL_ENTITY',description:'Detalhe ainda depende de revisão da fonte.'}];
  });
  const nav=viewport.width<720?'#mobileNav':'#primaryNav';
  await page.click(`${nav} [data-route="bio"]`);
  await page.click(`${nav} [data-route="mais"]`);
  await page.waitForSelector('#moreSheet:not(.hidden)');
  await page.click('#moreSheet [data-route="dados"]');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Dados');
  const text=(await page.textContent('#screenHost'))||'';
  for(const expected of ['Apple Saúde · recebido','MyFitnessPal · importado','Fleury · revisão necessária','Outra origem · não processado','Detalhe do treino precisa de revisão']){
    if(!text.includes(expected))throw new Error(`${label}: missing plain-language status ${expected}`);
  }
  for(const forbidden of ['review_required','rejected','uploaded','INTERNAL_ENTITY','workout_parsing']){
    if(text.includes(forbidden))throw new Error(`${label}: raw internal value visible: ${forbidden}`);
  }
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health v2 data copy smoke passed');
