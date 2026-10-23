import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {fixture,today} from './steps-evidence-fixture.mjs';

// Production preview route, synthetic authenticated SDK. No external requests
// or mutations. This is not evidence of a real authenticated-device acceptance.
const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/preview/compact-evidence/';
const origin=new URL(base);
assert.ok(['127.0.0.1','localhost','[::1]'].includes(origin.hostname));
assert.equal(origin.pathname,'/preview/compact-evidence/');assert.equal(origin.search,'');
const data=fixture(),db={health_source_daily_metrics:data.sourceMetrics};
const sdk=`window.__stepWrites=[];window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-steps-user'}}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from(table){let start=0,end=999;const q={select(){return q},eq(){return q},is(){return q},order(){return q},range(a,b){start=a;end=b;return q},limit(n){end=start+n-1;return q},maybeSingle:async()=>({data:null,error:null}),then(resolve,reject){return Promise.resolve({data:(${JSON.stringify(db)}[table]||[]).slice(start,end+1),error:null}).then(resolve,reject)}};for(const op of ['insert','update','upsert','delete'])q[op]=()=>{window.__stepWrites.push(op);throw Error('No writes')};return q},functions:{invoke(){window.__stepWrites.push('invoke');throw Error('No writes')}},rpc(){window.__stepWrites.push('rpc');throw Error('No writes')}})};`;
const directory='steps-evidence-visual';mkdirSync(directory,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
  for(const width of [390,1280]){
    const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await context.route('**/*',route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.hostname==='cdn.jsdelivr.net'&&url.pathname==='/npm/@supabase/supabase-js@2')return route.fulfill({contentType:'application/javascript',body:sdk});
      if(url.origin===origin.origin&&['GET','HEAD'].includes(request.method()))return route.continue();
      return route.abort('blockedbyclient');
    });
    await page.clock.install({time:new Date(today+'T15:00:00Z')});
    await page.goto(base+'#hoje');
    const card=page.locator('[data-dashboard-card="steps"]');
    await page.waitForFunction(()=>document.querySelector('[data-dashboard-card="steps"]')?.textContent.includes('contagens diferentes por origem'));
    assert.match(await card.innerText(),/contagem em revisão/);
    await card.locator('summary').click();
    const evidence=card.locator('[data-steps-evidence]');
    assert.match(await evidence.innerText(),/1\.024,125006/);assert.match(await evidence.innerText(),/1\.234 passos/);assert.match(await evidence.innerText(),/4\.321 passos/);
    assert.match(await evidence.innerText(),/Atualizado no app em/);
    await page.screenshot({path:`${directory}/steps-${width}.png`,fullPage:true});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no page overflow');
    await card.locator('[data-dashboard-day="2024-03-07"]').first().click();
    await page.waitForFunction(()=>document.querySelector('[data-dashboard-card="steps"]')?.textContent.includes('Contagem recebida em revisão'));
    assert.equal(await card.locator('.healthMetricValue strong').innerText(),'—');
    await page.locator('[data-dashboard-day="2024-03-08"]').first().click();
    await page.waitForFunction(()=>document.querySelector('[data-dashboard-card="steps"] .healthMetricValue strong')?.textContent==='250');
    assert.match(await card.innerText(),/parcial/);
    assert.deepEqual(await page.evaluate(()=>window.__stepWrites),[]);assert.deepEqual(errors,[]);
    await context.close();
  }
}finally{await browser.close();}
console.log('Synthetic steps browser checks passed: exact fractional evidence, distinct sources, date navigation, partial today, layout and zero writes.');
