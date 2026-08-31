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

  const result=await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    const {sourceStatusFor,sourceCoverageFor}=await import('./src/source-status.js');
    const {renderDataHub}=await import('./src/data-screen.js');

    state.data.uploads=[];
    state.data.previews=[];
    state.data.quality=[];
    state.data.sourceMetrics=[];
    state.data.metrics=[{source_record_id:'apple-stale-confirmed',measured_at:'2026-02-07T12:00:00Z',metric_type:'active_energy_kcal',value:450,unit:'kcal',source:'HealthKitBridge ActivitySummary'}];
    state.data.workouts=[{source_record_id:'polar-stale-confirmed',workout_date:'2026-02-08',workout_type:'Treino',source:'Polar Flow'}];
    state.data.nutrition=[{source_record_id:'mfp-stale-confirmed',nutrition_date:'2026-02-09',calories_kcal:2100,source:'MyFitnessPal'}];
    state.data.meals=[];
    state.data.labs=[{source_record_id:'fleury-stale-confirmed',collection_date:'2026-02-06',laboratory:'Fleury',biomarker:'Marcador',result_raw:'10',result_numeric:10,unit:'u',source:'Fleury'}];
    state.errors={};
    for(const key of ['uploads','previews','quality','sourceMetrics','metrics','workouts','nutrition','meals','labs'])state.domainStatus[key]='ready';

    state.domainStatus.metrics='error';
    state.domainStatus.workouts='error';
    state.domainStatus.nutrition='error';
    state.domainStatus.labs='error';

    const snapshot={
      apple:{status:sourceStatusFor('apple_health'),coverage:sourceCoverageFor('apple_health')},
      polar:{status:sourceStatusFor('polar_flow'),coverage:sourceCoverageFor('polar_flow')},
      mfp:{status:sourceStatusFor('myfitnesspal'),coverage:sourceCoverageFor('myfitnesspal')},
      fleury:{status:sourceStatusFor('fleury'),coverage:sourceCoverageFor('fleury')},
      html:renderDataHub()
    };
    return snapshot;
  });

  for(const [source,entry] of Object.entries(result).filter(([key])=>key!=='html')){
    if(entry.status!=='unknown')throw new Error(`${label}: ${source} stale confirmed data still reports ${entry.status}`);
    if(entry.coverage.confirmedDate!==null||entry.coverage.latestDate!==null)throw new Error(`${label}: ${source} stale confirmed date survived failed domain ${JSON.stringify(entry.coverage)}`);
  }
  if(!result.html.includes('não foi possível verificar'))throw new Error(`${label}: failed source is not visibly unavailable`);
  for(const date of ['07/02/2026','08/02/2026','09/02/2026','06/02/2026'])if(result.html.includes(`Confirmado até: ${date}`))throw new Error(`${label}: stale confirmed freshness leaked into source card ${date}`);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health v2 confirmed source failure smoke passed');
