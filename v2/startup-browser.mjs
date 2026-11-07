import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
const base='http://127.0.0.1:4175/v2/';
const sdk='window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}})}';
for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true});
 try{
  for(const width of [320,393,1440]){
   const context=await browser.newContext({viewport:{width,height:800}}),page=await context.newPage();
   let release;
   const sdkReady=new Promise(resolve=>{release=resolve;});
   await page.route('https://cdn.jsdelivr.net/**',async route=>{await sdkReady;await route.fulfill({contentType:'application/javascript',body:sdk});});
   await page.clock.install();
   await page.goto(base,{waitUntil:'commit'});
   await page.locator('#appStartup').waitFor({state:'visible'});
   assert.equal(await page.locator('#login').isVisible(),false);
   assert.equal(await page.locator('#app').isVisible(),false);
   await page.clock.runFor(9000);
   await page.locator('#appStartupRetry').waitFor({state:'visible'});
   assert.match(await page.locator('#appStartupMessage').innerText(),/demorando/);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'startup fits '+width);
   release();
   await page.locator('#login').waitFor({state:'visible'});
   assert.equal(await page.locator('#appStartup').isVisible(),false,'a late successful startup clears recovery');
   assert.equal(await page.locator('#app').isVisible(),false,'no SDK result exposes account data');
   await context.close();
  }
  const page=await browser.newPage({viewport:{width:393,height:800}});
  await page.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({contentType:'application/javascript',body:sdk}));
  await page.route('**/src/main.js?*',route=>route.abort());
  await page.clock.install();await page.goto(base);
  await page.clock.runFor(9000);
  assert.equal(await page.locator('#appStartupRetry').isVisible(),true,'failed entry retains usable recovery');
  assert.equal(await page.locator('#app').isVisible(),false);
  await page.close();
 }finally{await browser.close();}
}
console.log('Chromium/WebKit startup at 320/393/1440: delayed SDK, late recovery, failed module and protected account boundary passed.');
