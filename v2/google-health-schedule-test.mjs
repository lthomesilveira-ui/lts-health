import assert from 'node:assert/strict';
import {test} from 'node:test';
import {handleGoogleHydrationSchedule,googleHydrationWindow} from '../supabase/functions/_shared/google-health-schedule.mjs';
import {digest} from '../supabase/functions/_shared/polar-contract.mjs';
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',ticket='a'.repeat(64);
function fixture({authorized=true,rows=[{user_id:owner}],enabled=true,read}={}){
  const calls=[];
  const db={rpc:async(name,params)=>{calls.push({name,params});return {data:name==='health_google_scheduler_authorized'?authorized:rows,error:null};}};
  const dependencies={db,ready:async()=>{calls.push({ready:true});return enabled;},read:async(...args)=>{calls.push({read:args});return read?read(...args):{read:true,canonical_updated:false};},now:()=>Date.parse('2030-02-11T16:00:00Z')};
  const request=(body={action:'tick'},headers={},method='POST')=>new Request('https://abcdefghijklmnopqrst.supabase.co/functions/v1/health-google-scheduled',{method,headers:{'Content-Type':'application/json','x-lts-google-scheduler':ticket,...headers},...(method==='GET'?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});
  return {calls,db,dependencies,request,run:(...args)=>handleGoogleHydrationSchedule(request(...args),dependencies)};
}
test('BRT civil windows include today and the preceding 29 days across UTC midnight, leap day and year boundary',()=>{
  assert.deepEqual(googleHydrationWindow(Date.parse('2028-03-01T01:00:00Z')),{from:'2028-01-31',to:'2028-03-01'});
  assert.deepEqual(googleHydrationWindow(Date.parse('2028-03-01T04:00:00Z')),{from:'2028-02-01',to:'2028-03-02'});
  assert.deepEqual(googleHydrationWindow(Date.parse('2030-01-01T12:00:00Z')),{from:'2029-12-03',to:'2030-01-02'});
});
test('method, browser origins including empty Origin, and malformed tickets fail before any privileged call',async()=>{
  const f=fixture();
  assert.equal((await f.run(undefined,{},'GET')).status,405);
  for(const origin of ['https://lthomesilveira-ui.github.io','null',''])assert.equal((await f.run(undefined,{Origin:origin})).status,403);
  for(const key of ['',ticket.toUpperCase(),'Bearer '+ticket,'x'.repeat(64)])assert.equal((await f.run(undefined,{'x-lts-google-scheduler':key})).status,401);
  assert.equal(f.calls.length,0);
});
test('only a hashed single-use ticket reaches authorization; denied/replayed requests cannot inspect configuration or owners',async()=>{
  const f=fixture({authorized:false}),r=await f.run();assert.equal(r.status,401);
  assert.deepEqual(f.calls,[{name:'health_google_scheduler_authorized',params:{p_key_hash:await digest(ticket)}}]);
  assert.ok(!JSON.stringify(f.calls).includes(ticket));
  const g=fixture();let used=false;g.db.rpc=async name=>{if(name==='health_google_scheduler_authorized'){const data=!used;used=true;return {data};}return {data:[]};};
  assert.equal((await g.run()).status,200);assert.equal((await g.run()).status,401);
});
test('wrong content type, invalid JSON, oversized bytes, user IDs, trigger and arbitrary ranges never reach owner selection',async()=>{
  for(const [body,headers,status] of [
    [{action:'tick'},{'Content-Type':'text/plain'},415],
    [{action:'tick'},{'Content-Type':'application/jsonp'},415],
    ['{',{},400],[' '.repeat(1025),{},413],['é'.repeat(600),{},413],
    [{action:'tick',user_id:owner},{},400],[{action:'tick',from:'2030-02-01'},{},400],
    [[],{},400],[null,{},400],[{action:'read'},{},400]
  ]){
    const f=fixture(),r=await f.run(body,headers);assert.equal(r.status,status);assert.equal(f.calls.length,1);
  }
});
test('a disabled server and zero connected owners make no provider read and never claim canonical hydration',async()=>{
  const f=fixture({enabled:false}),r=await f.run();assert.deepEqual(await r.json(),{disabled:true,attempted:0,completed:0,skipped:0,failed:0});assert.equal(f.calls.length,2);
  const g=fixture({rows:[]}),empty=await g.run();assert.deepEqual(await empty.json(),{attempted:0,completed:0,skipped:0,failed:0});assert.equal(g.calls.filter(x=>x.read).length,0);
});
test('unbounded, invalid or duplicate candidate results fail closed before provider access',async()=>{
  for(const rows of [null,{},[{user_id:'invalid'}],[{user_id:owner},{user_id:owner.toUpperCase()}],[{user_id:owner},{user_id:other},{user_id:owner}]]){
    const f=fixture({rows});assert.equal((await f.run()).status,503);assert.equal(f.calls.filter(x=>x.read).length,0);
  }
});
test('at most two service-selected owners use the fixed BRT range; results contain counts only',async()=>{
  const f=fixture({rows:[{user_id:owner},{user_id:other}]});const r=await f.run(undefined,{'Content-Type':'application/json; charset=utf-8'}),body=await r.json();
  assert.equal(r.status,200);assert.deepEqual(body,{attempted:2,completed:2,skipped:0,failed:0});
  assert.deepEqual(f.calls.filter(x=>x.read).map(x=>x.read),[[owner,'2030-01-13','2030-02-12'],[other,'2030-01-13','2030-02-12']]);
  assert.ok(!JSON.stringify(body).includes(owner));assert.ok(!JSON.stringify(body).includes(ticket));assert.equal(r.headers.get('Cache-Control'),'no-store');
});
test('concurrent/disconnected reads are skipped; incomplete results and provider exceptions fail without leaking details',async()=>{
  const f=fixture({rows:[{user_id:owner},{user_id:other}],read:async id=>id===owner?{read:false,in_progress:true,canonical_updated:false}:{read:false,connected:false,canonical_updated:false}});
  assert.deepEqual(await (await f.run()).json(),{attempted:2,completed:0,skipped:2,failed:0});
  for(const read of [async()=>{throw Error('synthetic-provider-secret');},async()=>({read:true,canonical_updated:true}),async()=>null]){
    const g=fixture({read}),r=await g.run();assert.equal(r.status,503);assert.deepEqual(await r.json(),{attempted:1,completed:0,skipped:0,failed:1});
  }
});
test('database/secret lookup failures expose only scheduler_unavailable and make no source read',async()=>{
  const f=fixture();f.db.rpc=async()=>{throw Error('synthetic-database-secret');};const r=await f.run();assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'scheduler_unavailable'});
  const g=fixture();g.dependencies.ready=async()=>{throw Error('synthetic-vault-secret');};assert.equal((await g.run()).status,503);assert.equal(g.calls.filter(x=>x.read).length,0);
});
const hints={action:'configuration_check',client_id:'123-synthetic.apps.googleusercontent.com',secret_suffixes:['demo','test']};
test('configuration checks require the same consumed ticket and never select or read an owner',async()=>{
  const f=fixture();let checked=0;
  f.dependencies.configurationCheck=async body=>{checked++;assert.deepEqual(body,hints);return {check:'client_configuration',connection_verified:false,canonical_updated:false};};
  const r=await f.run(hints);assert.equal(r.status,200);assert.equal(checked,1);assert.equal(f.calls.length,1);
  assert.equal(r.headers.get('Cache-Control'),'no-store');assert.deepEqual(await r.json(),{check:'client_configuration',connection_verified:false,canonical_updated:false});
  const denied=fixture({authorized:false});denied.dependencies.configurationCheck=async()=>{throw Error('must-not-reach');};
  assert.equal((await denied.run(hints)).status,401);assert.equal(denied.calls.length,1);
  const replay=fixture();let used=false;replay.db.rpc=async name=>{assert.equal(name,'health_google_scheduler_authorized');const data=!used;used=true;return {data};};
  let probes=0;replay.dependencies.configurationCheck=async()=>{probes++;return {connection_verified:false};};
  assert.equal((await replay.run(hints)).status,200);assert.equal((await replay.run(hints)).status,401);assert.equal(probes,1);
});
test('configuration payloads cannot supply complete credentials, source grants, owners or windows',async()=>{
  for(const body of [{...hints,code:'synthetic-private-grant'},{...hints,user_id:owner},{...hints,from:'2030-01-01'},
    {...hints,secret_suffixes:['synthetic-complete-secret']},{...hints,secret_suffixes:['demo','test','more']}]){
    const f=fixture();f.dependencies.configurationCheck=async()=>{throw Error('must-not-reach');};
    assert.equal((await f.run(body)).status,400);assert.equal(f.calls.length,1);
  }
});
test('a missing or failing configuration checker stays private and does not fall through to hydration',async()=>{
  const f=fixture();assert.equal((await f.run(hints)).status,503);assert.equal(f.calls.length,1);
  const g=fixture();g.dependencies.configurationCheck=async()=>{throw Error('synthetic-server-secret');};
  const r=await g.run(hints);assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'scheduler_unavailable'});assert.equal(g.calls.length,1);
});
