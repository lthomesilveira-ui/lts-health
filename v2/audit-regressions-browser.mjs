import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium,webkit} from 'playwright';
import {makeCalendarReportFixture,calendarReportService,CALENDAR_TODAY} from '../preview/compact-evidence/tests/calendar-report-fixture.mjs';

assert.ok(process.env.CI,'Run only in the existing approved public-repository CI environment');
const base='http://127.0.0.1:4173/preview/compact-evidence/';
const dir='audit-regressions-synthetic';mkdirSync(dir,{recursive:true});
const results=[];
for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch();
 try{for(const width of [320,390,1440]){
  const f=makeCalendarReportFixture();
  f.db.health_daily_nutrition.push({...f.db.health_daily_nutrition[0],id:'synthetic-old-food',source_record_id:'synthetic-old-food',nutrition_date:'2019-01-02',source:'Synthetic archived diary'});
  for(const [metric_type,value,unit] of [['heart_rate_avg_bpm',81.5,'bpm'],['oxygen_saturation_pct',96.5,'%']])
   f.db.health_source_daily_metrics.push({...f.db.health_source_daily_metrics[0],id:`synthetic-${metric_type}`,source_record_id:`synthetic-${metric_type}`,metric_date:'2026-10-16',metric_type,value,unit,source_name:'Synthetic typed watch',source_family:'polar_flow',canonical_status:'candidate'});
  const context=await browser.newContext({viewport:{width,height:width<840?844:1000},isMobile:width<840,hasTouch:width<840,locale:'pt-BR',timezoneId:'America/Sao_Paulo',serviceWorkers:'block'});
  const traffic={writes:[],external:[],errors:[]};
  await context.route('**/*',route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.hostname==='cdn.jsdelivr.net'&&url.pathname==='/npm/@supabase/supabase-js@2'&&req.method()==='GET')return route.fulfill({status:200,contentType:'application/javascript',body:calendarReportService(f)});
   if(url.origin==='http://127.0.0.1:4173'&&['GET','HEAD'].includes(req.method()))return route.continue();
   traffic[!['GET','HEAD'].includes(req.method())?'writes':'external'].push(req.url());return route.abort();
  });
  const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>traffic.errors.push(e.message));
  await page.clock.setFixedTime(new Date(`${CALENDAR_TODAY}T15:00:00Z`));
  try{
   await page.goto(base+'#analise');await page.locator('#calendarReport').waitFor();
   await page.evaluate(async()=>{
    const {state,fixtureMode}=await import('./src/core.js'),{isRouteReady}=await import('./src/data-layer.js');
    const imports=JSON.parse(document.querySelector('script[type="importmap"]').textContent).imports;
    const actual=await import(new URL(imports['./src/core.js'],document.baseURI).href);
    if(actual.state!==state)throw new Error('QA must inspect the actual application core instance');
    window.__languageApp={state,fixtureMode,isRouteReady};
   });
   await page.waitForFunction(()=>window.__languageApp.state.loaded&&window.__languageApp.isRouteReady('analise')&&document.querySelector('#calendarReport'));

   const originalData=await page.evaluate(()=>JSON.stringify(window.__historyDb));
   const selection=await page.evaluate(async()=>{
    const {state}=window.__languageApp,{calendarReport}=await import('./src/calendar-report-model.js');
    const m=calendarReport(state.data,state.domainStatus,state.ui),sources=m.metricsByKey.energy.sources;
    const archived=sources.find(s=>s.label.includes('Synthetic archived diary')),available=sources.find(s=>s.count>0);
    if(!archived||!available)throw new Error('Synthetic source scenario incomplete');
    state.ui.calendarReportSources={...(state.ui.calendarReportSources||{}),energy:archived.key};
    return{archived:archived.key,available:available.key,calendar:JSON.stringify(m.calendar.bounds)};
   });
   await page.locator('[data-calendar-chart="energy"]').click();
   const recover=page.getByRole('button',{name:'Escolher diário para este relatório',exact:true});
   await recover.waitFor();
   assert.equal(await page.locator('#calendar-source-energy').isVisible(),false);
   assert.equal(await page.evaluate(()=>window.__languageApp.state.ui.calendarReportSources.energy),selection.archived);
   const bounds=await recover.boundingBox();assert.ok(bounds.height>=44&&bounds.width<=width);
   await recover.click();await page.locator('#calendar-source-energy').waitFor({state:'visible'});
   assert.equal(await page.locator('#calendar-source-energy').evaluate(el=>el===document.activeElement),true);
   assert.equal(await page.locator('#calendar-source-energy').inputValue(),selection.archived);
   await page.locator('#calendar-source-energy').selectOption(selection.available);
   await page.waitForFunction(()=>!document.querySelector('[data-calendar-source-jump="energy"]'));
   assert.equal(await page.evaluate(()=>window.__languageApp.state.ui.calendarReportSources.energy),selection.available);
   assert.equal(await page.evaluate(async()=>{const {state}=window.__languageApp,{calendarReport}=await import('./src/calendar-report-model.js');return JSON.stringify(calendarReport(state.data,state.domainStatus,state.ui).calendar.bounds);}),selection.calendar);
   await page.screenshot({path:`${dir}/${engine}-${width}-report-synthetic.png`,fullPage:false});
   if(await page.locator('#primaryNav [data-route="timeline"]').isVisible())await page.locator('#primaryNav [data-route="timeline"]').click();
   else{await page.locator('#mobileNav [data-route="mais"]').click();await page.locator('#moreSheet [data-route="timeline"]').click();}
   await page.getByRole('heading',{name:'Timeline',exact:true}).waitFor();
   await page.locator('#timelinePeriod').selectOption('all');
   await page.getByText('Frequência cardíaca média 81,5 bpm',{exact:false}).waitFor();
   assert.match(await page.locator('#screenHost').innerText(),/Saturação de oxigênio 96,5 %/);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.equal(await page.evaluate(()=>JSON.stringify(window.__historyDb)),originalData);
   assert.deepEqual(traffic,{writes:[],external:[],errors:[]});
   await page.screenshot({path:`${dir}/${engine}-${width}-timeline-synthetic.png`,fullPage:false});
   results.push({engine,width,status:'passed',syntheticOnly:true,physicalIPhone:false,zeroWrites:true,observationsUnchanged:true});
  }catch(e){await page.screenshot({path:`${dir}/${engine}-${width}-failure-synthetic.png`}).catch(()=>{});results.push({engine,width,status:'failed',message:String(e.message),syntheticOnly:true});}
  finally{await context.close();writeFileSync(`${dir}/results.json`,JSON.stringify(results,null,2));}
 }}finally{await browser.close();}
}
assert.ok(results.every(r=>r.status==='passed'),JSON.stringify(results.filter(r=>r.status!=='passed')));
