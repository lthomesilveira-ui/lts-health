import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {FIXED_TODAY,makeDashboardFixture,dateLabel} from './health-dashboard-render-test.mjs';
import {makeReviewedBloodCountPair} from './reviewed-blood-count-fixture.mjs';

// CI browser contract, using the repository's existing playwright@1.56.1.
// No installation, real authentication, real records or external requests.
// Run against the isolated preview served by the existing CI HTTP server.
const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/preview/compact-evidence/';
const origin=new URL(base);
assert.ok(['127.0.0.1','localhost','[::1]'].includes(origin.hostname),'Synthetic browser QA is restricted to loopback');
assert.ok(origin.pathname.endsWith('/preview/compact-evidence/'),'Only the isolated preview may be tested');
assert.equal(origin.search,'','The SDK mock uses the real preview route, without fixture/demo mode');
const dir='health-reviewed-blood-count-visual';mkdirSync(dir,{recursive:true});
const results=[];
function service(db){return `
window.__healthQA={reads:[],writes:[]};
window.__reviewDb=${JSON.stringify(db)};
const mutation=(kind,target)=>{window.__healthQA.writes.push({kind,target});throw new Error('Synthetic QA forbids writes: '+kind+' '+target);};
window.supabase={createClient:()=>({
 auth:{getSession:async()=>({data:{session:{user:{id:'synthetic-health-dashboard-user'}}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
 functions:{invoke:(name)=>mutation('invoke',name)},rpc:(name)=>mutation('rpc',name),
 storage:{from:(name)=>({upload:()=>mutation('upload',name),remove:()=>mutation('remove',name)})},
 from(table){
  let from=0,to=999,columns='';const filters=[],orders=[];
  const rows=()=>{
   let selected=(window.__reviewDb[table]||[]).filter(row=>filters.every(([key,value])=>row[key]===value));
   if(orders.length)selected=selected.slice().sort((a,b)=>{for(const[key,asc]of orders){const result=String(a[key]??'').localeCompare(String(b[key]??''));if(result)return asc?result:-result;}return 0;});
   if(table==='health_lab_results')selected=selected.map(row=>{
    const copy={...row};delete copy.source_payload;delete copy.reference_verification;
    if(columns.includes('reference_verification:source_payload->reference_verification'))copy.reference_verification=row.source_payload?.reference_verification;
    if(columns.includes('numeric_kind:source_payload->>numeric_kind'))copy.numeric_kind=row.source_payload?.numeric_kind;
    return copy;
   });
   return selected;
  };
  const q={select(value){columns=value;return q;},eq(key,value){filters.push([key,value]);return q;},is(key,value){filters.push([key,value]);return q;},range(a,b){from=a;to=b;return q;},order(key,options={}){orders.push([key,options.ascending!==false]);return q;},limit(n){to=from+n-1;return q;},
   maybeSingle:async()=>{window.__healthQA.reads.push({table,single:true});const selected=rows();return selected.length>1?{data:null,error:{message:'Multiple synthetic rows'}}:{data:selected[0]||null,error:null};},
   then(resolve,reject){window.__healthQA.reads.push({table,from,to,columns});return Promise.resolve({data:rows().slice(from,to+1),error:null}).then(resolve,reject);}
  };
  for(const name of ['insert','update','upsert','delete'])q[name]=()=>mutation(name,table);
  return q;
 }
})};
`;}
const browser=await chromium.launch({headless:true});
async function stableHome(page){
  await page.waitForFunction(()=>{
    const root=document.querySelector('[data-health-dashboard]');
    if(!root||document.querySelector('#syncText')?.textContent!=='Atualizado'||document.querySelector('#screenHost')?.dataset.productLayoutRoute!=='hoje')return false;
    if(window.__qaStableRoot!==root){window.__qaStableRoot=root;window.__qaStableFrames=0;}
    return ++window.__qaStableFrames>=3;
  });
  const cockpit=page.locator('[data-disclosure="cockpit-details"]');
  if(!(await cockpit.evaluate(el=>el.open)))await cockpit.locator(':scope > summary').click();
}

