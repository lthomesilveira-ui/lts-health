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
  const latestHead=latest.locator('.sessionHead');
  if((await latestHead.getAttribute('aria-expanded'))!=='false')throw new Error(`${label}: collapsed workout does not expose its state`);
  const latestText=(await latest.textContent())||'';
  if(!latestText.includes('mais recente'))throw new Error(`${label}: latest workout label missing`);
  await latestHead.click();
  if((await latestHead.getAttribute('aria-expanded'))!=='true')throw new Error(`${label}: workout expansion state is not reflected for accessibility`);
  await latestHead.click();

  await page.evaluate(async()=>{
    const {state}=await import('./src/core.js');
    state.data.exercises=[...(state.data.exercises||[]),
      {source_record_id:'trend-ex-1',workout_source_record_id:'workout-1',workout_date:'2026-01-20',order_index:10,exercise:'Remada teste',machine:'Máquina A',muscle_group:'Costas',source:'Fixture de interface'},
      {source_record_id:'trend-ex-2',workout_source_record_id:'workout-1',workout_date:'2026-01-27',order_index:10,exercise:'Remada teste',machine:'Máquina A',muscle_group:'Costas',source:'Fixture de interface'},
      {source_record_id:'trend-ex-3',workout_source_record_id:'workout-2',workout_date:'2026-02-03',order_index:10,exercise:'Remada teste',machine:'Máquina A',muscle_group:'Costas',source:'Fixture de interface'},
      {source_record_id:'trend-ex-other-machine',workout_source_record_id:'workout-2',workout_date:'2026-02-03',order_index:11,exercise:'Remada teste',machine:'Máquina B',muscle_group:'Costas',source:'Fixture de interface'}
    ];
    state.data.sets=[...(state.data.sets||[]),
      {source_record_id:'trend-set-1',exercise_source_record_id:'trend-ex-1',workout_source_record_id:'workout-1',workout_date:'2026-01-20',set_index:1,phase:'working',weight:60,weight_unit:'kg',reps_numeric:10,reps_raw:'10',source:'Fixture de interface'},
      {source_record_id:'trend-set-2',exercise_source_record_id:'trend-ex-1',workout_source_record_id:'workout-1',workout_date:'2026-01-20',set_index:2,phase:'working',weight:60,weight_unit:'kg',reps_numeric:12,reps_raw:'12',source:'Fixture de interface'},
      {source_record_id:'trend-set-3',exercise_source_record_id:'trend-ex-2',workout_source_record_id:'workout-1',workout_date:'2026-01-27',set_index:1,phase:'working',weight:65,weight_unit:'kg',reps_numeric:8,reps_raw:'8',source:'Fixture de interface'},
      {source_record_id:'trend-set-4',exercise_source_record_id:'trend-ex-3',workout_source_record_id:'workout-2',workout_date:'2026-02-03',set_index:1,phase:'working',weight:65,weight_unit:'kg',reps_numeric:11,reps_raw:'11',source:'Fixture de interface'},
      {source_record_id:'trend-set-unit',exercise_source_record_id:'trend-ex-3',workout_source_record_id:'workout-2',workout_date:'2026-02-03',set_index:2,phase:'working',weight:7,weight_unit:'plate_index',reps_numeric:9,reps_raw:'9',source:'Fixture de interface'},
      {source_record_id:'trend-set-other-machine',exercise_source_record_id:'trend-ex-other-machine',workout_source_record_id:'workout-2',workout_date:'2026-02-03',set_index:1,phase:'working',weight:100,weight_unit:'kg',reps_numeric:20,reps_raw:'20',source:'Fixture de interface'}
    ];
  });
  await page.fill('#exerciseQuery','remada teste');
  await page.waitForFunction(()=>document.querySelectorAll('.exerciseList button').length===2);
  await page.click('.exerciseList button:has-text("Máquina A")');
  await page.waitForSelector('.trainingRecent');
  const text=(await page.locator('.exerciseDetail').textContent())||'';
  for(const expected of ['Sessões recentes','60 kg','12 reps','65 kg','11 reps','placa','Unidades diferentes permanecem separadas']){
    if(!text.includes(expected))throw new Error(`${label}: missing conservative training trend detail: ${expected}`);
  }
  if(text.includes('100 kg')||text.includes('20 reps'))throw new Error(`${label}: alternate machine leaked into selected exercise progression`);
  const rows=await page.locator('.trainingRecentRow').count();
  if(rows<4)throw new Error(`${label}: recent-session trend did not render expected unit-separated rows`);
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
