import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {sourceWindowService} from './source-window-service-fixture.mjs';
import {makeConsumerLanguageFixture,languageDatabase,LANGUAGE_TODAY} from './consumer-language-fixture.mjs';
import {consumerRouteSettled} from './consumer-language-readiness.mjs';

// CI-only synthetic browser proof. No real records, credentials or requests.
// Do not launch a local browser/server to work around an execution denial.
const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/preview/compact-evidence/',origin=new URL(base);
assert.equal(origin.protocol,'http:');assert.ok(['127.0.0.1','localhost','[::1]'].includes(origin.hostname));
assert.ok(['/preview/compact-evidence/','/v2/'].includes(origin.pathname));assert.equal(origin.search,'');assert.equal(origin.hash,'');
const dir=process.env.LTS_LAB_VISUAL_CONTEXT_EVIDENCE_DIR||'lab-visual-context-evidence';mkdirSync(dir,{recursive:true});
const method='Método sintético com uma descrição deliberadamente longa para verificar leitura integral no celular';
const row=(id,date,value,extra={})=>({source_record_id:`synthetic-lab-visual-${id}`,collection_date:date,
  biomarker:'Marcador visual sintético',laboratory:'Laboratório sintético',unit:'u/L',method,
  result_numeric:value,result_raw:String(value),reference_range:'42 a 60 u/L',source:'Fonte sintética',...extra});
const originalRows=[row('a','2025-01-10',61.1),row('b','2025-05-20',61.7),
  row('c','2025-01-10',61.1,{biomarker:'Marcador condicional sintético',reference_range:'Homens: 42 a 60; Mulheres: 40 a 58'}),
  row('d','2025-05-20',61.7,{biomarker:'Marcador condicional sintético',reference_range:'Homens: 42 a 60; Mulheres: 40 a 58'}),
  row('e','2025-09-10',62,{method:'Outro método sintético'})];
