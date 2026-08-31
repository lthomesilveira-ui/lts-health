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
  await page.waitForFunction(()=>document.querySelector('[data-executive-dashboard]'));

  const boundary=await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    const {buildIntegratedAnalysis}=await import('./src/integrated-analysis.js');
    state.data.workouts.push(
      {source_record_id:'shadow-workout-1',workout_date:'2026-02-03',workout_type:'Atividade complementar 1',record_status:'validated',is_canonical:false,source:'Apple Saúde'},
      {source_record_id:'shadow-workout-2',workout_date:'2026-01-29',workout_type:'Atividade complementar 2',record_status:'validated',is_canonical:false,source:'MyFitnessPal'}
    );
    state.data.exercises.push(
      {source_record_id:'shadow-ex-1',workout_source_record_id:'shadow-workout-1',workout_date:'2026-02-03',exercise:'Supino máquina',machine:'Máquina de teste',muscle_group:'Peito'},
      {source_record_id:'shadow-ex-2',workout_source_record_id:'shadow-workout-2',workout_date:'2026-01-29',exercise:'Supino máquina',machine:'Máquina de teste',muscle_group:'Peito'}
    );
    state.data.sets.push(
      {source_record_id:'shadow-set-1',exercise_source_record_id:'shadow-ex-1',weight:300,weight_unit:'kg',reps_numeric:2},
      {source_record_id:'shadow-set-2',exercise_source_record_id:'shadow-ex-2',weight:250,weight_unit:'kg',reps_numeric:3}
    );
    const model=buildIntegratedAnalysis(state.data,state.domainStatus);
    return {
      totalSessions:model.training.distribution.totalSessions,
      groups:model.training.distribution.rows.map(row=>row.label),
      lastWorkout:model.training.lastWorkout?.workout_type||'',
      shadowPerformance:(model.training.performance||[]).some(row=>row.weight===300||row.weight===250)
    };
  });

  if(boundary.totalSessions!==2)throw new Error(`${label}: integrated distribution counted non-canonical activity (${boundary.totalSessions})`);
  if(boundary.groups.includes('Peito'))throw new Error(`${label}: non-canonical muscle group leaked into integrated distribution`);
  if(boundary.lastWorkout!=='Peito + ombros')throw new Error(`${label}: canonical latest workout changed (${boundary.lastWorkout})`);
  if(boundary.shadowPerformance)throw new Error(`${label}: non-canonical activity created a performance comparison`);

  await page.locator('[data-route="hoje"]:visible').first().click();
  await page.waitForFunction(()=>document.querySelector('[data-executive-dashboard]')?.textContent?.includes('Último treino'));
  const text=(await page.textContent('#screenHost'))||'';
  if(!text.includes('Peito + ombros'))throw new Error(`${label}: canonical latest workout disappeared`);
  if(text.includes('Atividade complementar 1')||text.includes('Atividade complementar 2'))throw new Error(`${label}: non-canonical activity leaked into dashboard`);
  if(text.includes('250 → 300 kg')||text.includes('300 kg'))throw new Error(`${label}: non-canonical activity leaked into a performance card`);

  await page.locator('[data-route="timeline"]:visible').first().click();
  await page.waitForFunction(()=>document.querySelector('.screenTitle h1')?.textContent?.trim()==='Timeline');
  const timelineText=(await page.textContent('#screenHost'))||'';
  if(timelineText.includes('Atividade complementar 1')||timelineText.includes('Atividade complementar 2'))throw new Error(`${label}: non-canonical activity leaked into Timeline as structured training`);
  if(await page.locator('[data-timeline-route="treinos"]').count()===0)throw new Error(`${label}: Timeline lost canonical structured workouts`);

  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: page errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health v2 structured workout boundary smoke passed');
