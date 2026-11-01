import assert from 'node:assert/strict';
import {mkdirSync,readFileSync} from 'node:fs';
import {deployedRuntimeAssets} from './deployed-runtime-assets.mjs';
import {withPublicEntryEvidence} from './public-entry-diagnostics.mjs';
import {chromium} from 'playwright';
// Fresh signed-out contexts only. No credentials, fixture mode or authenticated data.
const root=new URL(process.env.LTS_PUBLIC_ROOT||'https://lthomesilveira-ui.github.io/lts-health/');
const publicDeployment=root.href==='https://lthomesilveira-ui.github.io/lts-health/';
const localCandidate=root.protocol==='http:'&&['127.0.0.1','localhost'].includes(root.hostname)&&root.pathname==='/'&&!root.search&&!root.hash;
assert.ok(publicDeployment||localCandidate,'only the approved public deployment or loopback repository root');
const expectedBuild=readFileSync(new URL('./index.html',import.meta.url),'utf8').match(/name="lts-build" content="([^"]+)"/)[1];
const diskRoot=new URL('./',import.meta.url),html=readFileSync(new URL('index.html',diskRoot),'utf8');
const allowed=new Set(['','index.html','favicon.ico','v2/','v2/index.html',...deployedRuntimeAssets(html,url=>readFileSync(url,'utf8'),diskRoot).map(asset=>'v2/'+asset.file)]);
mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 for(const [label,width,height]of [['desktop',1536,864],['mobile',390,844]]){
  const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block'}),blocked=[],errors=[];
  await context.route('**/*',route=>{
   const request=route.request(),url=new URL(request.url());
   if(request.method()==='GET'&&((url.origin===root.origin&&url.pathname.startsWith(root.pathname))||url.href==='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'))return route.continue();
   blocked.push({origin:url.origin,path:url.pathname,method:request.method()});return route.abort('blockedbyclient');
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  try{await withPublicEntryEvidence(page,{label,root,allowed,expectedBuild,errorCount:()=>errors.length,blockedCount:()=>blocked.length},async()=>{
  const url=new URL(root);if(process.env.LTS_DEPLOY_SHA)url.searchParams.set('lts_sha',process.env.LTS_DEPLOY_SHA);
  await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:60000});
  await page.locator('#login:not(.hidden)').waitFor({timeout:60000});
  await page.waitForLoadState('networkidle');
  assert.equal(new URL(page.url()).pathname,root.pathname+'v2/','public root promotes to the actual app');
  assert.equal(new URL(page.url()).searchParams.has('fixture'),false);
  assert.equal(await page.locator('meta[name="lts-build"]').getAttribute('content'),expectedBuild);
  assert.equal(await page.title(),'LTS Health');
  for(const route of ['hoje','bio','saude','treinos','analise','dados']){
   await page.evaluate(route=>{location.hash=route},route);
   await page.waitForTimeout(100);
   assert.equal(await page.locator('#login').isVisible(),true,route+' stays signed out');
   assert.equal(await page.locator('#app').isVisible(),false,route+' cannot expose the private shell');
   assert.equal(await page.locator('[data-health-dashboard],[data-executive-dashboard]').count(),0,'no data renderer before authentication');
  }
  assert.deepEqual(await page.evaluate(async()=>{const {state,fixtureMode}=await import('./src/core.js');return {fixtureMode,session:state.session,loaded:state.loaded,data:state.data};}),{fixtureMode:false,session:null,loaded:false,data:{}});
  assert.match((await page.locator('#login').innerText()).toLocaleLowerCase('pt-BR'),/área privada[\s\S]*acesse seu health/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'login fits the viewport');
  assert.deepEqual(blocked,[],'no backend data, authentication or write requests while signed out');assert.deepEqual(errors,[]);
  await page.screenshot({path:`artifacts/deployed-public-login-${label}.png`});
  });}finally{await context.close();}
 }
}finally{await browser.close();}
console.log('Public deployment: current entry identity, clean signed-out route isolation, responsive login and zero backend/write requests passed.');
