// Supplemental retired-reference renderer checks. Actual seven-card production Home is
// mandatory in production-integration-browser.mjs and home-reference-period-browser.mjs.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
const origin=process.env.LTS_TEST_ORIGIN||'http://127.0.0.1:4173';
const evidenceDir='v2/public-audit-evidence';mkdirSync(evidenceDir,{recursive:true});
const browser=await chromium.launch({headless:true});
async function renderReference(page,period='all',metric='weight_kg'){
 await page.evaluate(async({period,metric})=>{
  const core=await import('./src/core.js');const home=await import('./src/home-reference-experience.js');
  core.state.data=core.fixtureData();core.state.loaded=true;core.state.route='hoje';core.state.ui.homePeriod=period;core.state.ui.homeBodyMetric=metric;
  core.state.domainStatus=Object.fromEntries(['body','segmental','workouts','workoutEvidence','exercises','sets','nutrition','labs','docs','metrics','sourceMetrics','treatments','regimens','goals','meals'].map(k=>[k,'ready']));
  document.body.dataset.productRoute='hoje';document.querySelector('#screenHost').innerHTML=home.renderReferenceHome(core.state.data,core.state.domainStatus,core.state.ui.homePeriod,core.state.ui);document.querySelector('#screenHost').scrollTop=0;
 },{period,metric});
}
try{
 for(const [label,width,height] of [['desktop',1440,900],['mobile',393,852]]){
  const page=await browser.newPage({viewport:{width,height}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${origin}/?fixture=1#hoje`,{waitUntil:'domcontentloaded'});await page.waitForSelector('#app:not(.hidden)');await renderReference(page);
  assert.equal(await page.locator('.refSignal').count(),5);
  assert.equal(await page.locator('.refPanels>.refPanel:visible').count(),6);
  assert.equal(await page.locator('.refPanel.body .refPlot svg').count(),1);
  assert.equal(await page.locator('.refPanel.body [data-series]').count(),2);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+3));
  const visible=await page.locator('.refSignal:visible').count();assert.equal(visible,5);
  const positions=await page.evaluate(()=>Object.fromEntries(['refSignals','refReading','refPanels'].map(c=>[c,document.querySelector('.'+c).getBoundingClientRect().top])));
  assert.ok(width<=840?positions.refReading<positions.refSignals:positions.refSignals<positions.refReading);
  await renderReference(page,'30','body_fat_pct');
  assert.equal(await page.locator('[data-home-period="30"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('.refPanel.body circle').count(),0,'old fixture observations remain outside recent calendar');
  await renderReference(page);await page.screenshot({path:`${evidenceDir}/${label}-home-dashboard-reference.png`,fullPage:label==='desktop'});
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('Legacy Home reference regression: desktop/mobile hierarchy, readable outcome cards, bounded controls and source evidence passed.');
}finally{await browser.close();}
