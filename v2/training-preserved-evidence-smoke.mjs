import { chromium } from 'playwright';

const base='http://127.0.0.1:4173/?fixture=1#treinos';

async function run(viewport,label){
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#app:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Treinos');
  await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    state.ui.trainingPeriod='all';
    state.data.workouts=[
      {source_record_id:'legacy-session',workout_date:'2026-02-10',workout_type:'Sessão histórica',location:'Local registrado',record_status:'validated',is_canonical:true,source:'Fonte de teste',raw_exercises:'Descrição original preservada da sessão.'},
      {source_record_id:'summary-session',workout_date:'2026-02-08',workout_type:'Sessão resumida',location:'Local registrado',record_status:'validated',is_canonical:true,source:'Fonte de teste'}
    ];
    state.data.exercises=[
      {source_record_id:'summary-exercise',workout_source_record_id:'summary-session',workout_date:'2026-02-08',order_index:1,exercise:'Exercício resumido',machine:'Equipamento de teste',muscle_group:'Grupo',source_text:'Texto original preservado do exercício.',source:'Fonte de teste'}
    ];
    state.data.sets=[];
    state.domainStatus.workouts='ready';
    state.domainStatus.exercises='ready';
    state.domainStatus.sets='ready';
  });
  const nav=viewport.width<720?'#mobileNav':'#primaryNav';
  await page.click(`${nav} [data-route="bio"]`);
  await page.click(`${nav} [data-route="treinos"]`);
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Treinos');

  const legacy=page.locator('[data-workout="legacy-session"]');
  await legacy.click();
  let text=(await page.textContent('#screenHost'))||'';
  for(const expected of ['Registro histórico da fonte','Descrição original preservada da sessão.','O texto foi preservado sem criar exercícios ou séries que a fonte não detalha.']){
    if(!text.includes(expected))throw new Error(`${label}: missing preserved session evidence: ${expected}`);
  }
  if(text.includes('0 exercício(s) · 0 série(s)'))throw new Error(`${label}: preserved session reduced to contradictory zero detail`);

  await page.locator('[data-workout="summary-session"]').click();
  text=(await page.textContent('#screenHost'))||'';
  for(const expected of ['Exercício resumido','Registro da fonte','Texto original preservado do exercício.','Séries detalhadas não disponíveis.']){
    if(!text.includes(expected))throw new Error(`${label}: missing preserved exercise evidence: ${expected}`);
  }
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health v2 preserved workout evidence smoke passed');
