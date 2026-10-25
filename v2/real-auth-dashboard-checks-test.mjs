import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {auditIntegratedDashboard} from './real-auth-dashboard-checks.mjs';
import {sourceWindowService} from '../preview/compact-evidence/tests/source-window-service-fixture.mjs';
import {languageDatabase} from '../preview/compact-evidence/tests/consumer-language-fixture.mjs';
// This harness validates the real-auth assertions against a disposable invented
// transport. It does not claim to authenticate or write to a real account.
const base='http://127.0.0.1:4175/v2/',today='2024-08-21';
const sdk=sourceWindowService(languageDatabase({nutrition:[{source_record_id:'synthetic-food-no-water',nutrition_date:today,source:'Synthetic food',water_ml:null,calories_kcal:2100,protein_g:150}],sourceMetrics:[{source_record_id:'synthetic-water-prior',metric_date:'2024-08-08',metric_type:'dietary_water_ml',value:1750,unit:'mL',source_family:'synthetic_bridge',source_name:'Synthetic water bridge',canonical_status:'candidate',updated_at:'2024-08-09T11:20:00Z'}]}));
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
  assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);assert.deepEqual(await page.evaluate(()=>window.__historyQA.writes),[]);
  await context.close();
 }
}finally{await browser.close();}
console.log('Current authenticated dashboard assertions validated with invented local data at desktop/393×650/320px: exact seven cards, all windows, historical reopening and no external reads or writes.');
