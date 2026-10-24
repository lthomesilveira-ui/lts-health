import assert from 'node:assert/strict';
import {sourceWindowService} from './source-window-service-fixture.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {labAccessRows} from './lab-history-access-fixture.mjs';
import {makeConsumerLanguageFixture,languageDatabase,LANGUAGE_TODAY} from './consumer-language-fixture.mjs';
import {consumerRouteSettled} from './consumer-language-readiness.mjs';

// CI-only proof through the real startup, loader and delegated event handlers.
// All records and authentication are invented. Never use a real patient/session,
// contact a backend, or start a local runtime to work around an execution denial.
const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/preview/compact-evidence/';
const origin=new URL(base);
assert.equal(origin.protocol,'http:');assert.ok(['127.0.0.1','localhost','[::1]'].includes(origin.hostname));
assert.ok(['/preview/compact-evidence/','/v2/'].includes(origin.pathname));assert.equal(origin.search,'');assert.equal(origin.hash,'');
const dir=process.env.LTS_LAB_ACCESS_EVIDENCE_DIR||'lab-history-access-visual';mkdirSync(dir,{recursive:true});
const results=[],failures=[];
const save=()=>writeFileSync(`${dir}/results.json`,JSON.stringify({syntheticOnly:true,realAccount:false,productionStartup:true,results,failures},null,2));
async function stable(page,route='saude'){
  await page.evaluate(async()=>{
    if(!window.__languageApp){
      const {state,fixtureMode}=await import('./src/core.js'),{isRouteReady}=await import('./src/data-layer.js');
      const imports=JSON.parse(document.querySelector('script[type="importmap"]').textContent).imports;
      const actual=await import(new URL(imports['./src/core.js'],document.baseURI).href);
      if(actual.state!==state)throw new Error('Test must inspect the real core instance');
      window.__languageApp={state,fixtureMode,isRouteReady};
    }
    window.__languageStableRoot=null;window.__languageFrames=0;
  });
  await page.waitForFunction(consumerRouteSettled,{route,selector:route==='saude'?'.ltsLabsV2':'[data-health-dashboard]'});
}
async function toTop(page){await page.evaluate(()=>{document.querySelector('#screenHost').scrollTo({top:0,behavior:'instant'});window.scrollTo({top:0,behavior:'instant'});});}
async function capture(page,width,name){await page.screenshot({path:`${dir}/${width}-${name}.png`,animations:'disabled',scale:'css'});}
async function jump(page,id,width){
  await page.locator(`[data-ux-scroll="${id}"]`).click();
  const heading=page.locator(`#${id} h2`);
  await page.waitForFunction(id=>document.activeElement===document.querySelector(`#${id} h2`),id);
  const geometry=await heading.evaluate(el=>{
    const r=el.getBoundingClientRect(),host=document.querySelector('#screenHost').getBoundingClientRect();
    const x=Math.max(1,Math.min(innerWidth-1,r.left+Math.min(20,r.width/2))),y=r.top+r.height/2;
    const hit=document.elementFromPoint(x,y);
    return {top:r.top,bottom:r.bottom,hostTop:host.top,viewportHeight:innerHeight,unobscured:Boolean(hit&&(el===hit||el.contains(hit)))};
  });
  assert.ok(geometry.top>=Math.max(0,geometry.hostTop)-1&&geometry.bottom<geometry.viewportHeight,`${id} heading stays in the visible scrollport`);
  assert.ok(geometry.unobscured,`${id} heading is not covered by application chrome`);
  assert.equal(await page.evaluate(()=>location.hash),'#saude');
  await capture(page,width,id);return geometry;
}
const browser=await chromium.launch({headless:true});
try{
  for(const [width,height] of [[390,844],[1180,757]]){
    const fixture=makeConsumerLanguageFixture('empty');fixture.data.labs=labAccessRows();fixture.db=languageDatabase(fixture.data);
    const traffic={external:[],writes:[],errors:[]};
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:width<=840,hasTouch:width<=840,locale:'pt-BR',timezoneId:'America/Sao_Paulo',serviceWorkers:'block'});
    await context.route('**/*',route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.protocol==='https:'&&url.hostname==='cdn.jsdelivr.net'&&url.pathname==='/npm/@supabase/supabase-js@2'&&request.method()==='GET')return route.fulfill({status:200,contentType:'application/javascript',body:sourceWindowService(fixture.db)});
      if(url.origin===origin.origin&&['GET','HEAD'].includes(request.method())&&(url.pathname.startsWith(origin.pathname)||url.pathname==='/favicon.ico'))return route.continue();
      if(!['GET','HEAD'].includes(request.method()))traffic.writes.push({url:request.url(),method:request.method()});else traffic.external.push(request.url());
      return route.abort('blockedbyclient');
    });
    const page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',error=>traffic.errors.push(error.message));
    await page.clock.setFixedTime(new Date(`${LANGUAGE_TODAY}T15:00:00Z`));
    try{
      await page.goto(`${base}#hoje`);await stable(page,'hoje');
      await page.locator('#dashboard-period').selectOption('7');await stable(page,'hoje');
      const homeBefore=await page.evaluate(()=>({home:window.__languageApp.state.ui.homePeriod,dashboard:window.__languageApp.state.ui.dashboardPeriod}));
      assert.equal(homeBefore.dashboard,'7');
      await page.evaluate(()=>{location.hash='#saude';});await stable(page);
      assert.equal(await page.evaluate(()=>window.__languageApp.fixtureMode),false);
      const before=await page.evaluate(()=>JSON.stringify(window.__languageApp.state.data.labs));
      assert.equal(JSON.parse(before).length,828);
      assert.equal(await page.locator('#productLabMarkerSelect option').count(),35);
      assert.equal(await page.locator('[data-depth-period="productLabPeriod"][data-value="all"]').getAttribute('aria-pressed'),'true');
      await page.locator('#productLabMarkerSelect').selectOption('marcador sintetico 01');await stable(page);
      const cohort=await page.locator('#productLabCohort option').evaluateAll(options=>options.find(o=>o.textContent.includes('Laboratório sintético A · u/L'))?.value);
      assert.ok(cohort);await page.locator('#productLabCohort').selectOption(cohort);await stable(page);
      assert.equal(await page.locator('.ltsLabsChart circle').count(),25,'only the selected comparable source/unit cohort is graphed');
      assert.equal(await page.locator('[data-lab-history-total]').getAttribute('data-lab-history-total'),'27','full marker history retains the other source and unit');
      await toTop(page);
      const positions=await page.evaluate(()=>{
        const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right};};
        return {search:rect('#productLabQuery'),selector:rect('#productLabMarkerSelect'),chart:rect('#productLabsTrend'),history:rect('#productLabsHistory'),collection:rect('#productLabsCollection'),jump:rect('.ltsLabsJump'),viewport:{width:innerWidth,height:innerHeight},hostTop:document.querySelector('#screenHost').getBoundingClientRect().top};
      });
      assert.ok(positions.search.top>=positions.hostTop&&positions.search.bottom<height,'search is discoverable in the initial viewport');
      assert.ok(positions.jump.bottom<height,'chart/history shortcuts are visible without scrolling');
      assert.ok(await page.locator('.ltsLabsJump button').evaluateAll(buttons=>buttons.every(el=>{const r=el.getBoundingClientRect();return r.width>=43.5&&r.height>=43.5;})),'new jump buttons have at least 44px touch targets');
      assert.ok(positions.search.top<positions.selector.top&&positions.selector.top<positions.chart.top&&positions.chart.top<positions.history.top&&positions.history.top<positions.collection.top);
      await capture(page,width,'top');
      await page.locator('#productLabQuery').fill('sem correspondência inventada');await stable(page);
      assert.equal(await page.locator('#productLabMarkerSelect option').count(),1);
      assert.match(await page.locator('.ltsLabsMarkerRail').innerText(),/Nenhum marcador corresponde/);
      await page.locator('#productLabQuery').fill('');await stable(page);
      assert.equal(await page.locator('#productLabMarkerSelect option').count(),35,'clearing search restores every marker');
      await page.locator('#productLabPoint').selectOption('0');await stable(page);
      assert.match(await page.locator('.ltsPointReadout p b').innerText(),/20,0 u\/L/);
      const jumps={};for(const id of ['productLabsTrend','productLabsHistory','productLabsCollection'])jumps[id]=await jump(page,id,width);
      await page.locator('[data-depth-page="productLabPage"][data-page="2"]').click();await stable(page);
      assert.equal(await page.locator('.ltsLabsHistoryRow').count(),10);
      await page.locator('[data-depth-page="productLabPage"][data-page="3"]').click();await stable(page);
      assert.equal(await page.locator('.ltsLabsHistoryRow').count(),7,'oldest records remain reachable');
      await page.locator('[data-depth-period="productLabPeriod"][data-value="30"]').click();await stable(page);
      assert.match(await page.locator('.ltsLabsV2').innerText(),/Nenhum resultado laboratorial nesta janela/);
      assert.deepEqual(await page.evaluate(()=>({home:window.__languageApp.state.ui.homePeriod,dashboard:window.__languageApp.state.ui.dashboardPeriod})),homeBefore,'lab period never changes either Home period control');
      await page.locator('[data-depth-period="productLabPeriod"][data-value="all"]').click();await stable(page);
      await page.evaluate(()=>{location.hash='#hoje';});await stable(page,'hoje');
      await page.locator('#dashboard-period').selectOption('90');await stable(page,'hoje');
      await page.evaluate(()=>{location.hash='#saude';});await stable(page);
      assert.equal(await page.evaluate(()=>window.__languageApp.state.ui.productLabPeriod),'all','Home never changes laboratory history');
      assert.equal(await page.locator('#productLabMarkerSelect option').count(),35);
      assert.equal(await page.evaluate(()=>JSON.stringify(window.__languageApp.state.data.labs)),before,'viewing/filtering never changes clinical records');
      assert.equal(await page.evaluate(()=>window.__historyQA.writes.length),0,'SDK read-only boundary remains intact');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.querySelector('#screenHost').scrollWidth<=document.querySelector('#screenHost').clientWidth+1),'no horizontal overflow');
      assert.deepEqual(traffic,{external:[],writes:[],errors:[]});
      results.push({width,height,records:828,positions,jumps,searchClear:true,historyPagination:true,independentPeriods:true,immutableRecords:true,traffic,status:'passed'});
    }catch(error){failures.push({width,message:String(error.message),traffic});await capture(page,width,'failure').catch(()=>{});}
    finally{await context.close();save();}
  }
}finally{save();await browser.close();}
assert.equal(failures.length,0,`Exames access browser failures: ${JSON.stringify(failures)}`);
console.log('Exames access: real startup and event handlers, 828 synthetic rows, visible controls, source-separated graph, focused jumps, search reset, independent periods and full history passed at 390/1180.');
