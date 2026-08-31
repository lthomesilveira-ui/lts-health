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
      {source_record_id:'lab-unitless-current',collection_date:'2026-01-03',report_date:'2026-01-03',laboratory:'Laboratório de teste',biomarker:'Marcador sem unidade',result_raw:'7',result_numeric:7,unit:null,source:'Fixture de interface'},
      {source_record_id:'lab-same-date-other',collection_date:'2026-01-03',report_date:'2026-01-03',laboratory:'Outro laboratório',biomarker:'Marcador A',result_raw:'99',result_numeric:99,unit:'u',source:'Fixture de interface'},
      {source_record_id:'lab-history-a-prev',collection_date:'2025-12-03',report_date:'2025-12-03',laboratory:'Laboratório de teste',biomarker:'Marcador A',result_raw:'6',result_numeric:6,unit:'u',source:'Fixture de interface'},
      {source_record_id:'lab-unitless-prev',collection_date:'2025-12-03',report_date:'2025-12-03',laboratory:'Laboratório de teste',biomarker:'Marcador sem unidade',result_raw:'5',result_numeric:5,unit:null,source:'Fixture de interface'},
      {source_record_id:'lab-other-unit-1',collection_date:'2025-11-03',report_date:'2025-11-03',laboratory:'Laboratório de teste',biomarker:'Marcador A',result_raw:'100',result_numeric:100,unit:'outra',source:'Fixture de interface'},
      {source_record_id:'lab-other-unit-2',collection_date:'2025-10-03',report_date:'2025-10-03',laboratory:'Laboratório de teste',biomarker:'Marcador A',result_raw:'90',result_numeric:90,unit:'outra',source:'Fixture de interface'},
      {source_record_id:'lab-text-1',collection_date:'2026-01-03',report_date:'2026-01-03',laboratory:'Laboratório de teste',biomarker:'Marcador textual',result_raw:'Presente',result_numeric:null,unit:null,source:'Fixture de interface'},
      {source_record_id:'lab-text-2',collection_date:'2025-12-03',report_date:'2025-12-03',laboratory:'Laboratório de teste',biomarker:'Marcador textual',result_raw:'Ausente',result_numeric:null,unit:null,source:'Fixture de interface'}
    ];
    state.ui.selectedCollection=null;
    state.ui.selectedBiomarker='marcador a';
  });
  await page.fill('#labQuery','x');
  await page.waitForFunction(()=>document.querySelectorAll('#collectionSelect option').length>=6);
  await page.fill('#labQuery','');
  await page.waitForFunction(()=>document.querySelector('#labQuery')?.value===''&&document.querySelectorAll('#collectionSelect option').length>=6);
  await page.selectOption('#collectionSelect','2026-01-03__Laboratório de teste');
  await page.waitForFunction(()=>{
    const select=document.querySelector('#collectionSelect');
    const list=document.querySelector('.collectionCompareList')?.textContent||'';
    const head=document.querySelector('.collectionCompareHead')?.textContent||'';
    return select?.value==='2026-01-03__Laboratório de teste'&&list.includes('Marcador A')&&list.includes('+2,0 u')&&list.includes('Marcador sem unidade')&&list.includes('unidade ausente')&&head.includes('03/12/2025')&&!head.includes('Outro laboratório');
  });
  const compare=(await page.locator('.collectionCompareList').textContent())||'';
  if(!compare.includes('Marcador A')||!compare.includes('+2,0 u'))throw new Error(`${label}: same-unit collection difference missing`);
  if(!compare.includes('Marcador sem unidade')||!compare.includes('unidade ausente'))throw new Error(`${label}: unitless numeric results were treated as directly comparable`);
  if(compare.includes('+2,0Marcador sem unidade')||compare.match(/Marcador sem unidade[\s\S]{0,80}\+2,0(?!\s*u)/))throw new Error(`${label}: unitless numeric delta was rendered`);
  const compareHead=(await page.locator('.collectionCompareHead').textContent())||'';
  if(!compareHead.includes('03/12/2025'))throw new Error(`${label}: comparison did not use the prior distinct collection date`);
  if(compareHead.includes('Outro laboratório'))throw new Error(`${label}: same-day source was treated as prior longitudinal collection`);
  const firstMetric=(await page.locator('.metric').first().textContent())||'';
  if(!firstMetric.includes('Datas de coleta')||!firstMetric.includes('5'))throw new Error(`${label}: collection-date summary is not based on distinct dates`);
  await page.click('[data-marker="marcador textual"]');
  await page.waitForFunction(()=>{const t=document.querySelector('.exerciseDetail')?.textContent||'';return t.includes('Presente')&&t.includes('Ausente')&&t.includes('textual');});
  const textual=(await page.locator('.exerciseDetail').textContent())||'';
  if(textual.match(/0,0\s*(?:u|mg\/dL)?/))throw new Error(`${label}: textual or missing lab value was coerced to zero`);
  await page.click('[data-marker="marcador sem unidade"]');
  await page.waitForFunction(()=>{const t=document.querySelector('.exerciseDetail')?.textContent||'';return t.includes('sem unidade')&&t.includes('não entram em diferenças ou gráficos de tendência');});
  if(await page.locator('.exerciseDetail .labUnitCohort').count())throw new Error(`${label}: unitless lab history produced a longitudinal trend`);
  await page.click('[data-marker="marcador a"]');
  await page.waitForFunction(()=>document.querySelectorAll('.labUnitCohort').length===2);
  const marker=(await page.locator('.exerciseDetail').textContent())||'';
  if(!marker.includes('unidades diferentes permanecem em séries separadas'))throw new Error(`${label}: mixed-unit separation guardrail missing`);
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