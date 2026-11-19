import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {makeDashboardFixture,FIXED_TODAY} from './health-dashboard-render-test.mjs';
import {sourceWindowService} from './source-window-service-fixture.mjs';
import {languageDatabase} from './consumer-language-fixture.mjs';
import {consumerRouteSettled} from './consumer-language-readiness.mjs';
const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/v2/',origin=new URL(base),dir='health-cockpit-visual';
assert.equal(origin.protocol,'http:');assert.ok(['127.0.0.1','localhost'].includes(origin.hostname));mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true}),results=[];
async function settled(page){
 await page.evaluate(async()=>{if(!window.__languageApp){const {state}=await import('./src/core.js'),{isRouteReady}=await import('./src/data-layer.js');window.__languageApp={state,isRouteReady};}});
 await page.waitForFunction(consumerRouteSettled,{route:'hoje',selector:'[data-health-cockpit]'});
}
async function quality(page){
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page fits width');
 const geometry=await page.locator('[data-health-dashboard]').evaluate(root=>({width:root.clientWidth,scroll:root.scrollWidth}));
 assert.ok(geometry.scroll<=geometry.width+1,`dashboard fits its own content width: ${JSON.stringify(geometry)}`);
 const defects=await page.locator('[data-health-dashboard]').evaluate(root=>[...root.querySelectorAll('button,input,select,summary,[role="button"]')].filter(el=>el.checkVisibility({checkVisibilityCSS:true})&&!el.disabled).flatMap(el=>{const b=el.getBoundingClientRect();return b.width>=43.5&&b.height>=43.5?[]:[{text:el.textContent.trim().slice(0,60),width:b.width,height:b.height}];}));
 assert.deepEqual(defects,[],'all visible actions have a 44px target');
 const clipped=await page.locator('.healthCockpitSummaryCard,.healthCockpitPanel,.healthMetric').evaluateAll(nodes=>nodes.filter(el=>el.scrollWidth>el.clientWidth+1).map(el=>({class:el.className,text:el.textContent.slice(0,80)})));
 assert.deepEqual(clipped,[],'readings do not clip');
 const smallContext=await page.locator('.healthCockpitSummaryContext,.healthCockpitSummaryCard>small,.healthCockpitPriorities p,.healthCockpitNote,.healthCockpitBody dt,.healthCockpitBody small,.healthCockpitLastSession>span,.healthCockpitTrainingChart span').evaluateAll(nodes=>nodes.filter(el=>el.checkVisibility({checkVisibilityCSS:true})&&parseFloat(getComputedStyle(el).fontSize)<14).map(el=>({class:el.className,font:getComputedStyle(el).fontSize})));
 assert.deepEqual(smallContext,[],'dates, mean coverage, caveats and chart dates remain readable at every viewport');
 const text=await page.locator('[data-health-dashboard]').innerText();assert.doesNotMatch(text,/\b(?:undefined|NaN|Infinity|canonical_status|source_record_id|payload|fail.closed)\b/);
}
try{
 for(const [width,height] of [[1536,864],[393,650],[320,740]])for(const sparse of [false,true]){
  const f=makeDashboardFixture(FIXED_TODAY,{sparse});
  const todayId='synthetic-current-day-strength';
  f.data.workouts.push({source_record_id:todayId,workout_date:FIXED_TODAY,workout_type:'Treino sintético de hoje',location:'Academia de teste',duration_minutes:32,is_canonical:true,record_status:'validated'});
  // Realistic gap: other data exists after the last genuine water observation.
  for(const row of f.data.nutrition)row.water_ml=null;
  const sdk=sourceWindowService(languageDatabase(f.data)),context=await browser.newContext({viewport:{width,height},timezoneId:'America/Sao_Paulo',serviceWorkers:'block'}),page=await context.newPage(),errors=[],blocked=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',route=>{const r=route.request(),u=new URL(r.url());if(u.hostname==='cdn.jsdelivr.net'&&u.pathname==='/npm/@supabase/supabase-js@2')return route.fulfill({contentType:'application/javascript',body:sdk});if(u.origin===origin.origin&&['GET','HEAD'].includes(r.method()))return route.continue();blocked.push({method:r.method(),origin:u.origin});return route.abort();});
  await page.clock.setFixedTime(new Date(FIXED_TODAY+'T15:00:00Z'));await page.goto(base+'#hoje');await settled(page);
  const todayButton=page.getByRole('region',{name:'Treinos de hoje'}).getByRole('button',{name:/Treino sintético de hoje/});
  assert.equal(await todayButton.getAttribute('data-home-workout'),todayId);
  await todayButton.click();await page.locator('#productTrainingTitle').waitFor();
  assert.equal(await page.evaluate(async()=>{const {state}=await import('./src/core.js');return state.ui.openWorkout;}),todayId);
  await page.goto(base+'#hoje');await settled(page);
  assert.equal(await page.locator('[data-cockpit-summary]').count(),5);assert.equal(await page.locator('[data-cockpit-panel]').count(),3);
  assert.equal(await page.locator('[data-dashboard-card]:visible').count(),7,'daily readings are preserved');
  const firstItems=await page.locator('.healthReadingGrid').evaluate(grid=>[...grid.children].slice(0,3).map(item=>item.dataset.dashboardCard||item.dataset.cockpitPanel));
  assert.deepEqual(firstItems,['water','protein','training']);
  const report=page.getByRole('heading',{name:'Visão geral',exact:true}).locator('..').getByRole('button',{name:'Relatórios de saúde'});
  assert.equal(await report.isVisible(),true);
  const positions=await page.locator('[data-health-dashboard]').evaluate(root=>{
   const top=selector=>root.querySelector(selector).getBoundingClientRect().top;
   return {readings:top('.healthReadingGrid'),alerts:top('.healthCockpitPriorities'),protein:top('[data-dashboard-card="protein"]'),water:top('[data-dashboard-card="water"]')};
  });
  assert.ok(positions.readings<positions.alerts&&Math.abs(positions.water-positions.protein)<2,'water and protein share the top row before alerts');
  assert.match(await page.locator('.healthCockpitPriorities').innerText(),/Água sem atualização/);
  assert.equal(await page.locator('[data-disclosure="cockpit-details"]').getAttribute('open'),null);
  assert.equal(await page.locator('.healthPeriodContext').isVisible(),false,'source-selection algorithm is secondary');
  assert.equal(await page.locator('[data-cockpit-panel="body"]').locator('dl').count(),1,'last known body state is present even outside short period');
  await quality(page);await page.screenshot({path:`${dir}/${width}-${sparse?'sparse':'full'}-opening.png`});
  for(const [name,selector] of [['body','[data-cockpit-panel="body"]'],['training','[data-cockpit-panel="training"]'],['labs','[data-cockpit-panel="labs"]'],['metrics','[data-dashboard-card="protein"]']]){await page.locator(selector).scrollIntoViewIfNeeded();await page.screenshot({path:`${dir}/${width}-${sparse?'sparse':'full'}-${name}.png`});}
  if(width>840){const boxes=await page.locator('[data-cockpit-summary]').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().top));assert.ok(Math.max(...boxes)-Math.min(...boxes)<2,'five domains share the first row');const priorityWidth=await page.locator('.healthCockpitPriorities>div').evaluate(root=>({right:root.getBoundingClientRect().right,last:root.lastElementChild?.getBoundingClientRect().right}));assert.ok(Math.abs(priorityWidth.right-priorityWidth.last)<2,'available priorities fill the desktop row without an empty column');}
  else {const rail=page.locator('.healthCockpitSummary');assert.ok(await rail.evaluate(el=>el.scrollWidth>el.clientWidth),'mobile panorama is a horizontal rail, not a long stack');await quality(page);}
  await page.locator('[data-disclosure="cockpit-details"]>summary').click();assert.ok(await page.locator('.healthContextGrid').isVisible());assert.ok(await page.locator('[data-dashboard-change-domain="body"]').isVisible());await quality(page);
  await page.locator('[data-dashboard-mode="day"]').click();await settled(page);assert.equal(await page.locator('[data-dashboard-card]').count(),7);await quality(page);await page.locator('.studyHeading').scrollIntoViewIfNeeded();await page.screenshot({path:`${dir}/${width}-${sparse?'sparse':'full'}-day.png`});
  await page.locator('[data-dashboard-mode="period"]').click();await settled(page);await page.locator('#dashboard-period').selectOption('90');await settled(page);await quality(page);
  const source=page.locator('[data-disclosure="dashboard-metric-protein"]>summary');await source.click();assert.ok(await page.locator('[data-dashboard-source="protein"]').isVisible(),'source choice remains reachable');
  const workout=page.locator('[data-cockpit-panel="training"] [data-home-workout]');if(await workout.count()){const id=await workout.getAttribute('data-home-workout');await workout.click();await page.locator('#productTrainingTitle').waitFor();assert.equal(await page.evaluate(async()=>{const {state}=await import('./src/core.js');return state.ui.openWorkout;}),id,'workout action opens the exact selected session');}
  if(!sparse){
   const areas=[
    ['nutricao','.nutritionIntake','.nutritionIntake','.nutritionPlanSource'],
    ['timeline','#timelineDomain','.timelineGroups','.timelineAreaTotals'],
    ['tratamentos','[data-latest-applications]','[data-latest-applications]','.protocolSummaryGrid'],
    ['analise','#calendarReport','.ltsCalendarHeading','.ltsReportHistory'],
    ['dados','[data-connections]','[data-connections]','.dataActions']
   ];
   for(const [route,selector,lead,detail] of areas){
    await page.goto(base+'#'+route);
    await page.waitForFunction(consumerRouteSettled,{route,selector});
    assert.ok(await page.locator(lead).first().isVisible(),route+' lead is visible');
    const layout=await page.evaluate(([a,b])=>{
     const first=document.querySelector(a),second=document.querySelector(b);
     return {first:first.getBoundingClientRect().top,second:second.getBoundingClientRect().top,fits:document.documentElement.scrollWidth<=innerWidth+1};
    },[lead,detail]);
    assert.ok(layout.first<layout.second,route+' presents results before detail');
    assert.ok(layout.fits,route+' fits viewport width '+width);
    if(route==='nutricao'){
     assert.deepEqual(await page.locator('.nutritionIntake dt').allTextContents(),['Água','Proteína','Energia']);
     await page.locator('[data-period="30"]').click();
     await page.waitForFunction(()=>document.querySelector('.ltsNutritionProduct [data-period="30"]')?.getAttribute('aria-pressed')==='true');
    }
    if(route==='timeline'){await page.locator('.timelineAreaTotals summary').click();assert.ok(await page.locator('.timelineAreaTotals').evaluate(el=>el.open));}
   }
  }
  assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);assert.deepEqual(await page.evaluate(()=>window.__historyQA.writes),[]);
  results.push({width,height,sparse,status:'passed'});await context.close();
 }
 writeFileSync(dir+'/results.json',JSON.stringify(results,null,2));console.log('Cockpit browser story passed: six responsive full/sparse cases, actual values, source access, details, day/period and workout drilldown.');
}finally{await browser.close();}
