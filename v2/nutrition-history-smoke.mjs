import { chromium } from 'playwright';

const base='http://127.0.0.1:4173/?fixture=1#nutricao';

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});

  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Nutrição');

  await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    state.data.nutrition.push({source_record_id:'nut-2024',nutrition_date:'2024-06-10',calories_kcal:2050,protein_g:140,source:'Teste'});
    state.data.meals.push({source_record_id:'meal-2024',meal_date:'2024-06-10',meal_name:'Almoço 2024',calories_kcal:600,protein_g:40,source:'Teste'});
  });

  await page.selectOption('#nutritionPeriod','all');
  await page.waitForSelector('#nutritionYear');
  const coverage=(await page.textContent('.yearGrid'))||'';
  if(!coverage.includes('2026')||!coverage.includes('2025')||!coverage.includes('2024'))throw new Error(`${label}: contiguous nutrition year coverage is incomplete`);
  const gap=(await page.locator('.yearGap').filter({hasText:'2025'}).textContent())||'';
  if(!gap.includes('sem registros disponíveis')||!gap.includes('Nenhum dia importado neste ano'))throw new Error(`${label}: missing nutrition year is not explicit`);

  await page.click('[data-nutrition-year="2024"]');
  await page.waitForFunction(()=>document.querySelector('#nutritionYear')?.value==='2024');
  const coverageMetric=(await page.locator('.metric').filter({hasText:'Cobertura do período'}).textContent())||'';
  if(!coverageMetric.includes('1 de 366 dias')||!coverageMetric.includes('365 dia(s) sem registro'))throw new Error(`${label}: calendar coverage does not distinguish recorded from missing days`);
  if(coverageMetric.includes('365 dia(s) com consumo zero'))throw new Error(`${label}: missing nutrition days were mislabeled as zero consumption`);

  await page.waitForSelector('[data-nutrition-date="2024-06-10"]');
  await page.click('[data-nutrition-date="2024-06-10"]');
  const detail=(await page.textContent('#screenHost'))||'';
  if(!detail.includes('10/06/2024')||!detail.includes('Almoço 2024'))throw new Error(`${label}: historical nutrition day drilldown failed`);

  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: nutrition history caused horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: page errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health v2 nutrition history smoke passed');
