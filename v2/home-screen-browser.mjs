import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {chromium,webkit} from 'playwright';
import {makeDashboardFixture} from '../preview/compact-evidence/tests/health-dashboard-render-test.mjs';
import {sourceWindowService} from '../preview/compact-evidence/tests/source-window-service-fixture.mjs';
import {languageDatabase} from '../preview/compact-evidence/tests/consumer-language-fixture.mjs';
import {consumerRouteSettled} from '../preview/compact-evidence/tests/consumer-language-readiness.mjs';
const base='http://127.0.0.1:4173/v2/',origin=new URL(base),dir='health-home-screen-visual',results=[];
const html=readFileSync(new URL('./index.html',import.meta.url),'utf8'),current=html.match(/name="lts-build" content="([^"]+)"/)[1],next='health-integrated-synthetic-next';
const signedOut=`window.__pwaWrites=[];window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from(){window.__pwaWrites.push('table');throw Error('No data before login')},rpc(){window.__pwaWrites.push('rpc');throw Error('No writes')},functions:{invoke(){window.__pwaWrites.push('invoke');throw Error('No functions before login')}}})};`;
mkdirSync(dir,{recursive:true});
async function fit(page){
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page fits screen');
 const dialog=page.locator('#healthInstallGuide');if(await dialog.isVisible()){
  assert.ok(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'guide fits its modal');
  const b=await dialog.boundingBox();assert.ok(b.x>=0&&b.x+b.width<=page.viewportSize().width+1);assert.ok(b.y>=0&&b.y+b.height<=page.viewportSize().height+1);
  assert.ok(await dialog.locator('button').evaluate(el=>{const b=el.getBoundingClientRect();return b.width>=44&&b.height>=44;}));
 }
}
for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch({headless:true});
 try{
  for(const [width,height] of [[320,740],[393,650],[1536,864]]){
   const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block'}),page=await context.newPage(),blocked=[],errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await context.route('**/*',route=>{const r=route.request(),u=new URL(r.url());if(u.hostname==='cdn.jsdelivr.net'&&u.pathname==='/npm/@supabase/supabase-js@2')return route.fulfill({contentType:'application/javascript',body:signedOut});if(u.origin===origin.origin&&['GET','HEAD'].includes(r.method()))return route.continue();blocked.push({method:r.method(),origin:u.origin});return route.abort();});
   await page.goto(base);await page.locator('#login:not(.hidden)').waitFor();
   const manifest=await page.evaluate(async()=>{const url=document.querySelector('link[rel="manifest"]').href;return {url,data:await(await fetch(url)).json()};});
   assert.equal(new URL(manifest.data.start_url,manifest.url).href,base+'#hoje');assert.equal(new URL(manifest.data.start_url,manifest.url).search,'');assert.equal(manifest.data.display,'standalone');
   await page.locator('#email').fill('synthetic-unsaved@example.invalid');await page.locator('#login [data-health-install]').click();assert.ok(await page.locator('#healthInstallGuide').isVisible());
   assert.match(await page.locator('#healthInstallGuide').innerText(),/Safari.*Compartilhar.*Adicionar à Tela de Início.*Abrir como App da Web/s);await fit(page);
   await page.screenshot({path:`${dir}/${engine}-${width}-guide.png`});await page.locator('[data-health-install-close]').click();assert.equal(await page.locator('#email').inputValue(),'synthetic-unsaved@example.invalid');assert.equal(await page.locator('#healthInstallGuide').isVisible(),false);
   assert.deepEqual(await page.evaluate(()=>window.__pwaWrites),[]);assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);results.push({engine,width,height,guide:true,stableStart:true,zeroWrites:true});await context.close();
  }
  // The installed-display layout and More action run through normal app routing.
  for(const installed of [false,true]){
   const f=makeDashboardFixture(),sdk=sourceWindowService(languageDatabase(f.data)),context=await browser.newContext({viewport:{width:393,height:650},serviceWorkers:'block'}),page=await context.newPage();
   if(installed)await context.addInitScript(()=>Object.defineProperty(navigator,'standalone',{get:()=>true}));
   await context.route('**/*',route=>{const r=route.request(),u=new URL(r.url());if(u.hostname==='cdn.jsdelivr.net')return route.fulfill({contentType:'application/javascript',body:sdk});if(u.origin===origin.origin&&['GET','HEAD'].includes(r.method()))return route.continue();return route.abort();});
   await page.clock.setFixedTime(new Date(f.today+'T15:00:00Z'));await page.goto(base+'#hoje');
   await page.evaluate(async()=>{const {state}=await import('./src/core.js'),{isRouteReady}=await import('./src/data-layer.js');window.__languageApp={state,isRouteReady};});
   await page.waitForFunction(consumerRouteSettled,{route:'hoje',selector:'[data-health-dashboard]'});
   assert.equal(await page.locator('[data-dashboard-card]').count(),7);
   await page.locator('#mobileNav [data-route="mais"]').click();await page.locator('#moreSheet:not(.hidden)').waitFor();
   assert.equal(await page.locator('#moreSheet [data-health-install]').isVisible(),!installed);
   if(!installed){await page.locator('#moreSheet [data-health-install]').click();await fit(page);await page.locator('[data-health-install-close]').click();await page.locator('#closeMore').click();}
   else{
    await page.locator('#closeMore').click();await page.addStyleTag({content:':root{--health-safe-top:38px;--health-safe-left:12px;--health-safe-right:12px}'});
    const layout=await page.evaluate(()=>{const header=document.querySelector('.topbar'),host=document.querySelector('#screenHost'),nav=document.querySelector('#mobileNav');return {top:parseFloat(getComputedStyle(document.querySelector('#app')).paddingTop),headerBottom:header.getBoundingClientRect().bottom,hostTop:host.getBoundingClientRect().top,hostBottom:host.getBoundingClientRect().bottom,navTop:nav.getBoundingClientRect().top};});
    assert.ok(layout.top>=38,'installed shell reserves the simulated status area');assert.ok(layout.hostTop>=38,'the cockpit begins below the simulated status area even with a hidden header');assert.ok(layout.headerBottom<=layout.hostTop+1,'header does not cover the cockpit');assert.ok(layout.hostBottom<=layout.navTop+1,'navigation does not cover content');
    await fit(page);await page.screenshot({path:`${dir}/${engine}-standalone-safe-area.png`});
   }
   assert.deepEqual(await page.evaluate(()=>window.__historyQA.writes),[]);results.push({engine,installed,actualRoutes:true,safeArea:installed,zeroWrites:true});await context.close();
  }
 }finally{await browser.close();}
}
// An actual Chromium service worker exercises navigation, cache cleanup and reconnect.
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:393,height:650},serviceWorkers:'allow'}),page=await context.newPage();let latest=false,navigations=0;
 await context.addInitScript(()=>Object.defineProperty(navigator,'standalone',{get:()=>true}));
 await context.route('**/*',route=>{const r=route.request(),u=new URL(r.url());if(u.hostname==='cdn.jsdelivr.net')return route.fulfill({contentType:'application/javascript',body:signedOut});if(u.origin===origin.origin&&['GET','HEAD'].includes(r.method())){if(latest&&u.pathname==='/v2/')return route.fulfill({contentType:'text/html',body:html.replaceAll(current,next)});return route.continue();}return route.abort();});
 await page.goto(base+'manifest.webmanifest');await page.evaluate(async()=>{await(await caches.open('lts-health-shell-synthetic-old')).put('./old-shell',new Response('old synthetic shell'));await(await caches.open('lts-wealth-sentinel')).put('./wealth-sentinel',new Response('unrelated synthetic app'));localStorage.setItem('synthetic-auth-sentinel','preserve');});
 page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigations++;});await page.goto(base);await page.locator('#login:not(.hidden)').waitFor();
 await page.waitForFunction(async()=>Boolean((await navigator.serviceWorker.getRegistration())?.active));await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
 assert.equal(await page.evaluate(()=>navigator.serviceWorker.controller.scriptURL),base+'sw.js');
 assert.deepEqual(await page.evaluate(()=>caches.keys()),['lts-wealth-sentinel']);assert.equal(await page.evaluate(()=>localStorage.getItem('synthetic-auth-sentinel')),'preserve');
 await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});assert.match(await page.locator('h1').innerText(),/sem conexão/);assert.equal(await page.locator('[data-health-dashboard]').count(),0);await page.screenshot({path:`${dir}/offline.png`});
 await context.setOffline(false);await page.reload();await page.locator('#login:not(.hidden)').waitFor();await page.locator('#email').fill('synthetic-unsaved@example.invalid');await page.waitForLoadState('networkidle');const count=navigations;
 latest=true;await page.clock.setFixedTime(new Date(Date.now()+120000));await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.locator('#healthAppUpdate:not([hidden])').waitFor();
 assert.equal(navigations,count,'an update does not reload an unfinished form');assert.equal(await page.locator('#email').inputValue(),'synthetic-unsaved@example.invalid');
 await page.screenshot({path:`${dir}/update-available.png`});await page.locator('[data-health-update]').click();await page.waitForFunction(expected=>document.querySelector('meta[name="lts-build"]')?.content===expected,next);await page.locator('#login:not(.hidden)').waitFor();
 assert.equal(await page.locator('#healthAppUpdate').isVisible(),false);assert.equal(new URL(page.url()).search,'','reopening uses a stable URL');assert.equal(await page.evaluate(()=>localStorage.getItem('synthetic-auth-sentinel')),'preserve');assert.deepEqual(await page.evaluate(()=>window.__pwaWrites),[]);
 results.push({engine:'chromium',actualServiceWorker:true,otherAppCachePreserved:true,sessionSentinelPreserved:true,offlineReconnect:true,updateRequiresExplicitAction:true,stableUrl:true,zeroWrites:true});await context.close();
}finally{await browser.close();writeFileSync(dir+'/results.json',JSON.stringify(results,null,2));}
console.log('Home Screen story passed: Chromium/WebKit guide, mobile/desktop, normal routing, simulated standalone safe areas, actual network-only worker, preserved other-app cache/session sentinel, offline/reconnect and explicit update with no writes.');
