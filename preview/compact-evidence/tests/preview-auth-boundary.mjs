import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/preview/compact-evidence/';
const service=`window.__anonymousReads=0;window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from(){window.__anonymousReads++;throw new Error('Anonymous data read must not occur');}})};`;
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const url=route.request().url();if(url.startsWith('https://cdn.jsdelivr.net/'))return route.fulfill({contentType:'application/javascript',body:service});if(new URL(url).origin===new URL(base).origin)return route.continue();return route.abort();});
 await page.goto(base+'#hoje');await page.locator('#login').waitFor({state:'visible'});await page.waitForTimeout(400);
 assert.equal(await page.locator('#app').isVisible(),false);assert.equal(await page.locator('.refPanels:visible').count(),0);assert.equal(await page.evaluate(()=>window.__anonymousReads),0);assert.deepEqual(errors,[]);
}finally{await browser.close();}
console.log('Preview: signed-out route displays login, performs no data reads and never substitutes demonstration data.');
