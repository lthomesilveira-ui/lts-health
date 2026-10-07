import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
const evidenceDir='v2/public-audit-evidence';
const origin=process.env.LTS_TEST_ORIGIN||'http://127.0.0.1:4173';
mkdirSync(evidenceDir,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.goto(`${origin}/?fixture=1#hoje`,{waitUntil:'domcontentloaded'});
 await page.waitForSelector('#app:not(.hidden)');
 const dates=await page.evaluate(async()=>{
  const {state}=await import('./src/core.js');
  const {localHealthDay}=await import('./src/health-context.js');
  const {renderProductHomeReference}=await import('./src/home-reference.js');
  const today=localHealthDay(),date=n=>{const d=new Date(`${today}T12:00:00Z`);d.setUTCDate(d.getUTCDate()-n);return d.toISOString().slice(0,10);};
  state.ui.homePeriod='30';state.route='hoje';
  state.domainStatus=Object.fromEntries(['body','segmental','workouts','exercises','sets','nutrition','labs','metrics','sourceMetrics','treatments','goals','meals'].map(k=>[k,'ready']));
  state.data={body:[
   {measured_at:date(20),weight_kg:80,body_fat_pct:20,fat_mass_kg:16,skeletal_muscle_mass_kg:30,source:'InBody',device_name:'InBody 270'},
   {measured_at:date(2),weight_kg:79,body_fat_pct:19,fat_mass_kg:15,skeletal_muscle_mass_kg:31,source:'InBody',device_name:'InBody 270'}
  ],workouts:[],exercises:[],sets:[],nutrition:[
   {nutrition_date:date(3),source:'Synthetic connected',calories_kcal:2000,protein_g:100},
   {nutrition_date:date(2),source:'Synthetic connected',calories_kcal:2100,protein_g:150},
   {nutrition_date:date(60),source:'Synthetic legacy',calories_kcal:9000,protein_g:999}
  ],labs:[{collection_date:date(60),biomarker:'Synthetic old marker',result_numeric:999,unit:'u',laboratory:'Synthetic lab'}],metrics:[],sourceMetrics:[],treatments:[],goals:[],meals:[]};
  document.body.dataset.productRoute='hoje';
  document.querySelector('#screenHost').innerHTML=renderProductHomeReference();
  return{latest:date(2),old:date(60)};
 });
 assert.equal(await page.locator('.ltsExecutiveCard').count(),5);
 assert.equal(await page.locator('.ltsCockpitPanel').count(),6);
 assert.match(await page.locator('.ltsCockpitReading').innerText(),/-1,0 kg.*\+1,0 kg/s,'same-device tissue changes, not record totals');
 assert.match(await page.locator('.ltsExecutiveCard.nutrition').innerText(),/150 g proteína/);
 assert.match(await page.locator('.ltsCockpitPanel.nutrition').innerText(),/Último diário.*2\.100 kcal/s,'two diaries show the latest value, not an average');
 assert.match(await page.locator('.ltsCockpitPanel.labs').innerText(),/Nenhum resultado inequívoco na janela/,'old labs cannot appear as current-window results');
 assert.doesNotMatch(await page.locator('.ltsCockpitGrid').innerText(),/999|9\.000|2 de 30|2\/7|Cobertura do período/);
 assert.equal(await page.locator('.ltsCockpitPanel.water .ltsContextPlot').count(),0,'no sparse hydration chart or fabricated average');
 await page.locator('[data-disclosure="home-history"] > summary').click();
 const selected=await page.locator('#healthContextDate').inputValue();
 assert.equal(selected,dates.latest);
 assert.equal(await page.locator('.ltsContextPanel.nutrition circle').count(),2);
 assert.doesNotMatch(await page.locator('.ltsContextPanel.nutrition').innerText(),/999/);
 assert.equal(await page.locator('#healthContextDate option').filter({hasText:dates.old}).count(),0);
 for(const viewport of [{width:390,height:844},{width:1440,height:1000}]){
  await page.setViewportSize(viewport);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+3),'no horizontal overflow');
  const sizes=await page.locator('.ltsExecutiveCard small,.ltsCockpitPanel p').evaluateAll(es=>es.map(e=>parseFloat(getComputedStyle(e).fontSize)));
  assert.ok(sizes.every(n=>n>=11),'readable evidence and source text');
  await page.screenshot({path:`${evidenceDir}/${viewport.width<500?'mobile':'desktop'}-home.png`,fullPage:true});
 }
 await page.evaluate(async()=>{
  const {state}=await import('./src/core.js');const {renderProductHomeReference}=await import('./src/home-reference.js');state.domainStatus.nutrition='error';document.querySelector('#screenHost').innerHTML=renderProductHomeReference();
 });
 assert.match(await page.locator('.ltsExecutiveCard.nutrition').innerText(),/Indisponível/);
 assert.doesNotMatch(await page.locator('.ltsCockpitPanel.nutrition').innerText(),/150 g|2\.100/);
 await page.locator('[data-disclosure="home-history"] > summary').click();
 assert.equal(await page.locator('.ltsContextPanel.nutrition circle').count(),0,'failed reads hide stale source points');
 console.log('Home integrity: shared calendar, compatible tissue deltas, latest actual nutrition, bounded labs, sparse water, read failures and responsive evidence passed.');
}finally{await browser.close();}
