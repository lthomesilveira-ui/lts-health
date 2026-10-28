import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {healthDashboardModel} from './src/health-dashboard-model.js';
import {dashboardContext} from './src/health-dashboard-context.js';
import {FIXED_TODAY,METRIC_KEYS,makeDashboardFixture,expectedMetric,dateLabel,numberLabel} from '../preview/compact-evidence/tests/health-dashboard-render-test.mjs';

// Accepted daily/period dashboard contract on the production graph. Migrated
// from the reviewed preview suite, retaining all six legacy viewport sizes.
// Dense data at every size; explicit sparse/missing cases at mobile size.
// CI browser contract, using the repository's existing playwright@1.56.1.
// No installation, real authentication, real records or external requests.
// Run against integrated /v2 served by the existing CI HTTP server.
const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/v2/';
const origin=new URL(base);
assert.ok(['127.0.0.1','localhost','[::1]'].includes(origin.hostname),'Synthetic browser QA is restricted to loopback');
assert.ok(origin.pathname.endsWith('/v2/'),'Only integrated production on loopback may be tested');
assert.equal(origin.search,'','The SDK mock uses the real integrated production route, without fixture/demo mode');
const dir='v2/reference-period-visual';mkdirSync(dir,{recursive:true});
const results=[];let desktopContent;
function service(db){return `
window.__healthQA={reads:[],writes:[]};
window.__reviewDb=${JSON.stringify(db)};
const mutation=(kind,target)=>{window.__healthQA.writes.push({kind,target});throw new Error('Synthetic QA forbids writes: '+kind+' '+target);};
window.supabase={createClient:()=>({
 auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-health-dashboard-user'}}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
 functions:{invoke:async(name,args)=>{if(args?.body?.action==='status')return {data:{configured:false,connected:false,received:false},error:null};return mutation('invoke',name)}},rpc:(name)=>mutation('rpc',name),
 storage:{from:(name)=>({upload:()=>mutation('upload',name),remove:()=>mutation('remove',name)})},
 from(table){
  let from=0,to=999;const filters=[],orders=[];
  const rows=()=>{
   let selected=(window.__reviewDb[table]||[]).filter(row=>filters.every(([key,value])=>row[key]===value));
   if(orders.length)selected=selected.slice().sort((a,b)=>{for(const[key,asc]of orders){const result=String(a[key]??'').localeCompare(String(b[key]??''));if(result)return asc?result:-result;}return 0;});
   return selected;
  };
  const q={select(){return q;},eq(key,value){filters.push([key,value]);return q;},is(key,value){filters.push([key,value]);return q;},range(a,b){from=a;to=b;return q;},order(key,options={}){orders.push([key,options.ascending!==false]);return q;},limit(n){to=from+n-1;return q;},
   maybeSingle:async()=>{window.__healthQA.reads.push({table,single:true});const selected=rows();return selected.length>1?{data:null,error:{message:'Multiple synthetic rows'}}:{data:selected[0]||null,error:null};},
   then(resolve,reject){window.__healthQA.reads.push({table,from,to});return Promise.resolve({data:rows().slice(from,to+1),error:null}).then(resolve,reject);}
  };
  for(const name of ['insert','update','upsert','delete'])q[name]=()=>mutation(name,table);
  return q;
 }
})};
`;}
const browser=await chromium.launch({headless:true});
async function stableHome(page){
  await page.waitForFunction(()=>{
    const root=document.querySelector('[data-health-dashboard]');
    if(!root||document.querySelector('#syncText')?.textContent!=='Atualizado'||document.querySelector('#screenHost')?.dataset.productLayoutRoute!=='hoje')return false;
    if(window.__qaStableRoot!==root){window.__qaStableRoot=root;window.__qaStableFrames=0;}
    return ++window.__qaStableFrames>=3;
  });
}
async function focusIs(page,id){assert.equal(await page.evaluate(()=>document.activeElement?.id),id,`focus restored to #${id} after rendering`);}
async function quality(page,label){
  const text=await page.locator('[data-health-dashboard]').innerText();
  assert.doesNotMatch(text,/\b(?:NaN|undefined|Infinity)\b/,`${label}: no invalid value leaks`);
  const layout=await page.evaluate(()=>{
    const root=document.querySelector('[data-health-dashboard]'),host=document.querySelector('#screenHost');
    return {viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth,root:{width:root.clientWidth,scroll:root.scrollWidth},host:{width:host.clientWidth,scroll:host.scrollWidth}};
  });
  assert.ok(layout.document<=layout.viewport+1&&layout.body<=layout.viewport+1,`${label}: page overflow ${JSON.stringify(layout)}`);
  assert.ok(layout.root.scroll<=layout.root.width+1&&layout.host.scroll<=layout.host.width+1,`${label}: dashboard overflow ${JSON.stringify(layout)}`);
  const small=await page.locator('[data-health-dashboard]').evaluate(root=>[...root.querySelectorAll('button,input,select,summary,[role="button"]')].filter(el=>!el.disabled&&el.checkVisibility({checkVisibilityCSS:true})&&el.getBoundingClientRect().width>0).flatMap(el=>{
    const rect=el.getBoundingClientRect();return rect.width>=43.5&&rect.height>=43.5?[]:[{id:el.id,tag:el.tagName,text:el.textContent.trim().slice(0,70),width:rect.width,height:rect.height}];
  }));
  assert.deepEqual(small,[],`${label}: visible interactive targets must be at least 44 × 44 CSS pixels`);
  const clipped=await page.locator('.healthMetricValue strong,.healthMetricPeriod,.healthCoverage').evaluateAll(nodes=>nodes.filter(node=>node.scrollWidth>node.clientWidth+1).map(node=>node.textContent));
  assert.deepEqual(clipped,[],`${label}: metric values, dates and coverage cannot clip`);
  assert.equal(await page.locator('[data-dashboard-card]:visible').count(),7,'all accepted daily metrics remain visible without disclosure');
}
async function capture(page,name,selector){
  await stableHome(page);
  // A test-injected data/status change also reaches the compatibility controller
  // on its 250 ms cycle. Observe a quiet root and layout beyond that cycle before
  // measuring scroll/screenshot effects; ongoing redraws still fail by timeout.
  await page.evaluate(()=>{window.__qaCaptureStable=null;});
  await page.waitForFunction(()=>{
    const root=document.querySelector('[data-health-dashboard]'),host=document.querySelector('#screenHost');
    if(!root||!host)return false;
    const geometry=[root.clientWidth,root.scrollWidth,root.clientHeight,root.scrollHeight,host.clientWidth,host.clientHeight].join(','),now=performance.now();
    const previous=window.__qaCaptureStable;
    if(!previous||previous.root!==root||previous.geometry!==geometry){window.__qaCaptureStable={root,geometry,since:now};return false;}
    return now-previous.since>=350;
  });
  const handle=await page.locator('[data-health-dashboard]').elementHandle();
  if(selector)await page.locator(selector).first().scrollIntoViewIfNeeded();
  else await page.evaluate(()=>{document.querySelector('#screenHost').scrollTop=0;window.scrollTo(0,0);});
  await page.screenshot({path:`${dir}/${name}.png`,animations:'disabled'});
  assert.ok(await page.evaluate(root=>root===document.querySelector('[data-health-dashboard]'),handle),'scrolling/screenshots must not replace the dashboard DOM');
  await handle.dispose();
}
async function openDetails(page,selector){
  const details=page.locator(selector);if(!(await details.evaluate(el=>el.open)))await details.locator(':scope > summary').click();
  // Empty-string boolean attributes are valid; check the DOM property after click.
  assert.equal(await details.evaluate(el=>el.open),true);
}
async function selectPeriod(page,period){
  const control=page.locator('[data-dashboard-period]');await control.focus();await control.selectOption(period);await stableHome(page);
  assert.equal(await control.inputValue(),period);await focusIs(page,'dashboard-period');
}
async function assertMetrics(page,fixture,ui={}){
  const d=healthDashboardModel(fixture.data,fixture.status,ui,fixture.today);
  assert.equal(await page.locator('[data-dashboard-card]').count(),7);
  for(const key of METRIC_KEYS){
    const card=page.locator(`[data-dashboard-card="${key}"]`),m=d.metricsByKey[key];
    assert.equal((await card.locator('.healthMetricValue strong').innerText()).trim(),numberLabel(m.value,key),`${key}: displayed model value`);
    if(d.mode==='period'){
      const chosen=ui.dashboardSources?.[key]?m.source?.label:null;
      if(!chosen||chosen===`Synthetic ${['water','protein','energy'].includes(key)?'A food':'A watch'}`){
        const expected=expectedMetric(fixture,key,d.bounds);
        assert.ok(m.value===expected.value||Math.abs(m.value-expected.value)<1e-10,`${key}: independently computed arithmetic mean`);
        assert.equal(m.count,expected.count);
      }
      assert.equal(await card.locator('.healthCoverage').innerText(),`${m.count}/${m.expectedDays} dias usados na média`);
      assert.equal(await card.locator(':scope > .healthMetricPeriod').count(),0,'period window is shared above the cards');
      assert.ok((await page.locator('.healthWindow').innerText()).includes(`${dateLabel(d.bounds.start)} a ${dateLabel(d.bounds.end)}`),'shared period window remains exact');
      if(m.source)assert.ok((await card.locator('.healthPeriodSource').innerText()).includes(m.source.label),'full synthetic origin remains visible');
    }else{
      assert.equal(await card.locator(':scope > .healthMetricPeriod').count(),0,'daily date is shared above the seven cards');
      assert.equal(await card.locator(':scope > .healthAggregation').count(),0,'daily partial copy is not repeated in the cards');
      assert.ok((await page.locator('.healthWindow').innerText()).includes(dateLabel(d.date)),'selected daily date remains visible');
    }
  }
  return d;
}
async function returnHome(page,width){
  const nav=width<=840?'#mobileNav':'#primaryNav';await page.locator(`${nav} [data-route="hoje"]`).click();
  await page.waitForURL('**/#hoje');await stableHome(page);
}
async function visitAndReturn(page,width,route,from,expected){
  if(from)await from.click();
  else if(width<=840){await page.locator('#mobileNav [data-route="mais"]').click();await page.locator(`#moreSheet [data-route="${route}"]`).click();}
  else await page.locator(`#primaryNav [data-route="${route}"]`).click();
  await page.waitForURL(`**/#${route}`);
  await page.waitForFunction(()=>{const host=document.querySelector('#screenHost');return host&&host.textContent.trim().length>30&&!host.querySelector('.loadingState,.errorState');});
  await returnHome(page,width);
  assert.equal(await page.locator(`[data-dashboard-mode="${expected.mode}"]`).getAttribute('aria-pressed'),'true',`${route}: mode retained`);
  if(expected.mode==='day')assert.equal(await page.locator('[data-dashboard-date]').inputValue(),expected.date,`${route}: date retained`);
  else assert.equal(await page.locator('[data-dashboard-period]').inputValue(),expected.period,`${route}: period retained`);
  for(const [key,source] of Object.entries(expected.sources))assert.equal(await page.locator(`[data-dashboard-source="${key}"]`).inputValue(),source,`${route}: ${key} source retained`);
}
try{
  for(const [label,width,height] of [['desktop',1440,900],['tablet',900,900],['compact',500,835],['physical',393,650],['mobile',393,844],['small',320,650]])for(const sparse of label==='mobile'?[false,true]:[false]){
    const fixture=makeDashboardFixture(FIXED_TODAY,{sparse}),name=`${label}-${sparse?'sparse':'full'}`;
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:width<=840,hasTouch:width<=840,timezoneId:'America/Sao_Paulo',serviceWorkers:'block'});
    const external=[],networkWrites=[],errors=[];
    await context.route('**/*',route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.hostname==='cdn.jsdelivr.net'&&url.pathname==='/npm/@supabase/supabase-js@2'&&request.method()==='GET')return route.fulfill({status:200,contentType:'application/javascript',body:service(fixture.db)});
      if(url.origin===origin.origin&&['GET','HEAD'].includes(request.method()))return route.continue();
      if(!['GET','HEAD'].includes(request.method()))networkWrites.push({url:request.url(),method:request.method()});
      else external.push(request.url());
      return route.abort('blockedbyclient');
    });
    const page=await context.newPage();page.setDefaultTimeout(20000);
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('net::ERR_BLOCKED_BY_CLIENT'))errors.push(message.text());});
    await page.clock.setFixedTime(new Date(`${FIXED_TODAY}T15:00:00Z`));
    try{
      await page.goto(base+'#hoje');await stableHome(page);
      assert.equal(await page.locator('[data-dashboard-period]').inputValue(),'7');
      assert.equal(await page.locator('[data-dashboard-mode="period"]').getAttribute('aria-pressed'),'true');
      const initial=await assertMetrics(page,fixture);
      if(!sparse){const content=await page.locator('.healthMetricGrid,.healthGuidance,.healthContextGrid').evaluateAll(nodes=>nodes.map(node=>node.textContent.replace(/\s+/g,' ').trim()));if(label==='desktop')desktopContent=content;else assert.deepEqual(content,desktopContent,'every responsive size retains all values, sources, insights and domain context');}
      assert.deepEqual(await page.locator('[data-study-domain]').evaluateAll(nodes=>nodes.map(node=>node.dataset.studyDomain)),['training','labs','protocols','body']);
      await quality(page,`${name}/default`);
      if(width<=840){assert.deepEqual(await page.locator('#mobileNav [data-route]').evaluateAll(nodes=>nodes.map(node=>node.dataset.route)),['hoje','treinos','evolucao','mais']);assert.ok(await page.locator('#mobileNav [data-route]').evaluateAll(nodes=>nodes.every(node=>node.getBoundingClientRect().height>=44)));}
      await capture(page,`${name}-period-7-top`);
      await openDetails(page,'[data-disclosure="cockpit-details"]');
      for(const [section,selector] of [['metrics','.healthMetricGrid'],['guidance','.healthGuidance'],['training','[data-study-domain="training"]'],['labs','[data-study-domain="labs"]'],['protocols','[data-study-domain="protocols"]'],['body','[data-study-domain="body"]']])await capture(page,`${name}-${section}`,selector);
      const training=page.locator('[data-study-domain="training"]'),laboratory=page.locator('[data-study-domain="labs"]'),protocols=page.locator('[data-study-domain="protocols"]');
      assert.deepEqual(await training.locator('.healthTrainingCounts strong').evaluateAll(nodes=>nodes.map(node=>Number(node.firstChild.textContent.trim()))),sparse?[0,0]:[3,2]);
      assert.match(await training.innerText(),/Registros Polar/);
      assert.match(await training.innerText(),/Os totais não são somados/);
      assert.match(await laboratory.innerText(),/Última coleta:/);
      if(sparse)assert.match(await training.innerText(),/último conhecido, fora do período/);
      if(!sparse){assert.match(await training.innerText(),/9 exercícios/);assert.match(await training.innerText(),/9 séries registradas/);await openDetails(page,'[data-disclosure="dashboard-groups"]');assert.match(await training.innerText(),/Peito · 3 sessões em 2 dias/);assert.match(await training.innerText(),/Pernas: sem registro nesta janela/);}
      const exerciseDetail=training.locator('details[data-disclosure^="dashboard-workout-"]').first();
      if(await exerciseDetail.count()){await exerciseDetail.locator(':scope > summary').click();assert.ok(await exerciseDetail.locator('.healthExercise').count()>0);await quality(page,`${name}/exercise-detail`);await capture(page,`${name}-training-exercises`,'.healthExercise');}
      await capture(page,`${name}-training-polar`,'.healthPolar');
      assert.match(await laboratory.innerText(),/Último resultado conhecido · fora do período/);
      assert.match(await laboratory.innerText(),/aproximou da referência/);
      const firstLab=laboratory.locator('[data-dashboard-lab-item]').first();
      await firstLab.locator('details > summary').click();
      for(const age of [20,60])assert.ok((await firstLab.innerText()).includes(`${dateLabel(fixture.date(age))} · referência: 10 a 18`));
      assert.match(await protocols.innerText(),/Cadastro de plano não confirma início ou uso atual/);
      assert.ok(!(await protocols.innerText()).includes('Synthetic today protocol'));
      await openDetails(page,'[data-disclosure="dashboard-metric-water"]');
      const sourceControl=page.locator('[data-dashboard-source="water"]');
      const oldSource=initial.metricsByKey.water.sources.find(source=>source.label==='Synthetic older water').key;
      await sourceControl.focus();await sourceControl.selectOption(oldSource);await stableHome(page);await focusIs(page,'dashboard-source-water');
      assert.equal(await page.locator('[data-dashboard-card="water"] .healthMetricValue strong').innerText(),'—');
      assert.ok((await page.locator('[data-dashboard-card="water"]').innerText()).includes(`Último valor desta origem: 5.555 mL · ${dateLabel(fixture.date(40))}`));
      assert.equal(await page.locator('[data-disclosure="dashboard-metric-water"]').evaluate(el=>el.open),true,'open source disclosure is retained');
      const sourceB=initial.metricsByKey.water.sources.find(source=>source.label==='Synthetic B food').key;
      await sourceControl.focus();await sourceControl.selectOption(sourceB);await stableHome(page);await focusIs(page,'dashboard-source-water');
      const ui={dashboardSources:{water:sourceB}};
      await assertMetrics(page,fixture,ui);
      assert.equal(await page.locator('[data-dashboard-card="water"] .healthMetricValue strong').innerText(),numberLabel(expectedMetric(fixture,'water',initial.bounds,'B').value,'water'),'explicit source replaces, never adds to, source A');
      await quality(page,`${name}/expanded-source`);
      const signatures=[];
      for(const period of ['7','30','60','90','6m','1y','all']){
        await selectPeriod(page,period);const d=await assertMetrics(page,fixture,{...ui,dashboardPeriod:period});
        assert.equal(await sourceControl.inputValue(),sourceB,'source selection survives period changes');
        assert.equal(await page.locator('[data-disclosure="dashboard-metric-water"]').evaluate(el=>el.open),true,'period render preserves disclosure');
        const expected=dashboardContext(fixture.data,fixture.status,{bounds:d.bounds,today:d.today,mode:d.mode}).training;
        assert.deepEqual(await training.locator('.healthTrainingCounts strong').evaluateAll(nodes=>nodes.map(node=>Number(node.firstChild.textContent.trim()))),[expected.sessions,expected.recordedDays]);
        assert.equal(await training.locator('.healthSectionPeriod').innerText(),`${dateLabel(d.bounds.start)} a ${dateLabel(d.bounds.end)}`);
        assert.ok((await page.locator('.healthGuidance>header').innerText()).includes(dateLabel(d.bounds.start)));
        signatures.push({period,start:d.bounds.start,values:d.metrics.map(metric=>metric.value)});
        await quality(page,`${name}/${period}`);
      }
      assert.equal(new Set(signatures.map(item=>item.start)).size,7);
      if(!sparse)assert.equal(new Set(signatures.map(item=>JSON.stringify(item.values))).size,7,'all windows recompute all seven means');
      await capture(page,`${name}-history-top`);
      await selectPeriod(page,'7');
      // Real pointer click on a chart point, then keyboard alternative on the
      // single >=44px chart target. Dense series do not create tiny tab stops.
      const chart=page.locator('[data-dashboard-card="protein"] [data-dashboard-chart]');
      const target=page.locator(`[data-dashboard-card="protein"] g[data-dashboard-day="${fixture.date(3)}"]`);
      await target.click();await stableHome(page);
      assert.equal(await page.locator('[data-dashboard-date]').inputValue(),fixture.date(3));await focusIs(page,'dashboard-date');
      await assertMetrics(page,fixture,{...ui,dashboardMode:'day',dashboardDate:fixture.date(3)});
      await page.locator('[data-dashboard-mode="period"]').click();await stableHome(page);
      await chart.focus();await chart.press('Enter');await stableHome(page);
      assert.equal(await page.locator('[data-dashboard-date]').inputValue(),fixture.date(1));await focusIs(page,'dashboard-date');
      await page.locator('#dashboard-today').click();await stableHome(page);
      assert.equal(await page.locator('[data-dashboard-date]').inputValue(),FIXED_TODAY);
      assert.match(await page.locator('.healthWindow').innerText(),/hoje parcial/);
      await assertMetrics(page,fixture,{...ui,dashboardMode:'day',dashboardDate:FIXED_TODAY});
      await quality(page,`${name}/today`);await capture(page,`${name}-today-partial`);
      const date=fixture.date(40),dateInput=page.locator('[data-dashboard-date]');
      await dateInput.focus();await dateInput.fill(date);await dateInput.dispatchEvent('change');await stableHome(page);await focusIs(page,'dashboard-date');
      assert.equal(await dateInput.inputValue(),date);assert.match(await page.locator('.healthWindow').innerText(),/dia encerrado/);
      await assertMetrics(page,fixture,{...ui,dashboardMode:'day',dashboardDate:date});
      assert.ok((await laboratory.innerText()).includes(dateLabel(fixture.date(60))));assert.ok(!(await laboratory.innerText()).includes(dateLabel(fixture.date(20))));
      assert.ok(!(await protocols.innerText()).includes(dateLabel(fixture.date(2))));
      await quality(page,`${name}/historical-day`);await capture(page,`${name}-historical-day`);
      // A source remains selected while all four deep routes are visited.
      const remembered={mode:'day',date,sources:{water:sourceB}};
      for(const route of ['treinos','saude','tratamentos','bio']){
        const selector=route==='treinos'?'[data-study-domain="training"] [data-route="treinos"]':route==='saude'?'[data-study-domain="labs"] [data-route="saude"]':route==='tratamentos'?'[data-study-domain="protocols"] [data-route="tratamentos"]':null;
        await visitAndReturn(page,width,route,selector?page.locator(selector).last():null,remembered);
        await assertMetrics(page,fixture,{...ui,dashboardMode:'day',dashboardDate:date});
      }
      await page.locator('[data-dashboard-mode="period"]').click();await stableHome(page);await focusIs(page,'dashboard-mode-period');
      assert.equal(await page.locator('[data-dashboard-period]').inputValue(),'7','day mode retains the saved period');
      await selectPeriod(page,'90');
      await visitAndReturn(page,width,'treinos',page.locator('[data-study-domain="training"] [data-route="treinos"]').last(),{mode:'period',period:'90',sources:{water:sourceB}});
      // Body and labs have their own windows. Home must not truncate or overwrite them.
      if(width<=840){await page.locator('#mobileNav [data-route="mais"]').click();await page.locator('#moreSheet [data-route="bio"]').click();}else await page.locator('#primaryNav [data-route="bio"]').click();
      await page.waitForSelector('.ltsCompositionV2');
      assert.equal(await page.locator('[data-depth-period="productCompositionPeriod"][data-value="365"]').getAttribute('aria-pressed'),'true','body defaults to its own recent year while Home remains 90 days');
      await page.locator('[data-depth-period="productCompositionPeriod"][data-value="all"]').click();
      assert.equal(await page.locator('[data-depth-period="productCompositionPeriod"][data-value="all"]').getAttribute('aria-pressed'),'true','the complete observed history remains an explicit choice');
      assert.equal(await page.locator('.ltsCompositionChart circle').count(),sparse?2:7);
      await page.locator('[data-depth-period="productCompositionPeriod"][data-value="90"]').click();
      assert.equal(await page.locator('[data-depth-period="productCompositionPeriod"][data-value="90"]').getAttribute('aria-pressed'),'true');
      assert.equal(await page.locator('.ltsCompositionChart circle').count(),sparse?2:4);
      await page.locator('[data-depth-period="productCompositionPeriod"][data-value="30"]').click();
      assert.equal(await page.locator('.ltsCompositionChart circle').count(),sparse?1:2);
      await page.locator('.ltsCompositionV2>.ltsPageHeader .ltsBack').click();await stableHome(page);
      assert.equal(await page.locator('[data-dashboard-period]').inputValue(),'90','body 30 days must not change Home 90 days');
      await selectPeriod(page,'7');
      if(width<=840){await page.locator('#mobileNav [data-route="mais"]').click();await page.locator('#moreSheet [data-route="bio"]').click();}else await page.locator('#primaryNav [data-route="bio"]').click();
      await page.waitForSelector('.ltsCompositionV2');assert.equal(await page.locator('[data-depth-period="productCompositionPeriod"][data-value="30"]').getAttribute('aria-pressed'),'true','body keeps its selected window after Home changes to 7 days');
      assert.equal(await page.locator('.ltsCompositionChart circle').count(),sparse?1:2);
      await page.locator('.ltsCompositionV2>.ltsPageHeader .ltsBack').click();await stableHome(page);assert.equal(await page.locator('[data-dashboard-period]').inputValue(),'7');
      await selectPeriod(page,'90');
      if(width<=840){await page.locator('#mobileNav [data-route="mais"]').click();await page.locator('#moreSheet [data-route="saude"]').click();}else await page.locator('#primaryNav [data-route="saude"]').click();
      await page.waitForSelector('.ltsLabsV2');assert.equal(await page.locator('[data-depth-period="productLabPeriod"][data-value="all"]').getAttribute('aria-pressed'),'true','labs default to full history despite Home 90 days');assert.equal(await page.locator('#productLabCollection option').count(),2);
      await page.locator('[data-depth-period="productLabPeriod"][data-value="90"]').click();assert.equal(await page.locator('#productLabCollection option').count(),2);
      await page.locator('[data-depth-period="productLabPeriod"][data-value="30"]').click();assert.equal(await page.locator('#productLabCollection option').count(),1);
      await page.locator('.ltsLabsV2>.ltsPageHeader .ltsBack').click();await stableHome(page);assert.equal(await page.locator('[data-dashboard-period]').inputValue(),'90');
      await selectPeriod(page,'7');
      if(width<=840){await page.locator('#mobileNav [data-route="mais"]').click();await page.locator('#moreSheet [data-route="saude"]').click();}else await page.locator('#primaryNav [data-route="saude"]').click();
      await page.waitForSelector('.ltsLabsV2');assert.equal(await page.locator('[data-depth-period="productLabPeriod"][data-value="30"]').getAttribute('aria-pressed'),'true','labs keep their chosen window after Home changes');assert.equal(await page.locator('#productLabCollection option').count(),1);
      await page.locator('.ltsLabsV2>.ltsPageHeader .ltsBack').click();await stableHome(page);assert.equal(await page.locator('[data-dashboard-period]').inputValue(),'7');
      await selectPeriod(page,'90');
      if(width<=840){await page.locator('#mobileNav [data-route="mais"]').click();await page.locator('#moreSheet [data-route="nutricao"]').click();}else await page.locator('#primaryNav [data-route="nutricao"]').click();
      await page.waitForSelector('.ltsNutritionProduct');assert.equal(await page.locator('[data-period="90"]').getAttribute('aria-pressed'),'true');
      await returnHome(page,width);assert.equal(await page.locator('[data-dashboard-period]').inputValue(),'90');
      // A calendar year is not always 365 days: unrelated domain selection must
      // not silently rewrite Home's separately selected 12-month calendar.
      await selectPeriod(page,'1y');
      if(width<=840){await page.locator('#mobileNav [data-route="mais"]').click();await page.locator('#moreSheet [data-route="bio"]').click();}else await page.locator('#primaryNav [data-route="bio"]').click();
      await page.waitForSelector('.ltsCompositionV2');await page.locator('[data-depth-period="productCompositionPeriod"][data-value="365"]').click();
      await page.locator('.ltsCompositionV2>.ltsPageHeader .ltsBack').click();await stableHome(page);assert.equal(await page.locator('[data-dashboard-period]').inputValue(),'1y','365-day domain window cannot redefine Home calendar-year bounds');
      await selectPeriod(page,'all');
      if(width<=840){await page.locator('#mobileNav [data-route="mais"]').click();await page.locator('#moreSheet [data-route="bio"]').click();}else await page.locator('#primaryNav [data-route="bio"]').click();
      await page.waitForSelector('.ltsCompositionV2');assert.equal(await page.locator('[data-depth-period="productCompositionPeriod"][data-value="365"]').getAttribute('aria-pressed'),'true','Home history cannot reset an explicit 365-day body window');
      assert.equal(await page.locator('.ltsCompositionChart circle').count(),sparse?2:6);
      await page.locator('[data-depth-period="productCompositionPeriod"][data-value="all"]').click();assert.equal(await page.locator('.ltsCompositionChart circle').count(),sparse?2:7);
      await page.locator('.ltsCompositionV2>.ltsPageHeader .ltsBack').click();await stableHome(page);assert.equal(await page.locator('[data-dashboard-period]').inputValue(),'all');
      await page.locator('[data-dashboard-mode="day"]').click();await stableHome(page);await focusIs(page,'dashboard-mode-day');
      assert.equal(await page.locator('[data-dashboard-date]').inputValue(),date,'period changes retain the chosen historical day');
      if(!sparse){
        await page.locator('[data-dashboard-mode="period"]').click();await stableHome(page);await selectPeriod(page,'7');
        await page.evaluate(async conflictDate=>{const {state}=await import('./src/core.js');const row=state.data.nutrition.find(row=>row.nutrition_date===conflictDate&&row.source==='Synthetic B food');state.data.nutrition=[...state.data.nutrition,{...row,source_record_id:'synthetic-conflicting-food',water_ml:99999}];const {renderProductHomeReference}=await import('./src/home-reference.js');document.querySelector('#screenHost').innerHTML=renderProductHomeReference();},fixture.date(3));
        await stableHome(page);assert.equal(await page.locator('[data-dashboard-card="water"] .healthCoverage').innerText(),'6/7 dias usados na média');
        await page.locator('[data-dashboard-mode="day"]').click();await stableHome(page);await page.locator('[data-dashboard-date]').fill(fixture.date(3));await page.locator('[data-dashboard-date]').dispatchEvent('change');await stableHome(page);
        assert.equal(await page.locator('[data-dashboard-card="water"] .healthMetricValue strong').innerText(),'—','same-origin conflict cannot silently choose or sum');
        await openDetails(page,'[data-disclosure="dashboard-metric-water"]');assert.match(await page.locator('[data-dashboard-card="water"]').innerText(),/99\.999/);assert.match(await page.locator('[data-dashboard-card="water"]').innerText(),/5\.030/);
      }
      await page.evaluate(async()=>{const {state}=await import('./src/core.js');for(const key of ['body','nutrition','sourceMetrics','metrics','workouts','labs'])state.domainStatus[key]='error';const {renderProductHomeReference}=await import('./src/home-reference.js');document.querySelector('#screenHost').innerHTML=renderProductHomeReference();});
      await stableHome(page);for(const key of METRIC_KEYS)assert.equal(await page.locator(`[data-dashboard-card="${key}"] .healthMetricValue strong`).innerText(),'—','failed readers never retain a stale value');
      assert.match(await page.locator('[data-health-dashboard]').innerText(),/não carreg/);assert.equal(await page.locator('[id]').evaluateAll(nodes=>nodes.length===new Set(nodes.map(node=>node.id)).size),true);
      await quality(page,`${name}/failed-read`);await capture(page,`${name}-failed-read`);
      // Production has no preview proxy. This read/navigation suite must still
      // produce zero writes; operational writes are tested by the separate suite.
      const audit=await page.evaluate(()=>({readOnly:Boolean(window.LTSPreviewReadOnly),writes:window.__healthQA.writes,readTables:[...new Set(window.__healthQA.reads.map(read=>read.table))]}));
      assert.equal(audit.readOnly,false);assert.deepEqual(audit.writes,[]);assert.deepEqual(networkWrites,[]);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
      assert.ok(audit.readTables.includes('health_daily_nutrition')&&audit.readTables.includes('health_lab_results'));
      results.push({name,width,height,status:'passed',windows:signatures,writeCount:0,externalRequestCount:0});
      writeFileSync(`${dir}/results.json`,JSON.stringify({syntheticOnly:true,today:FIXED_TODAY,results},null,2));
      console.log(`${name}: periods/day, seven values, sources, four routes, focus, 44px controls, overflow and zero writes passed.`);
    }catch(error){
      await page.screenshot({path:`${dir}/${name}-failure.png`,animations:'disabled'}).catch(()=>{});
      results.push({name,width,height,status:'failed',error:String(error.message),pageErrors:errors,blockedExternal:external,networkWrites});
      writeFileSync(`${dir}/results.json`,JSON.stringify({syntheticOnly:true,today:FIXED_TODAY,results},null,2));
      throw error;
    }finally{await context.close();}
  }
}finally{await browser.close();}
console.log('Production daily/period dashboard: seven synthetic responsive scenarios passed; screenshots in v2/reference-period-visual.');