const results=[],failures=[];
const save=()=>writeFileSync(`${dir}/results.json`,JSON.stringify({syntheticOnly:true,realAccount:false,productionStartup:true,results,failures},null,2));
async function stable(page,route='saude'){
  await page.evaluate(async()=>{
    if(!window.__languageApp){
      const {state,fixtureMode}=await import('./src/core.js'),{isRouteReady}=await import('./src/data-layer.js');
      const imports=JSON.parse(document.querySelector('script[type="importmap"]').textContent).imports;
      const actual=await import(new URL(imports['./src/core.js'],document.baseURI).href);if(state!==actual.state)throw new Error('Different test and production state');
      window.__languageApp={state,fixtureMode,isRouteReady};
    }
    window.__languageStableRoot=null;window.__languageFrames=0;
  });
  await page.waitForFunction(consumerRouteSettled,{route,selector:route==='saude'?'.ltsLabsV2':'[data-health-dashboard]'});
}
const browser=await chromium.launch({headless:true});
try{
  for(const [width,height] of [[320,740],[393,844],[1180,757],[1440,900]]){
    const fixture=makeConsumerLanguageFixture('empty');fixture.data.labs=structuredClone(originalRows);fixture.db=languageDatabase(fixture.data);
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
      await page.goto(`${base}#saude`);await stable(page);
      assert.equal(await page.evaluate(()=>window.__languageApp.fixtureMode),false);
      const before=await page.evaluate(()=>JSON.stringify(window.__languageApp.state.data.labs));
      await page.locator('#productLabMarkerSelect').selectOption('marcador visual sintetico');await stable(page);
      const chosen=await page.locator('#productLabCohort option').evaluateAll(options=>options.find(o=>JSON.parse(o.value)[2].startsWith('metodo sintetico com'))?.value);
      assert.ok(chosen);await page.locator('#productLabCohort').selectOption(chosen);await stable(page);
      assert.equal(await page.locator('.ltsLabReferenceBand').count(),1);assert.equal(await page.locator('.ltsLabsChart .ltsDepthLine').count(),1);
      assert.equal(await page.locator('.ltsLabsChart circle').count(),2);assert.equal(await page.locator('.ltsLabsMarkerRail [data-lab-marker="marcador visual sintetico"]').count(),0);
      assert.match(await page.locator('.ltsLabEndpoints').innerText(),/61,1 u\/L/);assert.match(await page.locator('.ltsLabEndpoints').innerText(),/61,7 u\/L/);
      assert.match(await page.locator('.ltsLabDelta').innerText(),/10\/01\/2025 → 20\/05\/2025: \+0,60 u\/L/);
      const disclosure=page.locator('#productLabMethodDetails');assert.equal(await disclosure.evaluate(el=>el.open),false);
      await page.locator('[data-ux-scroll="productLabsTrend"]').click();
      await page.waitForFunction(()=>document.activeElement===document.querySelector('#productLabsTrend h2'));
      const geometry=await page.evaluate(()=>{
        const chart=document.querySelector('.ltsLabTrendPlot'),min=Number(chart.dataset.labAxisMin),max=Number(chart.dataset.labAxisMax);
        const plot=chart.querySelector('svg'),band=chart.querySelector('rect'),circles=[...chart.querySelectorAll('circle')];
        const host=document.querySelector('#screenHost'),hostBox=host.getBoundingClientRect(),nav=document.querySelector('#mobileNav'),topbar=document.querySelector('.topbar');
        const visibleTop=Math.max(0,hostBox.top,topbar?.checkVisibility()?topbar.getBoundingClientRect().bottom:0);
        const visibleBottom=Math.min(innerHeight,hostBox.bottom,nav?.checkVisibility()?nav.getBoundingClientRect().top:innerHeight);
        const box=el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,left:r.left,right:r.right};};
        const plotBox=box(plot),valuesBox=box(chart.querySelector('.ltsLabEndpoints')),referenceBox=box(chart.querySelector('.ltsLabReferenceLegend'));
        const visiblePlotHeight=Math.max(0,Math.min(plotBox.bottom,visibleBottom)-Math.max(plotBox.top,visibleTop));
        return {min,max,visibleTop,visibleBottom,plotBox,valuesBox,referenceBox,visiblePlotHeight,visiblePlotFraction:visiblePlotHeight/plotBox.height,
          bandY:Number(band.getAttribute('y')),bandHeight:Number(band.getAttribute('height')),viewHeight:plot.viewBox.baseVal.height,
          pointDisplacement:Math.abs(Number(circles[0].getAttribute('cy'))-Number(circles[1].getAttribute('cy'))),
          rootOverflow:document.documentElement.scrollWidth-innerWidth,hostOverflow:host.scrollWidth-host.clientWidth};
      });
      assert.ok(geometry.min<42&&geometry.min>0&&geometry.max>61.7);assert.ok(geometry.pointDisplacement<10);
      assert.ok(geometry.bandY>0&&geometry.bandY+geometry.bandHeight<geometry.viewHeight);assert.ok(geometry.rootOverflow<=1&&geometry.hostOverflow<=1);
      for(const target of [geometry.valuesBox,geometry.referenceBox])assert.ok(target.top>=geometry.visibleTop-1&&target.bottom<=geometry.visibleBottom+1,'dates, values and the report range are fully visible after the chart jump');
      assert.ok(geometry.visiblePlotHeight>=130&&geometry.visiblePlotFraction>=.7,'the initial chart view shows at least 130px and 70% of the actual plot, not merely empty container');
      await page.screenshot({path:`${dir}/${width}-lab-trend.png`,animations:'disabled',scale:'css'});
      await page.locator('.ltsLabsChart').scrollIntoViewIfNeeded();await page.screenshot({path:`${dir}/${width}-lab-chart.png`,animations:'disabled',scale:'css'});
      await disclosure.locator('summary').click();assert.equal(await disclosure.evaluate(el=>el.open),true);
      await disclosure.scrollIntoViewIfNeeded();
      const methodGeometry=await page.locator('.ltsLabSeriesContext>div:last-child dd').evaluate(text=>{
        const style=getComputedStyle(text),box=text.getBoundingClientRect();
        return {method:text.textContent,visible:text.checkVisibility(),width:box.width,scrollWidth:text.scrollWidth,clientWidth:text.clientWidth,whiteSpace:style.whiteSpace,lineClamp:style.webkitLineClamp};
      });
      assert.equal(methodGeometry.method,method);assert.equal(methodGeometry.visible,true);assert.equal(methodGeometry.whiteSpace,'normal');assert.ok(['none','0',''].includes(methodGeometry.lineClamp));
      assert.ok(methodGeometry.width<=width&&methodGeometry.scrollWidth<=methodGeometry.clientWidth+1);
      await page.screenshot({path:`${dir}/${width}-lab-method-open.png`,animations:'disabled',scale:'css'});
      await disclosure.locator('summary').click();assert.equal(await disclosure.evaluate(el=>el.open),false);
      await page.locator('#productLabPoint').selectOption('0');await stable(page);assert.match(await page.locator('.ltsPointReadout p').innerText(),/61,1 u\/L/);assert.match(await page.locator('.ltsPointReadout p').innerText(),/10\/01\/2025/);
      await page.locator('#productLabMarkerSelect').selectOption('marcador condicional sintetico');await stable(page);
      assert.equal(await page.locator('.ltsLabReferenceBand').count(),0);assert.equal(await page.locator('.ltsLabsChart .ltsDepthLine').count(),1,'conditional references retain the pre-existing numeric comparison only');
      assert.match(await page.locator('.ltsLabScaleNote').first().innerText(),/Sem faixa de referência comum validada/);
      await page.evaluate(()=>{location.hash='#hoje';});await stable(page,'hoje');await page.evaluate(()=>{location.hash='#saude';});await stable(page);
      assert.equal(await page.locator('#productLabMarkerSelect').inputValue(),'marcador condicional sintetico');assert.equal(await page.locator('.ltsLabReferenceBand').count(),0);
      assert.equal(await page.evaluate(()=>JSON.stringify(window.__languageApp.state.data.labs)),before);assert.deepEqual(await page.evaluate(()=>window.__historyQA.writes),[]);assert.deepEqual(traffic,{external:[],writes:[],errors:[]});
      results.push({width,height,geometry,methodGeometry,methodDisclosure:true,neutralDelta:true,datedValues:true,referenceFailClosed:true,pointSelection:true,routeReturn:true,immutableRecords:true,traffic,status:'passed'});
    }catch(error){failures.push({width,message:String(error.message),traffic});await page.screenshot({path:`${dir}/${width}-failure.png`,animations:'disabled',scale:'css'}).catch(()=>{});}
    finally{await context.close();save();}
  }
}finally{save();await browser.close();}
assert.equal(failures.length,0,`Laboratory visual-context failures: ${JSON.stringify(failures)}`);
console.log('Laboratory chart context: CI-only synthetic values, neutral scale/delta, validated reference band, full method, point selection, route return and no writes at 320/393/1180/1440.');
