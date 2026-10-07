import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
const origin=process.env.LTS_TEST_ORIGIN||'http://127.0.0.1:4173';
const evidenceDir='v2/public-audit-evidence';mkdirSync(evidenceDir,{recursive:true});
const browser=await chromium.launch({headless:true});
async function renderReference(page,period='all',metric='weight_kg'){
 await page.evaluate(async({period,metric})=>{
  const core=await import('./src/core.js');const home=await import('./src/home-reference.js');
  core.state.data=core.fixtureData();core.state.loaded=true;core.state.route='hoje';core.state.ui.homePeriod=period;core.state.ui.homeBodyMetric=metric;
  core.state.domainStatus=Object.fromEntries(['body','segmental','workouts','workoutEvidence','exercises','sets','nutrition','labs','docs','metrics','sourceMetrics','treatments','regimens','goals','meals'].map(k=>[k,'ready']));
  document.body.dataset.productRoute='hoje';document.querySelector('#screenHost').innerHTML=home.renderProductHomeReference();document.querySelector('#screenHost').scrollTop=0;
 },{period,metric});
}
try{
 for(const [label,width,height] of [['desktop',1440,900],['mobile',393,852]]){
  const page=await browser.newPage({viewport:{width,height}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${origin}/?fixture=1#hoje`,{waitUntil:'domcontentloaded'});await page.waitForSelector('#app:not(.hidden)');await renderReference(page);
  assert.equal(await page.locator('.ltsExecutiveCard').count(),5);
  assert.equal(await page.locator('.ltsCockpitPanel').count(),6);
  assert.equal(await page.locator('.ltsRefProgress,.ltsRefDomain').count(),0,'outcome product supersedes coverage rings');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+3));
  const order=await page.locator('.ltsCockpitHeading,.ltsExecutiveCards,.ltsCockpitReading,.ltsCockpitGrid,.ltsEvolutionNext').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().top));
  assert.equal(order.length,5);assert.ok(order.every((v,i)=>i===0||v>=order[i-1]),'question, snapshot, change, evidence, next review order');
  const heights=await page.locator('.ltsEvolutionAction,.ltsHomePeriod button,.ltsEvolutionTabs button,.ltsExecutiveCard').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height));
  assert.ok(heights.every(h=>h>=40),'controls meet desktop/phone target size');
  assert.ok(await page.locator('.ltsCockpitPanel.body .ltsContextPlot').count()>0,'historical body values visible');
  await renderReference(page,'30','body_fat_pct');
  assert.equal(await page.locator('[data-home-period="30"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('[data-home-body-metric="body_fat_pct"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('.ltsCockpitPanel.body circle').count(),0,'old fixture body is not charted as current');
  await renderReference(page);await page.screenshot({path:`${evidenceDir}/${label}-home-dashboard-reference.png`,fullPage:label==='desktop'});
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('Executive Home reference: desktop/mobile hierarchy, readable outcome cards, bounded controls and source evidence passed.');
}finally{await browser.close();}
