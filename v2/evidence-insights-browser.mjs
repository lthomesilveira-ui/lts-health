import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';

// Synthetic service on the integrated production renderer; never a copy of private records.
// Complete technique/effort fields exercise equivalent recorded conditions.
// A separate incomplete-effort case must block the strict comparison, not history.
const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/v2/';
const parsed=new URL(base);assert.equal(parsed.protocol,'http:');assert.ok(['127.0.0.1','localhost'].includes(parsed.hostname),'synthetic gate only targets loopback');assert.equal(parsed.pathname,'/v2/');assert.equal(parsed.search,'','never use fixture mode or a remote source');
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
  db.health_workout_sets.push({source_record_id:`s${i}-${e}`,exercise_source_record_id:`e${i}-${e}`,workout_source_record_id:`w${i}`,workout_date:date(i),phase:'working',weight:i===2?30:20,weight_unit:'kg',reps_numeric:10,source:'Synthetic notes',technique:'Synthetic standard technique',failure:false,near_failure:false});
}
const service=`
window.__insightDb=${JSON.stringify(db)};window.__qaMutations=[];
const mutation=(kind,target)=>{window.__qaMutations.push({kind,target});throw new Error('Synthetic browser gate forbids writes: '+kind+' '+target);};
window.supabase={createClient:()=>({
 auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-user'}}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})},
 functions:{invoke:async(name,args)=>{if(args?.body?.action!=='status')return mutation('invoke',name);return {data:{configured:false,connected:false,received:false},error:null};}},
 rpc:name=>mutation('rpc',name),storage:{from:name=>({upload:()=>mutation('upload',name),remove:()=>mutation('remove',name)})},
 from(table){
  let from=0,to=999;const filters=[],orders=[];
  const rows=()=>{const list=(window.__insightDb[table]||[]).filter(row=>filters.every(([key,value])=>row[key]===value));return list.slice().sort((a,b)=>{for(const[key,ascending]of orders){const c=String(a[key]??'').localeCompare(String(b[key]??''));if(c)return ascending?c:-c;}return 0;});};
  const q={select(){return q;},eq(key,value){filters.push([key,value]);return q;},is(key,value){filters.push([key,value]);return q;},range(a,b){from=a;to=b;return q;},order(key,options={}){orders.push([key,options.ascending!==false]);return q;},limit(n){to=from+n-1;return q;},
   maybeSingle:async()=>({data:rows()[0]||null,error:null}),
   then(resolve,reject){return Promise.resolve({data:window.__failTable===table?null:rows().slice(from,to+1),error:window.__failTable===table?{message:'Synthetic read failure'}:null}).then(resolve,reject);}
  };
  for(const name of ['insert','update','upsert','delete'])q[name]=()=>mutation(name,table);
  return q;
 }
})};`;
const browser=await chromium.launch({headless:true,...(process.env.LTS_BROWSER_PATH?{executablePath:process.env.LTS_BROWSER_PATH}:{}),args:['--no-sandbox']});
const errors=[],external=[];
async function isolate(page){
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.href==='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2')return route.fulfill({contentType:'application/javascript',body:service});
  if(url.origin===parsed.origin&&route.request().method()==='GET')return route.continue();
  external.push({url:url.href,method:route.request().method()});return route.abort();
 });
}
async function stableHome(page){
  await page.waitForFunction(()=>{
    const root=document.querySelector('[data-health-dashboard]');
    if(!root||document.querySelector('#syncText')?.textContent!=='Atualizado'||document.querySelector('#screenHost')?.dataset.productLayoutRoute!=='hoje')return false;
    if(window.__gateHomeRoot!==root){window.__gateHomeRoot=root;window.__gateHomeStableFrames=0;}
    return ++window.__gateHomeStableFrames>=3;
  });
}
async function overflow(page){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no document horizontal overflow');}
try{
  for(const [label,width,height] of [['desktop',1440,1000],['mobile',390,844],['small',320,740]]){
    const page=await browser.newPage({viewport:{width,height}});page.on('pageerror',error=>errors.push(error.message));
    await isolate(page);
    await page.goto(base+'#hoje');await page.waitForSelector('[data-health-dashboard]');await stableHome(page);assert.equal(await page.locator('[data-dashboard-card]').count(),7);assert.equal(await page.locator('[data-preview-readonly-banner]').count(),0);await page.locator('[data-dashboard-mode="period"]').click();await stableHome(page);await page.locator('[data-dashboard-period]').selectOption('90');await stableHome(page);
    assert.equal(await page.locator('.studyCard.body svg').count(),0);assert.match(await page.locator('.studyCard.body').innerText(),/Sem avaliação corporal sem conflito nesta janela/);
    assert.equal(await page.locator('.studyCard.body .studyPair').count(),0,'missing body records cannot create a comparison');
    assert.equal(await page.locator('.studyInsight [data-home-insight-details]').count(),0,'no body pair means no invented interval CTA');
    assert.ok(await page.locator('.studyCard.body [data-route="bio"]').isVisible(),'empty-body hero links to the original assessments');
    await overflow(page);
    // Without a body pair the hero opens Composition. Recovery remains reachable
    // through the existing navigation and keeps the same global calendar.
    await page.locator('.studyCard.body [data-route="bio"]').click();await page.waitForSelector('.ltsCompositionV2 .ltsEmptyCard');
    const nav=width<=840?'#mobileNav':'#primaryNav';
    await page.locator(`${nav} [data-route="analise"]`).click();
    await page.waitForSelector('.ltsUsefulReports');await page.locator('[data-report-section="reportEvidenceInsights"]').click();await page.waitForSelector('#reportEvidenceInsights');
    assert.equal(await page.locator('#analysisPeriod').inputValue(),'90','evidence details retain the Home calendar window');
    assert.equal(await page.locator('#reportNutritionSource').inputValue(),JSON.stringify(['nutrition','synthetic food a','canonical']));
    const protein=page.locator('#reportEvidenceInsights .ltsInsightTable').first().locator('tbody tr').first();
    assert.match(await protein.innerText(),/150 g.*10 dias.*100 g.*10 dias.*\+50,0 g/s,'rendered table binds independently known means and counts');
    assert.equal(await page.locator('[data-report-exercise]').count(),8,'load table is paginated, not silently capped');
    await page.locator('[data-report-page="reportLoadPage"]').last().click();
    await page.waitForFunction(()=>document.querySelectorAll('[data-report-exercise]').length===2);
    await page.locator('#analysisPeriod').selectOption('90');
    await page.waitForFunction(()=>document.querySelectorAll('[data-report-exercise]').length===8);
    await page.waitForTimeout(300); // exercise the compatibility controller's settling pass
    assert.equal(await page.locator('[data-disclosure="report-workspace-routine"]').getAttribute('open'),'','period/pagination and settling preserve the current workspace');
    assert.match(await page.locator('#reportNutritionSource').innerText(),/Synthetic Food B · Histórico alimentar/);
    await page.locator('#reportNutritionSource').selectOption(JSON.stringify(['nutrition','synthetic food b','canonical']));
    assert.equal(await page.locator('#reportNutritionSource').inputValue(),JSON.stringify(['nutrition','synthetic food b','canonical']));
    await page.waitForFunction(()=>document.querySelector('#reportEvidenceInsights .ltsInsightTable tbody tr')?.innerText.includes('5 dias com valor'));
    assert.match(await protein.innerText(),/5 dias com valor/s,'source switch recalculates denominators');
    assert.match(await page.locator('#reportNutritionSource').innerText(),/Synthetic Food A · Histórico alimentar/);
    await page.locator('#reportNutritionSource').selectOption(JSON.stringify(['nutrition','synthetic food a','canonical']));
    assert.equal(await page.locator('#reportNutritionSource').inputValue(),JSON.stringify(['nutrition','synthetic food a','canonical']));
    await page.waitForFunction(()=>document.querySelector('#reportEvidenceInsights .ltsInsightTable tbody tr')?.innerText.includes('10 dias com valor'));
    await overflow(page);await page.evaluate(()=>document.querySelector('#reportNutritionSource').scrollIntoView({block:'center'}));
    await page.screenshot({path:`${dir}/synthetic-${label}-insights.png`,fullPage:false});
    await page.locator('[data-report-exercise]').first().click();await page.waitForSelector('.ltsExerciseHistory');
    assert.match(await page.locator('.ltsExerciseHistory').innerText(),/Synthetic press/,'evidence link opens the actual exercise');
    await overflow(page);
    await page.evaluate(()=>{location.hash='#analise';});await page.waitForSelector('.ltsUsefulReports');await page.locator('[data-report-section="reportEvidenceInsights"]').click();await page.waitForSelector('#reportEvidenceInsights');
    await page.evaluate(async()=>{const {state}=await import('./src/core.js');state.data.sets=state.data.sets.map(row=>({...row,failure:null}));const {renderUsefulReports}=await import('./src/reports-screen.js');document.querySelector('#screenHost').innerHTML=renderUsefulReports();});
    await page.locator('[data-report-section="reportEvidenceInsights"]').click();
    assert.equal(await page.locator('[data-report-exercise]').count(),0,'incomplete effort cannot create a strict comparison');
    assert.match(await page.locator('#reportEvidenceInsights').innerText(),/Não há duas sessões com condições registradas equivalentes/);
    assert.equal(await page.evaluate(async()=>{const {state}=await import('./src/core.js');return state.data.sets.length;}),20,'incomplete evidence remains in the source history');
    await page.evaluate(async()=>{const {state}=await import('./src/core.js');state.domainStatus.sets='error';const {renderUsefulReports}=await import('./src/reports-screen.js');document.querySelector('#screenHost').innerHTML=renderUsefulReports();});
    await page.locator('[data-report-section="reportEvidenceInsights"]').click();
    assert.equal(await page.locator('[data-report-exercise]').count(),0,'failed sets hide stale load comparisons');
    assert.match(await page.locator('#reportEvidenceInsights').innerText(),/comparação de cargas fica bloqueada/);
    assert.deepEqual(await page.evaluate(()=>window.__qaMutations),[],'synthetic navigation and inspection perform no writes');
    await page.close();
  }
  assert.deepEqual(external,[],'all unexpected external requests are blocked');assert.deepEqual(errors,[],'no uncaught errors');
  console.log('Evidence insights integrated production UI: 1440/390/320px, calculated means/counts, source selection, pagination/reset, exercise evidence navigation and partial failures passed.');
}finally{await browser.close();}
