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
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Dados');

  const initial=await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    const {sourceStatusFor,latestSourceMetricDateFor,latestConfirmedSourceDateFor,latestSourceEvidenceDateFor,sourceCoverageFor}=await import('./src/source-status.js');
    state.data.uploads=[];
    state.data.workouts=[];
    state.data.nutrition=[];
    state.data.meals=[];
    state.data.metrics=[];
    state.data.sourceMetrics=[
      {source_record_id:'apple-healthkit-candidate',metric_date:'2026-02-10',metric_type:'sleep_duration_h',value:7.2,unit:'h',source_name:'Apple Saúde export',source_family:'healthkit_candidate',canonical_status:'candidate'},
      {source_record_id:'mfp-candidate',metric_date:'2026-02-10',metric_type:'dietary_protein_g',value:155,unit:'g',source_name:'MyFitnessPal via Apple Health',source_family:'myfitnesspal',canonical_status:'candidate'},
      {source_record_id:'polar-candidate',metric_date:'2026-02-10',metric_type:'resting_heart_rate_bpm',value:59,unit:'count/min',source_name:'Polar Flow',source_family:'polar_flow',canonical_status:'candidate'}
    ];
    for(const key of ['uploads','workouts','nutrition','meals','metrics','sourceMetrics'])state.domainStatus[key]='ready';
    return {
      apple:sourceStatusFor('apple_health'),polar:sourceStatusFor('polar_flow'),mfp:sourceStatusFor('myfitnesspal'),
      appleDate:latestSourceMetricDateFor('apple_health'),polarDate:latestSourceMetricDateFor('polar_flow'),mfpDate:latestSourceMetricDateFor('myfitnesspal'),
      appleConfirmed:latestConfirmedSourceDateFor('apple_health'),appleEvidence:latestSourceEvidenceDateFor('apple_health'),appleCoverage:sourceCoverageFor('apple_health')
    };
  });
  if(initial.apple!=='candidate'||initial.polar!=='candidate'||initial.mfp!=='candidate')throw new Error(`${label}: candidate source status missing ${JSON.stringify(initial)}`);
  if(initial.appleDate!=='2026-02-10'||initial.polarDate!=='2026-02-10'||initial.mfpDate!=='2026-02-10'||initial.appleEvidence!=='2026-02-10')throw new Error(`${label}: candidate source freshness missing ${JSON.stringify(initial)}`);
  if(initial.appleConfirmed!==null||initial.appleCoverage.confirmedDate!==null||initial.appleCoverage.preservedDate!=='2026-02-10')throw new Error(`${label}: candidate-only evidence was described as confirmed ${JSON.stringify(initial)}`);

  const held=await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    const {sourceStatusFor}=await import('./src/source-status.js');
    state.data.sourceMetrics=state.data.sourceMetrics.map(row=>({...row,canonical_status:'held'}));
    return {apple:sourceStatusFor('apple_health'),polar:sourceStatusFor('polar_flow'),mfp:sourceStatusFor('myfitnesspal')};
  });
  if(held.apple!=='candidate'||held.polar!=='candidate'||held.mfp!=='candidate')throw new Error(`${label}: held source evidence was not preserved as candidate ${JSON.stringify(held)}`);

  const foreignOnly=await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    const {sourceStatusFor,latestSourceMetricDateFor,latestSourceEvidenceDateFor}=await import('./src/source-status.js');
    state.data.sourceMetrics=state.data.sourceMetrics.filter(row=>!['apple_watch','iphone','apple_activity_summary','healthkit_candidate'].includes(row.source_family));
    return {status:sourceStatusFor('apple_health'),latest:latestSourceMetricDateFor('apple_health'),evidence:latestSourceEvidenceDateFor('apple_health')};
  });
  if(foreignOnly.status!=='missing'||foreignOnly.latest!==null||foreignOnly.evidence!==null)throw new Error(`${label}: foreign candidates leaked into Apple source status ${JSON.stringify(foreignOnly)}`);

  const ambiguous=await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    const {sourceStatusFor}=await import('./src/source-status.js');
    state.data.sourceMetrics=[
      {source_record_id:'apple-no-status',metric_date:'2026-02-10',metric_type:'steps',value:9000,unit:'count',source_name:'Apple Watch',source_family:'apple_watch'},
      {source_record_id:'mfp-no-status',metric_date:'2026-02-10',metric_type:'dietary_protein_g',value:155,unit:'g',source_name:'MyFitnessPal',source_family:'myfitnesspal'},
      {source_record_id:'polar-canonical-history',metric_date:'2026-02-10',metric_type:'resting_heart_rate_bpm',value:59,unit:'count/min',source_name:'Polar Flow',source_family:'polar_flow',canonical_status:'canonical'}
    ];
    return {apple:sourceStatusFor('apple_health'),mfp:sourceStatusFor('myfitnesspal'),polar:sourceStatusFor('polar_flow')};
  });
  if(ambiguous.apple!=='missing'||ambiguous.mfp!=='missing'||ambiguous.polar!=='missing')throw new Error(`${label}: missing/non-candidate provenance status was silently treated as candidate ${JSON.stringify(ambiguous)}`);

  const promoted=await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    const {sourceStatusFor,latestSourceEvidenceDateFor,sourceCoverageFor}=await import('./src/source-status.js');
    const {renderDataHub}=await import('./src/data-screen.js');
    state.data.uploads=[];state.data.previews=[];state.data.quality=[];
    state.data.sourceMetrics=[
      {source_record_id:'apple-healthkit-candidate',metric_date:'2026-02-10',metric_type:'sleep_duration_h',value:7.2,unit:'h',source_name:'Apple Saúde export',source_family:'healthkit_candidate',canonical_status:'candidate'},
      {source_record_id:'mfp-candidate',metric_date:'2026-02-10',metric_type:'dietary_protein_g',value:155,unit:'g',source_name:'MyFitnessPal via Apple Health',source_family:'myfitnesspal',canonical_status:'candidate'},
      {source_record_id:'polar-candidate',metric_date:'2026-02-10',metric_type:'steps',value:8500,unit:'count',source_name:'Polar Flow',source_family:'polar_flow',canonical_status:'held'}
    ];
    state.data.workouts=[{source_record_id:'polar-workout',workout_date:'2026-02-08',workout_type:'Treino',source:'Polar Flow'}];
    state.data.nutrition=[
      {source_record_id:'mfp-direct',nutrition_date:'2026-02-09',calories_kcal:2100,source:'MyFitnessPal'},
      {source_record_id:'mfp-via-apple-not-confirmed',nutrition_date:'2026-02-11',calories_kcal:2200,source:'MyFitnessPal via Apple Health'}
    ];
    state.data.meals=[];
    state.data.metrics=[{source_record_id:'apple-energy',measured_at:'2026-02-07T12:00:00Z',metric_type:'active_energy_kcal',value:450,unit:'kcal',source:'HealthKitBridge ActivitySummary'}];
    for(const key of ['uploads','previews','quality','workouts','nutrition','meals','metrics','sourceMetrics'])state.domainStatus[key]='ready';
    return {
      apple:sourceStatusFor('apple_health'),polar:sourceStatusFor('polar_flow'),mfp:sourceStatusFor('myfitnesspal'),
      appleEvidence:latestSourceEvidenceDateFor('apple_health'),polarEvidence:latestSourceEvidenceDateFor('polar_flow'),mfpEvidence:latestSourceEvidenceDateFor('myfitnesspal'),
      appleCoverage:sourceCoverageFor('apple_health'),polarCoverage:sourceCoverageFor('polar_flow'),mfpCoverage:sourceCoverageFor('myfitnesspal'),html:renderDataHub()
    };
  });
  if(promoted.apple!=='ready'||promoted.polar!=='ready'||promoted.mfp!=='ready')throw new Error(`${label}: direct/canonical evidence did not outrank candidate-only status ${JSON.stringify(promoted)}`);
  if(promoted.appleEvidence!=='2026-02-10'||promoted.polarEvidence!=='2026-02-10'||promoted.mfpEvidence!=='2026-02-10')throw new Error(`${label}: total source evidence freshness drifted ${JSON.stringify(promoted)}`);
  const expectedCoverage={appleCoverage:{confirmedDate:'2026-02-07',preservedDate:'2026-02-10',latestDate:'2026-02-10'},polarCoverage:{confirmedDate:'2026-02-08',preservedDate:'2026-02-10',latestDate:'2026-02-10'},mfpCoverage:{confirmedDate:'2026-02-09',preservedDate:'2026-02-10',latestDate:'2026-02-10'}};
  for(const key of Object.keys(expectedCoverage))if(JSON.stringify(promoted[key])!==JSON.stringify(expectedCoverage[key]))throw new Error(`${label}: ${key} did not separate confirmed and preserved coverage ${JSON.stringify(promoted[key])}`);
  for(const expected of ['Confirmado até: 07/02/2026<br>Registros adicionais guardados até: 10/02/2026','Confirmado até: 08/02/2026<br>Registros adicionais guardados até: 10/02/2026','Confirmado até: 09/02/2026<br>Registros adicionais guardados até: 10/02/2026'])if(!promoted.html.includes(expected))throw new Error(`${label}: source card coverage wording missing ${expected}`);
  if(promoted.html.includes('Última data disponível'))throw new Error(`${label}: ambiguous source freshness wording returned`);
  for(const forbidden of ['candidate','canonical','source_family','ActivitySummary'])if(promoted.html.includes(forbidden))throw new Error(`${label}: technical source language visible in data hub ${forbidden}`);

  const failed=await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    const {sourceStatusFor,latestSourceMetricDateFor,latestConfirmedSourceDateFor,latestSourceEvidenceDateFor}=await import('./src/source-status.js');
    state.data.workouts=[];state.data.nutrition=[];state.data.meals=[];state.data.metrics=[];state.data.sourceMetrics=[];
    state.domainStatus.sourceMetrics='error';
    return {apple:sourceStatusFor('apple_health'),polar:sourceStatusFor('polar_flow'),mfp:sourceStatusFor('myfitnesspal'),latest:latestSourceMetricDateFor('apple_health'),confirmed:latestConfirmedSourceDateFor('apple_health'),evidence:latestSourceEvidenceDateFor('apple_health')};
  });
  if(failed.apple!=='unknown'||failed.polar!=='unknown'||failed.mfp!=='unknown'||failed.latest!==null||failed.confirmed!==null||failed.evidence!==null)throw new Error(`${label}: failed provenance was converted into missing/zero evidence ${JSON.stringify(failed)}`);

  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health v2 source status smoke passed');
