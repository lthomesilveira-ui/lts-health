import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
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
const geometry=[];const directory='evolution-access-visual';mkdirSync(directory,{recursive:true});
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
  assert.equal(await page.locator('.ltsEvolutionOverview .ltsContextLine').count(),0);assert.equal(await page.locator('.ltsEvolutionOverview .ltsEvolutionMark').count(),40);
  assert.equal(await page.locator('[data-evolution-period="12m"]').getAttribute('aria-pressed'),'true');
  const chartGeometry=await page.locator('.ltsEvolutionChart').evaluate(el=>{const r=el.getBoundingClientRect(),nav=document.querySelector('#mobileNav'),n=nav?.getBoundingClientRect(),bottom=n&&n.height>0?n.top:innerHeight;return{top:r.top,bottom:r.bottom,height:r.height,visible:Math.max(0,Math.min(r.bottom,bottom)-Math.max(0,r.top)),viewport:innerHeight};});geometry.push({width,...chartGeometry});writeFileSync(`${directory}/geometry.json`,JSON.stringify(geometry,null,2));assert.ok(chartGeometry.top<500&&chartGeometry.visible/chartGeometry.height>=.65,'at least65% of the recent chart is visible above navigation on entry');
  assert.equal(await page.locator('.ltsEvolutionLegend span').count(),2);
  assert.ok(await page.locator('.ltsEvolutionTick').evaluateAll(nodes=>nodes.every((el,i)=>!i||nodes[i-1].getBoundingClientRect().right<=el.getBoundingClientRect().left+1)),'readable time ticks do not overlap');
  await page.locator('[data-evolution-period="all"]').click();assert.equal(await page.locator('.ltsEvolutionMark').count(),41);
  await page.locator('[data-evolution-point-select]').selectOption(await page.locator('[data-evolution-point-select] option').filter({hasText:'20/03/2021'}).getAttribute('value'));assert.match(await page.locator('.ltsEvolutionReading').innerText(),/20\/03\/2021/);assert.match(await page.locator('.ltsEvolutionReading').innerText(),/90,0/);await page.screenshot({path:`${directory}/selected-observation-${width}.png`});
  await page.locator('[data-evolution-period="6m"]').click();assert.equal(await page.locator('.ltsEvolutionMark').count(),21);
  await page.locator('[data-evolution-period="12m"]').click();assert.equal(await page.locator('.ltsEvolutionMark').count(),40);
  assert.match(await page.locator('.ltsEvolutionReading').innerText(),/01\/09\/2026/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Evolution has no horizontal overflow');await page.screenshot({path:`${directory}/evolution-${width}.png`});
  await page.locator('.ltsEvolutionAccess [data-route="bio"]').click();await page.waitForSelector('[data-composition-overview]');
  assert.match(await page.locator('[data-composition-overview]').innerText(),/41 medições no histórico · 40 nesta janela/);
  assert.equal(await page.locator('[data-depth-period="productCompositionPeriod"][data-value="365"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#productCompositionSource').inputValue(),'all');assert.equal(await page.locator('.ltsCompositionTrend circle').count(),40);assert.equal(await page.locator('.ltsCompositionTrend .ltsDepthLine').count(),0);
  assert.match(await page.locator('.ltsCompositionHeroCompact').innerText(),/01\/09\/2026/);assert.match(await page.locator('.ltsCompositionHeroCompact').innerText(),/86,0/);assert.match(await page.locator('.ltsCompositionHeroCompact').innerText(),/Synthetic historical report/);
  const compositionControls=await page.locator('.ltsCompositionTrend .ltsCompositionTabs button,.ltsCompositionTrend .ltsPeriodControl button').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return{label:el.textContent,width:r.width,height:r.height};}));writeFileSync(`${directory}/composition-controls-${width}.json`,JSON.stringify(compositionControls,null,2));
  assert.ok(compositionControls.every(r=>r.height>=43.5&&r.width>=43.5),`${width}px: Composition metric and window controls retain44px touch targets: `+JSON.stringify(compositionControls));
  const readableComposition=await page.locator('.ltsCompositionHeroTop span,.ltsCompositionHeroTop small,.ltsCompositionMetric span,.ltsCompositionMetric b small,.ltsCompositionTabs button,.ltsPeriodControl button,.ltsCompositionV2 .ltsDepthScale span,.ltsCompositionV2 .ltsDepthAxis span,.ltsCompositionV2 .ltsField,.ltsCompositionV2 .ltsDepthNote,.ltsCompositionHistoryRow time,.ltsCompositionHistoryRow small,.ltsCompositionHistoryRow>span').evaluateAll(nodes=>nodes.filter(el=>el.getClientRects().length).map(el=>({text:el.textContent.slice(0,80),font:parseFloat(getComputedStyle(el).fontSize)})));
  assert.ok(readableComposition.length>15&&readableComposition.every(el=>el.font>=14),`${width}px: dates, units, source labels and measurements remain readable: `+JSON.stringify(readableComposition));
  assert.ok(await page.locator('.ltsCompositionV2 select').evaluateAll(nodes=>nodes.every(el=>parseFloat(getComputedStyle(el).fontSize)>=16)),'phone selects keep readable text without focus zoom');
  if(width<=360)assert.ok(await page.locator('#productCompositionTitle').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'narrow-screen Composition title remains complete');
  const compositionGeometry=await page.locator('.ltsCompositionTrend svg').evaluate(el=>{const r=el.getBoundingClientRect(),n=document.querySelector('#mobileNav')?.getBoundingClientRect(),bottom=n&&n.height>0?n.top:innerHeight;return{kind:'composition',top:r.top,bottom:r.bottom,height:r.height,visible:Math.max(0,Math.min(r.bottom,bottom)-Math.max(0,r.top))};});geometry.push({width,...compositionGeometry});writeFileSync(`${directory}/geometry.json`,JSON.stringify(geometry,null,2));
  await page.screenshot({path:`${directory}/composition-entry-${width}.png`});
  assert.ok(compositionGeometry.top<=450&&compositionGeometry.visible>=150,'Composition starts with a useful recorded chart, not a viewport of context');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Composition controls and values do not overflow');
  await page.locator('[data-depth-period="productCompositionPeriod"][data-value="all"]').click();
  assert.match(await page.locator('[data-composition-overview]').innerText(),/41 medições no histórico · 41 nesta janela/);assert.equal(await page.locator('.ltsCompositionTrend circle').count(),41);assert.equal(await page.locator('.ltsCompositionTrend .ltsDepthLine').count(),0);
  await page.locator('[data-ux-scroll="productCompositionHistory"]').click();assert.equal(await page.evaluate(()=>document.activeElement?.textContent),'Histórico completo');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Body history has no horizontal overflow');await page.screenshot({path:`${directory}/body-history-${width}.png`});
  await page.locator('#productCompositionHistory [data-depth-composition-record="observed-40"]').click();await page.waitForSelector('[data-composition-view="detail"]');assert.match(await page.locator('.ltsHistoryContext').innerText(),/01\/09\/2026/);assert.match(await page.locator('.ltsRecordDetails').first().innerText(),/86,0 kg/);
  assert.ok(await page.locator('.ltsCompositionV2 .ltsDetailGrid span,.ltsCompositionV2 .ltsHistoryContext,.ltsCompositionV2 .ltsHistoryContext b').evaluateAll(nodes=>nodes.every(el=>parseFloat(getComputedStyle(el).fontSize)>=14)),'measurement detail retains readable names, date and source');
  await page.locator('[data-depth-composition-back]').first().click();await page.waitForSelector('[data-composition-overview]');
  await page.locator('[data-depth-period="productCompositionPeriod"][data-value="30"]').click();
  await page.locator('[data-route="evolucao"]:visible').first().click();await page.waitForSelector('.ltsEvolutionOverview');
  await page.locator('[data-evolution-training]').first().click();await page.waitForSelector('.ltsExerciseDirectory');assert.match(await page.locator('.ltsExerciseDirectory').innerText(),/2 exercícios/);
  await page.locator('[data-depth-exercise="exercise-1"]').click();await page.waitForSelector('.ltsExerciseHistory');assert.match(await page.locator('.ltsExerciseHistory').innerText(),/2 ocorrências/);assert.match(await page.locator('.ltsExerciseHistory').innerText(),/4 \+ 1,5 parcial/);assert.equal(await page.locator('.ltsExerciseHistory .ltsDepthLine').count(),0);
  async function assertDenseExercise(name,occurrences,label){
   assert.equal(await page.locator('#productTrainingTitle').innerText(),name);
   assert.match(await page.locator('.ltsExerciseHistoryOverview').innerText(),new RegExp(`${occurrences} ${occurrences===1?'ocorrência':'ocorrências'}`));
   const latest=page.locator('.ltsExerciseSessionLatest');
   assert.equal(await latest.locator('.ltsExerciseRecordedSets li').count(),4);
   assert.match(await latest.innerText(),/3 séries registradas \+ 1 prolong\./);
   assert.match(await latest.innerText(),/17 kg × 11/);assert.match(await latest.innerText(),/31 kg × 4 \+ 1,5 parcial/);assert.match(await latest.innerText(),/Rest-pause/);
   assert.equal((await latest.locator('.ltsExerciseRecordedSets').innerText()).match(/fase não informada/g).length,3);
   assert.equal(await latest.locator('.ltsExerciseRecordedPlot circle').count(),4);
   assert.equal(await page.locator('.ltsExerciseHistory .ltsDepthLine, #productExerciseUnit, #productExercisePoint').count(),0);
   assert.doesNotMatch(await page.locator('.ltsExerciseHistory').innerText(),/Não há pontos numéricos exatos/);
   await page.locator('#productTrainingTitle').scrollIntoViewIfNeeded();
   const reading=await latest.locator('.ltsExerciseRecordedSets li').first().boundingBox();
   const readingBoundary=await page.evaluate(()=>{const nav=document.querySelector('#mobileNav')?.getBoundingClientRect();return nav&&nav.height>0?nav.top:innerHeight;});assert.ok(reading&&reading.y>=0&&reading.y+reading.height<readingBoundary,'first original load/reps are visible above navigation without scrolling past a chart or caution');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Exercise history has no horizontal overflow');
   await page.screenshot({path:`${directory}/${label}-${width}.png`});
  }
  await assertDenseExercise('Synthetic press',2,'exercise-history');
  await page.locator('.ltsRefExerciseNav [data-depth-training-view="progress"]').click();await page.waitForSelector('.ltsExerciseDirectory');
  await page.locator('[data-depth-exercise="single-session-exercise"]').click();await page.waitForSelector('.ltsExerciseHistory');
  await assertDenseExercise('Synthetic single-session press',1,'exercise-history-single');
  await page.locator('.ltsRefExerciseNav [data-depth-training-view="progress"]').click();await page.waitForSelector('.ltsExerciseDirectory');
  await page.locator('[data-depth-exercise="exercise-1"]').click();await page.waitForSelector('.ltsExerciseHistory');
  await page.locator('[data-depth-workout="workout-0"]').click();await page.waitForSelector('[data-workout-id="workout-0"]');
  await page.locator('[data-route="evolucao"]:visible').first().click();await page.waitForSelector('.ltsEvolutionOverview');await page.locator('.ltsEvolutionAccess [data-route="saude"]').click();await page.waitForSelector('#productLabQuery');
  assert.match(await page.locator('.ltsLabsV2').innerText(),/Synthetic marker/);await page.screenshot({path:`${directory}/labs-${width}.png`});
  await page.getByRole('button',{name:'Histórico do marcador',exact:true}).click();
  const labHistory=page.locator('#productLabsHistory .ltsLabsHistoryRow').first();
  assert.ok(await labHistory.isVisible(),'The dated laboratory history remains reachable');
  await page.waitForFunction(()=>{
    const row=document.querySelector('#productLabsHistory .ltsLabsHistoryRow')?.getBoundingClientRect(),host=document.querySelector('#screenHost')?.getBoundingClientRect(),nav=document.querySelector('#mobileNav')?.getBoundingClientRect();
    const bottom=Math.min(innerHeight,host?.bottom??innerHeight,nav?.width>0?nav.top:innerHeight);
    return row&&row.top>=Math.max(0,host?.top??0)&&row.bottom<=bottom+1;
  });
  const historyReading=await labHistory.evaluate(el=>{
    const time=el.querySelector('time'),value=el.querySelector('b'),meta=el.querySelector('small');
    const rect=time.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(time);
    return{dateFont:parseFloat(getComputedStyle(time).fontSize),valueFont:parseFloat(getComputedStyle(value).fontSize),metaFont:parseFloat(getComputedStyle(meta).fontSize),dateLines:range.getClientRects().length,dateFits:time.scrollWidth<=time.clientWidth+1&&rect.left>=0&&rect.right<=innerWidth,rowFits:el.scrollWidth<=el.clientWidth+1};
  });
  assert.ok(historyReading.dateFont>=14&&historyReading.metaFont>=14&&historyReading.valueFont>=16,'Dates, original results and provenance retain readable computed sizes');
  assert.equal(historyReading.dateLines,1,'The full collection date fits on one line');
  assert.ok(historyReading.dateFits&&historyReading.rowFits,'Readable history does not clip dates or create horizontal scrolling');
  await page.screenshot({path:`${directory}/labs-history-${width}.png`});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.deepEqual(await page.evaluate(()=>window.__changesQA.writes),[]);assert.deepEqual(errors,[]);await context.close();
 }
}finally{await browser.close();}
console.log('Actual evolution route: full observed body history, independent window, exact record, unknown-equipment exercise sets, labs entry and no writes at three widths passed.');
