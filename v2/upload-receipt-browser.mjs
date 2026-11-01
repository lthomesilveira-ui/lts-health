import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium,webkit} from 'playwright';
import {FIXED_TODAY,makeDashboardFixture} from '../preview/compact-evidence/tests/health-dashboard-render-test.mjs';

// Full production form, invented file and in-memory transport only. Every
// external request and every mutation outside the upload chain is rejected.
const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4175/v2/';
const origin=new URL(base).origin;
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const output='artifacts/production-integration';mkdirSync(output,{recursive:true});
function service(mode){return `
const db=${JSON.stringify(makeDashboardFixture(FIXED_TODAY).db)};
db.health_uploads=[];db.health_ingestion_previews=[];
const qa=window.__uploadQA={mode:${JSON.stringify(mode)},calls:[],stage:'idle',resume:null,holdReads:false,pendingReads:[]};
qa.resumeReads=()=>{qa.holdReads=false;qa.pendingReads.splice(0).forEach(resolve=>resolve())};
let session={user:{id:'synthetic-upload-owner'}},authChange=()=>{};
const record=(kind,target)=>qa.calls.push({kind,target});
const denied=(kind,target)=>{throw new Error('Forbidden synthetic mutation: '+kind+' '+target)};
const hold=stage=>{qa.stage=stage;return new Promise(resolve=>{qa.resume=()=>{qa.resume=null;resolve()}})};
window.supabase={createClient:()=>({
 auth:{getSession:async()=>({data:{session},error:null}),onAuthStateChange:cb=>{authChange=cb;return {data:{subscription:{unsubscribe(){}}}}},signOut:async()=>{session=null;authChange('SIGNED_OUT',null);return {error:null}}},
 functions:{invoke:async(name,args)=>{
  if(args?.body?.action==='status')return {data:{configured:false,connected:false},error:null};
  if(name!=='health-inspect-upload'||args?.body?.upload_id!=='synthetic-upload')return denied('invoke',name);
  record('inspect',name);await hold('inspect');qa.stage='complete';
  if(qa.mode==='inspect-failure')return {data:null,error:new Error('Invented inspector outage')};
  const status=qa.mode==='imported'?'imported':qa.mode==='rejected'?'rejected':'review_required';
  const preview={upload_id:'synthetic-upload',detected_format:'pdf',status:status==='imported'?'inspected':status==='rejected'?'failed':'needs_specialized_parser',warnings:[]};
  db.health_uploads[0].status=status;db.health_ingestion_previews=[preview];
  return {data:{ok:true,upload_status:status,preview},error:null};
 }},rpc:name=>denied('rpc',name),
 storage:{from:bucket=>({upload:async(path,file)=>{
  if(bucket!=='health-inbox'||!path.startsWith('synthetic-upload-owner/')||!file.name.startsWith('arquivo-sintetico'))return denied('storage',bucket);
  record('storage',bucket);await hold('upload');
  if(qa.mode==='storage-failure'){qa.stage='complete';return {error:new Error('Invented storage outage')}}
  return {error:null};
 },remove:()=>denied('remove',bucket)})},
 from(table){let from=0,to=999,payload=null,operation=null;const filters=[];
  const selected=()=> (db[table]||[]).filter(row=>filters.every(([k,v])=>row[k]===v)).slice(from,to+1);
  const q={select(){return q},eq(k,v){filters.push([k,v]);return q},is(k,v){filters.push([k,v]);return q},order(){return q},range(a,b){from=a;to=b;return q},limit(n){to=n-1;return q},
   insert(value){if(table!=='health_uploads')return denied('insert',table);record('metadata',table);payload=value;operation='insert';return q},
   update(value){if(table!=='health_uploads')return denied('update',table);record('status',table);payload=value;operation='update';return q},
   upsert(){return denied('upsert',table)},delete(){return denied('delete',table)},
   async single(){
    if(operation==='insert'){
     if(qa.mode==='metadata-failure'){qa.stage='complete';return {data:null,error:new Error('Invented metadata outage')}}
     if(payload.user_id!=='synthetic-upload-owner')return denied('owner',table);
     db[table].push({...payload,id:'synthetic-upload',created_at:'2001-02-03T12:00:00Z'});return {data:{id:'synthetic-upload'},error:null};
    }return {data:selected()[0]||null,error:null};
   },async maybeSingle(){return {data:selected()[0]||null,error:null}},
   then(resolve,reject){
    if(operation==='update'){for(const row of selected())Object.assign(row,payload);qa.stage='complete'}
    const failed=qa.mode==='refresh-failure'&&qa.stage==='complete'&&['health_uploads','health_ingestion_previews'].includes(table);
    const wait=qa.holdReads?new Promise(done=>qa.pendingReads.push(done)):Promise.resolve();
    return wait.then(()=>failed?{data:null,error:new Error('Invented list outage')}:{data:selected(),error:null}).then(resolve,reject);
   }
  };return q;
 }
})};
`;}

