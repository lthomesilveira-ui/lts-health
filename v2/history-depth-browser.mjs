import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';

// Exercises the production structural path with a synthetic service, not ?fixture.
// Real authenticated release proof is a separate mandatory gate.
const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/v2/';
const dir='v2/history-depth-evidence';mkdirSync(dir,{recursive:true});
const db={};
db.health_workouts=Array.from({length:36},(_,i)=>({source_record_id:`w-${i}`,workout_date:`${i<18?'2025':'2026'}-01-${String(i%18+1).padStart(2,'0')}`,workout_type:`Sessão sintética ${i}`,location:'Local sintético',duration_minutes:40,heart_rate_avg:100,heart_rate_min:60,heart_rate_max:120,is_canonical:true,record_status:'validated',source:'Teste',muscle_groups:['Grupo sintético']}));
db.health_workout_exercises=db.health_workouts.map((w,i)=>({source_record_id:`ex-${i}`,workout_source_record_id:w.source_record_id,workout_date:w.workout_date,order_index:1,exercise:'Exercício sintético',machine:'Equipamento sintético',source:'Teste'}));
db.health_workout_sets=db.health_workouts.map((w,i)=>({source_record_id:`s-${i}`,workout_source_record_id:w.source_record_id,exercise_source_record_id:`ex-${i}`,workout_date:w.workout_date,set_index:1,phase:'working',weight:20+i%4,weight_unit:'kg',reps_numeric:10,source:'Teste'}));
db.health_body_composition=Array.from({length:30},(_,i)=>({source_record_id:`b-${i}`,measured_at:`2024-${i<28?'01':'02'}-${String(i%28+1).padStart(2,'0')}`,source:'Teste',source_file:'synthetic.csv',weight_kg:70+i%3,body_fat_pct:20,skeletal_muscle_mass_kg:30,fat_mass_kg:14,body_water_l:40}));
db.health_segmental_composition=db.health_body_composition.map((r,i)=>({source_record_id:`seg-${i}`,measured_at:r.measured_at,source:'Teste',source_file:'synthetic.csv',lean_right_arm_kg:3,lean_left_arm_kg:3,lean_trunk_kg:20,lean_right_leg_kg:7,lean_left_leg_kg:7,fat_right_arm_kg:1,fat_left_arm_kg:1,fat_trunk_kg:6,fat_right_leg_kg:2,fat_left_leg_kg:2}));
db.health_lab_results=Array.from({length:22},(_,i)=>Array.from({length:25},(_,j)=>({source_record_id:`lab-${i}-${j}`,biomarker:`Marcador ${String(i+1).padStart(2,'0')}`,collection_date:`2024-01-${String(j+1).padStart(2,'0')}`,laboratory:'Laboratório A sintético',unit:'u',result_numeric:10+j%4,result_raw:String(10+j%4),reference_range:'Faixa sintética',source:'Teste'}))).flat();
db.health_lab_results.push({source_record_id:'text-only',biomarker:'Marcador textual único',collection_date:'2026-01-01',laboratory:'Laboratório A sintético',result_raw:'Resultado textual sintético',source:'Teste'});
for(let j=1;j<4;j++)db.health_lab_results.push({source_record_id:`other-${j}`,biomarker:'Marcador 01',collection_date:`2025-02-0${j}`,laboratory:'Laboratório B sintético',unit:'outra unidade',result_numeric:j,result_raw:String(j),source:'Teste'});
const service=`window.__depthDb=${JSON.stringify(db)};window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-user'}}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})},from(table){let from=0,to=999,orders=[];const q={select(){return q;},range(a,b){from=a;to=b;return q;},order(k,opt={}){orders.push([k,opt.ascending!==false]);return q;},then(resolve,reject){let rows=[...(window.__depthDb[table]||[])];rows.sort((a,b)=>{for(const[k,asc]of orders){const c=String(a[k]||'').localeCompare(String(b[k]||''));if(c)return asc?c:-c;}return 0;});return Promise.resolve({data:window.__failTable===table?null:rows.slice(from,to+1),error:window.__failTable===table?{message:'Synthetic read failure'}:null}).then(resolve,reject);}};return q;}})};`;
const browser=await chromium.launch({headless:true,...(process.env.LTS_BROWSER_PATH?{executablePath:process.env.LTS_BROWSER_PATH}:{}),args:['--no-sandbox']});
const errors=[];
async function overflow(page){
  const result=await page.evaluate(()=>({doc:document.documentElement.scrollWidth-window.innerWidth,host:document.getElementById('screenHost').scrollWidth-document.getElementById('screenHost').clientWidth}));
  assert.ok(result.doc<=1&&result.host<=1,`horizontal overflow ${JSON.stringify(result)}`);
}
async function goto(page,route,selector){await page.evaluate(r=>{location.hash='#'+r;},route);await page.waitForSelector(selector);await page.waitForTimeout(150);}
try{
 for(const [label,width,height] of [['desktop',1440,1000],['mobile',390,844],['small',320,740]]){
  const page=await browser.newPage({viewport:{width,height}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://cdn.jsdelivr.net/**',r=>r.fulfill({contentType:'application/javascript',body:service}));
  await page.goto(base+'#hoje');await page.waitForSelector('.ltsHomeV2');await overflow(page);
  if(label!=='small')await page.screenshot({path:`${dir}/synthetic-${label}-home.png`});
  await goto(page,'treinos','.ltsTrainingV2 .ltsExerciseCard');
  await page.locator('[data-depth-training-view="history"]').first().click();
  const seen=[];
  for(let i=0;i<3;i++){
   seen.push(...await page.locator('[data-depth-workout]').evaluateAll(es=>es.map(e=>e.dataset.depthWorkout)));
   if(i<2)await page.locator('[data-depth-page="productTrainingPage"]').last().click();
  }
  assert.equal(new Set(seen).size,36,'all workouts must be reachable past former 14 cap');
  assert.equal(await page.locator('[data-depth-workout]').last().getAttribute('data-depth-workout'),'w-0');
  await page.locator('[data-depth-workout]').last().click();
  assert.ok((await page.locator('.ltsTrainingV2 h1').textContent()).includes('Sessão sintética 0'));
  await page.locator('[data-depth-exercise]').first().click();
  await page.waitForSelector('.ltsExerciseHistory');assert.equal(await page.locator('.ltsDepthPlot circle').count(),36);
  await overflow(page);
  await page.locator('[data-depth-training-view="history"]').first().click();
  assert.equal(await page.locator('[data-depth-workout]').last().getAttribute('data-depth-workout'),'w-0','return preserves pagination');
  await page.locator('#productTrainingQuery').fill('Sintética 0');
  assert.equal(await page.locator('[data-depth-workout]').count(),1);assert.equal(await page.locator('#productTrainingQuery').inputValue(),'Sintética 0');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'productTrainingQuery','search retains focus after rerender');
  await page.locator('[data-depth-clear="training"]').click();await page.locator('#productTrainingYear').selectOption('2025');assert.equal(await page.locator('[data-training-total]').getAttribute('data-training-total'),'18');
  await overflow(page);if(label!=='small')await page.screenshot({path:`${dir}/synthetic-${label}-training-history.png`});

  await goto(page,'saude','.ltsLabsV2 .ltsLabsHero');
  assert.equal(await page.locator('#productLabMarkerSelect option').count(),24,'all 23 markers plus placeholder');
  await page.locator('#productLabMarkerSelect').selectOption('marcador textual unico');
  assert.ok((await page.locator('.ltsLabsHero').innerText()).includes('Resultado textual sintético'));assert.equal(await page.locator('.ltsDepthLine').count(),0);
  await page.locator('#productLabMarkerSelect').selectOption('marcador 01');
  const sourceA=await page.locator('#productLabCohort option').evaluateAll(es=>es.find(e=>e.textContent.includes('Laboratório A')).value);
  await page.locator('#productLabCohort').selectOption(sourceA);await page.locator('[data-depth-period="productLabPeriod"][data-value="all"]').click();
  assert.equal(await page.locator('.ltsDepthPlot circle').count(),25,'all comparable points past former 12 cap');
  assert.equal(await page.locator('[data-lab-history-total]').getAttribute('data-lab-history-total'),'28');
  await page.locator('[data-depth-page="productLabPage"]').last().click();await page.locator('[data-depth-page="productLabPage"]').last().click();
  assert.equal(await page.locator('.ltsLabsHistoryRow').count(),8,'last page exposes oldest records');
  await page.locator('#productLabPoint').selectOption('0');assert.ok((await page.locator('.ltsPointReadout b').innerText()).includes('10'));
  await page.locator('#productLabQuery').fill('Marcador 22');assert.equal(await page.locator('#productLabMarkerSelect option').count(),2);await page.locator('[data-lab-marker="marcador 22"]').click();await overflow(page);
  if(label!=='small')await page.screenshot({path:`${dir}/synthetic-${label}-labs.png`});

  await goto(page,'bio','.ltsCompositionV2 .ltsCompositionHero');
  await page.locator('[data-depth-period="productCompositionPeriod"][data-value="all"]').click();assert.equal(await page.locator('.ltsDepthPlot circle').count(),30);
  await page.locator('[data-composition-metric="weight_kg"]').click();assert.equal(await page.locator('[data-composition-metric="weight_kg"]').getAttribute('aria-pressed'),'true');
  const ids=[];for(let i=0;i<4;i++){ids.push(...await page.locator('.ltsCompositionHistoryList [data-depth-composition-record]').evaluateAll(es=>es.map(e=>e.dataset.depthCompositionRecord)));if(i<3)await page.locator('[data-depth-page="productCompositionPage"]').last().click();}
  assert.equal(new Set(ids).size,30,'all body records past former 8 cap');await page.locator('.ltsCompositionHistoryList [data-depth-composition-record]').last().click();
  await page.waitForSelector('.ltsSegmentTable');assert.equal(await page.locator('.ltsSegmentTable tbody tr').count(),5);await overflow(page);
  if(label!=='small')await page.screenshot({path:`${dir}/synthetic-${label}-measurement.png`});
  await page.locator('[data-depth-composition-back]').last().click();assert.equal(await page.locator('.ltsCompositionHistoryList [data-depth-composition-record]').last().getAttribute('data-depth-composition-record'),'b-0');
  await page.locator('[data-disclosure="product-composition-compare"] summary').click();await page.locator('#productCompareA').selectOption('b-0');assert.ok(await page.locator('[data-disclosure="product-composition-compare"]').getAttribute('open')!==null);await overflow(page);

  // Explicit read failure is not a valid empty dataset and cannot show stale hero.
  await goto(page,'saude','.ltsLabsV2 .ltsLabsHero');await page.evaluate(()=>{window.__failTable='health_lab_results';});await page.locator('#refreshBtn').click();await page.waitForSelector('.ltsLabsV2 .ltsDepthError');assert.equal(await page.locator('.ltsLabsHero').count(),0);
  await page.evaluate(()=>{window.__failTable='';window.__depthDb.health_lab_results=[];});await page.locator('#refreshBtn').click();await page.waitForSelector('.ltsLabsV2 .ltsEmptyCard');assert.equal(await page.locator('.ltsDepthError').count(),0);await overflow(page);
  await page.close();
 }
 assert.deepEqual(errors,[]);console.log('Production-path synthetic browser gate passed in desktop, 390px and 320px: all histories, filtering, selection, units, details, return and read failures.');
}finally{await browser.close();}
