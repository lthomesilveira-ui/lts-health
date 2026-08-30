import { chromium } from 'playwright';

const base='http://127.0.0.1:4173/?fixture=1#dados';

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');

  const result=await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    const {visibleRowsForDomain}=await import('./src/data-layer.js');
    const {sourceStatusFor,latestSourceEvidenceDateFor}=await import('./src/source-status.js');

    const nutrition=visibleRowsForDomain('nutrition',[
      {source_record_id:'mfp-export',nutrition_date:'2026-02-11',calories_kcal:2100,source:'MyFitnessPal export'},
      {source_record_id:'mfp-apple',nutrition_date:'2026-02-12',calories_kcal:2200,source:'MyFitnessPal via Apple Health'},
      {source_record_id:'mfp-healthkit',nutrition_date:'2026-02-13',calories_kcal:2300,source:'MyFitnessPal via HealthKitBridge'}
    ]);
    const metrics=visibleRowsForDomain('metrics',[
      {source_record_id:'hk-active',measured_at:'2026-02-11T12:00:00Z',metric_type:'active_energy_kcal',value:450,unit:'kcal',source:'HealthKitBridge ActivitySummary'},
      {source_record_id:'hk-steps',measured_at:'2026-02-11T12:00:00Z',metric_type:'steps',value:9000,unit:'count',source:'HealthKitBridge ActivitySummary'},
      {source_record_id:'watch-active',measured_at:'2026-02-11T12:00:00Z',metric_type:'active_energy_kcal',value:300,unit:'kcal',source:'Apple Watch'},
      {source_record_id:'manual-rhr',measured_at:'2026-02-10T12:00:00Z',metric_type:'resting_heart_rate_bpm',value:60,unit:'bpm',source:'Manual validated'}
    ]);

    state.data.uploads=[];
    state.data.nutrition=nutrition;
    state.data.meals=[];
    state.data.metrics=metrics;
    state.data.sourceMetrics=[];
    for(const key of ['uploads','nutrition','meals','metrics','sourceMetrics'])state.domainStatus[key]='ready';

    return {
      nutritionIds:nutrition.map(row=>row.source_record_id),
      metricIds:metrics.map(row=>row.source_record_id),
      apple:sourceStatusFor('apple_health'),
      mfp:sourceStatusFor('myfitnesspal'),
      appleEvidence:latestSourceEvidenceDateFor('apple_health'),
      mfpEvidence:latestSourceEvidenceDateFor('myfitnesspal')
    };
  });

  if(JSON.stringify(result.nutritionIds)!==JSON.stringify(['mfp-export']))throw new Error(`${label}: MyFitnessPal via Apple alias crossed nutrition boundary ${JSON.stringify(result)}`);
  for(const id of ['hk-active','manual-rhr'])if(!result.metricIds.includes(id))throw new Error(`${label}: valid metric disappeared ${id}`);
  for(const id of ['hk-steps','watch-active'])if(result.metricIds.includes(id))throw new Error(`${label}: Apple non-canonical metric crossed boundary ${id}`);
  if(result.apple!=='ready'||result.appleEvidence!=='2026-02-11')throw new Error(`${label}: HealthKit ActivitySummary was not recognized as Apple canonical evidence ${JSON.stringify(result)}`);
  if(result.mfp!=='ready'||result.mfpEvidence!=='2026-02-11')throw new Error(`${label}: direct MyFitnessPal export was not kept as canonical nutrition evidence ${JSON.stringify(result)}`);

  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health v2 provenance alias smoke passed');
