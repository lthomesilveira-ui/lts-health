import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {evolutionAccessFixture,TODAY} from './evolution-access-fixture.mjs';
// Synthetic, loopback-only acceptance of the real module routes. No real login,
// private records, Supabase traffic, integration calls or persisted mutations.
const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/preview/compact-evidence/';
const origin=new URL(base);assert.ok(['127.0.0.1','localhost','[::1]'].includes(origin.hostname));
assert.ok(['/preview/compact-evidence/','/v2/'].includes(origin.pathname));assert.equal(origin.search,'');
const f=evolutionAccessFixture(),tables={body:'health_body_composition',labs:'health_lab_results',workouts:'health_workouts',exercises:'health_workout_exercises',sets:'health_workout_sets',nutrition:'health_daily_nutrition',goals:'health_personal_goals',docs:'health_documents'};
const db=Object.fromEntries(Object.entries(tables).map(([key,table])=>[table,f.data[key]]));
const sdk=`window.__changesQA={writes:[],calls:[]};window.supabase={createClient:()=>({
 auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-changes-user'}}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
 from(table){let start=0,end=999;const filters=[];const rows=()=>(${JSON.stringify(db)}[table]||[]).filter(r=>filters.every(([k,v])=>r[k]===v));const q={select(){return q},eq(k,v){filters.push([k,v]);return q},is(k,v){filters.push([k,v]);return q},order(){return q},range(a,b){start=a;end=b;return q},limit(n){end=start+n-1;return q},maybeSingle:async()=>({data:rows()[0]||null,error:null}),then(resolve,reject){if(table==='health_lab_results'&&window.__pauseEvolutionLabs){window.__evolutionLabsRequested=true;return new Promise(done=>window.__releaseEvolutionLabs=done).then(()=>({data:rows().slice(start,end+1),error:null})).then(resolve,reject)}return Promise.resolve({data:rows().slice(start,end+1),error:null}).then(resolve,reject)}};for(const op of ['insert','update','upsert','delete'])q[op]=()=>{window.__changesQA.writes.push(op);throw Error('No writes')};return q},
 functions:{invoke(name,options){window.__changesQA.calls.push([name,options?.body?.action]);if(options?.body?.action==='status')return Promise.resolve({data:{configured:false,connected:false},error:null});window.__changesQA.writes.push(name);throw Error('No integration mutation')}},
 rpc(){window.__changesQA.writes.push('rpc');throw Error('No writes')}})};`;
const directory='evolution-access-visual';mkdirSync(directory,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 for(const width of [320,393,1280]){
  const context=await browser.newContext({viewport:{width,height:650}}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await context.route('**/*',route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.hostname==='cdn.jsdelivr.net'&&url.pathname==='/npm/@supabase/supabase-js@2')return route.fulfill({contentType:'application/javascript',body:sdk});
   if(url.origin===origin.origin&&['GET','HEAD'].includes(req.method()))return route.continue();return route.abort('blockedbyclient');
  });
  await page.clock.install({time:new Date(TODAY+'T15:00:00Z')});await page.addInitScript(()=>window.__pauseEvolutionLabs=true);await page.goto(base+'#evolucao');await page.waitForFunction(()=>window.__evolutionLabsRequested);await page.waitForSelector('.loadingState');assert.equal(await page.locator('.ltsEvolutionOverview').count(),0,'pending labs cannot appear as zero results');await page.evaluate(()=>{window.__pauseEvolutionLabs=false;window.__releaseEvolutionLabs();});await page.waitForSelector('.ltsEvolutionOverview');await page.locator('.ltsEvolutionOverview [data-route="hoje"]').click();await page.waitForSelector('[data-dashboard-card]');
  const nav=width<900?'#mobileNav':'#sideNav';
  // The labelled Evolução destination must open evolution, never Recovery.
  const evolution=page.locator('[data-route="evolucao"]:visible').first();await evolution.click();await page.waitForSelector('.ltsEvolutionOverview');
  assert.equal(new URL(page.url()).hash,'#evolucao');assert.equal(await page.locator((width<900?'#mobileNav':'#primaryNav')+' [data-route].active').count(),1,'only the actual Evolution destination is active');assert.match(await page.locator('.ltsEvolutionOverview').innerText(),/41 medições preservadas/);
  assert.equal(await page.locator('.ltsEvolutionOverview .ltsContextLine').count(),0);assert.equal(await page.locator('.ltsEvolutionOverview circle').count(),41);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Evolution has no horizontal overflow');await page.screenshot({path:`${directory}/evolution-${width}.png`});
  await page.locator('.ltsEvolutionAccess [data-route="bio"]').click();await page.waitForSelector('[data-composition-overview]');
  assert.match(await page.locator('[data-composition-overview]').innerText(),/41 medições no histórico · 41 nesta janela/);
  assert.equal(await page.locator('#productCompositionSource').inputValue(),'all');assert.equal(await page.locator('.ltsCompositionTrend circle').count(),41);assert.equal(await page.locator('.ltsCompositionTrend .ltsDepthLine').count(),0);
  await page.locator('[data-ux-scroll="productCompositionHistory"]').click();assert.equal(await page.evaluate(()=>document.activeElement?.textContent),'Histórico completo');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Body history has no horizontal overflow');await page.screenshot({path:`${directory}/body-history-${width}.png`});
  await page.locator('#productCompositionHistory [data-depth-composition-record="observed-40"]').click();await page.waitForSelector('[data-composition-view="detail"]');assert.match(await page.locator('.ltsHistoryContext').innerText(),/01\/09\/2026/);assert.match(await page.locator('.ltsRecordDetails').first().innerText(),/86,0 kg/);
  await page.locator('[data-depth-composition-back]').first().click();await page.waitForSelector('[data-composition-overview]');
  await page.locator('[data-depth-period="productCompositionPeriod"][data-value="30"]').click();
  await page.locator('[data-route="evolucao"]:visible').first().click();await page.waitForSelector('.ltsEvolutionOverview');
  await page.locator('[data-evolution-training]').first().click();await page.waitForSelector('.ltsExerciseDirectory');assert.match(await page.locator('.ltsExerciseDirectory').innerText(),/1 exercícios/);
  await page.locator('[data-depth-exercise="exercise-1"]').click();await page.waitForSelector('.ltsExerciseHistory');assert.match(await page.locator('.ltsExerciseHistory').innerText(),/2 ocorrências/);assert.match(await page.locator('.ltsExerciseHistory').innerText(),/4 \+ 1,5 parcial/);assert.equal(await page.locator('.ltsExerciseHistory .ltsDepthLine').count(),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Exercise history has no horizontal overflow');await page.screenshot({path:`${directory}/exercise-history-${width}.png`});
  await page.locator('[data-depth-workout="workout-0"]').click();await page.waitForSelector('[data-workout-id="workout-0"]');
  await page.locator('[data-route="evolucao"]:visible').first().click();await page.waitForSelector('.ltsEvolutionOverview');await page.locator('.ltsEvolutionAccess [data-route="saude"]').click();await page.waitForSelector('#productLabQuery');
  assert.match(await page.locator('.ltsLabsV2').innerText(),/Synthetic marker/);await page.screenshot({path:`${directory}/labs-${width}.png`});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.deepEqual(await page.evaluate(()=>window.__changesQA.writes),[]);assert.deepEqual(errors,[]);await context.close();
 }
}finally{await browser.close();}
console.log('Actual evolution route: full observed body history, independent window, exact record, unknown-equipment exercise sets, labs entry and no writes at three widths passed.');
