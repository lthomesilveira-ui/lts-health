import { chromium } from 'playwright';

const base='http://127.0.0.1:4173/?fixture=1#hoje';

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForSelector('[data-executive-dashboard]');

  const result=await page.evaluate(async()=>{
    const {visibleRowsForDomain,visibleWorkoutChildren}=await import('./src/data-layer.js');
    const metrics=visibleRowsForDomain('metrics',[
      {source_record_id:'activity-energy',measured_at:'2026-08-29T12:00:00Z',metric_type:'active_energy_kcal',value:500,unit:'kcal',source:'Apple Health ActivitySummary'},
      {source_record_id:'activity-stand',measured_at:'2026-08-29T12:00:00Z',metric_type:'stand_hours',value:10,unit:'h',source:'Apple Health ActivitySummary'},
      {source_record_id:'bridge-energy',measured_at:'2026-08-29T12:00:00Z',metric_type:'active_energy_kcal',value:510,unit:'kcal',source:'HealthKitBridge ActivitySummary'},
      {source_record_id:'bridge-steps',measured_at:'2026-08-29T12:00:00Z',metric_type:'steps',value:7200,unit:'count',source:'HealthKitBridge ActivitySummary'},
      {source_record_id:'bridge-sleep',measured_at:'2026-08-29T12:00:00Z',metric_type:'sleep_duration_h',value:7.2,unit:'h',source:'HealthKitBridge'},
      {source_record_id:'iphone-weight',measured_at:'2026-08-29T12:00:00Z',metric_type:'weight_kg',value:90.1,unit:'kg',source:'iPhone HealthKit'},
      {source_record_id:'watch-resting',measured_at:'2026-08-29T12:00:00Z',metric_type:'resting_heart_rate_bpm',value:55,unit:'bpm',source:'Apple Watch via Apple Health'},
      {source_record_id:'watch-hrv',measured_at:'2026-08-29T12:00:00Z',metric_type:'hrv_sdnn_ms',value:42,unit:'ms',source:'Apple Watch via Apple Health'},
      {source_record_id:'watch-sleep',measured_at:'2026-08-29T12:00:00Z',metric_type:'sleep_duration_h',value:7.1,unit:'h',source:'Apple Watch via Apple Health'},
      {source_record_id:'polar-sleep',measured_at:'2026-08-29T12:00:00Z',metric_type:'sleep_duration_h',value:7.4,unit:'h',source:'Polar Flow via Apple Health'},
      {source_record_id:'other-resting',measured_at:'2026-08-29T12:00:00Z',metric_type:'resting_heart_rate_bpm',value:58,unit:'bpm',source:'Validated external source'}
    ]);
    const nutrition=visibleRowsForDomain('nutrition',[
      {source_record_id:'mfp-export',nutrition_date:'2026-08-28',calories_kcal:2100,protein_g:150,source:'MyFitnessPal export'},
      {source_record_id:'mfp-healthkit',nutrition_date:'2026-08-29',calories_kcal:2200,protein_g:160,source:'MyFitnessPal via Apple Health'}
    ]);
    const workouts=visibleRowsForDomain('workouts',[
      {source_record_id:'lts-polar-evidence',workout_date:'2026-08-27',source:'user-reported completed workout + Polar Flow screenshot',record_status:'validated',is_canonical:true},
      {source_record_id:'polar-only-candidate',workout_date:'2026-08-27',source:'Polar Flow via Apple Health',record_status:'validated',is_canonical:false},
      {source_record_id:'polar-unpromoted-null',workout_date:'2026-08-27',source:'Polar Flow via Apple Health',record_status:'validated',is_canonical:null},
      {source_record_id:'polar-unpromoted-missing',workout_date:'2026-08-27',source:'Polar Flow via Apple Health',record_status:'validated'},
      {source_record_id:'quarantined-generated',workout_date:'2026-08-27',source:'builder generated',record_status:'quarantined',is_canonical:true}
    ]);
    const children=visibleWorkoutChildren(workouts,[
      {source_record_id:'exercise-canonical',workout_source_record_id:'lts-polar-evidence'},
      {source_record_id:'exercise-candidate',workout_source_record_id:'polar-only-candidate'},
      {source_record_id:'exercise-unpromoted',workout_source_record_id:'polar-unpromoted-null'}
    ],[
      {source_record_id:'set-canonical',workout_source_record_id:'lts-polar-evidence'},
      {source_record_id:'set-candidate',workout_source_record_id:'polar-only-candidate'},
      {source_record_id:'set-unpromoted',workout_source_record_id:'polar-unpromoted-null'}
    ]);
    return {metricIds:metrics.map(r=>r.source_record_id),nutritionIds:nutrition.map(r=>r.source_record_id),workoutIds:workouts.map(r=>r.source_record_id),exerciseIds:children.exercises.map(r=>r.source_record_id),setIds:children.sets.map(r=>r.source_record_id)};
  });

  if(result.metricIds.join('|')!=='activity-energy|activity-stand|bridge-energy|other-resting')throw new Error(`${label}: Apple Health candidate-only metrics crossed the canonical boundary: ${result.metricIds.join('|')}`);
  if(result.nutritionIds.join('|')!=='mfp-export')throw new Error(`${label}: MyFitnessPal via Apple Health candidate crossed the canonical nutrition boundary: ${result.nutritionIds.join('|')}`);
  if(result.workoutIds.join('|')!=='lts-polar-evidence')throw new Error(`${label}: workout provenance boundary failed: ${result.workoutIds.join('|')}`);
  if(result.exerciseIds.join('|')!=='exercise-canonical')throw new Error(`${label}: child exercise from non-canonical workout crossed the boundary: ${result.exerciseIds.join('|')}`);
  if(result.setIds.join('|')!=='set-canonical')throw new Error(`${label}: child set from non-canonical workout crossed the boundary: ${result.setIds.join('|')}`);

  const integrated=await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    const {visibleRowsForDomain}=await import('./src/data-layer.js');
    const {buildIntegratedAnalysis}=await import('./src/integrated-analysis.js');
    state.data.metrics=visibleRowsForDomain('metrics',[
      {source_record_id:'bridge-energy',measured_at:'2026-08-29T12:00:00Z',metric_type:'active_energy_kcal',value:510,unit:'kcal',source:'HealthKitBridge ActivitySummary'},
      {source_record_id:'bridge-steps',measured_at:'2026-08-29T12:00:00Z',metric_type:'steps',value:7200,unit:'count',source:'HealthKitBridge ActivitySummary'},
      {source_record_id:'bridge-sleep',measured_at:'2026-08-29T12:00:00Z',metric_type:'sleep_duration_h',value:7.2,unit:'h',source:'HealthKitBridge'},
      {source_record_id:'iphone-weight',measured_at:'2026-08-29T12:00:00Z',metric_type:'weight_kg',value:90.1,unit:'kg',source:'iPhone HealthKit'},
      {source_record_id:'watch-sleep',measured_at:'2026-08-29T12:00:00Z',metric_type:'sleep_duration_h',value:7.1,unit:'h',source:'Apple Watch via Apple Health'},
      {source_record_id:'polar-sleep',measured_at:'2026-08-29T12:00:00Z',metric_type:'sleep_duration_h',value:7.4,unit:'h',source:'Polar Flow via Apple Health'},
      {source_record_id:'other-resting',measured_at:'2026-08-29T12:00:00Z',metric_type:'resting_heart_rate_bpm',value:58,unit:'bpm',source:'Validated external source'}
    ]);
    state.data.sourceMetrics=[
      {source_record_id:'watch-sleep-review',metric_date:'2026-08-28',metric_type:'sleep_duration_h',value:7.1,unit:'h',source_name:'Apple Watch',source_family:'apple_watch',canonical_status:'candidate'},
      {source_record_id:'polar-sleep-review',metric_date:'2026-08-28',metric_type:'sleep_duration_h',value:7.4,unit:'h',source_name:'Polar Flow',source_family:'polar_flow',canonical_status:'held'}
    ];
    state.domainStatus.sourceMetrics='ready';
    state.data.nutrition=visibleRowsForDomain('nutrition',[
      {source_record_id:'mfp-export',nutrition_date:'2026-08-28',calories_kcal:2100,protein_g:150,source:'MyFitnessPal export'},
      {source_record_id:'mfp-healthkit',nutrition_date:'2026-08-29',calories_kcal:2200,protein_g:160,source:'MyFitnessPal via Apple Health'}
    ]);
    const model=buildIntegratedAnalysis(state.data,state.domainStatus);
    return {sleepDays:model.sleep.days,sleepSources:model.sleep.sources};
  });
  if(integrated.sleepDays!==1||integrated.sleepSources.length!==2)throw new Error(`${label}: overlapping sleep evidence was not preserved separately`);

  await page.evaluate(()=>{location.hash='bio';});
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Composição corporal');
  await page.evaluate(()=>{location.hash='hoje';});
  await page.waitForSelector('[data-executive-dashboard]');
  const todayText=(await page.textContent('#screenHost'))||'';
  if(todayText.includes('7.200 passos')||todayText.includes('90,1 kg')||todayText.includes('7,2 h')||todayText.includes('7,1 h')||todayText.includes('7,4 h'))throw new Error(`${label}: source-preserving Apple Health candidate leaked into dashboard`);
  for(const forbidden of ['Em validação','Não consolidado','canônico','candidato','ActivitySummary','source_family','count/min'])if(todayText.includes(forbidden))throw new Error(`${label}: technical boundary language leaked into dashboard: ${forbidden}`);

  await page.evaluate(()=>{location.hash='analise';});
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Análise');
  await page.selectOption('#analysisPeriod','all');
  await page.waitForFunction(()=>document.querySelector('#analysisPeriod')?.value==='all');
  const analysisText=(await page.textContent('#screenHost'))||'';
  if(!analysisText.includes('1 dia(s) de sono preservado(s)')||!analysisText.includes('As fontes permanecem separadas'))throw new Error(`${label}: sleep evidence is not visibly preserved without consolidation`);
  if(analysisText.includes('7,1 h')||analysisText.includes('7,4 h')||analysisText.includes('Sono consolidado'))throw new Error(`${label}: overlapping sleep values leaked as a consolidated analysis`);

  await page.evaluate(()=>{location.hash='nutricao';});
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Nutrição');
  const nutritionText=(await page.textContent('#screenHost'))||'';
  if(!nutritionText.includes('28/08/2026'))throw new Error(`${label}: direct MyFitnessPal export disappeared from Nutrition`);
  if(nutritionText.includes('29/08/2026')||nutritionText.includes('2.200'))throw new Error(`${label}: MyFitnessPal via Apple Health candidate appeared as confirmed Nutrition`);

  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: canonical boundary flow caused horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health v2 canonical boundary smoke passed');
