import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium,webkit} from 'playwright';
import {PLAN_TODAY,syntheticPlanData} from '../preview/compact-evidence/tests/training-plan-fixture.mjs';
import {syntheticNutritionPlanRow} from '../preview/compact-evidence/tests/documented-nutrition-plan-fixture.mjs';
import {languageDatabase} from '../preview/compact-evidence/tests/consumer-language-fixture.mjs';
import {sourceWindowService} from '../preview/compact-evidence/tests/source-window-service-fixture.mjs';
const base='http://127.0.0.1:4173/v2/',origin=new URL(base),dir='training-plan-visual',results=[];
mkdirSync(dir,{recursive:true});
for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch({headless:true});
 try{for(const [width,height] of [[320,740],[393,650],[1440,900]]){
  const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block'}),page=await context.newPage(),errors=[],external=[];
  await context.addInitScript(today=>{const NativeDate=Date;window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[today+'T12:00:00Z']));}static now(){return new NativeDate(today+'T12:00:00Z').getTime();}};},PLAN_TODAY);
  const f=syntheticPlanData(),db=languageDatabase(f.data);db.health_documents.push(...f.data.trainingPlans,...f.data.treatmentStatuses,syntheticNutritionPlanRow('2026-01-25'));
  db.health_daily_nutrition=Array.from({length:7},(_,i)=>({source_record_id:'synthetic-food-'+i,nutrition_date:new Date(Date.parse('2026-01-26T12:00:00Z')+i*86400000).toISOString().slice(0,10),source:'Synthetic food',calories_kcal:1800+i*20,protein_g:100+i,carbs_g:200,fat_g:50,fiber_g:20}));
  const sdk=sourceWindowService(db);page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',r=>{const q=r.request(),u=new URL(q.url());if(u.hostname==='cdn.jsdelivr.net'&&u.pathname==='/npm/@supabase/supabase-js@2'&&q.method()==='GET')return r.fulfill({contentType:'application/javascript',body:sdk});if(u.origin===origin.origin&&['GET','HEAD'].includes(q.method()))return r.continue();external.push({method:q.method(),path:u.pathname});return r.abort();});
  const navigate=async route=>{const direct=page.locator(`${width>840?'#primaryNav':'#mobileNav'} [data-route="${route}"]`);if(await direct.count())await direct.click();else{await page.locator('#mobileNav [data-route="mais"]').click();await page.locator(`#moreSheet [data-route="${route}"]`).click();}};
  const fit=async()=>{assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no document overflow');assert.ok(await page.locator('.planReview,.nutritionPlanCard').evaluateAll(els=>els.every(e=>e.scrollWidth<=e.clientWidth+1)),'cards fit');};
  await page.goto(base+'#treinos');await page.waitForSelector('.ltsRefTrainPrimaryTabs');await page.locator('[data-depth-training-view="plan"]').click();await page.waitForSelector('[data-training-plan-state="ready"]');
  assert.equal(await page.locator('.planReviewExercise').count(),2);assert.match(await page.locator('.planReviewExercise').first().innerText(),/2 séries de trabalho/);assert.match(await page.locator('.planReviewExercise').first().innerText(),/10 · 6/);
  await page.locator('#trainingPlanWeek').selectOption('2026-01-26');assert.match(await page.locator('.planReviewFacts article').first().innerText(),/1/);
  await page.locator('#trainingPlanTemplate').selectOption('B');assert.equal(await page.locator('.planReviewExercise').count(),1);await page.locator('[data-disclosure="training-plan-link-B1"] summary').click();await page.locator('#trainingPlanLink-B1').selectOption('synthetic-ex-b');assert.match(await page.locator('.planReviewExercise').innerText(),/1 sem tipo informado/);
  await page.locator('#trainingPlanTemplate').selectOption('A');await page.evaluate(async()=>{const {state}=await import('./src/core.js');state.domainStatus.sets='error';});await page.locator('#trainingPlanTemplate').selectOption('B');assert.match(await page.locator('.planReviewExercise').innerText(),/Séries de trabalho não confirmadas/);
  await page.locator('#trainingPlanTemplate').selectOption('A');await fit();await page.screenshot({path:`${dir}/${engine}-${width}-plan.png`,fullPage:true});
  await navigate('tratamentos');await page.waitForSelector('[data-current-treatment-status="ready"]');assert.equal(await page.locator('.currentTreatmentStatus .planReviewFacts article').count(),3);assert.match(await page.locator('.currentTreatmentStatus').innerText(),/ainda não iniciadas/);assert.match(await page.locator('.currentTreatmentStatus').innerText(),/não registra uma aplicação hoje/);await fit();await page.screenshot({path:`${dir}/${engine}-${width}-status.png`,fullPage:true});
  await navigate('nutricao');await page.waitForSelector('.nutritionPlanExpanded');assert.equal(await page.locator('#nutritionPlanPeriodProduct').inputValue(),'7');assert.equal(await page.locator('[data-plan-metric]').count(),6);assert.ok(await page.locator('[data-plan-metric="protein_g"]').isVisible());assert.equal(await page.locator('[data-nutrition-plan]').getAttribute('data-plan-state'),'ready');
  await page.locator('#nutritionPlanPeriodProduct').selectOption('30');await page.locator('[data-plan-retrospective="true"]').click();await page.waitForSelector('[data-plan-state="ready"]');assert.match(await page.locator('[data-nutrition-plan]').innerText(),/não indica adesão passada/);await page.locator('#nutritionPlanPeriodProduct').selectOption('7');await fit();await page.screenshot({path:`${dir}/${engine}-${width}-nutrition.png`,fullPage:true});
  const proof=await page.evaluate(()=>({writes:window.__historyQA?.writes||[],overflow:document.documentElement.scrollWidth>innerWidth}));assert.deepEqual(proof.writes,[]);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);assert.equal(proof.overflow,false);
  results.push({engine,width,height,trainingPlan:true,explicitMapping:true,unknownPhasePreserved:true,failedSetsWithheld:true,ownerStatement:true,nutritionVisible:true,retrospectiveOptIn:true,zeroWrites:true});await context.close();
 }}finally{await browser.close();writeFileSync(dir+'/results.json',JSON.stringify(results,null,2));}
}
console.log('Training plan story passed in Chromium/WebKit at320/393/1440: actual routing, temporary mapping, failed reads, current-use statement, visible nutrition comparison, historical opt-in and zero writes.');
