import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {auditIntegratedDashboard,auditIntegratedEvolution,auditObservedNutritionContrast} from './real-auth-dashboard-checks.mjs';
import {sourceWindowService} from '../preview/compact-evidence/tests/source-window-service-fixture.mjs';
import {languageDatabase} from '../preview/compact-evidence/tests/consumer-language-fixture.mjs';
// This harness validates the real-auth assertions against a disposable invented
// transport. It does not claim to authenticate or write to a real account.
const base='http://127.0.0.1:4175/v2/',today='2024-08-21';
const sdk=sourceWindowService(languageDatabase({body:[{source_record_id:'synthetic-body-old',measured_at:'2022-01-01',weight_kg:80,body_fat_pct:20,skeletal_muscle_mass_kg:35,fat_mass_kg:16,source_name:'Synthetic scale A',device_name:'Synthetic A'},{source_record_id:'synthetic-body-prior',measured_at:'2024-02-01',weight_kg:78,body_fat_pct:null,skeletal_muscle_mass_kg:36,fat_mass_kg:15,source_name:'Synthetic scale A',device_name:'Synthetic A'},{source_record_id:'synthetic-body-recent',measured_at:'2024-08-08',weight_kg:77,body_fat_pct:18,skeletal_muscle_mass_kg:37,fat_mass_kg:14,source_name:'Synthetic scale B',device_name:'Synthetic B'}],workouts:[{source_record_id:'synthetic-comparison-workout',workout_date:'2024-08-19',is_canonical:true,record_status:'validated'}],nutrition:[{source_record_id:'synthetic-contrast-training',nutrition_date:'2024-08-19',source:'Synthetic food',protein_g:90,calories_kcal:1800,carbs_g:200,fat_g:60},{source_record_id:'synthetic-contrast-no-training',nutrition_date:'2024-08-20',source:'Synthetic food',protein_g:0,calories_kcal:1500,carbs_g:150,fat_g:50},{source_record_id:'synthetic-contrast-other-origin',nutrition_date:'2024-08-20',source:'Synthetic other food',protein_g:700,calories_kcal:9000,carbs_g:800,fat_g:500},{source_record_id:'synthetic-food-no-water',nutrition_date:today,source:'Synthetic food',water_ml:null,calories_kcal:2100,protein_g:150}],sourceMetrics:[{source_record_id:'synthetic-water-prior',metric_date:'2024-08-08',metric_type:'dietary_water_ml',value:1750,unit:'mL',source_family:'synthetic_bridge',source_name:'Synthetic water bridge',canonical_status:'candidate',updated_at:'2024-08-09T11:20:00Z'}]})).replace("name==='health-polar-connection'","['health-polar-connection','health-auto-export-connection'].includes(name)").replace("Object.keys(options.body).length===1","(Object.keys(options.body).length===1||name==='health-auto-export-connection'&&Object.keys(options.body).length===2&&options.body.key_revision===null)");
await assert.rejects(()=>auditIntegratedDashboard({locator(){throw Error('Synthetic confidential value');},screenshot(){throw Error('Synthetic screenshot unavailable');}},{}),error=>!error.message.includes('Synthetic confidential')&&!error.cause&&/private observations withheld/.test(error.message),'public failure text must not contain private assertion values');
mkdirSync('water-continuity-visual',{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 for(const [width,height]of [[1440,864],[393,650],[320,740]]){
  const context=await browser.newContext({viewport:{width,height},timezoneId:'America/Sao_Paulo'}),page=await context.newPage(),errors=[],blocked=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.hostname==='cdn.jsdelivr.net'&&url.pathname==='/npm/@supabase/supabase-js@2')return route.fulfill({contentType:'application/javascript',body:sdk});
   if(url.origin===new URL(base).origin&&['GET','HEAD'].includes(request.method()))return route.continue();
   blocked.push({method:request.method(),origin:url.origin});return route.abort();
  });
  await page.clock.setFixedTime(new Date(today+'T15:00:00Z'));
  await page.goto(base+'#hoje');await page.locator('[data-health-dashboard]').waitFor();
  const expectedBuild=await page.locator('meta[name="lts-build"]').getAttribute('content');
  await auditIntegratedDashboard(page,{expectedBuild});
  await page.locator('[data-dashboard-card="water"]').scrollIntoViewIfNeeded();
  assert.match(await page.locator('[data-dashboard-card="water"]').innerText(),/Sem informação.*1\.750 mL.*08\/08\/2024.*Recebido em 09\/08\/2024, 08:20/s);
  await page.screenshot({path:`water-continuity-visual/missing-water-${width}.png`});
  await page.goto(base+'#evolucao');await page.locator('.ltsEvolutionOverview').waitFor();
  await auditIntegratedEvolution(page);
  assert.ok(await page.locator('[data-evolution-overview-metric]').evaluateAll(es=>es.every(e=>parseFloat(getComputedStyle(e).fontSize)>=10.5&&e.getBoundingClientRect().height>=44)),'current history metric controls are readable and touchable');
  await page.screenshot({path:`water-continuity-visual/current-evolution-${width}.png`});
  await page.goto(base+'#analise');await page.locator('.ltsUsefulReports').waitFor();await page.locator('#analysisPeriod').selectOption('all');await page.locator('[data-report-section="reportEvidenceInsights"]').click();await auditObservedNutritionContrast(page);
  for(const route of ['hoje','treinos','evolucao','analise','bio','nutricao','saude','tratamentos','timeline','dados']){
   await page.goto(base+'#'+route);await page.waitForFunction(route=>document.body.dataset.productRoute===route&&!document.querySelector('.loadingState'),route);
   if(width<=840){
    const active=await page.locator('#mobileNav button.active').evaluateAll(es=>es.map(e=>e.dataset.route));
    assert.deepEqual(active,[['hoje','treinos','evolucao'].includes(route)?route:'mais'],'each current mobile destination has one correct active tab');
   }
  }
  assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);assert.deepEqual(await page.evaluate(()=>window.__historyQA.writes),[]);
  await context.close();
 }
}finally{await browser.close();}
console.log('Current authenticated dashboard assertions validated with invented local data at desktop/393×650/320px: exact seven cards, all windows, historical reopening, current evolution metrics/windows and no external reads or writes.');
