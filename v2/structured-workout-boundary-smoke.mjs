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

  await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    state.data.workouts.push(
      {source_record_id:'shadow-workout-1',workout_date:'2026-02-03',workout_type:'Atividade complementar 1',record_status:'validated',is_canonical:false,source:'Apple Saúde'},
      {source_record_id:'shadow-workout-2',workout_date:'2026-01-29',workout_type:'Atividade complementar 2',record_status:'validated',is_canonical:false,source:'MyFitnessPal'}
    );
    state.data.exercises.push(
      {source_record_id:'shadow-ex-1',workout_source_record_id:'shadow-workout-1',workout_date:'2026-02-03',exercise:'Supino máquina',machine:'Máquina de teste'},
      {source_record_id:'shadow-ex-2',workout_source_record_id:'shadow-workout-2',workout_date:'2026-01-29',exercise:'Supino máquina',machine:'Máquina de teste'}
    );
    state.data.sets.push(
      {source_record_id:'shadow-set-1',exercise_source_record_id:'shadow-ex-1',weight:300,weight_unit:'kg',reps_numeric:2},
      {source_record_id:'shadow-set-2',exercise_source_record_id:'shadow-ex-2',weight:250,weight_unit:'kg',reps_numeric:3}
    );
    const {render}=await import('./src/main.js');
    render();
  });

  await page.waitForFunction(()=>document.querySelector('[data-executive-dashboard]')?.textContent?.includes('Último treino'));
  const text=(await page.textContent('#screenHost'))||'';
  if(!text.includes('Peito + ombros'))throw new Error(`${label}: canonical latest workout disappeared`);
  if(text.includes('Atividade complementar 1')||text.includes('Atividade complementar 2'))throw new Error(`${label}: non-canonical activity leaked into structured workout intelligence`);
  if(!text.includes('2 sessão(ões) nas últimas 8 semanas'))throw new Error(`${label}: workout coverage counted non-canonical activity`);
  if(text.includes('4 sessão(ões) nas últimas 8 semanas'))throw new Error(`${label}: workout coverage still includes complementary activity`);
  if(text.includes('250 → 300 kg')||text.includes('300 kg'))throw new Error(`${label}: non-canonical activity created a performance conclusion`);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: page errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health v2 structured workout boundary smoke passed');