const evidence=[];
for(const [engine,name] of [[chromium,'chromium'],[webkit,'webkit']]){
 const browser=await engine.launch({headless:true});
 for(const width of [320,393,1440])for(const mode of ['review','imported','rejected','inspect-failure','refresh-failure','metadata-failure','storage-failure','leave','signout']){
  const page=await browser.newPage({viewport:{width,height:650}}),external=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.hostname==='cdn.jsdelivr.net'&&url.pathname==='/npm/@supabase/supabase-js@2')return route.fulfill({contentType:'application/javascript',body:service(mode)});
   if(url.origin===origin&&route.request().method()==='GET')return route.continue();
   external.push(url.origin);return route.abort();
  });
  await page.clock.setFixedTime(new Date(FIXED_TODAY+'T15:00:00Z'));
  await page.goto(base+'#dados');await page.locator('#uploadForm').waitFor();
  await page.locator('#uploadType').selectOption('fleury');
  const filename='arquivo-sintetico-com-nome-longo-para-conferir-o-recebimento.pdf';
  await page.locator('#uploadFile').setInputFiles({name:filename,mimeType:'application/pdf',buffer:Buffer.from('Invented upload: no health record or real PDF')});
  // A redraw before submission must retain the chosen original and origin.
  await page.evaluate(()=>{window.__uploadQA.holdReads=true});
  await page.locator('#refreshBtn').click();
  await page.waitForFunction(()=>window.__uploadQA.pendingReads.length>0);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await page.locator('#uploadFile').evaluate(el=>el.files.length),1,'chosen File survives the actual loading redraw');
  await page.evaluate(()=>window.__uploadQA.resumeReads());
  await page.waitForFunction(async()=>{const {state}=await import('./src/core.js');return !state.loading&&document.querySelector('#uploadFile')?.files?.length===1});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await page.locator('#uploadType').inputValue(),'fleury');
  await page.locator('#uploadForm button[type="submit"]').click();
  await page.waitForFunction(()=>window.__uploadQA.stage==='upload');
  assert.equal(await page.locator('#uploadForm').getAttribute('aria-busy'),'true');
  assert.equal(await page.locator('#uploadForm button').isDisabled(),true);
  // Force a second real redraw while storage is pending. Duplicate submit
  // events must not create another original even if a caller ignores disabled.
  await page.evaluate(()=>{window.__uploadQA.holdReads=true});
  await page.locator('#refreshBtn').click();
  await page.waitForFunction(()=>window.__uploadQA.pendingReads.length>0);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.locator('#uploadForm').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  assert.equal(await page.locator('#uploadForm button').isDisabled(),true);
  assert.match(await page.locator('#uploadMsg').innerText(),/Enviando/);
  await page.evaluate(()=>window.__uploadQA.resumeReads());
  await page.waitForFunction(async()=>{const {state}=await import('./src/core.js');return !state.loading});
  await page.evaluate(()=>window.__uploadQA.resume());
  if(!['metadata-failure','storage-failure'].includes(mode)){
   await page.waitForFunction(()=>window.__uploadQA.stage==='inspect');
   if(mode==='leave'){
    await page.locator('#screenHost [data-route="hoje"]').first().click();
    await page.locator('[data-health-dashboard]').waitFor();
   }
   if(mode==='signout'){
    await page.locator('#logoutBtn').click();await page.locator('#login:not(.hidden)').waitFor();
   }
   await page.evaluate(()=>window.__uploadQA.resume());
  }
  await page.waitForFunction(()=>window.__uploadQA.stage==='complete');
  if(mode==='signout'){
   assert.equal(await page.locator('#app').isVisible(),false);
   assert.equal(await page.evaluate(async()=>{const {state}=await import('./src/core.js');return state.ui.uploadFeedback}),null);
  }else{
   await page.waitForFunction(async()=>{const {state}=await import('./src/core.js');return state.ui.uploadFeedback?.busy===false});
   if(mode==='leave'){
    assert.equal(await page.evaluate(()=>location.hash),'#hoje','completion must not steal the current route');
    await page.locator('.studyFooter [data-route="dados"]').click();await page.locator('#uploadForm').waitFor();
   }
   await page.waitForFunction(()=>document.querySelector('#uploadForm')?.getAttribute('aria-busy')==='false');
   const text=await page.locator('#uploadMsg').innerText();
   if(mode==='imported')assert.equal(text,'Arquivo incorporado ao histórico.');
   else if(mode==='storage-failure')assert.match(text,/Não foi possível enviar este arquivo/);
   else if(mode==='metadata-failure'){assert.match(text,/recebido e guardado.*registrar sua leitura/);assert.doesNotMatch(text,/Não foi possível enviar/)}
   else if(mode==='rejected')assert.match(text,/guardado.*não foi possível concluir o processamento/);
   else if(mode==='inspect-failure')assert.match(text,/recebido e guardado.*não entrou nas análises/);
   else assert.match(text,/recebido e guardado \(PDF\).*não entrou nas análises/);
   if(mode==='refresh-failure')assert.match(text,/histórico de arquivos não pôde ser atualizado/);
   assert.equal(await page.locator('.uploadFeedbackFile').innerText(),filename);
   assert.equal(await page.locator('#uploadType').inputValue(),'fleury');
   assert.equal(await page.locator('#uploadForm button').isDisabled(),false);
   assert.equal(await page.locator('#uploadFile').evaluate(el=>el.files.length),0,'completed original is not silently ready to resend');
   if(mode!=='leave')assert.equal(await page.evaluate(()=>document.activeElement?.id),'uploadMsg');
   assert.ok(await page.locator('#uploadMsg').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))>=14);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   if(['review','refresh-failure','metadata-failure'].includes(mode))await page.screenshot({path:output+'/upload-'+name+'-'+mode+'-'+width+'.png'});
   // The previous receipt is cleared as soon as a different file is chosen.
   await page.locator('#uploadFile').setInputFiles({name:'arquivo-sintetico-seguinte.pdf',mimeType:'application/pdf',buffer:Buffer.from('Invented next file')});
   assert.equal(await page.locator('#uploadMsg').innerText(),'');
  }
  const calls=await page.evaluate(()=>window.__uploadQA.calls);
  assert.equal(calls.filter(c=>c.kind==='storage').length,1,'one original per submission');
  assert.ok(calls.every(c=>['health-inbox','health_uploads','health-inspect-upload'].includes(c.target)),'no clinical, source or other mutations');
  assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  evidence.push({engine:name,width,mode,status:'passed',storageCalls:1,externalRequests:0});await page.close();
 }
 await browser.close();
}
writeFileSync(output+'/upload-receipt-evidence.json',JSON.stringify(evidence,null,2)+'\n');
console.log('Upload receipts: '+evidence.length+' full-form cases passed with invented files and in-memory storage only.');
