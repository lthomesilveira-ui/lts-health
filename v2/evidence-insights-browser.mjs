import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';

// Synthetic service on the production renderer; never a copy of private records.
const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/v2/';
const dir='v2/evidence-insights-visual';mkdirSync(dir,{recursive:true});
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const date=offset=>{const value=new Date(`${today}T12:00:00Z`);value.setUTCDate(value.getUTCDate()-offset);return value.toISOString().slice(0,10);};
const db={health_workouts:[],health_workout_exercises:[],health_workout_sets:[],health_daily_nutrition:[]};
for(const [start,total,source] of [[1,20,'Synthetic Food A'],[60,10,'Synthetic Food B']])for(let i=start;i<start+total;i++){
  db.health_daily_nutrition.push({source_record_id:`n${i}`,nutrition_date:date(i),protein_g:i%2?100:150,calories_kcal:2000,carbs_g:200,fat_g:60,source});
  if(i%2===0)db.health_workouts.push({source_record_id:`w${i}`,workout_date:date(i),is_canonical:true,record_status:'validated',location:'Synthetic gym',source:'Synthetic notes'});
}
for(const i of [2,4])for(let e=1;e<=10;e++){
  db.health_workout_exercises.push({source_record_id:`e${i}-${e}`,workout_source_record_id:`w${i}`,workout_date:date(i),exercise:`Synthetic press ${String(e).padStart(2,'0')}`,machine:'Synthetic machine',source:'Synthetic notes'});
  db.health_workout_sets.push({source_record_id:`s${i}-${e}`,exercise_source_record_id:`e${i}-${e}`,workout_source_record_id:`w${i}`,workout_date:date(i),phase:'working',weight:i===2?30:20,weight_unit:'kg',reps_numeric:10,source:'Synthetic notes'});
}
const service=`window.__insightDb=${JSON.stringify(db)};window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-user'}}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},functions:{invoke:async()=>({data:null,error:null})},from(table){let from=0,to=999;const q={select(){return q;},range(a,b){from=a;to=b;return q;},order(){return q;},then(resolve,reject){return Promise.resolve({data:(window.__insightDb[table]||[]).slice(from,to+1),error:null}).then(resolve,reject);}};return q;}})};`;
const browser=await chromium.launch({headless:true,...(process.env.LTS_BROWSER_PATH?{executablePath:process.env.LTS_BROWSER_PATH}:{}),args:['--no-sandbox']});
const errors=[];
async function overflow(page){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no document horizontal overflow');}
try{
  for(const [label,width,height] of [['desktop',1440,1000],['mobile',390,844],['small',320,740]]){
    const page=await browser.newPage({viewport:{width,height}});page.on('pageerror',error=>errors.push(error.message));
    await page.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({contentType:'application/javascript',body:service}));
    await page.goto(base+'#hoje');await page.waitForSelector('.ltsRefEvidenceBrief article');
    assert.match(await page.locator('.ltsRefEvidenceBrief').innerText(),/150 g\/dia.*10 dias/s,'Home uses matching counted observations');
    await overflow(page);await page.locator('.ltsRefEvidenceBrief button').click();
    await page.waitForSelector('#reportEvidenceInsights');
    assert.equal(await page.locator('#reportNutritionSource').inputValue(),'synthetic food a');
    const protein=page.locator('#reportEvidenceInsights .ltsInsightTable').first().locator('tbody tr').first();
    assert.match(await protein.innerText(),/150 g.*10 dias.*100 g.*10 dias.*\+50,0 g/s,'rendered table binds independently known means and counts');
    assert.equal(await page.locator('[data-report-exercise]').count(),8,'load table is paginated, not silently capped');
    await page.locator('[data-report-page="reportLoadPage"]').last().click();
    await page.waitForFunction(()=>document.querySelectorAll('[data-report-exercise]').length===2);
    await page.locator('#analysisPeriod').selectOption('90');
    await page.waitForFunction(()=>document.querySelectorAll('[data-report-exercise]').length===8);
    await page.locator('#reportNutritionSource').selectOption('synthetic food b');
    await page.waitForFunction(()=>document.querySelector('#reportNutritionSource')?.value==='synthetic food b');
    assert.match(await protein.innerText(),/5 dias com valor/s,'source switch recalculates denominators');
    await page.locator('#reportNutritionSource').selectOption('synthetic food a');
    await page.waitForFunction(()=>document.querySelector('#reportNutritionSource')?.value==='synthetic food a');
    await overflow(page);await page.locator('#reportEvidenceInsights').scrollIntoViewIfNeeded();
    await page.screenshot({path:`${dir}/synthetic-${label}-insights.png`,fullPage:false});
    await page.locator('[data-report-exercise]').first().click();await page.waitForSelector('.ltsExerciseHistory');
    assert.match(await page.locator('.ltsExerciseHistory').innerText(),/Synthetic press/,'evidence link opens the actual exercise');
    await overflow(page);
    await page.evaluate(()=>{location.hash='#analise';});await page.waitForSelector('#reportEvidenceInsights');
    await page.evaluate(async()=>{const {state}=await import('./src/core.js');state.domainStatus.sets='error';const {renderUsefulReports}=await import('./src/reports-screen.js');document.querySelector('#screenHost').innerHTML=renderUsefulReports();});
    assert.equal(await page.locator('[data-report-exercise]').count(),0,'failed sets hide stale load comparisons');
    assert.match(await page.locator('#reportEvidenceInsights').innerText(),/comparação de cargas fica bloqueada/);
    await page.close();
  }
  assert.deepEqual(errors,[],'no uncaught errors');
  console.log('Evidence insights production UI: 1440/390/320px, calculated means/counts, source selection, pagination/reset, exercise evidence navigation and partial failures passed.');
}finally{await browser.close();}