try {
 for(const [width,height] of [[320,740],[393,844],[1180,757],[1440,900]])for(const valid of (width===393?[true,false]:[true])){
  const f=makeDashboardFixture(),pairs=['Hemoglobina','Hematócrito'].map(marker=>makeReviewedBloodCountPair(marker));
  const labRows=pairs.flatMap(pair=>[pair.previous,pair.current]).map(row=>{
   const copy=structuredClone(row);copy.source_payload={...copy.source_payload,reference_verification:copy.reference_verification,numeric_kind:copy.numeric_kind};delete copy.reference_verification;delete copy.numeric_kind;return copy;
  });
  if(!valid)for(const row of labRows)if(row.source_payload.reference_verification)row.source_payload.reference_verification.evidence_text_sha256='0'.repeat(64);
  f.db.health_lab_results=labRows;
  const name=`${width}-${valid?'verified':'invalid-proof'}`,context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:width<=840,hasTouch:width<=840,timezoneId:'America/Sao_Paulo',serviceWorkers:'block'}),external=[],errors=[],writes=[];
  await context.route('**/*',route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.hostname==='cdn.jsdelivr.net'&&url.pathname==='/npm/@supabase/supabase-js@2'&&request.method()==='GET')return route.fulfill({status:200,contentType:'application/javascript',body:service(f.db)});
   if(url.origin===origin.origin&&['GET','HEAD'].includes(request.method()))return route.continue();
   if(!['GET','HEAD'].includes(request.method()))writes.push(request.method());else external.push(request.url());return route.abort('blockedbyclient');
  });
  const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));await page.clock.setFixedTime(new Date(`${FIXED_TODAY}T15:00:00Z`));
  try{
   await page.goto(base+'#hoje');await stableHome(page);
   const labs=page.locator('[data-study-domain="labs"]');
   for(const pair of pairs){
    const item=labs.locator('[data-dashboard-lab-item]').filter({has:page.getByRole('heading',{name:pair.current.biomarker,exact:true})});
    assert.equal(await item.count(),1);const raw=await item.locator('.healthLabValues').innerText();
    assert.ok(raw.includes(pair.previous.result_raw),'original qualified raw remains visible');assert.ok(raw.includes(dateLabel(pair.previous.collection_date)));assert.ok(raw.includes(dateLabel(pair.current.collection_date)));
    assert.equal(await item.locator('.healthLabDelta').count(),valid?1:0,'only verified documentary proof permits a delta');
    if(valid){const delta=Number((Number(pair.current.result_numeric)-Number(pair.previous.result_numeric)).toPrecision(12));assert.ok((await item.locator('.healthLabDelta').innerText()).includes(delta.toLocaleString('pt-BR',{maximumFractionDigits:10})));}
    else assert.match(await item.innerText(),/formato numérico não confirmado/);
    await item.locator('details > summary').click();assert.match(await item.innerText(),/A direção do número.*não definem melhora/);
    await item.scrollIntoViewIfNeeded();await page.screenshot({path:`${dir}/${name}-${pair.current.biomarker==='Hemoglobina'?'hb':'ht'}.png`,animations:'disabled'});
   }
   const layout=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth}));assert.ok(layout.document<=layout.viewport+1&&layout.body<=layout.viewport+1);
   const qa=await page.evaluate(()=>window.__healthQA);assert.ok(qa.reads.some(r=>r.table==='health_lab_results'&&r.columns?.includes('reference_verification:source_payload->reference_verification')),'actual loader requests only the required proof projection');assert.deepEqual(qa.writes,[]);assert.deepEqual(writes,[]);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
   await labs.scrollIntoViewIfNeeded();await page.screenshot({path:`${dir}/${name}.png`,animations:'disabled'});
   results.push({name,width,height,verifiedProof:valid,rawPreserved:true,expectedDeltaCount:valid?2:0,zeroWrites:true,status:'passed'});
  }catch(error){await page.screenshot({path:`${dir}/${name}-failure.png`,animations:'disabled'}).catch(()=>{});results.push({name,status:'failed',error:String(error.message)});throw error;}finally{writeFileSync(`${dir}/results.json`,JSON.stringify({syntheticOnly:true,results},null,2));await context.close();}
 }
}finally{await browser.close();}
console.log('Reviewed Hb/Ht: synthetic responsive UI, exact loader projection, original raw and failed-proof boundary passed.');
