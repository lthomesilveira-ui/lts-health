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
    state.data.nutrition.push(
      {source_record_id:'nut-2024',nutrition_date:'2024-06-10',calories_kcal:2050,protein_g:140,source:'Teste'},
      {source_record_id:'nut-2024-amb-a',nutrition_date:'2024-06-11',calories_kcal:9000,protein_g:900,source:'Teste A'},
      {source_record_id:'nut-2024-amb-b',nutrition_date:'2024-06-11',calories_kcal:100,protein_g:10,source:'Teste B'}
    );
    state.data.meals.push({source_record_id:'meal-2024',meal_date:'2024-06-10',meal_name:'Almoço 2024',calories_kcal:600,protein_g:40,source:'Teste'});
    state.data.sourceMetrics.push(
      {source_record_id:'mfp-energy',metric_date:'2026-02-02',metric_type:'dietary_energy_kcal',value:1999,unit:'kcal',source_name:'MyFitnessPal',source_family:'myfitnesspal',canonical_status:'candidate',confidence:'high',source_file:'apple-health-export'},
      {source_record_id:'mfp-protein',metric_date:'2026-02-02',metric_type:'dietary_protein_g',value:151.5,unit:'g',source_name:'MyFitnessPal',source_family:'myfitnesspal',canonical_status:'candidate',confidence:'high',source_file:'apple-health-export'},
      {source_record_id:'mfp-carbs',metric_date:'2026-02-02',metric_type:'dietary_carbs_g',value:201,unit:'g',source_name:'MyFitnessPal',source_family:'myfitnesspal',canonical_status:'candidate',confidence:'high',source_file:'apple-health-export'},
      {source_record_id:'mfp-fat',metric_date:'2026-02-02',metric_type:'dietary_fat_g',value:66,unit:'g',source_name:'MyFitnessPal',source_family:'myfitnesspal',canonical_status:'candidate',confidence:'high',source_file:'apple-health-export'},
      {source_record_id:'mfp-fiber',metric_date:'2026-02-02',metric_type:'dietary_fiber_g',value:29,unit:'g',source_name:'MyFitnessPal',source_family:'myfitnesspal',canonical_status:'candidate',confidence:'high',source_file:'apple-health-export'},
      {source_record_id:'mfp-energy-a',metric_date:'2026-02-01',metric_type:'dietary_energy_kcal',value:1800,unit:'kcal',source_name:'MyFitnessPal',source_family:'myfitnesspal',canonical_status:'candidate',confidence:'high',source_file:'apple-health-export'},
      {source_record_id:'mfp-energy-b',metric_date:'2026-02-01',metric_type:'dietary_energy_kcal',value:2600,unit:'kcal',source_name:'MyFitnessPal',source_family:'myfitnesspal',canonical_status:'candidate',confidence:'high',source_file:'apple-health-export'},
      {source_record_id:'mfp-protein-a',metric_date:'2026-02-01',metric_type:'dietary_protein_g',value:120,unit:'g',source_name:'MyFitnessPal',source_family:'myfitnesspal',canonical_status:'candidate',confidence:'high',source_file:'apple-health-export'},
      {source_record_id:'mfp-protein-b',metric_date:'2026-02-01',metric_type:'dietary_protein_g',value:170,unit:'g',source_name:'MyFitnessPal',source_family:'myfitnesspal',canonical_status:'candidate',confidence:'high',source_file:'apple-health-export'}
    );
  });

  await page.selectOption('#nutritionPeriod','all');
  await page.waitForSelector('#nutritionYear');
  await page.waitForFunction(()=>document.querySelector('.mfpCandidatePanel')?.textContent?.includes('1.999 kcal'));

  const candidate=(await page.locator('.mfpCandidatePanel').textContent())||'';
  if(!candidate.includes('MyFitnessPal via Apple Saúde')||!candidate.includes('em validação'))throw new Error(`${label}: MyFitnessPal Apple daily totals are not visibly held for validation`);
  if(!candidate.includes('1.999 kcal')||!candidate.includes('152g P')||!candidate.includes('201g C')||!candidate.includes('66g G')||!candidate.includes('29g Fibra'))throw new Error(`${label}: preserved MyFitnessPal daily candidate values are not rendered as received`);
  if(!candidate.includes('calorias em revisão')||!candidate.includes('P em revisão')||!candidate.includes('valores repetidos para revisão'))throw new Error(`${label}: ambiguous MyFitnessPal daily candidates are not held for review`);
  if(candidate.includes('1.800 kcal')||candidate.includes('2.600 kcal')||candidate.includes('120g P')||candidate.includes('170g P'))throw new Error(`${label}: one ambiguous MyFitnessPal candidate was silently selected`);
  if(!candidate.includes('nenhum valor é escolhido ou somado automaticamente'))throw new Error(`${label}: ambiguous candidate boundary is not explicit`);
  if(!candidate.includes('não criam alimentos, refeições ou horários'))throw new Error(`${label}: MyFitnessPal candidate granularity boundary is not explicit`);
  const calorieAverage=(await page.locator('.metric').filter({hasText:'Calorias · média'}).textContent())||'';
  if(!calorieAverage.includes('2.150'))throw new Error(`${label}: candidate MyFitnessPal energy contaminated canonical nutrition averages (${calorieAverage})`);
  if(calorieAverage.includes('2.100')||calorieAverage.includes('1.999')||calorieAverage.includes('1.800')||calorieAverage.includes('2.600'))throw new Error(`${label}: candidate or ambiguous value replaced the canonical nutrition average`);

  const coverage=(await page.textContent('.yearGrid'))||'';
  if(!coverage.includes('2026')||!coverage.includes('2025')||!coverage.includes('2024'))throw new Error(`${label}: contiguous nutrition year coverage is incomplete`);
  const gap=(await page.locator('.yearGap').filter({hasText:'2025'}).textContent())||'';
  if(!gap.includes('sem registros disponíveis')||!gap.includes('Nenhum dia importado neste ano'))throw new Error(`${label}: missing nutrition year is not explicit`);

  await page.click('[data-nutrition-year="2024"]');
  await page.waitForFunction(()=>document.querySelector('#nutritionYear')?.value==='2024');
  const coverageMetric=(await page.locator('.metric').filter({hasText:'Cobertura do período'}).textContent())||'';
  if(!coverageMetric.includes('2 de 366 dias')||!coverageMetric.includes('364 dia(s) sem registro'))throw new Error(`${label}: calendar coverage does not distinguish recorded from missing days`);
  if(coverageMetric.includes('364 dia(s) com consumo zero'))throw new Error(`${label}: missing nutrition days were mislabeled as zero consumption`);

  const yearAverage=(await page.locator('.metric').filter({hasText:'Calorias · média'}).textContent())||'';
  if(!yearAverage.includes('2.050'))throw new Error(`${label}: ambiguous canonical daily totals affected the yearly average (${yearAverage})`);
  if(yearAverage.includes('9.000')||yearAverage.includes('100'))throw new Error(`${label}: an ambiguous canonical daily total was selected for the yearly average`);
  const monthly=(await page.locator('.nutritionTrend').textContent())||'';
  if(!monthly.includes('2.050 kcal/dia')||monthly.includes('9.000 kcal/dia'))throw new Error(`${label}: ambiguous canonical day contaminated monthly nutrition trend`);

  await page.waitForSelector('[data-nutrition-date="2024-06-11"]');
  const ambiguousRow=(await page.locator('[data-nutrition-date="2024-06-11"]').textContent())||'';
  if(!ambiguousRow.includes('Em revisão')||!ambiguousRow.includes('nenhum valor foi escolhido'))throw new Error(`${label}: duplicate canonical daily totals are not explicitly held for review`);
  if(ambiguousRow.includes('9.000')||ambiguousRow.includes('100 kcal'))throw new Error(`${label}: one duplicate canonical daily total was silently displayed as accepted`);
  await page.click('[data-nutrition-date="2024-06-11"]');
  const ambiguousDetail=(await page.locator('.grid.split.sectionGap').last().textContent())||'';
  if(!ambiguousDetail.includes('Totais do dia em revisão')||!ambiguousDetail.includes('Nenhum total foi escolhido')||!ambiguousDetail.includes('ficam fora das médias até revisão'))throw new Error(`${label}: canonical nutrition ambiguity is not explained in the day detail`);
  if(ambiguousDetail.includes('9.000 kcal')||ambiguousDetail.includes('100 kcal'))throw new Error(`${label}: conflicting canonical nutrition values leaked into accepted day detail`);

  const intervalModel=await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    const {nutritionIntervalModel}=await import('./src/integrated-analysis.js');
    return nutritionIntervalModel(state.data,state.domainStatus,'2024-06-09','2024-06-11');
  });
  if(intervalModel.days!==1||Math.round(intervalModel.calorieAvg)!==2050||Math.round(intervalModel.proteinAvg)!==140)throw new Error(`${label}: integrated analysis did not exclude ambiguous canonical nutrition day (${JSON.stringify(intervalModel)})`);

  await page.click('[data-nutrition-date="2024-06-10"]');
  const detail=(await page.textContent('#screenHost'))||'';
  if(!detail.includes('10/06/2024')||!detail.includes('Almoço 2024'))throw new Error(`${label}: historical nutrition day drilldown failed`);

  const latestDate=await page.evaluate(async()=>{const {state}=await import('./src/core.js');return [...state.data.nutrition].map(r=>r.nutrition_date).filter(Boolean).sort().at(-1);});
  await page.evaluate(async(latest)=>{
    const {state}=await import('./src/core.js');
    state.data.nutrition.push({source_record_id:'latest-nutrition-duplicate',nutrition_date:latest,calories_kcal:9900,protein_g:999,source:'Teste duplicado'});
  },latestDate);
  const latestModel=await page.evaluate(async()=>{const {state}=await import('./src/core.js');const {buildIntegratedAnalysis}=await import('./src/integrated-analysis.js');const model=buildIntegratedAnalysis(state.data,state.domainStatus);return{date:model.lastNutritionDate,ambiguous:model.nutritionLatestAmbiguous,last:model.lastNutrition};});
  if(latestModel.date!==latestDate||latestModel.ambiguous!==true||latestModel.last!==null)throw new Error(`${label}: latest ambiguous nutrition day was silently resolved (${JSON.stringify(latestModel)})`);

  await page.evaluate(()=>{location.hash='#hoje';});
  await page.waitForFunction(()=>document.querySelector('[data-executive-dashboard]'));
  const nutritionCurrent=(await page.locator('.dashboardCurrent').filter({hasText:'Nutrição'}).textContent())||'';
  if(!nutritionCurrent.includes('Revisão necessária')||!nutritionCurrent.includes('nenhum foi escolhido como atual'))throw new Error(`${label}: Hoje did not surface latest nutrition ambiguity`);
  if(nutritionCurrent.includes('9.900')||nutritionCurrent.includes('999 g'))throw new Error(`${label}: Hoje selected a conflicting nutrition total`);

  await page.evaluate(()=>{location.hash='#nutricao';});
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Nutrição');
  await page.evaluate(async()=>{const {state}=await import('./src/core.js');state.domainStatus.sourceMetrics='error';});
  await page.selectOption('#nutritionPeriod','365');
  await page.waitForFunction(()=>document.querySelector('.mfpCandidatePanel')?.textContent?.includes('Não foi possível verificar estes totais agora'));
  const candidateFailure=(await page.locator('.mfpCandidatePanel').textContent())||'';
  if(!candidateFailure.includes('nenhum valor ausente é tratado como zero'))throw new Error(`${label}: candidate-source failure can be mistaken for a numeric zero`);

  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: nutrition history caused horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: page errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health v2 nutrition history smoke passed');