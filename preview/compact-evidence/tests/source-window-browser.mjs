import {sourceWindowService} from './source-window-service-fixture.mjs';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium,webkit} from 'playwright';
import {languageDatabase} from './consumer-language-fixture.mjs';
import {consumerRouteSettled} from './consumer-language-readiness.mjs';
// Invented origin switch only. Real startup, loopback transport, no private inputs.
const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/preview/compact-evidence/';
const origin=new URL(base);assert.equal(origin.protocol,'http:');assert.ok(['localhost','127.0.0.1','[::1]'].includes(origin.hostname));
assert.ok(['/preview/compact-evidence/','/v2/'].includes(origin.pathname));assert.equal(origin.search,'');
const today='2026-10-24',data={nutrition:[]};
for(let day=1;day<=24;day++)data.nutrition.push({source_record_id:`synthetic-window-${day}`,nutrition_date:`2026-10-${String(day).padStart(2,'0')}`,source:day<19?'Origin A':'Origin B',protein_g:day<19?100:200,calories_kcal:day<19?1000:2000,water_ml:day<19?1000:2000});
const sdk=sourceWindowService(languageDatabase(data)),directory='source-window-visual',results=[];mkdirSync(directory,{recursive:true});
async function stable(page,route='hoje'){
 await page.evaluate(async()=>{if(window.__languageApp)return;const {state}=await import('./src/core.js'),{isRouteReady}=await import('./src/data-layer.js');window.__languageApp={state,isRouteReady};});
 await page.waitForFunction(consumerRouteSettled,{route,selector:route==='hoje'?'[data-health-dashboard]':'#calendarReport'});
 // Compatibility polling may repaint once after route-ready. Wait for a stable root.
 await page.waitForFunction(selector=>{const root=document.querySelector(selector),now=performance.now();if(window.__windowRoot!==root){window.__windowRoot=root;window.__windowRootAt=now;return false;}return now-window.__windowRootAt>600;},route==='hoje'?'[data-health-dashboard]':'#calendarReport');
}
async function sourceKey(page,scope,label){return page.locator(`#${scope}-source-protein option`).evaluateAll((options,label)=>options.find(option=>option.textContent.startsWith(label+' ·'))?.value,label);}
async function chooseDashboardSource(page,key,value){
 const details=page.locator(`[data-disclosure="dashboard-metric-${key}"]`),wasOpen=await details.evaluate(element=>element.open);
 if(!wasOpen)await details.locator(':scope > summary').click();
 await page.locator(`#dashboard-source-${key}`).selectOption(value);await stable(page);
 if(!wasOpen)await details.locator(':scope > summary').click();
}
async function geometry(page){return page.locator('.healthMetricGrid').evaluate(grid=>({columns:getComputedStyle(grid).gridTemplateColumns,cards:[...grid.querySelectorAll('[data-dashboard-card]')].map(card=>({key:card.dataset.dashboardCard,width:Math.round(card.getBoundingClientRect().width),height:Math.round(card.getBoundingClientRect().height)}))}));}
async function quality(page,selector){
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal page overflow');
 const root=page.locator(selector);assert.doesNotMatch(await root.innerText(),/\b(?:NaN|undefined|Infinity)\b/);
 const tiny=await root.evaluate(root=>[...root.querySelectorAll('select,button,input,summary')].filter(el=>!el.disabled&&el.checkVisibility({checkVisibilityCSS:true})).map(el=>({id:el.id,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})).filter(rect=>rect.width<43.5||rect.height<43.5));
 assert.deepEqual(tiny,[],'visible controls retain touch target sizes');
}
for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch({headless:true});
 try{
  for(const [width,height] of engine==='chromium'?[[393,650],[1280,900]]:[[393,650]]){
   const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),errors=[],blocked=[];
   page.on('pageerror',error=>errors.push(error.message));
   await context.route('**/*',route=>{const request=route.request(),url=new URL(request.url());if(url.hostname==='cdn.jsdelivr.net'&&url.pathname==='/npm/@supabase/supabase-js@2')return route.fulfill({contentType:'application/javascript',body:sdk});if(url.origin===origin.origin&&['GET','HEAD'].includes(request.method()))return route.continue();blocked.push({method:request.method(),origin:url.origin});return route.abort('blockedbyclient');});
   await page.clock.setFixedTime(new Date(today+'T15:00:00Z'));await page.goto(base+'#hoje');await stable(page);
   await page.locator('[data-dashboard-mode="day"]').click();await stable(page);
   assert.equal(await page.locator('[data-dashboard-card]').count(),7);
   const baseline=await geometry(page);assert.equal(await page.locator('[data-dashboard-card] > .healthSourceWindow').count(),0,'daily grid does not gain expanded source controls');
   const dayNames=await page.locator('[data-dashboard-card] h2').allTextContents();assert.equal(dayNames.length,7);assert.deepEqual(new Set(await page.locator('[data-dashboard-card]').evaluateAll(cards=>cards.map(card=>card.dataset.dashboardCard))),new Set(['water','protein','energy','activeEnergy','totalEnergy','steps','sleep']));
   await quality(page,'[data-health-dashboard]');await page.screenshot({path:`${directory}/${engine}-${width}-day.png`});
   await page.locator('[data-dashboard-mode="period"]').click();await stable(page);await page.locator('#dashboard-period').selectOption('7');await stable(page);
   const card=page.locator('[data-dashboard-card="protein"]');assert.match(await card.innerText(),/5\/7 dias usados/);assert.equal(await card.locator('.healthMetricValue strong').innerText(),'200');assert.match(await card.locator('.healthPeriodSource').innerText(),/Origin B.*Automática/s);
   const originA=await sourceKey(page,'dashboard','Origin A'),originB=await sourceKey(page,'dashboard','Origin B');assert.ok(originA&&originB);
   await page.locator('#dashboard-period').selectOption('90');await stable(page);assert.match(await card.innerText(),/18\/90 dias usados/);assert.equal(await card.locator('.healthMetricValue strong').innerText(),'100');assert.match(await card.locator('.healthPeriodSource').innerText(),/Origin A.*Automática/s);assert.match((await card.locator('#dashboard-source-protein option').allTextContents()).join(' '),/Origin B.*5\/90/s);
   await quality(page,'[data-health-dashboard]');await card.scrollIntoViewIfNeeded();await page.screenshot({path:`${directory}/${engine}-${width}-period90.png`});
   await page.locator('#dashboard-period').selectOption('7');await stable(page);assert.equal(await card.locator('.healthMetricValue strong').innerText(),'200');
   await chooseDashboardSource(page,'protein',originB);await page.locator('#dashboard-period').selectOption('90');await stable(page);assert.equal(await card.locator('.healthMetricValue strong').innerText(),'200');assert.match(await card.innerText(),/5\/90 dias usados/);assert.match(await card.locator('.healthPeriodSource').innerText(),/Escolhida por você/);
   // Calendar inherits explicit dashboard choice; never silently replaces it.
   await page.evaluate(()=>location.hash='#analise');await stable(page,'analise');
   await page.locator('#calendarReport .ltsCalendarFullDetails > summary').click();await stable(page,'analise');
   const week=page.locator('[data-calendar-metric="protein"]');assert.match(await week.innerText(),/0\/7 dias encerrados/);assert.match(await week.innerText(),/Há registros em outra origem/);assert.match((await week.locator('#calendar-source-protein option').allTextContents()).join(' '),/Origin A.*7\/7/s);
   await quality(page,'#calendarReport');await week.locator('.ltsCalendarMetricValue').evaluate(element=>element.scrollIntoView({block:'center'}));await page.screenshot({path:`${directory}/${engine}-${width}-explicit-empty.png`});
   await page.locator('#calendar-source-protein').selectOption('');await stable(page,'analise');assert.match(await week.innerText(),/7\/7 dias encerrados/);assert.equal(await week.locator('.ltsCalendarMetricValue').innerText(),'100 g');assert.match(await week.innerText(),/Origin A.*Automática/s);
   assert.match(await week.locator('.ltsCalendarComparison').innerText(),/100 g → 100 g/,'same-origin comparison, not pooled values');
   await week.locator('.ltsCalendarMetricValue').evaluate(element=>element.scrollIntoView({block:'center'}));await page.screenshot({path:`${directory}/${engine}-${width}-week12-18.png`});
   await page.evaluate(()=>location.hash='#hoje');await stable(page);await chooseDashboardSource(page,'protein','');await page.locator('[data-dashboard-mode="day"]').click();await stable(page);
   assert.deepEqual(await geometry(page),baseline,'return to Dia preserves seven-card layout and dimensions');
   assert.equal(await page.locator('[data-dashboard-card] > .healthSourceWindow').count(),0);await quality(page,'[data-health-dashboard]');
   await page.locator('[data-disclosure="dashboard-metric-protein"] > summary').click();await stable(page);assert.match((await page.locator('#dashboard-source-protein option').allTextContents()).join(' '),/Origin B.*1\/1 dias/,'today value counts as one recorded day without entering means');
   assert.deepEqual(errors,[]);assert.deepEqual(blocked.filter(request=>!['GET','HEAD'].includes(request.method)),[]);
   assert.equal(await page.evaluate(()=>Boolean(window.__historyQA)),true,'synthetic write guard active');const writes=await page.evaluate(()=>window.__historyQA.writes);assert.deepEqual(writes,[]);
   results.push({engine,width,height,automaticWindowSwitch:true,explicitOriginPreserved:true,explicitEmptyExplained:true,weeklyRecovered:true,dailyGridPreserved:true,syntheticOnly:true});await context.close();
  }
 }finally{await browser.close();writeFileSync(`${directory}/results.json`,JSON.stringify(results,null,2));}
}
console.log('Source/window browser acceptance passed: generic automatic/explicit flows, weekly coverage, mobile daily grid and no writes.');
