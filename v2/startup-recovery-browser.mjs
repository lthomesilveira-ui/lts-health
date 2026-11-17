import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,statSync} from 'node:fs';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium,webkit} from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url)),directory='startup-recovery-synthetic';
const current=readFileSync(new URL('./index.html',import.meta.url),'utf8');
const build=current.match(/name="lts-build" content="([^"]+)"/)[1];
const sdk=`window.__startupWrites=[];window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from(){window.__startupWrites.push('table');throw Error('Unexpected data read')},rpc(){window.__startupWrites.push('rpc');throw Error('Unexpected RPC')},functions:{invoke(){window.__startupWrites.push('invoke');throw Error('Unexpected function')}}})};`;
let faults=new Map(),withoutRecovery=false,documents=0,requests=[];
const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://synthetic.invalid');
  requests.push({path:url.pathname,method:req.method,retry:url.searchParams.get('health_asset_retry')});
  if(url.pathname==='/v2/')documents++;
  const remaining=faults.get(url.pathname)||0;
  if(remaining){faults.set(url.pathname,remaining-1);res.writeHead(503,{'Content-Type':'text/plain','Cache-Control':'no-store'});res.end('Synthetic temporary delivery failure');return;}
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!file.startsWith(root)||!url.pathname.startsWith('/v2/')){res.writeHead(404);res.end();return;}
  try{
    const selected=statSync(file).isDirectory()?path.join(file,'index.html'):file;
    let body=readFileSync(selected);
    if(url.pathname==='/v2/'&&withoutRecovery)body=Buffer.from(current.replace(/\s*<script id="healthAssetRecovery">[\s\S]*?<\/script>/,''));
    res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'application/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.png':'image/png'})[path.extname(selected)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
  }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}/v2/`,origin=new URL(base).origin,results=[];
mkdirSync(directory,{recursive:true});
function configure(file=null,{baseline=false,persistent=false}={}){faults=new Map(file?[[file,persistent?Infinity:1]]:[]);withoutRecovery=baseline;documents=0;requests=[];}
async function setup(browser,width){
  const context=await browser.newContext({viewport:{width,height:800},serviceWorkers:'block'}),blocked=[];
  await context.addInitScript(()=>localStorage.setItem('synthetic-auth-sentinel','preserve'));
  await context.route('**/*',route=>{
    const r=route.request(),u=new URL(r.url());
    if(u.href==='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2')return route.fulfill({contentType:'application/javascript',body:sdk});
    if(u.origin===origin&&['GET','HEAD'].includes(r.method()))return route.continue();
    blocked.push({method:r.method()});return route.abort();
  });
  const page=await context.newPage();
  await page.clock.install({time:new Date('2030-04-10T12:00:00Z')});
  await page.clock.pauseAt(new Date('2030-04-10T12:00:01Z'));
  return {context,page,blocked};
}
async function accountBoundary(page,blocked){
  assert.equal(await page.locator('#app').isVisible(),false);
  assert.equal(await page.evaluate(()=>localStorage.getItem('synthetic-auth-sentinel')),'preserve');
  assert.deepEqual(await page.evaluate(()=>window.__startupWrites||[]),[]);assert.deepEqual(blocked,[]);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
}
try{
  for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]){
    const browser=await type.launch({headless:true});
    try{
      // Reproduce the prior stopped startup on the same document without the new guard.
      configure('/v2/src/evolution-screen.js',{baseline:true});
      {
        const {context,page,blocked}=await setup(browser,393);
        await page.goto(base);await page.clock.runFor(9000);
        assert.equal(documents,1);assert.equal(await page.locator('#login').isVisible(),false);
        assert.equal(await page.locator('#appStartupRetry').isVisible(),true);await accountBoundary(page,blocked);
        results.push({engine,baselineFailureReproduced:true});await context.close();
      }
      for(const width of [320,393,1440])for(const failed of ['main','dependency']){
        const file=failed==='main'?'/v2/src/main.js':'/v2/src/evolution-screen.js';configure(file);
        const {context,page,blocked}=await setup(browser,width);
        await page.goto(base);assert.equal(documents,1);
        const loaded=page.waitForEvent('load');await page.clock.runFor(600);await loaded;
        await page.locator('#login:not(.hidden)').waitFor();assert.equal(documents,2,'one automatic clean document after a genuine503');
        assert.equal(await page.locator('#appStartup').isVisible(),false);assert.equal(new URL(page.url()).search,'');
        await accountBoundary(page,blocked);await page.clock.runFor(12000);assert.equal(documents,2,'no automatic reload after successful startup');
        await page.screenshot({path:`${directory}/${engine}-${width}-${failed}.png`});results.push({engine,width,failed,automaticRecovery:true,zeroWrites:true});await context.close();
      }
      configure();
      {
        const {context,page,blocked}=await setup(browser,393);await page.goto(base);await page.locator('#login:not(.hidden)').waitFor();
        await page.locator('#email').fill('synthetic-unsaved@example.invalid');await page.locator('#email').focus();
        faults.set('/v2/entry.css',1);
        await page.evaluate(version=>{const link=document.createElement('link');link.rel='stylesheet';link.href='./entry.css?v='+version+'&fix=synthetic-late';link.id='syntheticLateStyle';link.addEventListener('error',()=>{link.dataset.syntheticFailed='yes';});document.head.append(link);},build);
        await page.locator('#syntheticLateStyle[data-synthetic-failed="yes"]').waitFor({state:'attached'});
        await page.clock.runFor(600);
        await page.waitForFunction(()=>{const link=document.getElementById('syntheticLateStyle');return Boolean(link?.sheet&&new URL(link.href).searchParams.get('health_asset_retry')==='1');});
        assert.equal(documents,1);assert.equal(await page.locator('#email').inputValue(),'synthetic-unsaved@example.invalid');assert.equal(await page.locator('#email').evaluate(el=>el===document.activeElement),true);
        assert.equal(requests.filter(r=>r.path==='/v2/entry.css'&&r.retry==='1').length,1);await accountBoundary(page,blocked);
        await page.screenshot({path:`${directory}/${engine}-stylesheet-form-preserved.png`});results.push({engine,stylesheetRecovered:true,inputAndFocusPreserved:true,zeroWrites:true});await context.close();
      }
      configure('/v2/src/main.js',{persistent:true});
      {
        const {context,page,blocked}=await setup(browser,393);await page.goto(base);
        const loaded=page.waitForEvent('load');await page.clock.runFor(600);await loaded;
        await page.clock.runFor(9000);assert.equal(documents,2);assert.equal(await page.locator('#appStartupRetry').isVisible(),true);
        await page.clock.runFor(30000);assert.equal(documents,2,'persistent failure cannot loop');await accountBoundary(page,blocked);
        await page.screenshot({path:`${directory}/${engine}-bounded-manual-fallback.png`});results.push({engine,persistentFailureBounded:true,manualFallbackVisible:true,zeroWrites:true});await context.close();
      }
    }finally{await browser.close();}
  }
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));writeFileSync(directory+'/results.json',JSON.stringify(results,null,2));}
console.log('Startup recovery: prior failure reproduced; actual503 main/dependency delivery, one clean retry, persistent failure bounds, preserved stylesheet form/focus and private boundary passed in Chromium/WebKit.');
