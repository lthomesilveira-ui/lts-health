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
    const snapshot=model=>({
      totalSessions:model.training.distribution.totalSessions,
      distribution:JSON.stringify(model.training.distribution.rows.map(row=>({label:row.label,sessions:row.sessions,sets:row.sets}))),
      lastWorkout:model.training.lastWorkout?.source_record_id||'',
      performance:JSON.stringify(model.training.performance||[])
    });
    const before=snapshot(buildIntegratedAnalysis(state.data,state.domainStatus));
    state.data.workouts.push(
      {source_record_id:'shadow-workout-1',workout_date:'2099-02-03',workout_type:'Atividade complementar 1',record_status:'validated',is_canonical:false,source:'Apple Saúde'},
      {source_record_id:'shadow-workout-2',workout_date:'2099-01-29',workout_type:'Atividade complementar 2',record_status:'validated',is_canonical:false,source:'MyFitnessPal'}
    );
    state.data.exercises.push(
      {source_record_id:'shadow-ex-1',workout_source_record_id:'shadow-workout-1',workout_date:'2099-02-03',exercise:'Exercício sombra',machine:'Máquina sombra',muscle_group:'Grupo sombra'},
      {source_record_id:'shadow-ex-2',workout_source_record_id:'shadow-workout-2',workout_date:'2099-01-29',exercise:'Exercício sombra',machine:'Máquina sombra',muscle_group:'Grupo sombra'}
    );
    state.data.sets.push(
      {source_record_id:'shadow-set-1',exercise_source_record_id:'shadow-ex-1',weight:300,weight_unit:'kg',reps_numeric:2},
      {source_record_id:'shadow-set-2',exercise_source_record_id:'shadow-ex-2',weight:250,weight_unit:'kg',reps_numeric:3}
    );
    const after=snapshot(buildIntegratedAnalysis(state.data,state.domainStatus));
    return {before,after};
  });

  if(boundary.after.totalSessions!==boundary.before.totalSessions)throw new Error(`${label}: non-canonical activity changed integrated session count`);
  if(boundary.after.distribution!==boundary.before.distribution)throw new Error(`${label}: non-canonical activity changed integrated muscle distribution`);
  if(boundary.after.lastWorkout!==boundary.before.lastWorkout)throw new Error(`${label}: non-canonical activity changed latest structured workout`);
  if(boundary.after.performance!==boundary.before.performance)throw new Error(`${label}: non-canonical activity changed performance comparisons`);

  await page.locator('[data-route="hoje"]:visible').first().click();
  await page.waitForFunction(()=>document.querySelector('[data-executive-dashboard]')?.textContent?.includes('Ritmo e distribuição'));
  const text=(await page.textContent('#screenHost'))||'';
  if(text.includes('Atividade complementar 1')||text.includes('Atividade complementar 2')||text.includes('Exercício sombra'))throw new Error(`${label}: non-canonical activity leaked into dashboard`);
  if(text.includes('250 → 300 kg')||text.includes('300 kg'))throw new Error(`${label}: non-canonical activity leaked into a performance card`);

  await page.evaluate(()=>{location.hash='timeline';});
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
