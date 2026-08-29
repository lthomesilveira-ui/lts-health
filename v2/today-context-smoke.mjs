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
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Hoje');
  await page.waitForSelector('.todayContextGrid');
  if((await page.locator('.todayContextGrid > article').count())!==5)throw new Error(`${label}: recent-context grid should have five evidence cards`);
  let text=(await page.locator('.todayContextSection').textContent())||'';
  for(const expected of ['Contexto recente','peso +1,0 kg','MME +1,0 kg','gordura -1,3 p.p.','Duas sessões mais recentes','1 tipo(s) de métrica em 02/02/2026','2 resultado(s) na coleta mais recente','Progressão de treino','Sem exercício comparável nas duas sessões']){
    if(!text.includes(expected))throw new Error(`${label}: missing recent-context fact: ${expected}`);
  }
  const metricGrid=page.locator('.todayMetricGrid').first();
  let metrics=(await metricGrid.textContent())||'';
  for(const expected of ['Energia ativa','Exercício','Horas em pé','Sono'])if(!metrics.includes(expected))throw new Error(`${label}: missing validated Apple metric ${expected}`);
  for(const forbidden of ['Passos','FC de repouso'])if(metrics.includes(forbidden))throw new Error(`${label}: unsupported automatic Apple metric leaked into Today: ${forbidden}`);
  if(!metrics.includes('Último disponível em 02/02/2026'))throw new Error(`${label}: stale fixture metrics are not identified as latest available`);
  const sectionCopy=(await metricGrid.locator('xpath=..').textContent())||'';
  if(!sectionCopy.includes('energia ativa, minutos de exercício, horas em pé e duração do sono'))throw new Error(`${label}: validated Apple metric scope is not explicit`);
  if(!sectionCopy.includes('indica se o dado é de hoje ou apenas o último disponível'))throw new Error(`${label}: Today freshness rule is not explicit`);
  if(!text.includes('sem transformar coincidências em causa ou meta'))throw new Error(`${label}: recent-context limitation is not explicit`);
  const summaryText=(await page.locator('.todaySummaryGrid').textContent())||'';
  if(!summaryText.includes('Último disponível em'))throw new Error(`${label}: summary cards do not distinguish latest available from today`);

  await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    const d=new Date(),p=n=>String(n).padStart(2,'0'),today=`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
    state.data.metrics=[
      {source_record_id:'metric-today',measured_at:`${today}T12:00:00`,metric_type:'active_energy_kcal',value:321,unit:'kcal',source:'Teste'},
      ...(state.data.metrics||[])
    ];
    location.hash='bio';
  });
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Bio');
  await page.evaluate(()=>{location.hash='hoje';});
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Hoje');
  const energyText=(await page.locator('.todayMetricGrid .todayStatusCard').filter({hasText:'Energia ativa'}).textContent())||'';
  if(!energyText.includes('Hoje'))throw new Error(`${label}: metric recorded today is not marked as today`);
  if(energyText.includes('Último disponível em'))throw new Error(`${label}: today metric is mislabeled as historical`);

  await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    state.data.workouts=[
      {source_record_id:'machine-new',workout_date:'2026-03-02',workout_type:'Teste A',record_status:'validated',is_canonical:true},
      {source_record_id:'machine-old',workout_date:'2026-03-01',workout_type:'Teste B',record_status:'validated',is_canonical:true}
    ];
    state.data.exercises=[
      {source_record_id:'machine-ex-new',workout_source_record_id:'machine-new',workout_date:'2026-03-02',order_index:1,exercise:'Remada',machine:'Máquina B'},
      {source_record_id:'machine-ex-old',workout_source_record_id:'machine-old',workout_date:'2026-03-01',order_index:1,exercise:'Remada',machine:'Máquina A'}
    ];
    state.data.sets=[
      {source_record_id:'machine-set-new',exercise_source_record_id:'machine-ex-new',workout_source_record_id:'machine-new',weight:80,weight_unit:'kg',reps_numeric:8},
      {source_record_id:'machine-set-old',exercise_source_record_id:'machine-ex-old',workout_source_record_id:'machine-old',weight:70,weight_unit:'kg',reps_numeric:10}
    ];
    location.hash='bio';
  });
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Bio');
  await page.evaluate(()=>{location.hash='hoje';});
  await page.waitForFunction(()=>document.querySelector('#screenHost h1')?.textContent==='Hoje');
  text=(await page.locator('.todayContextSection').textContent())||'';
  if(!text.includes('Sem exercício comparável nas duas sessões'))throw new Error(`${label}: Today compared the same exercise across different machines`);
  if(!text.includes('mesmo exercício, a mesma máquina e a mesma unidade'))throw new Error(`${label}: machine-aware comparison rule is not explicit`);
  if(text.includes('70 → 80 kg'))throw new Error(`${label}: cross-machine load comparison leaked into Today`);

  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: recent-context section caused horizontal overflow ${overflow}px`);
  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health v2 Today recent-context smoke passed');
