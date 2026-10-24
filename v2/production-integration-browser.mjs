import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
mkdirSync('artifacts/production-integration',{recursive:true});
import {chromium} from 'playwright';
import {FIXED_TODAY,makeDashboardFixture} from '../preview/compact-evidence/tests/health-dashboard-render-test.mjs';
const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4175/v2/';
const parsed=new URL(base);assert.ok(['127.0.0.1','localhost'].includes(parsed.hostname));assert.equal(parsed.pathname,'/v2/');
function service(db){return `
window.__healthQA={reads:[],writes:[]};
window.__reviewDb=${JSON.stringify(db)};
const mutation=(kind,target)=>{window.__healthQA.writes.push({kind,target});throw new Error('Synthetic QA forbids writes: '+kind+' '+target);};
window.supabase={createClient:()=>({
 auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-health-dashboard-user'}}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signOut:async()=>({error:null})},
 functions:{invoke:async(name,args)=>{if(args?.body?.action!=='status')return mutation('invoke',name);return {data:{configured:false,connected:false,received:false},error:null}}},rpc:(name)=>mutation('rpc',name),
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

const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
for(const width of [320,393,1440]){
 const page=await browser.newPage({viewport:{width,height:900}});const errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.hostname==='cdn.jsdelivr.net'&&url.pathname==='/npm/@supabase/supabase-js@2')return route.fulfill({contentType:'application/javascript',body:service(makeDashboardFixture(FIXED_TODAY).db)});
  if(url.origin===parsed.origin&&route.request().method()==='GET')return route.continue();
  external.push({origin:url.origin,method:route.request().method()});return route.abort();
 });
 await page.clock.setFixedTime(new Date(FIXED_TODAY+'T15:00:00Z'));
 await page.goto(base+'#hoje');
 await page.locator('[data-health-dashboard]').waitFor();
 assert.equal(await page.locator('[data-preview-readonly-banner]').count(),0);
 assert.equal(await page.locator('[data-dashboard-card]').count(),7);
 for(const route of ['treinos','bio','nutricao','saude','analise','tratamentos','dados','timeline','evolucao','hoje']){
  await page.evaluate(r=>{location.hash=r},route);
  await page.waitForTimeout(150);
  await page.waitForFunction(r=>document.querySelector('#screenHost')?.dataset.productLayoutRoute===r||r==='evolucao'||r==='timeline'||r==='dados'||r==='tratamentos',route);
  assert.ok((await page.locator('#screenHost').innerText()).trim().length>30,route+' renders');
  assert.equal(await page.evaluate(async()=>{const {state}=await import('./src/core.js');return state.route}),route);
  await page.screenshot({path:`artifacts/production-integration/${route}-${width}.png`,fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,route+' fits '+width);
  if(['bio','treinos'].includes(route)){
   await page.locator(`#screenHost [data-entry="${route==='bio'?'body':'workout'}"]`).click();await page.locator('#entryModal:not(.hidden)').waitFor();
   assert.equal(await page.locator('#entryModal input:not([disabled])').count()>0,true,'operational fields available');
   await page.locator('#closeEntry').click();await page.locator('#entryModal').waitFor({state:'hidden'});
   assert.equal(await page.locator('#entryModal').evaluate(e=>e.classList.contains('hidden')),true);
   await page.locator(`#screenHost [data-entry="${route==='bio'?'body':'workout'}"]`).click();await page.locator('#entryModal:not(.hidden)').waitFor();
   await page.locator('#closeEntry').click();await page.locator('#entryModal').waitFor({state:'hidden'});
   assert.equal(await page.locator('#entryModal').evaluate(e=>e.classList.contains('hidden')),true);
   assert.equal(await page.evaluate(()=>location.hash),'#'+route,'cancel retains route');
  }
 }
 const forms=await page.evaluate(async()=>{
  const {state}=await import('./src/core.js');
  const {renderGoals}=await import('./src/personal-goals.js');
  state.domainStatus.goals='ready';const host=document.createElement('div');host.innerHTML=renderGoals();
  return {goalsDisabled:host.querySelector('button[type="submit"]').disabled,preview:!!window.LTSPreviewReadOnly};
 });
 assert.deepEqual(forms,{goalsDisabled:false,preview:false});
 await page.screenshot({path:`artifacts/production-integration/home-${width}.png`,fullPage:true});
 assert.deepEqual(await page.evaluate(()=>window.__healthQA.writes),[],'navigation produces no writes when disconnected');
 await page.locator('#logoutBtn').click();await page.locator('#login:not(.hidden)').waitFor();
 assert.equal(await page.locator('#app').evaluate(e=>e.classList.contains('hidden')),true);
 assert.deepEqual(errors,[]);assert.deepEqual(external,[],'no unexpected external request');await page.close();
}
// Missing real session must remain at login, not enter fixture or render data.
const page=await browser.newPage();
await page.route('**/*',route=>{
 if(new URL(route.request().url()).origin===parsed.origin)return route.continue();
 if(route.request().url().includes('@supabase/supabase-js'))return route.fulfill({contentType:'application/javascript',body:"window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}})}"});
 return route.abort();
});
await page.goto(base);await page.locator('#login:not(.hidden)').waitFor();
assert.equal(await page.locator('#app').evaluate(e=>e.classList.contains('hidden')),true);
await browser.close();console.log('Production entry at 320/393/1440px, 10 routes, logout, absent-session auth and operational goals form passed; synthetic authenticated SDK only; no external writes.');
