import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {healthDashboardModel} from '../src/health-dashboard-model.js';
import {dashboardContext} from '../src/health-dashboard-context.js';
import {FIXED_TODAY,METRIC_KEYS,makeDashboardFixture,expectedMetric,dateLabel,numberLabel} from './health-dashboard-render-test.mjs';

// CI browser contract, using the repository's existing playwright@1.56.1.
// No installation, real authentication, real records or external requests.
// Run against the isolated preview served by the existing CI HTTP server.
const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/preview/compact-evidence/';
const origin=new URL(base);
assert.ok(['127.0.0.1','localhost','[::1]'].includes(origin.hostname),'Synthetic browser QA is restricted to loopback');
assert.ok(origin.pathname.endsWith('/preview/compact-evidence/'),'Only the isolated preview may be tested');
assert.equal(origin.search,'','The SDK mock uses the real preview route, without fixture/demo mode');
const dir='health-dashboard-visual';mkdirSync(dir,{recursive:true});
const results=[];
function service(db){return `
window.__healthQA={reads:[],writes:[]};
window.__reviewDb=${JSON.stringify(db)};
const mutation=(kind,target)=>{window.__healthQA.writes.push({kind,target});throw new Error('Synthetic QA forbids writes: '+kind+' '+target);};
window.supabase={createClient:()=>({
 auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-health-dashboard-user'}}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
 functions:{invoke:(name)=>mutation('invoke',name)},rpc:(name)=>mutation('rpc',name),
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
}
async function capture(page,name,selector){
  await stableHome(page);
  const handle=await page.locator('[data-health-dashboard]').elementHandle();
  if(selector)await page.locator(selector).scrollIntoViewIfNeeded();
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
      assert.equal(await card.locator('.healthCoverage').innerText(),`${m.count}/${m.expectedDays} dias com valor elegível`);
      assert.equal(await card.locator('.healthMetricPeriod').innerText(),`${dateLabel(d.bounds.start)} a ${dateLabel(d.bounds.end)}`);
    }else assert.equal(await card.locator('.healthMetricPeriod').innerText(),dateLabel(d.date));
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
  for(const [label,width,height] of [['small',320,740],['mobile',393,844],['desktopNarrow',1180,757],['desktop',1440,900]])for(const sparse of [false,true]){
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
      assert.deepEqual(await page.locator('[data-study-domain]').evaluateAll(nodes=>nodes.map(node=>node.dataset.studyDomain)),['training','labs','protocols','body']);
      await quality(page,`${name}/default`);
      if(width<=840){assert.deepEqual(await page.locator('#mobileNav [data-route]').evaluateAll(nodes=>nodes.map(node=>node.dataset.route)),['hoje','treinos','analise','mais']);assert.ok(await page.locator('#mobileNav [data-route]').evaluateAll(nodes=>nodes.every(node=>node.getBoundingClientRect().height>=44)));}
      await capture(page,`${name}-period-7-top`);
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
      assert.equal(await page.locator('[data-dashboard-card="water"] .healthMetricValue strong').innerText(),'Sem dado');
      assert.ok((await page.locator('[data-dashboard-card="water"]').innerText()).includes(`Última data recebida: ${dateLabel(fixture.date(40))}`));
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
      await page.locator('[data-dashboard-mode="day"]').click();await stableHome(page);await focusIs(page,'dashboard-mode-day');
      assert.equal(await page.locator('[data-dashboard-date]').inputValue(),date,'period changes retain the chosen historical day');
      // Guard probes must be rejected before the mock backend sees any write.
      const guard=await page.evaluate(()=>{
        const client=window.supabase.createClient('synthetic','synthetic'),blocked=[];
        for(const [name,operation] of [['insert',()=>client.from('synthetic').insert({})],['update',()=>client.from('synthetic').update({})],['delete',()=>client.from('synthetic').delete()],['rpc',()=>client.rpc('synthetic')],['invoke',()=>client.functions.invoke('synthetic')]]){
          try{operation();blocked.push({name,blocked:false});}catch(error){blocked.push({name,blocked:error.code==='preview_read_only'});}
        }
        return {blocked,writes:window.__healthQA.writes,readTables:[...new Set(window.__healthQA.reads.map(read=>read.table))]};
      });
      assert.ok(guard.blocked.every(item=>item.blocked));assert.deepEqual(guard.writes,[]);assert.deepEqual(networkWrites,[]);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
      assert.ok(guard.readTables.includes('health_daily_nutrition')&&guard.readTables.includes('health_lab_results'));
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
console.log('Health dashboard browser: eight synthetic responsive scenarios passed; screenshots in health-dashboard-visual.');
