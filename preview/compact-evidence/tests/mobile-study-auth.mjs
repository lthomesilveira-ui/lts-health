import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/preview/compact-evidence/';
const service=`window.__anonymousReads=0;window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from(){window.__anonymousReads++;throw new Error('Anonymous data read must not occur');}})};`;
const authenticatedService=`window.__previewBackend={reads:0,writes:0,functions:0,signouts:0};
window.supabase={createClient:()=>{
 const count=window.__previewBackend;let authCallback=null;
 const mutation=()=>{count.writes++;return Promise.resolve({data:null,error:null});};
 const query={select(){return this;},eq(){return this;},is(){return this;},range(){return this;},order(){return this;},then(resolve,reject){count.reads++;return Promise.resolve({data:[],error:null}).then(resolve,reject);},insert:mutation,update:mutation,upsert:mutation,delete:mutation};
 return {auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-preview-user'}}},error:null}),onAuthStateChange:callback=>{authCallback=callback;return {data:{subscription:{unsubscribe(){}}}};},signOut:async()=>{count.signouts++;authCallback?.('SIGNED_OUT',null);return {error:null};}},from:()=>query,rpc:mutation,storage:{from:()=>({upload:mutation,remove:mutation,move:mutation,copy:mutation})},functions:{invoke:async()=>{count.functions++;return {data:{configured:true,connected:true,last_attempt_at:null},error:null};}}};
}};`;
async function intercept(page,body){await page.route('**/*',route=>{const url=route.request().url();if(url.startsWith('https://cdn.jsdelivr.net/'))return route.fulfill({contentType:'application/javascript',body});if(new URL(url).origin===new URL(base).origin)return route.continue();return route.abort();});}
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await intercept(page,service);
 await page.goto(base+'#hoje');await page.locator('#login').waitFor({state:'visible'});await page.waitForTimeout(400);
 assert.equal(await page.locator('#app').isVisible(),false);assert.equal(await page.locator('[data-mobile-study]:visible').count(),0);assert.equal(await page.evaluate(()=>window.__anonymousReads),0);assert.deepEqual(errors,[]);
 assert.equal(await page.locator('#email').isDisabled(),false);assert.equal(await page.locator('#password').isDisabled(),false);assert.equal(await page.locator('#loginBtn').isDisabled(),false);await page.close();
 const signedIn=await browser.newPage();const signedInErrors=[];signedIn.on('pageerror',e=>signedInErrors.push(e.message));await intercept(signedIn,authenticatedService);
 await signedIn.goto(base+'#hoje');await signedIn.locator('[data-mobile-study]').waitFor();await signedIn.waitForTimeout(400);
 assert.equal(await signedIn.locator('.studyBrand').count(),1);
 await signedIn.locator('[data-home-period-select]').selectOption('30');assert.equal(await signedIn.locator('[data-home-period-select]').inputValue(),'30','period filter stays interactive');
 await signedIn.locator('#primaryNav [data-route="mais"]').click();await signedIn.locator('#moreSheet [data-route="nutricao"]').click();await signedIn.locator('#personalGoalsForm').waitFor({state:'attached'});
 assert.equal(await signedIn.locator('#personalGoalsForm input:not([disabled]),#personalGoalsForm button:not([disabled])').count(),0);
 assert.match(await signedIn.locator('#personalGoalsForm [data-preview-readonly-warning]').textContent(),/Prévia somente leitura/);
 assert.equal(await signedIn.evaluate(()=>document.querySelector('#personalGoalsForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))),false,'submit is stopped before application mutation');
 const blocked=await signedIn.evaluate(async()=>{
   const {sb}=await import('./src/core.js?v=health-dashboard-20261019.71');const attempts=[()=>sb.from('synthetic').insert({}),()=>sb.from('synthetic').update({}),()=>sb.from('synthetic').upsert({}),()=>sb.from('synthetic').delete(),()=>sb.rpc('synthetic'),()=>sb.storage.from('synthetic').upload('fixture',{}),()=>sb.functions.invoke('health-polar-connection',{body:{action:'sync'}})];
   return attempts.map(run=>{try{run();return false;}catch(error){return error.code==='preview_read_only';}});
 });
 assert.ok(blocked.every(Boolean));const counters=await signedIn.evaluate(()=>window.__previewBackend);assert.ok(counters.reads>0);assert.equal(counters.writes,0);assert.equal(counters.functions,0,'automatic Polar status/sync never reaches backend');
 await signedIn.locator('#logoutBtn').click();await signedIn.locator('#login').waitFor({state:'visible'});assert.equal(await signedIn.evaluate(()=>window.__previewBackend.signouts),1);assert.deepEqual(signedInErrors,[]);await signedIn.close();
}finally{await browser.close();}
console.log('Preview: signed-out login has no data reads/fallback; authenticated reads and filters work; forms and backend mutation/sync are blocked; logout remains available.');
