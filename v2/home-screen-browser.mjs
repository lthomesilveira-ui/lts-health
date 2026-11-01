import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync,statSync} from 'node:fs';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,webkit} from 'playwright';
import {makeDashboardFixture} from '../preview/compact-evidence/tests/health-dashboard-render-test.mjs';
import {sourceWindowService} from '../preview/compact-evidence/tests/source-window-service-fixture.mjs';
import {languageDatabase} from '../preview/compact-evidence/tests/consumer-language-fixture.mjs';
import {consumerRouteSettled} from '../preview/compact-evidence/tests/consumer-language-readiness.mjs';
const base='http://127.0.0.1:4173/v2/',origin=new URL(base),dir='health-home-screen-visual',results=[];
const html=readFileSync(new URL('./index.html',import.meta.url),'utf8'),current=html.match(/name="lts-build" content="([^"]+)"/)[1],next=current.replace(/\.(\d+)$/,(_,n)=>'.'+(Number(n)+1)),previous=current.replace(/\.(\d+)$/,(_,n)=>'.'+Math.max(0,Number(n)-1));
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
   const icon=await page.locator('#healthInstallGuide img').evaluate(async image=>{await image.decode();return {width:image.naturalWidth,height:image.naturalHeight,src:image.currentSrc,apple:document.querySelector('link[rel="apple-touch-icon"]').href};});
   assert.equal(icon.width,180);assert.equal(icon.height,180);assert.equal(icon.src,icon.apple);assert.equal(new URL(icon.src).searchParams.get('v'),'heart-pulse-20261029','the new health icon loads in the actual installation guide');
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
    await page.locator('#closeMore').click();await page.addStyleTag({content:':root{--health-safe-top:38px;--health-safe-bottom:24px;--health-safe-left:12px;--health-safe-right:12px}body[data-product-route="hoje"] #screenHost{padding-top:44px!important}'});
    const layout=await page.evaluate(()=>{const header=document.querySelector('.topbar'),host=document.querySelector('#screenHost'),nav=document.querySelector('#mobileNav');return {top:parseFloat(getComputedStyle(document.querySelector('#app')).paddingTop),headerBottom:header.getBoundingClientRect().bottom,hostTop:host.getBoundingClientRect().top,hostBottom:host.getBoundingClientRect().bottom,navTop:nav.getBoundingClientRect().top,navBottom:nav.getBoundingClientRect().bottom,navHeight:nav.getBoundingClientRect().height,hostPadding:parseFloat(getComputedStyle(host).paddingTop)};});
    assert.ok(layout.top>=38,'installed shell reserves the simulated status area');assert.ok(layout.hostTop>=38,'the cockpit begins below the simulated status area even with a hidden header');assert.ok(layout.headerBottom<=layout.hostTop+1,'header does not cover the cockpit');assert.ok(layout.hostBottom<=layout.navTop+1,'navigation does not cover content');assert.ok(layout.navBottom<=650.5,'the home indicator inset stays within the installed viewport');assert.ok(layout.navHeight>=84,'bottom inset has its own grid space');assert.equal(layout.hostPadding,6,'legacy Home safe-area padding is not counted twice');
    await fit(page);await page.screenshot({path:`${dir}/${engine}-standalone-safe-area.png`});
    await page.locator('#mobileNav [data-route="treinos"]').click();await page.waitForFunction(consumerRouteSettled,{route:'treinos',selector:'.ltsRefTrainPrimaryTabs'});
    const detailFrame=await page.evaluate(()=>{const host=document.querySelector('#screenHost').getBoundingClientRect(),nav=document.querySelector('#mobileNav').getBoundingClientRect();return {bottom:nav.bottom,hostBottom:host.bottom,navTop:nav.top};});assert.ok(detailFrame.bottom<=650.5&&detailFrame.hostBottom<=detailFrame.navTop+1,'detail routes retain a visible bottom navigation');await fit(page);
   }
   assert.deepEqual(await page.evaluate(()=>window.__historyQA.writes),[]);results.push({engine,installed,actualRoutes:true,safeArea:installed,zeroWrites:true});await context.close();
  }
 }finally{await browser.close();}
}
// An actual worker sees a real loopback-server outage, independent of browser offline emulation.
let serverOffline=false,servedBuild=current,serverFailures=0;
const appDirectory=fileURLToPath(new URL('../',import.meta.url));
const server=createServer((request,response)=>{
 const url=new URL(request.url,'http://127.0.0.1');
 if(serverOffline&&url.pathname==='/v2/'){serverFailures++;request.socket.destroy();return;}
 const file=path.resolve(appDirectory,'.'+decodeURIComponent(url.pathname));
 if(!file.startsWith(appDirectory)||!url.pathname.startsWith('/v2/')){response.writeHead(404);response.end();return;}
 try{
  const target=statSync(file).isDirectory()?path.join(file,'index.html'):file;
  const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.png':'image/png'};
  let body=readFileSync(target);if(servedBuild!==current&&url.pathname==='/v2/')body=Buffer.from(body.toString().replaceAll(current,servedBuild));
  response.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});response.end(body);
 }catch{response.writeHead(404);response.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const lifecycleBase=`http://127.0.0.1:${server.address().port}/v2/`,lifecycleOrigin=new URL(lifecycleBase).origin;
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:393,height:650},serviceWorkers:'allow'}),page=await context.newPage();let navigations=0;
 await context.addInitScript(()=>Object.defineProperty(navigator,'standalone',{get:()=>true}));
 await context.route('**/*',route=>{const r=route.request(),u=new URL(r.url());if(u.hostname==='cdn.jsdelivr.net')return route.fulfill({contentType:'application/javascript',body:signedOut});if(u.origin===lifecycleOrigin&&['GET','HEAD'].includes(r.method()))return route.continue();return route.abort();});
 await page.goto(lifecycleBase+'manifest.webmanifest');await page.evaluate(async()=>{await(await caches.open('lts-health-shell-synthetic-old')).put('./old-shell',new Response('old synthetic shell'));await(await caches.open('lts-wealth-sentinel')).put('./wealth-sentinel',new Response('unrelated synthetic app'));localStorage.setItem('synthetic-auth-sentinel','preserve');});
 page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigations++;});await page.goto(lifecycleBase);await page.locator('#login:not(.hidden)').waitFor();
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;return true;});await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
 assert.equal(await page.evaluate(()=>navigator.serviceWorker.controller.scriptURL),lifecycleBase+'sw.js');
 assert.deepEqual(await page.evaluate(()=>caches.keys()),['lts-wealth-sentinel']);assert.equal(await page.evaluate(()=>localStorage.getItem('synthetic-auth-sentinel')),'preserve');
 serverOffline=true;const offlineResponse=await page.goto(lifecycleBase+'?offline-check=1',{waitUntil:'domcontentloaded'});
 assert.equal(offlineResponse.status(),503);assert.equal(offlineResponse.fromServiceWorker(),true);assert.ok(serverFailures>0,'the server actually rejected the worker network request');
 assert.match(await page.locator('h1').innerText(),/sem conexão/);assert.equal(await page.locator('[data-health-dashboard]').count(),0);await page.screenshot({path:`${dir}/offline.png`});
 serverOffline=false;await page.goto(lifecycleBase);await page.locator('#login:not(.hidden)').waitFor();await page.locator('#email').fill('synthetic-unsaved@example.invalid');await page.waitForLoadState('networkidle');const count=navigations;
 servedBuild=previous;await page.clock.setFixedTime(new Date(Date.now()+120000));await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.waitForLoadState('networkidle');assert.equal(await page.locator('#healthAppUpdate').isVisible(),false,'a stale response is not offered as an update');
 servedBuild=next;await page.clock.setFixedTime(new Date(Date.now()+240000));await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.locator('#healthAppUpdate:not([hidden])').waitFor();
 assert.equal(navigations,count,'an update does not reload an unfinished form');assert.equal(await page.locator('#email').inputValue(),'synthetic-unsaved@example.invalid');
 await page.screenshot({path:`${dir}/update-available.png`});await page.locator('[data-health-update]').click();await page.waitForFunction(expected=>document.querySelector('meta[name="lts-build"]')?.content===expected,next);await page.locator('#login:not(.hidden)').waitFor();
 assert.equal(await page.locator('#healthAppUpdate').isVisible(),false);assert.equal(new URL(page.url()).search,'','reopening uses a stable URL');assert.equal(await page.evaluate(()=>localStorage.getItem('synthetic-auth-sentinel')),'preserve');assert.deepEqual(await page.evaluate(()=>window.__pwaWrites),[]);
 results.push({engine:'chromium',actualServiceWorker:true,otherAppCachePreserved:true,sessionSentinelPreserved:true,realServerOutage:true,offlineReconnect:true,updateRequiresExplicitAction:true,stableUrl:true,zeroWrites:true});await context.close();
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));writeFileSync(dir+'/results.json',JSON.stringify(results,null,2));}
console.log('Home Screen story passed: Chromium/WebKit guide, mobile/desktop, normal routing, simulated standalone safe areas, actual network-only worker, preserved other-app cache/session sentinel, real server outage/reconnect and explicit update with no writes.');
