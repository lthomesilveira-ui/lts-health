import { chromium } from 'playwright';
const base='http://127.0.0.1:4173/?fixture=1#saude';
const rows=[
  {source_record_id:'series-1',collection_date:'2024-01-01',laboratory:'Origem série',biomarker:'Marcador série',result_raw:'10',result_numeric:10,unit:'mg/dL',source:'Fixture'},
  {source_record_id:'series-2',collection_date:'2024-06-01',laboratory:'Origem série',biomarker:'Marcador série',result_raw:'12',result_numeric:12,unit:'mg/dL',source:'Fixture'},
  {source_record_id:'series-3',collection_date:'2025-01-01',laboratory:'Origem série',biomarker:'Marcador série',result_raw:'11',result_numeric:11,unit:'mg/dL',source:'Fixture'},
  {source_record_id:'foreign',collection_date:'2025-02-01',laboratory:'Outra origem',biomarker:'Marcador série',result_raw:'99',result_numeric:99,unit:'mg/dL',source:'Fixture'},
  {source_record_id:'unit',collection_date:'2025-03-01',laboratory:'Origem série',biomarker:'Marcador série',result_raw:'1',result_numeric:1,unit:'mmol/L',source:'Fixture'}
];
async function run(viewport,label){
  const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport});const errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForSelector('#app:not(.hidden)');await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Saúde & exames');
  await page.evaluate(async injected=>{const {state}=await import('./src/core.js');state.data.labs=[...(state.data.labs||[]),...injected];state.ui.selectedBiomarker=null;},rows);
  await page.fill('#labQuery','x');await page.fill('#labQuery','');
  await page.waitForFunction(()=>document.body.textContent.includes('Marcadores com série longitudinal'));
  const shortcut=page.locator('.labSeriesShortcuts [data-marker="marcador serie"]');await shortcut.waitFor();
  const shortcutText=(await shortcut.textContent())||'';if(!shortcutText.includes('3 pontos'))throw new Error(`${label}: foreign source or unit changed comparable series length`);
  await shortcut.click();await page.waitForFunction(()=>document.querySelector('.markerHead')?.textContent?.includes('Marcador série'));
  if(await page.locator('.labUnitCohort').count()!==1)throw new Error(`${label}: source/unit cohorts were combined`);
  const chart=page.locator('.labHistoryChart');await chart.waitFor();
  if(await chart.locator('.labHistoryYLabel').count()!==3)throw new Error(`${label}: explicit vertical scale missing`);
  const axis=await chart.locator('.labHistoryAxis span').allTextContents();if(axis.length!==3||!axis[0]||!axis[2])throw new Error(`${label}: chart date axis incomplete`);
  const text=(await chart.textContent())||'';if(text.includes('99,0')||text.includes('mmol/L'))throw new Error(`${label}: foreign series leaked into selected chart`);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);if(overflow>3)throw new Error(`${label}: horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: page errors: ${errors.join(' | ')}`);await browser.close();
}
await run({width:1280,height:900},'desktop');await run({width:390,height:844},'mobile');console.log('Lab series navigation smoke passed');
