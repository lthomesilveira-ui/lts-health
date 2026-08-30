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
    const {sourceStatusFor,latestSourceMetricDateFor,latestSourceEvidenceDateFor}=await import('./src/source-status.js');
    state.data.uploads=[];
    state.data.workouts=[];
    state.data.nutrition=[];
    state.data.meals=[];
    state.data.metrics=[];
    state.data.labs=[
      {source_record_id:'fleury-1',collection_date:'2026-02-01',report_date:'2026-02-02',laboratory:'Fleury',biomarker:'Marcador A',result_raw:'10',source:'Fleury'},
      {source_record_id:'einstein-1',collection_date:null,report_date:'2026-02-02',laboratory:'Einstein',biomarker:'Marcador B',result_raw:'Presente',source:'Einstein'}
    ];
    state.data.sourceMetrics=[
      {source_record_id:'apple-1',metric_date:'2026-02-03',metric_type:'resting_heart_rate_bpm',value:58,unit:'count/min',source_name:'Apple Watch',source_family:'apple_watch',canonical_status:'candidate'},
      {source_record_id:'mfp-1',metric_date:'2026-02-04',metric_type:'dietary_protein_g',value:150,unit:'g',source_name:'MyFitnessPal',source_family:'myfitnesspal',canonical_status:'candidate'},
      {source_record_id:'polar-1',metric_date:'2026-02-05',metric_type:'resting_heart_rate_bpm',value:60,unit:'count/min',source_name:'Polar Flow',source_family:'polar_flow',canonical_status:'candidate'},
      {source_record_id:'ring-1',metric_date:'2026-02-06',metric_type:'sleep_rem_h',value:1.8,unit:'h',source_name:'RingConn',source_family:'ringconn',canonical_status:'candidate'}
    ];
    for(const key of ['uploads','workouts','nutrition','meals','metrics','labs','sourceMetrics'])state.domainStatus[key]='ready';
    const {renderDataHub}=await import('./src/data-screen.js');
    document.querySelector('#screenHost').innerHTML=renderDataHub();
    return {
      apple:sourceStatusFor('apple_health'),
      polar:sourceStatusFor('polar_flow'),
      mfp:sourceStatusFor('myfitnesspal'),
      fleury:sourceStatusFor('fleury'),
      einstein:sourceStatusFor('einstein'),
      appleDate:latestSourceMetricDateFor('apple_health'),
      polarDate:latestSourceMetricDateFor('polar_flow'),
      mfpDate:latestSourceMetricDateFor('myfitnesspal'),
      appleEvidence:latestSourceEvidenceDateFor('apple_health'),
      polarEvidence:latestSourceEvidenceDateFor('polar_flow'),
      mfpEvidence:latestSourceEvidenceDateFor('myfitnesspal'),
      fleuryEvidence:latestSourceEvidenceDateFor('fleury'),
      einsteinEvidence:latestSourceEvidenceDateFor('einstein')
    };
  });
  if(initial.apple!=='candidate'||initial.polar!=='candidate'||initial.mfp!=='candidate'||initial.fleury!=='ready'||initial.einstein!=='ready')throw new Error(`${label}: source status drifted ${JSON.stringify(initial)}`);
  if(initial.appleDate!=='2026-02-03'||initial.polarDate!=='2026-02-05'||initial.mfpDate!=='2026-02-04')throw new Error(`${label}: source metric freshness crossed source boundaries ${JSON.stringify(initial)}`);
  if(initial.appleEvidence!=='2026-02-03'||initial.polarEvidence!=='2026-02-05'||initial.mfpEvidence!=='2026-02-04'||initial.fleuryEvidence!=='2026-02-01'||initial.einsteinEvidence!=='2026-02-02')throw new Error(`${label}: source evidence freshness drifted ${JSON.stringify(initial)}`);

  const cards=await page.locator('.sourceStatus').allTextContents();
  const card=name=>cards.find(text=>text.includes(name))||'';
  for(const name of ['Apple Saúde','Polar Flow','MyFitnessPal']){
    if(!card(name).includes('candidatos recebidos')||card(name).includes('com dados'))throw new Error(`${label}: ${name} candidate was presented as canonical readiness`);
  }
  for(const [name,date] of [['Apple Saúde','03/02/2026'],['Polar Flow','05/02/2026'],['MyFitnessPal','04/02/2026'],['Fleury','01/02/2026'],['Einstein','02/02/2026']]){
    const text=card(name);
    if(!text.includes('Última data disponível')||!text.includes(date))throw new Error(`${label}: ${name} card freshness missing or wrong: ${text}`);
  }
  const provenance=(await page.locator('.provenancePanel').textContent())||'';
  for(const expected of ['Apple Watch','MyFitnessPal','Polar Flow','RingConn','03/02/2026','04/02/2026','05/02/2026','06/02/2026','candidato'])if(!provenance.includes(expected))throw new Error(`${label}: provenance freshness missing ${expected}`);

  const foreignOnly=await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    const {sourceStatusFor,latestSourceMetricDateFor,latestSourceEvidenceDateFor}=await import('./src/source-status.js');
    state.data.sourceMetrics=state.data.sourceMetrics.filter(row=>row.source_family!=='apple_watch'&&row.source_family!=='iphone'&&row.source_family!=='apple_activity_summary');
    return {status:sourceStatusFor('apple_health'),latest:latestSourceMetricDateFor('apple_health'),evidence:latestSourceEvidenceDateFor('apple_health')};
  });
  if(foreignOnly.status!=='missing'||foreignOnly.latest!==null||foreignOnly.evidence!==null)throw new Error(`${label}: foreign candidates leaked into Apple source status ${JSON.stringify(foreignOnly)}`);

  const promoted=await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    const {sourceStatusFor,latestSourceEvidenceDateFor}=await import('./src/source-status.js');
    state.data.workouts=[{source_record_id:'polar-workout',workout_date:'2026-02-08',workout_type:'Treino',source:'Polar Flow'}];
    state.data.nutrition=[{source_record_id:'mfp-direct',nutrition_date:'2026-02-09',calories_kcal:2100,source:'MyFitnessPal'}];
    state.data.metrics=[{source_record_id:'apple-energy',measured_at:'2026-02-07T12:00:00Z',metric_type:'active_energy_kcal',value:450,unit:'kcal',source:'Apple Health'}];
    return {
      apple:sourceStatusFor('apple_health'),polar:sourceStatusFor('polar_flow'),mfp:sourceStatusFor('myfitnesspal'),
      appleEvidence:latestSourceEvidenceDateFor('apple_health'),polarEvidence:latestSourceEvidenceDateFor('polar_flow'),mfpEvidence:latestSourceEvidenceDateFor('myfitnesspal')
    };
  });
  if(promoted.apple!=='ready'||promoted.polar!=='ready'||promoted.mfp!=='ready')throw new Error(`${label}: direct/canonical evidence did not outrank candidate-only status ${JSON.stringify(promoted)}`);
  if(promoted.appleEvidence!=='2026-02-07'||promoted.polarEvidence!=='2026-02-08'||promoted.mfpEvidence!=='2026-02-09')throw new Error(`${label}: direct evidence did not extend source freshness ${JSON.stringify(promoted)}`);

  const failed=await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    const {sourceStatusFor,latestSourceMetricDateFor,latestSourceEvidenceDateFor}=await import('./src/source-status.js');
    state.data.workouts=[];state.data.nutrition=[];state.data.meals=[];state.data.metrics=[];state.data.sourceMetrics=[];
    state.domainStatus.sourceMetrics='error';
    return {apple:sourceStatusFor('apple_health'),polar:sourceStatusFor('polar_flow'),mfp:sourceStatusFor('myfitnesspal'),latest:latestSourceMetricDateFor('apple_health'),evidence:latestSourceEvidenceDateFor('apple_health')};
  });
  if(failed.apple!=='unknown'||failed.polar!=='unknown'||failed.mfp!=='unknown'||failed.latest!==null||failed.evidence!==null)throw new Error(`${label}: failed provenance was converted into missing/zero evidence ${JSON.stringify(failed)}`);

  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health v2 source status and freshness cards smoke passed');
