import { chromium } from 'playwright';

const base='http://127.0.0.1:4173/?fixture=1#nutricao';

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});

  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Nutrição');

  await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    state.data.nutrition.push(
      {source_record_id:'year-nav-2024-a',nutrition_date:'2024-01-05',calories_kcal:1900,protein_g:130,carbs_g:180,fat_g:60,source:'Teste histórico'},
      {source_record_id:'year-nav-2024-b',nutrition_date:'2024-12-28',calories_kcal:2300,protein_g:160,carbs_g:245,fat_g:70,source:'Teste histórico'},
      {source_record_id:'year-nav-2023',nutrition_date:'2023-06-10',calories_kcal:2100,protein_g:145,carbs_g:210,fat_g:65,source:'Teste histórico'}
    );
  });

  await page.selectOption('#nutritionPeriod','all');
  await page.waitForSelector('#nutritionYear');
  const yearOptions=await page.locator('#nutritionYear option').allTextContents();
  if(!yearOptions.includes('2024')||!yearOptions.includes('2023'))throw new Error(`${label}: historical year selector is incomplete`);

  await page.selectOption('#nutritionYear','2024');
  await page.waitForFunction(()=>document.querySelector('.domainHero')?.textContent?.includes('Histórico diário de 2024 disponível para navegação completa.'));

  const days=(await page.locator('.nutritionDays').textContent())||'';
  if(!days.includes('05/01/2024')||!days.includes('28/12/2024'))throw new Error(`${label}: selected year does not expose all preserved days`);
  if(days.includes('10/06/2023')||days.includes('02/02/2026'))throw new Error(`${label}: selected year leaked days from another year`);

  const coverage=(await page.locator('.metric').filter({hasText:'Cobertura do período'}).textContent())||'';
  if(!coverage.includes('2 de 366 dias')||!coverage.includes('364 dias sem registro'))throw new Error(`${label}: leap-year coverage is not calculated against the full year (${coverage})`);

  const historyDisclosure=page.locator('details.uxDisclosure').filter({hasText:'Distribuição e cobertura histórica'});
  await historyDisclosure.locator('summary').click();
  const yearButton=historyDisclosure.locator('[data-nutrition-year="2024"]');
  if(!await yearButton.count())throw new Error(`${label}: year drill-down button is missing`);
  if(!await yearButton.evaluate(node=>node.classList.contains('active')))throw new Error(`${label}: selected year is not visibly active`);

  await page.click('[data-nutrition-date="2024-01-05"]');
  const detailDisclosure=page.locator('details.uxDisclosure').filter({hasText:'Detalhe do dia selecionado'});
  await detailDisclosure.locator('summary').click();
  const detail=(await detailDisclosure.locator('.disclosureBody').textContent())||'';
  if(!detail.includes('05/01/2024')||!detail.includes('1.900 kcal'))throw new Error(`${label}: historical day drill-down failed after year navigation`);

  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: nutrition year navigation caused horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: page errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health v2 nutrition year navigation smoke passed');
