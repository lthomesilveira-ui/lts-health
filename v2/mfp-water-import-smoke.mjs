import {chromium} from 'playwright';

const exportDocument={
  schema:'lts-health-mfp-water-export',version:1,source:'MyFitnessPal authenticated web',method:'mfp_food_water_v1',status:'complete',
  started_at:'2026-09-08T00:00:00.000Z',completed_at:'2026-09-08T00:01:00.000Z',period:{from:'2026-09-06',to:'2026-09-08'},
  days_scanned:3,positive_days:2,days_without_positive_total:1,rows:[{date:'2026-09-07',water_ml:700},{date:'2026-09-08',water_ml:2500}]
};

async function run(viewport,label){
  const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport,timezoneId:'America/Sao_Paulo'}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto('http://127.0.0.1:4173/?fixture=1#nutricao',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Nutrição');
  const panel=(await page.locator('.hydrationImportPanel').textContent())||'';
  if(!panel.includes('Importar histórico do MFP')||!panel.includes('Registrar um dia manualmente'))throw new Error(`${label}: hydration actions are unclear`);
  await page.click('[data-entry="water-import"]');
  await page.waitForSelector('#mfpWaterImportForm');
  const extractorHref=await page.locator('#mfpWaterImportForm a').getAttribute('href');
  if(extractorHref!=='./mfp-water-extractor.html')throw new Error(`${label}: extractor link missing`);
  await page.locator('#mfpWaterImportFile').setInputFiles({name:'lts-health-mfp-water.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportDocument))});
  await page.waitForFunction(()=>document.querySelector('#mfpWaterImportPreview')?.textContent?.includes('2 data(s) com água encontradas'));
  const preview=(await page.locator('#mfpWaterImportPreview').textContent())||'';
  if(!preview.includes('3 dias verificados')||!preview.includes('1 sem total positivo')||!preview.includes('não serão gravados como zero'))throw new Error(`${label}: import preview lost coverage semantics`);
  await page.check('#mfpWaterImportConfirm');
  await page.click('#mfpWaterImportSubmit');
  await page.waitForFunction(()=>document.querySelector('#entryMsg')?.textContent==='2 data(s) importadas.');
  await page.waitForFunction(()=>document.querySelector('#entryModal')?.classList.contains('hidden'));
  const waterRows=await page.evaluate(async()=>{const{state}=await import('./src/core.js');return state.data.sourceMetrics.filter(row=>row.source_record_id?.startsWith('mfp-water:')).map(row=>({id:row.source_record_id,value:row.value,confidence:row.confidence}));});
  if(waterRows.length!==2||waterRows[0]?.confidence!=='account_authenticated_export')throw new Error(`${label}: imported rows or provenance are wrong (${JSON.stringify(waterRows)})`);
  const hydrated=(await page.locator('.hydrationImportPanel').textContent())||'';
  if(!hydrated.includes('2.500 mL')||!hydrated.includes('700 mL'))throw new Error(`${label}: imported water is not visible`);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: import flow caused horizontal overflow ${overflow}px`);

  await page.goto('http://127.0.0.1:4173/mfp-water-extractor.html',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#copyBookmarklet');
  const code=await page.locator('#bookmarkletCode').inputValue();
  if(!code.startsWith('javascript:')||!code.includes('/food/water?date='))throw new Error(`${label}: installer did not render the extractor`);
  const helperOverflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(helperOverflow>3)throw new Error(`${label}: extractor helper caused horizontal overflow ${helperOverflow}px`);
  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await context.close();await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health MyFitnessPal water import smoke passed');
