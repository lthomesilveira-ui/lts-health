import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {changesFixture,TODAY} from './dashboard-changes-fixture.mjs';
// Synthetic, loopback-only acceptance of the real module routes. No real login,
// private records, Supabase traffic, integration calls or persisted mutations.
const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/preview/compact-evidence/';
const origin=new URL(base);assert.ok(['127.0.0.1','localhost','[::1]'].includes(origin.hostname));
assert.ok(['/preview/compact-evidence/','/v2/'].includes(origin.pathname));assert.equal(origin.search,'');
const f=changesFixture(),tables={body:'health_body_composition',labs:'health_lab_results',workouts:'health_workouts',exercises:'health_workout_exercises',sets:'health_workout_sets',nutrition:'health_daily_nutrition',goals:'health_personal_goals',docs:'health_documents'};
const db=Object.fromEntries(Object.entries(tables).map(([key,table])=>[table,f.data[key]]));
const sdk=`window.__changesQA={writes:[],calls:[]};window.supabase={createClient:()=>({
 auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-changes-user'}}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
 from(table){let start=0,end=999;const filters=[];const rows=()=>(${JSON.stringify(db)}[table]||[]).filter(r=>filters.every(([k,v])=>r[k]===v));const q={select(){return q},eq(k,v){filters.push([k,v]);return q},is(k,v){filters.push([k,v]);return q},order(){return q},range(a,b){start=a;end=b;return q},limit(n){end=start+n-1;return q},maybeSingle:async()=>({data:rows()[0]||null,error:null}),then(resolve,reject){return Promise.resolve({data:rows().slice(start,end+1),error:null}).then(resolve,reject)}};for(const op of ['insert','update','upsert','delete'])q[op]=()=>{window.__changesQA.writes.push(op);throw Error('No writes')};return q},
 functions:{invoke(name,options){window.__changesQA.calls.push([name,options?.body?.action]);if(options?.body?.action==='status')return Promise.resolve({data:{configured:false,connected:false},error:null});window.__changesQA.writes.push(name);throw Error('No integration mutation')}},
 rpc(){window.__changesQA.writes.push('rpc');throw Error('No writes')}})};`;
const directory='dashboard-changes-visual';mkdirSync(directory,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await context.route('**/*',route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.hostname==='cdn.jsdelivr.net'&&url.pathname==='/npm/@supabase/supabase-js@2')return route.fulfill({contentType:'application/javascript',body:sdk});
   if(url.origin===origin.origin&&['GET','HEAD'].includes(req.method()))return route.continue();
   return route.abort('blockedbyclient');
  });
  await page.clock.install({time:new Date(TODAY+'T15:00:00Z')});
  await page.goto(base+'#hoje');
  await page.locator('[data-disclosure="cockpit-details"]>summary').click();
  const training=page.locator('[data-dashboard-change-domain="training"]');
  await page.waitForFunction(()=>document.querySelector('[data-dashboard-change-domain="training"]')?.textContent.includes('aumentou 5 kg'));
  assert.equal(await page.locator('[data-dashboard-card]').count(),7);assert.equal(await page.locator('[data-dashboard-change-domain]').count(),3);
  assert.match(await page.locator('[data-dashboard-change-domain="body"]').innerText(),/diminuiu 1 kg/);
  assert.match(await page.locator('[data-dashboard-change-domain="labs"]').innerText(),/13 u/);
  await page.locator('.healthGuidance').scrollIntoViewIfNeeded();await page.screenshot({path:`${directory}/changes-${width}.png`});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal page overflow');
  const targets=await page.locator('.healthGuidance').evaluate(root=>[...root.querySelectorAll('button,summary')].filter(el=>el.checkVisibility({checkVisibilityCSS:true})).map(el=>({text:el.textContent,rect:el.getBoundingClientRect().toJSON()})));
  assert.ok(targets.every(t=>t.rect.height>=43.5&&t.rect.width>=43.5),'visible insight actions have 44px targets');
  await page.locator('[data-dashboard-change="body:body-0"]').click();
  await page.waitForSelector('[data-composition-view="detail"]');
  assert.equal(await page.evaluate(()=>document.body.dataset.productRoute),'bio','body drilldown owns its route styling');
  assert.match(await page.locator('.ltsHistoryContext').first().innerText(),/11\/10\/2026/);
  assert.match(await page.locator('.ltsRecordDetails').first().innerText(),/80,0 kg/);
  await page.evaluate(()=>location.hash='#hoje');await page.waitForSelector('[data-health-cockpit]');if(!await page.locator('[data-disclosure="cockpit-details"]').evaluate(el=>el.open))await page.locator('[data-disclosure="cockpit-details"]>summary').click();
  await page.locator('[data-dashboard-change="training:workout-1:exercise-1"]').click();
  await page.waitForSelector('[data-workout-id="workout-1"]');
  assert.equal(await page.evaluate(()=>document.body.dataset.productRoute),'treinos','training drilldown owns its route styling');
  assert.match(await page.locator('[data-workout-id="workout-1"]').innerText(),/25/);
  await page.evaluate(()=>location.hash='#hoje');await page.waitForSelector('[data-health-cockpit]');if(!await page.locator('[data-disclosure="cockpit-details"]').evaluate(el=>el.open))await page.locator('[data-disclosure="cockpit-details"]>summary').click();
  await page.locator('[data-dashboard-change-domain="labs"] [data-dashboard-change]').click();
  await page.waitForSelector('[data-lab-asof]');
  assert.match(await page.locator('.ltsLabsHero').innerText(),/15\/10\/2026/);assert.match(await page.locator('.ltsLabsHero').innerText(),/13 u/);
  assert.equal(await page.evaluate(()=>document.body.dataset.productRoute),'saude','exact drilldown changes route styling, not only content');
  for(const selector of ['.ltsLabsV2 h1','.ltsLabsV2 [data-lab-clear-asof]']){
   const contrast=await page.locator(selector).evaluate(el=>{
    const rgb=text=>{const parts=text.match(/[\d.]+/g)?.map(Number)||[];return parts.length===4&&parts[3]===0?null:parts.slice(0,3);};
    const foreground=rgb(getComputedStyle(el).color);let background=null;
    for(let node=el;node&&!background;node=node.parentElement)background=rgb(getComputedStyle(node).backgroundColor);
    if(!foreground||!background||background.length!==3)return 0;
    const luminance=channels=>channels.map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
    const a=luminance(foreground),b=luminance(background);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
   });
   assert.ok(contrast>=4.5,`${selector}: readable contrast after historical drilldown (${contrast})`);
  }
  const clearBounds=await page.locator('[data-lab-clear-asof]').boundingBox();assert.ok(clearBounds.width>=44&&clearBounds.height>=44,'historical cutoff action stays touch-accessible');
  await page.screenshot({path:`${directory}/lab-drilldown-${width}.png`});
  await page.locator('[data-lab-clear-asof]').click();assert.equal(await page.locator('[data-lab-asof]').count(),0);
  assert.deepEqual(await page.evaluate(()=>window.__changesQA.writes),[]);assert.deepEqual(errors,[]);
  await context.close();
 }
}finally{await browser.close();}
console.log('Synthetic dashboard changes: readable values, seven-card grid, exact body/workout/lab navigation, historical scope, mobile/desktop layout and no mutations.');
