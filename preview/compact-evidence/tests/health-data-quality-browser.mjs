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
async function audit(page){
 const parent=page.locator('[data-disclosure="dashboard-metric-protein"]');if(await parent.getAttribute('open')===null)await parent.locator(':scope>summary').click();
 const detail=page.locator('[data-coverage-audit="protein"]');if(await detail.getAttribute('open')===null)await detail.locator(':scope>summary').click();
 return detail;
}
async function fit(page){
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page fits');
 const defects=await page.locator('[data-health-dashboard]').evaluate(root=>[...root.querySelectorAll('button,select,summary,input,[role="button"]')].filter(el=>el.checkVisibility({checkVisibilityCSS:true})&&!el.disabled).flatMap(el=>{const b=el.getBoundingClientRect();return b.width>=43.5&&b.height>=43.5?[]:[{text:el.textContent.slice(0,70),width:b.width,height:b.height}];}));
 assert.deepEqual(defects,[],'all opened controls have 44px targets');
 assert.deepEqual(await page.locator('[data-coverage-audit]').evaluateAll(nodes=>nodes.filter(el=>el.scrollWidth>el.clientWidth+1).map(el=>el.dataset.coverageAudit)),[],'daily audit does not clip');
 const cramped=await page.locator('[data-coverage-audit][open] li>span').evaluateAll(nodes=>nodes.filter(el=>el.getBoundingClientRect().width<100).map(el=>({text:el.textContent,width:el.getBoundingClientRect().width})));
 assert.deepEqual(cramped,[],'daily explanations have enough width for words, not a column of individual letters');
}
try{
 for(const [width,height] of [[1536,864],[393,650],[320,740]]){
  const f=makeDashboardFixture();
  for(const row of f.data.nutrition){const age=Math.round((Date.parse(f.today)-Date.parse(row.nutrition_date))/86400000);if(row.source==='Synthetic A food'&&age<3||row.source==='Synthetic B food'&&(age>3||age===0))row.protein_g=null;}
  f.data.sourceMetrics=f.data.sourceMetrics.filter(row=>row.metric_type!=='total_energy_kcal');
  const sdk=sourceWindowService(languageDatabase(f.data)),context=await browser.newContext({viewport:{width,height},timezoneId:'America/Sao_Paulo',serviceWorkers:'block'}),page=await context.newPage(),errors=[],blocked=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',route=>{const r=route.request(),u=new URL(r.url());if(u.hostname==='cdn.jsdelivr.net'&&u.pathname==='/npm/@supabase/supabase-js@2')return route.fulfill({contentType:'application/javascript',body:sdk});if(u.origin===origin.origin&&['GET','HEAD'].includes(r.method()))return route.continue();blocked.push({method:r.method(),origin:u.origin});return route.abort();});
  await page.clock.setFixedTime(new Date(FIXED_TODAY+'T15:00:00Z'));await page.goto(base+'#hoje');await settled(page);await page.locator('#dashboard-period').selectOption('30');await settled(page);
  const card=page.locator('[data-dashboard-card="protein"]');assert.match(await card.locator('.healthCoverage').innerText(),/28\/30/);assert.match(await card.locator('[data-received-coverage]').innerText(),/30\/30/);
  const total=page.locator('[data-dashboard-card="totalEnergy"]');assert.equal(await total.locator('.healthMetricValue strong').innerText(),'—');assert.ok(await total.locator('[data-total-energy-unavailable]').isVisible());
  await fit(page);await card.scrollIntoViewIfNeeded();await page.screenshot({path:`${dir}/${width}-quality-reading.png`});
  let detail=await audit(page);assert.equal(await detail.locator('[data-coverage-date]').count(),30);assert.equal(await detail.locator('[data-coverage-status="other_source"]').count(),2);assert.match(await detail.innerText(),/30\/30 dias com registros recebidos; 28 usados/);await fit(page);
  await detail.scrollIntoViewIfNeeded();await page.screenshot({path:`${dir}/${width}-quality-daily-audit.png`});
  const select=page.locator('[data-dashboard-source="protein"]'),choice=await select.locator('option').evaluateAll(nodes=>nodes.find(node=>node.textContent.includes('Synthetic B food')).value);await select.selectOption(choice);await settled(page);
  assert.match(await card.locator('.healthCoverage').innerText(),/3\/30/);assert.match(await card.locator('[data-received-coverage]').innerText(),/30\/30/);detail=await audit(page);assert.equal(await detail.locator('[data-coverage-status="other_source"]').count(),27);
  await page.locator('#dashboard-period').selectOption('7');await settled(page);assert.match(await card.locator('.healthCoverage').innerText(),/3\/7/);assert.equal(await page.locator('[data-dashboard-source="protein"]').inputValue(),choice,'explicit origin persists across periods');await audit(page);await fit(page);
  await page.locator('[data-dashboard-mode="day"]').click();await settled(page);await audit(page);await fit(page);assert.equal(await page.locator('[data-dashboard-card]').count(),7);
  assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);assert.deepEqual(await page.evaluate(()=>window.__historyQA.writes),[]);results.push({width,height,status:'passed',uniqueReceivedDays:30,selectedDays:28,alternateSelectedDays:3,overlapDays:1,writes:0});await context.close();
 }
 writeFileSync(dir+'/data-quality-results.json',JSON.stringify(results,null,2));console.log('Daily quality browser story passed: 320/393/1536px, split origins, one overlap counted once, 30 received versus 28/3 source days, daily exclusions, explicit selection, period/day and zero writes.');
}finally{await browser.close();}
