import { chromium } from 'playwright';

const base='http://127.0.0.1:4173/?fixture=1#bio';
const labs=[
  {source_record_id:'clarity-f1',collection_date:'2022-01-10',laboratory:'Origem teste',biomarker:'Ferritina',result_raw:'40',result_numeric:40,unit:'ng/mL',source:'Fixture'},
  {source_record_id:'clarity-f2',collection_date:'2024-01-10',laboratory:'Origem teste',biomarker:'Ferritina',result_raw:'55',result_numeric:55,unit:'ng/mL',source:'Fixture'},
  {source_record_id:'clarity-f3',collection_date:'2026-01-10',laboratory:'Origem teste',biomarker:'Ferritina',result_raw:'60',result_numeric:60,unit:'ng/mL',source:'Fixture'},
  {source_record_id:'clarity-t1',collection_date:'2022-02-01',laboratory:'Origem teste',biomarker:'Testosterona Total',result_raw:'400',result_numeric:400,unit:'ng/dL',source:'Fixture'},
  {source_record_id:'clarity-t2',collection_date:'2026-02-01',laboratory:'Origem teste',biomarker:'Testosterona Total',result_raw:'520',result_numeric:520,unit:'ng/dL',source:'Fixture'}
];

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Composição corporal');
  await page.waitForSelector('[data-longitudinal-bio]');
  await page.waitForSelector('[data-longitudinal-weight]');
  const bioText=(await page.locator('#screenHost').innerText())||'';
  if(!bioText.includes('Última medição')||!bioText.includes('Mudança relevante'))throw new Error(`${label}: composition summary hierarchy missing`);
  if(!bioText.includes('História do peso')||!bioText.includes('preenche dias sem InBody'))throw new Error(`${label}: consolidated weight narrative missing`);
  if(!bioText.includes('bioimpedância prevalece'))throw new Error(`${label}: source precedence rule missing`);
  if(await page.locator('[data-longitudinal-bio]').count()!==1||await page.locator('[data-longitudinal-weight]').count()!==1)throw new Error(`${label}: longitudinal composition duplicated`);

  await page.evaluate(async rows=>{
    const {state}=await import('./src/core.js');
    state.data.labs=[...(state.data.labs||[]),...rows];
    state.domainStatus.labs='ready';
    location.hash='#saude';
  },labs);
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Exames');
  await page.waitForSelector('[data-longitudinal-labs]');
  const labText=(await page.locator('[data-longitudinal-labs]').innerText())||'';
  if(!labText.includes('Evolução dos exames')||!labText.includes('Ferritina')||!labText.includes('Testosterona Total'))throw new Error(`${label}: longitudinal lab shortcuts missing`);
  if(!labText.includes('Abrir histórico'))throw new Error(`${label}: lab detail CTA missing`);
  await page.locator('[data-story-marker="ferritina"]').click();
  await page.waitForFunction(()=>document.querySelector('.markerHead')?.textContent?.includes('Ferritina'));
  if(!(await page.locator('.exerciseDetail').innerText()).includes('Série histórica'))throw new Error(`${label}: lab shortcut did not open detailed trend`);

  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: page errors: ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('Product clarity browser smoke passed');

