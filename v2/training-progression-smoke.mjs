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
  await page.selectOption('#trainingPeriod','all');

  const latest=page.locator('.sessions .session').first();
  if(!(await latest.evaluate(el=>el.classList.contains('latest'))))throw new Error(`${label}: latest structured workout is not visually prioritized`);
  if((await latest.locator('.sessionHead').getAttribute('aria-expanded'))!=='false')throw new Error(`${label}: collapsed workout does not expose its state`);
  const latestText=(await latest.textContent())||'';
  if(!latestText.includes('mais recente'))throw new Error(`${label}: latest workout label missing`);
  await latest.locator('.sessionHead').click();
  await page.waitForSelector('.sessions .session.latest.open .sessionBody');
  if((await page.locator('.sessions .session.latest .sessionHead').getAttribute('aria-expanded'))!=='true')throw new Error(`${label}: workout expansion state is not reflected for accessibility`);
  await page.locator('.sessions .session.latest .sessionHead').click();
  await page.waitForFunction(()=>document.querySelector('.sessions .session.latest .sessionHead')?.getAttribute('aria-expanded')==='false');

  await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    state.data.workouts=[...(state.data.workouts||[]),
      {source_record_id:'legacy-workout-detail',workout_date:'2025-12-20',workout_type:'Treino legado detalhado',location:'Fonte histórica',raw_exercises:'Remada histórica 75×6 + drop 55×4',source:'Fixture de interface',record_status:'imported',is_canonical:true},
      {source_record_id:'legacy-workout-summary',workout_date:'2025-12-19',workout_type:'Treino legado resumo',location:'Fonte histórica',raw_exercises:'Peito / Bíceps / Tríceps — sem detalhe',source:'Fixture de interface',record_status:'imported',is_canonical:true}
    ];
    state.data.exercises=[...(state.data.exercises||[]),
      {source_record_id:'legacy-ex-detail',workout_source_record_id:'legacy-workout-detail',workout_date:'2025-12-20',order_index:1,exercise:'Remada histórica',machine:null,muscle_group:'Costas',source_text:'Remada histórica 75×6 + drop 55×4',source:'Fixture de interface'},
      {source_record_id:'trend-ex-1',workout_source_record_id:'workout-1',workout_date:'2026-01-20',order_index:10,exercise:'Remada teste',machine:'Máquina A',muscle_group:'Costas',source:'Fixture de interface'},
      {source_record_id:'trend-ex-2',workout_source_record_id:'workout-1',workout_date:'2026-01-27',order_index:10,exercise:'Remada teste',machine:'Máquina A',muscle_group:'Costas',source:'Fixture de interface'},
      {source_record_id:'trend-ex-3',workout_source_record_id:'workout-2',workout_date:'2026-02-03',order_index:10,exercise:'Remada teste',machine:'Máquina A',muscle_group:'Costas',source:'Fixture de interface'},
      {source_record_id:'trend-ex-same-day-a',workout_source_record_id:'workout-same-day-a',workout_date:'2026-02-10',order_index:10,exercise:'Remada teste',machine:'Máquina A',muscle_group:'Costas',source:'Fixture de interface'},
      {source_record_id:'trend-ex-same-day-b',workout_source_record_id:'workout-same-day-b',workout_date:'2026-02-10',order_index:10,exercise:'Remada teste',machine:'Máquina A',muscle_group:'Costas',source:'Fixture de interface'},
      {source_record_id:'trend-ex-other-machine',workout_source_record_id:'workout-2',workout_date:'2026-02-03',order_index:11,exercise:'Remada teste',machine:'Máquina B',muscle_group:'Costas',source:'Fixture de interface'}
    ];
    state.data.sets=[...(state.data.sets||[]),
      {source_record_id:'trend-set-1',exercise_source_record_id:'trend-ex-1',workout_source_record_id:'workout-1',workout_date:'2026-01-20',set_index:1,phase:'working',weight:60,weight_unit:'kg',reps_numeric:10,reps_raw:'10',source:'Fixture de interface'},
      {source_record_id:'trend-set-2',exercise_source_record_id:'trend-ex-1',workout_source_record_id:'workout-1',workout_date:'2026-01-20',set_index:2,phase:'working',weight:60,weight_unit:'kg',reps_numeric:12,reps_raw:'12',source:'Fixture de interface'},
      {source_record_id:'trend-set-3',exercise_source_record_id:'trend-ex-2',workout_source_record_id:'workout-1',workout_date:'2026-01-27',set_index:1,phase:'working',weight:65,weight_unit:'kg',reps_numeric:8,reps_raw:'8',source:'Fixture de interface'},
      {source_record_id:'trend-set-no-unit-prev',exercise_source_record_id:'trend-ex-2',workout_source_record_id:'workout-1',workout_date:'2026-01-27',set_index:2,phase:'working',weight:80,weight_unit:null,reps_numeric:7,reps_raw:'7',source:'Fixture de interface'},
      {source_record_id:'trend-set-4',exercise_source_record_id:'trend-ex-3',workout_source_record_id:'workout-2',workout_date:'2026-02-03',set_index:1,phase:'working',weight:65,weight_unit:'kg',reps_numeric:11,reps_raw:'11',source:'Fixture de interface'},
      {source_record_id:'trend-set-unit',exercise_source_record_id:'trend-ex-3',workout_source_record_id:'workout-2',workout_date:'2026-02-03',set_index:2,phase:'working',weight:7,weight_unit:'plate_index',reps_numeric:9,reps_raw:'9',source:'Fixture de interface'},
      {source_record_id:'trend-set-no-unit-latest',exercise_source_record_id:'trend-ex-3',workout_source_record_id:'workout-2',workout_date:'2026-02-03',set_index:3,phase:'working',weight:90,weight_unit:null,reps_numeric:6,reps_raw:'6',source:'Fixture de interface'},
      {source_record_id:'trend-set-same-day-a',exercise_source_record_id:'trend-ex-same-day-a',workout_source_record_id:'workout-same-day-a',workout_date:'2026-02-10',set_index:1,phase:'working',weight:70,weight_unit:'kg',reps_numeric:8,reps_raw:'8',source:'Fixture de interface'},
      {source_record_id:'trend-set-same-day-b',exercise_source_record_id:'trend-ex-same-day-b',workout_source_record_id:'workout-same-day-b',workout_date:'2026-02-10',set_index:1,phase:'working',weight:250,weight_unit:'kg',reps_numeric:2,reps_raw:'2',source:'Fixture de interface'},
      {source_record_id:'trend-set-other-machine',exercise_source_record_id:'trend-ex-other-machine',workout_source_record_id:'workout-2',workout_date:'2026-02-03',set_index:1,phase:'working',weight:100,weight_unit:'kg',reps_numeric:20,reps_raw:'20',source:'Fixture de interface'}
    ];
  });

  await page.fill('#trainingQuery','legado detalhado');
  await page.waitForFunction(()=>document.querySelectorAll('.sessions .session').length===1);
  await page.locator('.sessions .session .sessionHead').click();
  const legacyDetail=(await page.locator('.sessions .session.open .sessionBody').textContent())||'';
  for(const expected of ['Remada histórica','Séries detalhadas não disponíveis','Registro da fonte','75×6 + drop 55×4']){
    if(!legacyDetail.includes(expected))throw new Error(`${label}: preserved legacy evidence missing: ${expected}`);
  }
  if(/\bS1\b/.test(legacyDetail))throw new Error(`${label}: legacy source text was incorrectly promoted to a structured set`);

  await page.fill('#trainingQuery','legado resumo');
  await page.waitForFunction(()=>document.querySelectorAll('.sessions .session').length===1);
  await page.locator('.sessions .session .sessionHead').click();
  const summaryDetail=(await page.locator('.sessions .session.open .sessionBody').textContent())||'';
  if(!summaryDetail.includes('Registro histórico da fonte')||!summaryDetail.includes('sem detalhe')||!summaryDetail.includes('sem criar exercícios ou séries'))throw new Error(`${label}: summary-only legacy workout was not preserved conservatively`);

  await page.fill('#trainingQuery','');
  await page.waitForFunction(()=>document.querySelectorAll('.sessions .session').length>1);
  await page.fill('#exerciseQuery','remada teste');
  await page.waitForFunction(()=>{
    const buttons=[...document.querySelectorAll('.exerciseList button')];
    return buttons.length===2&&buttons.every(button=>button.textContent?.toLowerCase().includes('remada teste'));
  });
  await page.click('.exerciseList button:has-text("Máquina A")');
  await page.waitForSelector('.trainingRecent');
  const selectedButton=(await page.locator('.exerciseList button.active').textContent())||'';
  if(!selectedButton.includes('5 sessão'))throw new Error(`${label}: same-day sessions were collapsed in the exercise session count`);
  const text=(await page.locator('.exerciseDetail').textContent())||'';
  for(const expected of ['Sessões recentes','60 kg','12 reps','65 kg','11 reps','placa','Unidades diferentes permanecem separadas','mesma carga · +3 reps','90 sem unidade','70 kg','250 kg','sessão mantida separada','mais de uma sessão']){
    if(!text.includes(expected))throw new Error(`${label}: missing conservative training trend detail: ${expected}`);
  }
  if(text.includes('100 kg')||text.includes('20 reps'))throw new Error(`${label}: alternate machine leaked into selected exercise progression`);
  const comparisonText=(await page.locator('.trainingComparison').textContent())||'';
  if(comparisonText.includes('sem unidade')||comparisonText.includes('+10'))throw new Error(`${label}: load without a recorded unit leaked into session comparison`);
  if(comparisonText.includes('70 kg')||comparisonText.includes('250 kg'))throw new Error(`${label}: unordered same-day sessions leaked into session comparison`);
  const progressionText=(await page.locator('.exerciseProgression').textContent())||'';
  if(progressionText.includes('80 sem unidade')||progressionText.includes('90 sem unidade'))throw new Error(`${label}: load without a recorded unit leaked into longitudinal progression`);
  if(progressionText.includes('70')||progressionText.includes('250'))throw new Error(`${label}: unordered same-day sessions leaked into longitudinal progression`);
  const recentText=(await page.locator('.trainingRecent').textContent())||'';
  if(recentText.includes('80 sem unidade')||recentText.includes('90 sem unidade'))throw new Error(`${label}: load without a recorded unit leaked into recent-session trend`);
  if(recentText.includes('70 kg')||recentText.includes('250 kg'))throw new Error(`${label}: unordered same-day sessions leaked into recent-session trend`);
  const sameDayRows=page.locator('.exerciseHistoryRows .row').filter({hasText:'10/02/2026'});
  if(await sameDayRows.count()!==2)throw new Error(`${label}: same-day sessions were not preserved as separate history rows`);
  const rows=await page.locator('.trainingRecentRow').count();
  if(rows<4)throw new Error(`${label}: recent-session trend did not render expected unit-separated rows`);

  await page.selectOption('#trainingPeriod','28');
  await page.waitForFunction(()=>document.querySelector('.exerciseList')?.textContent?.includes('Nenhum exercício encontrado no período.'));
  const scopedText=(await page.locator('#screenHost').textContent())||'';
  if(scopedText.includes('Remada teste')||scopedText.includes('Remada histórica'))throw new Error(`${label}: exercise progression ignored the selected period`);
  await page.selectOption('#trainingPeriod','all');
  await page.waitForFunction(()=>[...document.querySelectorAll('.exerciseList button')].some(button=>button.textContent?.toLowerCase().includes('remada teste')));

  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  if(overflow>3)throw new Error(`${label}: training progression caused horizontal overflow ${overflow}px`);
  if(viewport.width<620){
    const head=await page.locator('.sessions .session').first().locator('.sessionHead').evaluate(el=>({width:el.getBoundingClientRect().width,viewport:innerWidth}));
    if(head.width>head.viewport-20)throw new Error(`${label}: workout header exceeds usable mobile width`);
  }
  if(errors.length)throw new Error(`${label}: browser errors ${errors.join(' | ')}`);
  await browser.close();
}

await run({width:1280,height:900},'desktop');
await run({width:390,height:844},'mobile');
console.log('LTS Health v2 training progression smoke passed');
