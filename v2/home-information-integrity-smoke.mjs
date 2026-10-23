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
 assert.equal(await page.locator('.refSignal').count(),5);assert.equal(await page.locator('.refPanels>.refPanel:not(.mobileWorkout)').count(),6);
 assert.match(await page.locator('.refReading').innerText(),/Gordura −1,0 kg · músculo \+1,0 kg nos registros/,'observed deltas belong to selected period');
 assert.match(await page.locator('.refLegend').innerText(),/16(?:,0)?.*15(?:,0)?.*30(?:,0)?.*31(?:,0)?/s,'both endpoint values remain accessible in the chart legend');
 assert.match(await page.locator('.refPanel.nutrition').innerText(),/2\.050 kcal/,'sparse mean is explicitly an observed mean');
 assert.match(await page.locator('.refPanel.nutrition').innerText(),/2\/29 dias desta origem/);
 assert.match(await page.locator('.refPanel.labs').innerText(),/Sem coleta nesta janela/);
 assert.doesNotMatch(await page.locator('.refPanels').innerText(),/999|9\.000/);
 assert.equal(await page.locator('.refPanel.water .refPlot').count(),0,'no invented hydration chart');
 await page.evaluate(async selectedDate=>{const {state}=await import('./src/core.js');const {renderProductHomeReference}=await import('./src/home-reference.js');state.ui.overviewBodyDate=selectedDate;document.querySelector('#screenHost').innerHTML=renderProductHomeReference();},dates.latest);assert.equal(await page.locator('#overview-body-date').inputValue(),dates.latest);
 for(const viewport of [{width:390,height:844},{width:1440,height:1000}]){
  await page.setViewportSize(viewport);
  await page.evaluate(async()=>{const {renderProductHomeReference}=await import('./src/home-reference.js');document.querySelector('#screenHost').innerHTML=renderProductHomeReference();document.querySelector('#screenHost').scrollTop=0;});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+3),'no horizontal overflow');
  const sizes=await page.locator('.refSignal small,.refFootnote').evaluateAll(es=>es.map(e=>parseFloat(getComputedStyle(e).fontSize)));
  assert.ok(sizes.every(n=>n>=11),'readable evidence and source text');
  await page.screenshot({path:`${evidenceDir}/${viewport.width<500?'mobile':'desktop'}-home.png`,fullPage:true});
 }
 await page.evaluate(async()=>{
  const {state}=await import('./src/core.js');const {renderProductHomeReference}=await import('./src/home-reference.js');state.domainStatus.nutrition='error';document.querySelector('#screenHost').innerHTML=renderProductHomeReference();
 });
 assert.match(await page.locator('.refSignal.nutrition').innerText(),/Dados não carregaram|Sem média disponível/);
 assert.doesNotMatch(await page.locator('.refPanel.nutrition').innerText(),/150 g|2\.050/);
 assert.equal(await page.locator('.refPanel.nutrition rect').count(),0,'failed read cannot retain stale food points');
 console.log('Home integrity: shared calendar, compatible tissue deltas, latest actual nutrition, bounded labs, sparse water, read failures and responsive evidence passed.');
}finally{await browser.close();}
