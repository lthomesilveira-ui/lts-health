import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {periodReadabilityFixture,today} from './period-readability-fixture.mjs';
import {sourceWindowService} from './source-window-service-fixture.mjs';
import {languageDatabase} from './consumer-language-fixture.mjs';
import {consumerRouteSettled} from './consumer-language-readiness.mjs';
import {healthDashboardModel} from '../src/health-dashboard-model.js';
import {numberLabel} from './health-dashboard-render-test.mjs';
const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/preview/compact-evidence/',origin=new URL(base);
assert.equal(origin.protocol,'http:');assert.ok(['127.0.0.1','localhost','[::1]'].includes(origin.hostname));
assert.ok(['/preview/compact-evidence/','/v2/'].includes(origin.pathname));assert.equal(origin.search,'');
const directory='period-readability-visual',results=[];mkdirSync(directory,{recursive:true});
async function stable(page){
 await page.evaluate(async()=>{if(!window.__languageApp){const{state}=await import('./src/core.js'),{isRouteReady}=await import('./src/data-layer.js');window.__languageApp={state,isRouteReady};}});
 await page.waitForFunction(consumerRouteSettled,{route:'hoje',selector:'[data-health-dashboard]'});
 await page.waitForFunction(()=>{const root=document.querySelector('[data-health-dashboard]'),now=performance.now();if(window.__periodRoot!==root){window.__periodRoot=root;window.__periodRootAt=now;return false;}return now-window.__periodRootAt>600;});
}
async function quality(page){
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no page overflow');
 const clipped=await page.locator('.healthPeriodMetric').evaluateAll(cards=>cards.flatMap(card=>[...card.querySelectorAll('p,strong,summary')].filter(el=>el.checkVisibility({checkVisibilityCSS:true})&&el.scrollWidth>el.clientWidth+1).map(el=>el.textContent)));
 assert.deepEqual(clipped,[],'visible source names, values and warnings are not clipped');
 const small=await page.locator('[data-health-dashboard]').evaluate(root=>[...root.querySelectorAll('button,input,select,summary,[role="button"]')].filter(el=>el.checkVisibility({checkVisibilityCSS:true})&&!el.disabled).map(el=>({text:el.textContent.slice(0,60),width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})).filter(box=>box.width<43.5||box.height<43.5));
 assert.deepEqual(small,[],'all visible actions retain 44px targets');
}
const browser=await chromium.launch({headless:true});
try{
 for(const sparse of [false,true]){
  const f=periodReadabilityFixture({sparse}),sdk=sourceWindowService(languageDatabase(f.data)),context=await browser.newContext({viewport:{width:393,height:650},timezoneId:'America/Sao_Paulo',serviceWorkers:'block'}),page=await context.newPage(),errors=[],blocked=[];
  page.on('pageerror',error=>errors.push(error.message));
  await context.route('**/*',route=>{const request=route.request(),url=new URL(request.url());if(url.hostname==='cdn.jsdelivr.net'&&url.pathname==='/npm/@supabase/supabase-js@2')return route.fulfill({contentType:'application/javascript',body:sdk});if(url.origin===origin.origin&&['GET','HEAD'].includes(request.method()))return route.continue();blocked.push({method:request.method(),origin:url.origin});return route.abort('blockedbyclient');});
  await page.clock.setFixedTime(new Date(today+'T15:00:00Z'));await page.goto(base+'#hoje');await stable(page);
  const model=healthDashboardModel(f.data,f.status,{dashboardPeriod:'7'},today),cards=page.locator('[data-dashboard-card]');
  assert.equal(await cards.count(),7);assert.equal(await page.locator('.healthPeriodContext').count(),1);
  assert.match(await page.locator('.healthWindow').innerText(),/hoje fora das médias/);
  assert.equal(await page.locator('.healthPeriodContext').isVisible(),false);assert.match(await page.locator('.healthPeriodContext').textContent(),/médias usam os dias com registro.*conflitantes.*fora da média/s);
  for(const metric of model.metrics){
   const card=page.locator(`[data-dashboard-card="${metric.key}"]`);
   assert.equal(await card.locator('.healthMetricValue strong').innerText(),numberLabel(metric.value,metric.key));
   assert.equal(await card.locator('.healthCoverage').innerText(),`${metric.count}/${metric.expectedDays} dias usados na média`);
   assert.ok((await card.locator('.healthPeriodSource').textContent()).includes(metric.source.label),'full selected human origin is preserved inside details');
   assert.match(await card.locator('.healthPeriodSource').textContent(),/Automática/);
   assert.equal(await card.locator(':scope > details').evaluate(el=>el.open),false);
   assert.equal(await card.locator(':scope > .healthTodayValue,:scope > .healthMetricPeriod,:scope > .healthAggregation').count(),0);
  }
  assert.match(await page.locator('[data-dashboard-card="activeEnergy"] > .healthSourceCaution').innerText(),/não confirmado/);
  assert.match(await page.locator('[data-dashboard-card="water"]').innerText(),/Último valor desta origem/);
  const steps=page.locator('[data-dashboard-card="steps"]');assert.match(await steps.innerText(),/1 dia em revisão.*1 dia divergente/s);assert.doesNotMatch(await steps.innerText(),/valores fracionados ou inválidos/);
  await quality(page);
  const geometry=await cards.evaluateAll(cards=>cards.map(card=>({key:card.dataset.dashboardCard,height:Math.ceil(card.getBoundingClientRect().height),width:Math.ceil(card.getBoundingClientRect().width)})));
  results.push({sparse,viewport:{width:393,height:650},geometry});writeFileSync(`${directory}/results.json`,JSON.stringify(results,null,2));
  await page.screenshot({path:`${directory}/393-${sparse?'sparse':'dense'}-top.png`});await steps.scrollIntoViewIfNeeded();await page.screenshot({path:`${directory}/393-${sparse?'sparse':'dense'}-steps.png`});
  for(const box of geometry)assert.ok(box.height<=(box.key==='steps'?430:350),`${box.key}: natural height ${box.height}px exceeds ${box.key==='steps'?430:350}px`);
  // Source choice stays explicit across windows; empty choices do not fall back.
  const protein=page.locator('[data-dashboard-card="protein"]'),details=protein.locator(':scope > details');
  await details.locator(':scope > summary').click();assert.equal(await details.evaluate(el=>el.open),true);
  const source=model.metricsByKey.protein.source.key;assert.ok(source);
  await protein.locator('[data-dashboard-source]').selectOption(source);await stable(page);assert.match(await protein.locator('.healthPeriodSource').innerText(),/Escolhida por você/);
  await details.locator(':scope > summary').click();await page.locator('#dashboard-period').selectOption('30');await stable(page);assert.equal(await protein.locator('[data-dashboard-source]').inputValue(),source);
  await page.locator('#dashboard-period').selectOption('7');await stable(page);await details.locator(':scope > summary').click();
  const older=await protein.locator('[data-dashboard-source] option').evaluateAll(options=>options.find(option=>option.textContent.startsWith('Outro diário sintético'))?.value);assert.ok(older);
  await protein.locator('[data-dashboard-source]').selectOption(older);await stable(page);await details.locator(':scope > summary').click();
  assert.equal(await protein.locator('.healthMetricValue strong').innerText(),'—');assert.equal(await details.evaluate(el=>el.open),false);
  assert.match(await details.locator(':scope > summary').innerText(),/Sem valor utilizável nesta origem.*1 outra origem com registros, não somadas.*Ver fontes/s);
  await page.screenshot({path:`${directory}/393-${sparse?'sparse':'dense'}-explicit-empty.png`});
  // The warning itself opens the selector, without guessing a separate action.
  await details.locator(':scope > summary').click();assert.equal(await details.evaluate(el=>el.open),true);
  await protein.locator('[data-dashboard-source]').selectOption('');await stable(page);
  // Current partial values remain reachable inside their original disclosure.
  await protein.locator('.healthTodayValue').click();await stable(page);assert.equal(await page.locator('#dashboard-date').inputValue(),today);
  assert.equal(await page.locator('.healthPeriodMetric').count(),0);assert.equal(await cards.count(),7);
  assert.deepEqual(errors,[]);assert.deepEqual(blocked.filter(request=>!['GET','HEAD'].includes(request.method)),[]);assert.deepEqual(await page.evaluate(()=>window.__historyQA.writes),[]);
  await context.close();
 }
}finally{await browser.close();writeFileSync(`${directory}/results.json`,JSON.stringify(results,null,2));}
console.log('Period readability: exact 393×650 long/sparse fixtures, natural heights, source/validity boundaries, direct disclosure action, today navigation and no writes passed.');
