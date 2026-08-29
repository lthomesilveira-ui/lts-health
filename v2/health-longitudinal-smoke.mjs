import { chromium } from 'playwright';

const base='http://127.0.0.1:4173/?fixture=1#saude';

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text())});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Saúde & exames');
  await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    state.data.labs=[
      ...(state.data.labs||[]),
      {source_record_id:'lab-history-a',collection_date:'2026-01-03',report_date:'2026-01-03',laboratory:'Laboratório de teste',biomarker:'Marcador A',result_raw:'8',result_numeric:8,unit:'u',reference_range:'5–15',source:'Fixture de interface'},
      {source_record_id:'lab-history-b',collection_date:'2026-01-03',report_date:'2026-01-03',laboratory:'Laboratório de teste',biomarker:'Marcador B',result_raw:'18',result_numeric:18,unit:'mg/dL',reference_range:'10–30',source:'Fixture de interface'},
      {source_record_id:'lab-other-unit-1',collection_date:'2025-12-03',report_date:'2025-12-03',laboratory:'Laboratório de teste',biomarker:'Marcador A',result_raw:'100',result_numeric:100,unit:'outra',source:'Fixture de interface'},
      {source_record_id:'lab-other-unit-2',collection_date:'2025-11-03',report_date:'2025-11-03',laboratory:'Laboratório de teste',biomarker:'Marcador A',result_raw:'90',result_numeric:90,unit:'outra',source:'Fixture de interface'},
      {source_record_id:'lab-text-1',collection_date:'2026-02-03',report_date:'2026-02-03',laboratory:'Laboratório de teste',biomarker:'Marcador textual',result_raw:'Presente',result_numeric:null,unit:null,source:'Fixture de interface'},
      {source_record_id:'lab-text-2',collection_date:'2026-01-03',report_date:'2026-01-03',laboratory:'Laboratório de teste',biomarker:'Marcador textual',result_raw:'Ausente',result_numeric:null,unit:null,source:'Fixture de interface'}
    ];
    state.ui.selectedCollection=null;
    state.ui.selectedBiomarker='marcador a';
  });
  await page.fill('#labQuery','x');
  await page.fill('#labQuery','');
  await page.waitForFunction(()=>document.querySelectorAll('#collectionSelect option').length>=4);
  await page.waitForSelector('.collectionCompareList');
  const compare=(await page.locator('.collectionCompareList').textContent())||'';
  if(!compare.includes('Marcador A')||!compare.includes('+2,0 u'))throw new Error(`${label}: same-unit collection difference missing`);
  if(!compare.includes('Marcador textual')||!compare.includes('comparação lado a lado'))throw new Error(`${label}: textual results were not preserved side by side`);
  await page.click('[data-marker="marcador a"]');
  await page.waitForSelector('.labUnitCohort');
  const marker=(await page.locator('.exerciseDetail').textContent())||'';
  if(!marker.includes('unidades diferentes permanecem em séries separadas'))throw new Error(`${label}: mixed-unit separation guardrail missing`);
  if((await page.locator('.labUnitCohort').count())!==2)throw new Error(`${label}: compatible unit cohorts were not rendered independently`);
  if(marker.match(/converter|convertid/i))throw new Error(`${label}: interface implies unsupported unit conversion`);
  const full=(await page.textContent('#screenHost'))||'';
  if(full.match(/\b(canonical|parity|backend|provenance[- ]first|readiness|PWA)\b/i))throw new Error(`${label}: implementation jargon visible`);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: page errors: ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('Health longitudinal browser smoke passed');