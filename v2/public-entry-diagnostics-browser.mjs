import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,existsSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {withPublicEntryEvidence} from './public-entry-diagnostics.mjs';
const root='http://127.0.0.1:4189/',expectedBuild='synthetic-public-entry',allowed=new Set(['','v2/shell.css','v2/src/core.js']),directory='artifacts/public-entry-regression',results=[];
mkdirSync(directory,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 for(const [label,width,mode]of [['http-503-mobile',320,'network'],['http-503-desktop',1536,'network'],['private-renderer',390,'private'],['filled-login',390,'filled'],['absent-login',390,'absent'],['closed-page',390,'closed'],['success',390,'success']]){
  const context=await browser.newContext({viewport:{width,height:740},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await context.route('**/*',route=>{
   const u=new URL(route.request().url());
   if(u.pathname==='/v2/shell.css')return route.fulfill({status:503,contentType:'text/css',body:'SYNTHETIC_PRIVATE_RESPONSE'});
   if(u.pathname==='/v2/src/core.js')return route.abort('failed');
   if(u.pathname!=='/')return route.fulfill({status:404,body:'SYNTHETIC_PRIVATE_RESPONSE'});
   const resources=mode==='network'?'<link rel="stylesheet" href="/v2/shell.css?token=SYNTHETIC_SECRET"><script src="/v2/src/core.js?private=SYNTHETIC_SECRET"></script><img src="/private/SYNTHETIC_PATIENT.png?token=SYNTHETIC_SECRET">':'';
   return route.fulfill({contentType:'text/html',body:`<!doctype html><meta name="lts-build" content="${expectedBuild}">${resources}<main id="app" style="display:${mode==='private'?'block':'none'}">${mode==='private'?'<article data-health-dashboard>SYNTHETIC_PATIENT</article>':''}</main>${mode==='absent'?'':`<section id="login" style="background:white;padding:24px"><h1>Synthetic private account entry</h1><label>Email<input value="${mode==='filled'?'SYNTHETIC_SECRET':''}"></label><button>Enter</button></section>`}`});
  });
  let original=null,caught=null;
  try{await withPublicEntryEvidence(page,{label,root,allowed,expectedBuild,directory,errorCount:()=>errors.length},async()=>{
   await page.goto(root,{waitUntil:'networkidle'});
   if(mode==='success'){assert.deepEqual(errors,[]);return;}
   if(mode==='closed')await page.close();
   try{if(mode==='network')assert.deepEqual(errors,[]);else assert.fail('SYNTHETIC_PRIVATE_ASSERTION');}catch(e){original=e;throw e;}
  });}catch(e){caught=e;}
  if(mode==='success')assert.equal(caught,null);else assert.equal(caught,original,'the original failed assertion is preserved exactly');
  const report=JSON.parse(readFileSync(`${directory}/public-entry-diagnostic-${label}.json`,'utf8'));
  assert.equal(report.outcome,mode==='success'?'passed':'failed');assert.doesNotMatch(JSON.stringify(report),/SYNTHETIC_SECRET|SYNTHETIC_PATIENT|SYNTHETIC_PRIVATE|private\/|token=|127\.0\.0\.1/);
  const screenshot=existsSync(`${directory}/deployed-public-login-${label}-failure.png`);
  if(mode==='network'){
   assert.equal(report.screenshot,'login-only');assert.equal(screenshot,true);
   assert.ok(report.network.some(x=>x.status===503&&x.resource==='v2/shell.css'));
   assert.ok(report.network.some(x=>x.kind==='transport'&&x.resource==='v2/src/core.js'));
   assert.ok(report.network.some(x=>x.status===404&&x.resource==='unrecognized-resource'));
  }else assert.equal(screenshot,false,'unsafe/unavailable entries never yield a screenshot');
  if(mode==='absent')assert.equal(report.readiness.loginVisible,false);
  if(mode==='closed')assert.equal(report.readiness.pageUnavailable,true);
  results.push({label,width,outcome:report.outcome,originalFailurePreserved:mode==='success'||caught===original,safeScreenshot:screenshot,privateMetadataRedacted:true});await context.close();
 }
}finally{await browser.close();writeFileSync(directory+'/results.json',JSON.stringify(results,null,2));}
console.log('Public entry evidence: real503/404/transport failures,320/1536px safe login capture, private/credential/absent/closed-page guards, exact assertion identity, redacted JSON and success boundary passed.');
