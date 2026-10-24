import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const db={};
// Authenticated synthetic transport. All unrecognized reads and every write fail closed.
const tables=['health_personal_goals','health_polar_sessions','health_body_composition','health_segmental_composition','health_workouts','health_workout_source_evidence','health_workout_exercises','health_workout_sets','health_lab_results','health_documents','health_medication_events','health_medication_regimens','health_uploads','health_ingestion_previews','health_data_quality_issues','health_daily_nutrition','health_nutrition_meals','health_activity_records','health_metrics','health_source_daily_metrics'];
function installService(db,tables){
 window.__qaDb=db;window.__qaDenied=[];window.__qaCalls=[];window.__qaSession={user:{id:'synthetic-evidence-owner'}};
 window.__qaHaeStatus={configured:false,received:false};
 const deny=target=>{window.__qaDenied.push(target);throw Error('Synthetic gate forbids '+target);};
 const failure=message=>({data:null,error:{message}});
 function query(table){
  if(!tables.includes(table))return deny('unrecognized table '+table);
  let start=0,end=999,projection='*';const filters=[],orders=[];
  const read=()=>{
   window.__qaCalls.push({table,projection});
   if(!window.__qaSession)return failure('Synthetic session expired');
   if(window.__qaFailProjection&&projection.includes(window.__qaFailProjection))return failure('Synthetic domain read failure');
   const rows=(window.__qaDb[table]||[]).filter(row=>filters.every(([key,value])=>row[key]===value)).slice().sort((a,b)=>{for(const[key,asc]of orders){const c=String(a[key]??'').localeCompare(String(b[key]??''));if(c)return asc?c:-c;}return 0;});
   return {data:structuredClone(rows.slice(start,end+1)),error:null};
  };
  const q={select(value){projection=value;return q;},eq(key,value){filters.push([key,value]);return q;},is(key,value){filters.push([key,value]);return q;},range(a,b){start=a;end=b;return q;},order(key,options={}){orders.push([key,options.ascending!==false]);return q;},limit(n){end=start+n-1;return q;},
   async maybeSingle(){const r=read();return r.error?r:r.data.length>1?failure('Multiple rows'):{data:r.data[0]||null,error:null};},
   then(resolve,reject){return Promise.resolve(read()).then(resolve,reject);}};
  for(const action of ['insert','update','upsert','delete'])q[action]=()=>deny(table+' '+action);
  return q;
 }
 window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:window.__qaSession},error:null}),onAuthStateChange:callback=>{window.__qaAuthCallback=callback;return{data:{subscription:{unsubscribe(){}}}};},signOut:async()=>{window.__qaSession=null;window.__qaAuthCallback?.('SIGNED_OUT',null);return{error:null};}},from:query,
  functions:{invoke:async(name,args)=>{
   const action=args?.body?.action;window.__qaCalls.push({name,action});
   if(action!=='status'||!['health-polar-connection','health-auto-export-connection'].includes(name))return deny('invoke '+name+' '+action);
   if(!window.__qaSession||window.__qaHaeError&&name==='health-auto-export-connection')return failure('Synthetic connection unavailable');
   return {data:name==='health-auto-export-connection'?structuredClone(window.__qaHaeStatus):{configured:false,connected:false},error:null};
  }},rpc:name=>deny('rpc '+name),storage:{from:name=>({upload:()=>deny('upload '+name),remove:()=>deny('remove '+name)})}})};
}
const service=`(${installService.toString()})(${JSON.stringify(db)},${JSON.stringify(tables)});`;
const base=process.env.LTS_HEALTH_BASE_URL||'http://127.0.0.1:4173/';
const parsed=new URL(base);
assert.equal(parsed.protocol,'http:');assert.ok(['127.0.0.1','localhost'].includes(parsed.hostname),'synthetic gate only targets loopback');assert.ok(['/','/v2/'].includes(parsed.pathname));assert.equal(parsed.search,'','exercise the actual renderer, never fixture mode');assert.equal(parsed.hash,'');
const external=[];
async function isolate(page){
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.href==='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'&&route.request().method()==='GET')return route.fulfill({contentType:'application/javascript',body:service});
  if(url.origin===parsed.origin&&route.request().method()==='GET')return route.continue();
  external.push({url:url.href,method:route.request().method()});return route.abort();
 });
}

