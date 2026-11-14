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
   // Open the real entry renderer in its existing synthetic fixture mode.
   // No form is submitted and no production identity or data is involved.
   await page.goto('http://127.0.0.1:4173/v2/?fixture=1#treinos');
   await page.locator('#routeAction:not(.hidden)').waitFor();await page.locator('#routeAction').click();
   await page.getByRole('textbox',{name:'Carga da série 1',exact:true}).waitFor();
   for(const [role,name] of [['combobox','Tipo da série 1'],['textbox','Carga da série 1'],['combobox','Unidade da carga da série 1'],['textbox','Repetições da série 1']]){
    const control=page.getByRole(role,{name,exact:true}),box=await control.boundingBox();assert.ok(box.height>=44,name+' touch target');
   }
   await page.getByRole('combobox',{name:'Unidade da carga da série 1',exact:true}).selectOption('plate_index');
   const geometry=await page.evaluate(()=>{
    const luminance=color=>{const v=color.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});return .2126*v[0]+.7152*v[1]+.0722*v[2];};
    const field=document.querySelector('.setEntry input'),css=getComputedStyle(field),a=luminance(css.color),b=luminance(css.backgroundColor);
    const controls=[...document.querySelectorAll('.setEntry input,.setEntry select,.setEntry button')].map(el=>{const r=el.getBoundingClientRect();return{left:r.left,right:r.right,height:r.height};});
    const select=document.querySelector('.setEntry select[name=weight_unit]'),sc=getComputedStyle(select),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.font=sc.font;
    return{contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),labelSize:Math.min(...[...document.querySelectorAll('#workoutEntryForm label')].map(el=>parseFloat(getComputedStyle(el).fontSize))),modalZ:Number(getComputedStyle(document.getElementById('entryModal')).zIndex),navZ:Number(getComputedStyle(document.getElementById('mobileNav')).zIndex)||0,controls,selectFits:ctx.measureText(select.selectedOptions[0].textContent).width+parseFloat(sc.paddingLeft)+parseFloat(sc.paddingRight)+28<=select.clientWidth};
   });
   assert.ok(geometry.contrast>=4.5);assert.ok(geometry.labelSize>=14);assert.ok(geometry.modalZ>geometry.navZ);assert.ok(geometry.selectFits);
   assert.ok(geometry.controls.every(r=>r.left>=0&&r.right<=width&&r.height>=44));
   assert.deepEqual(traffic,{writes:[],external:[],errors:[]});
   await page.locator('.setEntry').screenshot({path:`${dir}/${engine}-${width}-entry-synthetic.png`});
   results.push({engine,width,status:'passed',syntheticOnly:true,physicalIPhone:false,zeroWrites:true,observationsUnchanged:true});
  }catch(e){await page.screenshot({path:`${dir}/${engine}-${width}-failure-synthetic.png`}).catch(()=>{});results.push({engine,width,status:'failed',message:String(e.message),syntheticOnly:true});}
  finally{await context.close();writeFileSync(`${dir}/results.json`,JSON.stringify(results,null,2));}
 }}finally{await browser.close();}
}
assert.ok(results.every(r=>r.status==='passed'),JSON.stringify(results.filter(r=>r.status!=='passed')));
