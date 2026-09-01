import { chromium } from 'playwright';

const base='http://127.0.0.1:4173/?fixture=1#saude';
const injected=[
  {source_record_id:'src-f',collection_date:'2026-02-03',laboratory:null,biomarker:'Origem F',result_raw:'31',result_numeric:31,unit:'u',source:'Fonte F preservada'},
  {source_record_id:'src-e',collection_date:'2026-02-03',laboratory:null,biomarker:'Origem E',result_raw:'47',result_numeric:47,unit:'u',source:'Fonte E preservada'},
  {source_record_id:'third',collection_date:'2026-01-03',laboratory:'Terceira origem',biomarker:'Marcador A',result_raw:'12',result_numeric:12,unit:'u',source:'Fixture'},
  {source_record_id:'a-now',collection_date:'2026-01-03',laboratory:'Origem teste',biomarker:'Marcador A',result_raw:'8',result_numeric:8,unit:'u',source:'Fixture'},
  {source_record_id:'unitless-now',collection_date:'2026-01-03',laboratory:'Origem teste',biomarker:'Marcador sem unidade',result_raw:'7',result_numeric:7,unit:null,source:'Fixture'},
  {source_record_id:'same-day-other',collection_date:'2026-01-03',laboratory:'Outra origem',biomarker:'Marcador A',result_raw:'99',result_numeric:99,unit:'u',source:'Fixture'},
  {source_record_id:'intervening-other',collection_date:'2025-12-20',laboratory:'Origem intermediária',biomarker:'Marcador A',result_raw:'500',result_numeric:500,unit:'u',source:'Fixture'},
  {source_record_id:'prior-decoy',collection_date:'2025-12-03',laboratory:'Origem sem sobreposição',biomarker:'Marcador X',result_raw:'77',result_numeric:77,unit:'u',source:'Fixture'},
  {source_record_id:'a-prev',collection_date:'2025-12-03',laboratory:'Origem teste',biomarker:'Marcador A',result_raw:'6',result_numeric:6,unit:'u',source:'Fixture'},
  {source_record_id:'unitless-prev',collection_date:'2025-12-03',laboratory:'Origem teste',biomarker:'Marcador sem unidade',result_raw:'5',result_numeric:5,unit:null,source:'Fixture'},
  {source_record_id:'a-alt-1',collection_date:'2025-11-03',laboratory:'Origem teste',biomarker:'Marcador A',result_raw:'100',result_numeric:100,unit:'outra',source:'Fixture'},
  {source_record_id:'a-alt-2',collection_date:'2025-10-03',laboratory:'Origem teste',biomarker:'Marcador A',result_raw:'90',result_numeric:90,unit:'outra',source:'Fixture'},
  {source_record_id:'a-old',collection_date:'2025-09-03',laboratory:'Origem teste',biomarker:'Marcador A',result_raw:'4',result_numeric:4,unit:'u',source:'Fixture'},
  {source_record_id:'text-now',collection_date:'2026-01-03',laboratory:'Origem teste',biomarker:'Marcador textual',result_raw:'Presente',result_numeric:null,unit:null,source:'Fixture'},
  {source_record_id:'text-prev',collection_date:'2025-12-03',laboratory:'Origem teste',biomarker:'Marcador textual',result_raw:'Ausente',result_numeric:null,unit:null,source:'Fixture'}
];

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Saúde & exames');
  await page.evaluate(async rows=>{
    const {state}=await import('./src/core.js');
    state.data.labs=[...(state.data.labs||[]),...rows];
    state.ui.selectedCollection=null;
    state.ui.selectedBiomarker='marcador a';
  },injected);
  await page.fill('#labQuery','x');
  await page.waitForFunction(()=>document.querySelectorAll('#collectionSelect option').length>=11);
  await page.fill('#labQuery','');
  await page.waitForFunction(()=>document.querySelector('#labQuery')?.value==='');

  const options=await page.locator('#collectionSelect option').allTextContents();
  if(!options.some(t=>t.includes('03/02/2026')&&t.includes('Fonte F preservada'))||!options.some(t=>t.includes('03/02/2026')&&t.includes('Fonte E preservada')))throw new Error(`${label}: distinct source-only collections merged`);

  await page.selectOption('#collectionSelect','2026-02-03__Fonte F preservada');
  await page.waitForFunction(()=>document.querySelector('.labTable')?.textContent?.includes('Origem F'));
  if(((await page.locator('.labTable').textContent())||'').includes('Origem E'))throw new Error(`${label}: source-only evidence leaked across collections`);
  await page.selectOption('#collectionSelect','2026-02-03__Fonte E preservada');
  await page.waitForFunction(()=>document.querySelector('.labTable')?.textContent?.includes('Origem E'));
  if(((await page.locator('.labTable').textContent())||'').includes('Origem F'))throw new Error(`${label}: reciprocal source-only evidence leak`);

  await page.selectOption('#collectionSelect','2026-01-03__Origem teste');
  await page.waitForFunction(()=>{const h=document.querySelector('.collectionCompareHead')?.textContent||'',l=document.querySelector('.collectionCompareList')?.textContent||'';return h.includes('03/12/2025')&&h.includes('Origem teste')&&l.includes('+2,0 u')&&l.includes('unidade ausente');});
  const compareHead=(await page.locator('.collectionCompareHead').textContent())||'';
  const compare=(await page.locator('.collectionCompareList').textContent())||'';
  if(compareHead.includes('20/12/2025')||compareHead.includes('Origem intermediária'))throw new Error(`${label}: intervening foreign source replaced same-source longitudinal history`);
  if(!compare.includes('Marcador A')||!compare.includes('+2,0 u'))throw new Error(`${label}: same-unit difference missing`);
  if(!compare.includes('Marcador sem unidade')||!compare.includes('unidade ausente'))throw new Error(`${label}: unitless result was compared`);

  await page.selectOption('#collectionSelect','2026-01-03__Terceira origem');
  await page.waitForFunction(()=>[...document.querySelectorAll('.card.sectionGap .note')].some(n=>(n.textContent||'').includes('nenhuma da mesma origem')));
  const sourceGap=(await page.locator('.card.sectionGap').filter({hasText:'Comparação com histórico da mesma origem'}).textContent())||'';
  if(!sourceGap.includes('Nenhuma diferença foi calculada automaticamente'))throw new Error(`${label}: source-gap guardrail missing`);
  if(await page.locator('.collectionCompareHead').count())throw new Error(`${label}: different-source history produced comparison`);

  await page.selectOption('#collectionSelect','2026-01-03__Origem teste');
  await page.waitForFunction(()=>document.querySelector('.collectionCompareHead')?.textContent?.includes('03/12/2025'));
  const expectedDates=await page.evaluate(async()=>{const {state}=await import('./src/core.js');return new Set((state.data.labs||[]).map(r=>r.collection_date).filter(Boolean)).size;});
  const shownDates=Number((await page.locator('.metric').first().locator('strong').textContent())||'NaN');
  if(shownDates!==expectedDates)throw new Error(`${label}: collection-date metric does not use distinct dates`);

  await page.click('[data-marker="marcador textual"]');
  await page.waitForFunction(()=>{const t=document.querySelector('.exerciseDetail')?.textContent||'';return t.includes('Presente')&&t.includes('Ausente')&&t.includes('textual');});
  if(((await page.locator('.exerciseDetail').textContent())||'').match(/0,0\s*(?:u|mg\/dL)?/))throw new Error(`${label}: textual result coerced to zero`);

  await page.click('[data-marker="marcador sem unidade"]');
  await page.waitForFunction(()=>document.querySelector('.exerciseDetail')?.textContent?.includes('não entram em diferenças ou gráficos de tendência'));
  if(await page.locator('.exerciseDetail .labUnitCohort').count())throw new Error(`${label}: unitless result produced trend`);

  await page.click('[data-marker="marcador a"]');
  await page.waitForFunction(()=>document.querySelectorAll('.labUnitCohort').length===2);
  const marker=(await page.locator('.exerciseDetail').textContent())||'';
  if(!marker.includes('unidades diferentes permanecem em séries separadas'))throw new Error(`${label}: mixed-unit guardrail missing`);
  if(!marker.includes('mais de um resultado deste marcador na mesma data'))throw new Error(`${label}: same-date ambiguity missing`);
  const trends=await page.locator('.exerciseDetail .labUnitCohort').allTextContents();
  if(trends.some(t=>t.includes('03/01/2026')||t.includes('99,0')||t.includes('12,0')))throw new Error(`${label}: ambiguous same-date values leaked into trend`);

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