const browser=await chromium.launch({headless:true});
try{
  for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
    const page=await browser.newPage({viewport,serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await isolate(page);
    await page.goto(base+'#dados',{waitUntil:'domcontentloaded'});
    const card=page.locator('[data-health-auto-export]');await card.waitFor();
    await card.getByText('Ativação no iPhone pendente',{exact:true}).waitFor();
    await page.waitForFunction(()=>document.querySelector('#syncText')?.textContent==='Atualizado');
    assert.equal(await page.evaluate(async()=>{const {fixtureMode,state}=await import('./src/core.js');return !fixtureMode&&state.session?.user?.id==='synthetic-evidence-owner';}),true);
    await card.getByRole('button',{name:'Verificar recebimento'}).click();
    await card.getByText('Ativação no iPhone pendente',{exact:true}).waitFor();
    await card.getByText('Configurar o Health Auto Export',{exact:true}).click();
    assert.match(await card.innerText(),/JSON · versão 2/);assert.match(await card.innerText(),/Dias \/ Day/);
    assert.match(await card.innerText(),/água precisa aparecer no Saúde/);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'no horizontal overflow');
    for(const box of await card.locator('button:visible').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height)))assert.ok(box>=44,'phone touch target');
    // Status-only synthetic responses. No key creation, connection changes or real writes.
    await page.evaluate(()=>{window.__qaHaeStatus={configured:true,received:false};});
    await card.getByRole('button',{name:'Verificar recebimento'}).click();
    await card.getByText('Aguardando primeiro envio',{exact:true}).waitFor();
    assert.doesNotMatch(await card.innerText(),/Histórico disponível|Último recebimento:/,'configured is not proof of receipt');
    await page.evaluate(()=>{window.__qaHaeStatus={configured:true,received:true,last_received_at:'2026-10-04T19:00:00Z',last_metric_date:'2026-10-03',last_water_date:null};});
    await card.getByRole('button',{name:'Verificar recebimento'}).click();
    await card.getByText('Histórico disponível',{exact:true}).waitFor();
    assert.match(await card.innerText(),/Último recebimento: 04\/10\/2026, 16:00:00/);
    assert.match(await card.innerText(),/Última data com dados: 03\/10\/2026/);
    assert.match(await card.innerText(),/Ainda não há registros de volume de água por esta conexão/);
    assert.doesNotMatch(await card.innerText(),/Água recebida até/,'receipt of other metrics cannot imply water receipt');
    if(!await card.locator('details').evaluate(node=>node.open))await card.locator('summary').click();
    assert.equal(await card.locator('textarea[aria-label="URL do Health Auto Export"]').inputValue(),'https://plztdqyuqcjohiimudnr.supabase.co/functions/v1/health-auto-export-receive');
    assert.equal(await card.locator('input[aria-label="Nome do cabeçalho"]').inputValue(),'x-lts-health-key');
    assert.equal(await card.locator('input[aria-label="Chave privada do Health Auto Export"]').count(),0,'a status response never reveals a private key');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    for(const box of await card.locator('button:visible').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height)))assert.ok(box>=44,'configured touch target');
    await page.evaluate(()=>{window.__qaHaeStatus.last_water_date='2026-10-02';});
    await card.getByRole('button',{name:'Verificar recebimento'}).click();
    await card.getByText('Água recebida até 02/10/2026. O histórico antigo do MyFitnessPal continua sendo uma transferência separada.',{exact:true}).waitFor();
    await page.evaluate(()=>{window.__qaHaeError=true;});
    await card.getByRole('button',{name:'Verificar recebimento'}).click();
    await card.getByText('Conexão indisponível agora',{exact:true}).waitFor();
    assert.match(await card.innerText(),/histórico já importado continua guardado/);
    assert.doesNotMatch(await card.innerText(),/Histórico disponível|Água recebida até/,'a failed check must not claim confirmed current status');
    const calls=await page.evaluate(()=>window.__qaCalls.filter(call=>call.name));
    assert.ok(calls.some(call=>call.name==='health-auto-export-connection'&&call.action==='status'));
    assert.ok(calls.every(call=>call.action==='status'),'only read-only connection status is invoked');
    assert.deepEqual(await page.evaluate(()=>window.__qaDenied),[]);
    // Auth revocation must erase account state and hide the authenticated screen.
    await page.evaluate(()=>{window.__qaSession=null;window.__qaAuthCallback('SIGNED_OUT',null);});
    await page.waitForSelector('#login:not(.hidden)');
    assert.equal(await page.locator('#app').isVisible(),false);
    assert.deepEqual(await page.evaluate(async()=>{const {state}=await import('./src/core.js');return {session:state.session,connection:state.autoExportConnection,data:state.data};}),{session:null,connection:null,data:{}});
    assert.deepEqual(errors,[]);await page.close();
  }
  assert.deepEqual(external,[],'no remote or non-GET requests');
  console.log('Health Auto Export setup: actual desktop/mobile renderer, configured/received/water distinctions, status errors, auth isolation and touch targets passed.');
}finally{await browser.close();}
