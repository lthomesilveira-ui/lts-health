import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';

// Only known public asset names. Never retain arbitrary URLs, queries, headers,
// response bodies, console text, credentials or private DOM in CI artifacts.
export function publicResource(reference,root,allowed){
 try{
  const url=new URL(reference),base=new URL(root);
  if(url.href==='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2')return 'supabase-browser-sdk';
  if(url.origin!==base.origin||!url.pathname.startsWith(base.pathname))return 'unrecognized-resource';
  const name=url.pathname.slice(base.pathname.length);
  return allowed.has(name)?name||'public-root':'unrecognized-resource';
 }catch{return 'unrecognized-resource';}
}
const types=new Set(['document','stylesheet','image','media','font','script','texttrack','xhr','fetch','eventsource','websocket','manifest','other']);
export function observePublicFailures(page,root,allowed){
 const failures=[],counts={http:0,transport:0,dropped:0};
 const retain=(request,kind,status=null)=>{
  counts[kind]++;
  if(failures.length>=64){counts.dropped++;return;}
  failures.push({kind,resource:publicResource(request.url(),root,allowed),type:types.has(request.resourceType())?request.resourceType():'other',method:request.method()==='GET'?'GET':'other',...(status===null?{}:{status})});
 };
 const response=r=>{const status=r.status();if(Number.isInteger(status)&&status>=400&&status<=599)retain(r.request(),'http',status);};
 const failed=request=>retain(request,'transport');
 page.on('response',response);page.on('requestfailed',failed);
 return {failures,counts,stop(){page.removeListener('response',response);page.removeListener('requestfailed',failed);}};
}
export async function publicEntryReadiness(page,expectedBuild){
 return page.evaluate(expected=>{
  const visible=selector=>{const e=document.querySelector(selector);if(!e)return false;const box=e.getBoundingClientRect(),style=getComputedStyle(e);return box.width>0&&box.height>0&&style.display!=='none'&&style.visibility!=='hidden';};
  const login=document.querySelector('#login');
  return {expectedBuildMatches:document.querySelector('meta[name="lts-build"]')?.content===expected,loginVisible:visible('#login'),privateShellVisible:visible('#app'),dataRendererCount:document.querySelectorAll('[data-health-dashboard],[data-executive-dashboard]').length,loginInputsEmpty:Boolean(login)&&[...login.querySelectorAll('input,textarea')].every(e=>!e.value)};
 },expectedBuild);
}
export async function withPublicEntryEvidence(page,{label,root,allowed,expectedBuild,directory='artifacts',errorCount=()=>0,blockedCount=()=>0},check){
 if(!/^[a-z0-9-]{1,48}$/.test(label))throw Error('invalid diagnostic label');
 mkdirSync(directory,{recursive:true});
 const network=observePublicFailures(page,root,allowed);let primary=null,result;
 try{result=await check();}
 catch(error){primary=error;}
 const readiness=await publicEntryReadiness(page,expectedBuild).catch(()=>({pageUnavailable:true}));
 let screenshot='not-needed';
 if(primary){
  screenshot='withheld-unverified-entry';
  if(readiness.expectedBuildMatches&&readiness.loginVisible&&readiness.privateShellVisible===false&&readiness.dataRendererCount===0&&readiness.loginInputsEmpty){
   try{await page.locator('#login').screenshot({path:path.join(directory,`deployed-public-login-${label}-failure.png`),timeout:5000});screenshot='login-only';}
   catch{screenshot='capture-unavailable';}
  }
 }
 network.stop();
 const count=value=>Number.isSafeInteger(value)&&value>=0?value:null;
 try{writeFileSync(path.join(directory,`public-entry-diagnostic-${label}.json`),JSON.stringify({schema_version:1,outcome:primary?'failed':'passed',readiness,errorCount:count(errorCount()),blockedRequestCount:count(blockedCount()),network:network.failures,networkCounts:network.counts,screenshot},null,2));}
 catch(error){if(!primary)throw error;}
 if(primary)throw primary;
 return result;
}
