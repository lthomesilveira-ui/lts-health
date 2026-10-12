import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {digest} from '../supabase/functions/_shared/polar-contract.mjs';
import {handleScheduledSync,scheduledCandidates,normalizeSyncTrigger} from '../supabase/functions/_shared/polar-schedule.mjs';

const key='a'.repeat(64),now=Date.parse('2025-02-28T12:00:00Z');
const calls=[];
function database({authorized=true,authError=null,listError=null,rows=[{user_id:'synthetic-owner'}]}={}){return {
  rpc:async(name,args)=>{calls.push({name,args});return {data:authorized,error:authError};},
  from:table=>({select:fields=>({limit:async(limit)=>{calls.push({table,fields,limit});return {data:rows,error:listError};}})})
};}
const request=({token=key,method='POST',origin=null,body='{"action":"tick"}',type='application/json'}={})=>new Request('https://synthetic.invalid/cron',{method,headers:{...(token?{'x-lts-polar-scheduler':token}:{}),...(origin?{Origin:origin}:{}),'Content-Type':type},...(method==='POST'?{body}:{})});
const invoke=(req,opts={})=>handleScheduledSync(req,{db:database(opts),now,sync:async()=>({connected:true,synced:true})});
for(const token of [null,'public-key','f'.repeat(63),'G'.repeat(64)]){
  calls.length=0;assert.equal((await invoke(request({token}))).status,401);assert.equal(calls.length,0,'invalid credential cannot reach database');
}
calls.length=0;assert.equal((await invoke(request(),{authorized:false})).status,401);assert.equal(calls.length,1,'unauthorized request cannot enumerate connections');
assert.equal(calls[0].args.p_key_hash,await digest(key));assert.notEqual(calls[0].args.p_key_hash,key);
assert.equal((await invoke(request({method:'GET'}))).status,405);
assert.equal((await invoke(request({origin:'https://synthetic.invalid'}))).status,403);
assert.equal((await invoke(request({type:'text/plain'}))).status,415);
assert.equal((await invoke(request({body:'not json'}))).status,400);
assert.equal((await invoke(request({body:'x'.repeat(1025)}))).status,413);
for(const body of [{action:'disconnect'},{action:'tick',user_id:'another-owner'},{action:'tick',trigger:'manual'}])assert.equal((await invoke(request({body:JSON.stringify(body)}))).status,400);
assert.equal((await invoke(request(),{authError:{message:'synthetic private error'}})).status,503);
assert.equal((await invoke(request(),{listError:{message:'synthetic private error'}})).status,503);
assert.equal((await invoke(request(),{rows:Array.from({length:51},(_,i)=>({user_id:`synthetic-${i}`}))})).status,503);
assert.deepEqual(scheduledCandidates([{user_id:'due'},{user_id:'recent',last_scheduled_attempt_at:'2025-02-28T11:30:00Z'},{user_id:'due-again',last_scheduled_attempt_at:'2025-02-28T11:00:00Z'}],now).map(r=>r.user_id),['due','due-again']);
const result=await invoke(request());assert.equal(result.status,200);assert.deepEqual(await result.json(),{attempted:1,completed:1,skipped:0,failed:0});
const empty=await invoke(request(),{rows:[]});assert.deepEqual(await empty.json(),{attempted:0,completed:0,skipped:0,failed:0});
const recent=await invoke(request(),{rows:[{user_id:'synthetic-recent',last_scheduled_attempt_at:'2025-02-28T11:30:00Z'}]});assert.deepEqual(await recent.json(),{attempted:0,completed:0,skipped:1,failed:0});
const lease=await handleScheduledSync(request(),{db:database(),now,sync:async()=>({connected:true,synced:false,in_progress:true})});assert.deepEqual(await lease.json(),{attempted:1,completed:0,skipped:1,failed:0});
const failed=await handleScheduledSync(request(),{db:database(),now,sync:async()=>{throw Error('synthetic-private-provider-token');}});assert.equal(failed.status,503);assert.doesNotMatch(await failed.text(),/synthetic-private|user_id|token/);
for(const [input,output] of [['scheduled','scheduled'],['app_open','app_open'],['unknown','manual'],[undefined,'manual']])assert.equal(normalizeSyncTrigger(input),output);
const runtime=readFileSync('supabase/functions/_shared/polar-runtime.mjs','utf8'),handler=readFileSync('supabase/functions/health-polar-connection/index.ts','utf8');
assert.match(runtime,/last_scheduled_sync_at:completedAt/);assert.match(runtime,/last_scheduled_attempt_at:now/);assert.match(runtime,/eq\('sync_lease_until',lease\)/);
assert.match(handler,/trigger:body\?\.trigger==='app_open'\?'app_open':'manual'/,'owner-facing clients cannot label a sync as scheduled');
assert.doesNotMatch(runtime,/from\('health_workouts'\)\.(insert|upsert)/);
const migration=readdirSync('supabase/migrations').find(n=>n.endsWith('_polar_background_schedule.sql'));
const sql=readFileSync(migration?`supabase/migrations/${migration}`:'supabase/polar_background_schedule.sql','utf8');
for(const marker of ['vault.create_secret','extensions.gen_random_bytes(32)','security invoker',"'17 * * * *'",'active:=false','revoke all on all tables in schema net','revoke all on function public.health_polar_scheduler_authorized(text) from public, anon, authenticated','revoke all on function health_internal.enqueue_polar_sync() from public, anon, authenticated, service_role'])assert.ok(sql.includes(marker),`scheduler boundary missing ${marker}`);
assert.doesNotMatch(sql,/service_role_key|Bearer |tokens_encrypted|security definer/i);
const singletonMigration=readdirSync('supabase/migrations').find(n=>n.endsWith('_polar_schedule_singleton_ticket.sql'));
const ticketSql=readFileSync(singletonMigration?`supabase/migrations/${singletonMigration}`:'supabase/planned/polar_schedule_singleton_ticket.sql','utf8');
assert.match(ticketSql,/interval '5 minutes'/);
assert.match(ticketSql,/set ticket_consumed_at=clock_timestamp\(\)/);
assert.match(ticketSql,/ticket_consumed_at is null/);
assert.match(ticketSql,/ticket_expires_at>clock_timestamp\(\)/);
assert.match(ticketSql,/ticket_issued_at<=clock_timestamp\(\)/);
assert.match(ticketSql,/get diagnostics consumed_rows=row_count/);
assert.match(ticketSql,/return consumed_rows=1/);
assert.match(ticketSql,/grant update\(ticket_consumed_at\) on health_internal\.polar_schedule_config to service_role/);
assert.match(ticketSql,/revoke all on function public\.health_polar_scheduler_authorized\(text\) from public, anon, authenticated/);
assert.doesNotMatch(ticketSql,/vault\.decrypted_secrets|service_role_key|security definer|\bdelete\b|\bdrop\b|\btruncate\b/i);
const revisionMigration=readdirSync('supabase/migrations').find(n=>n.endsWith('_polar_schedule_revision_boundary.sql'));
assert.ok(revisionMigration,'new authorization revisions need a database schedule-evidence boundary');
const revisionSql=readFileSync(`supabase/migrations/${revisionMigration}`,'utf8');
for(const marker of ['security invoker',"if tg_op='UPDATE'",'new.revision is not distinct from old.revision','new.last_scheduled_sync_at:=null','new.last_scheduled_attempt_at:=null','new.last_sync_trigger:=null','before insert or update of revision on public.health_polar_connections'])assert.ok(revisionSql.includes(marker),`revision boundary missing ${marker}`);
assert.doesNotMatch(revisionSql,/tokens_encrypted|\bdelete\b|\bdrop\b|security definer/i);
globalThis.location={search:'?fixture=1'};
const {state}=await import('./src/core.js'),{renderConnections}=await import('./src/polar-connection.js');
state.polarConnection={status:'ready',configured:true,connected:true,update_mode:'scheduled_hourly',last_scheduled_sync_at:'2025-02-28T12:00:00Z'};
assert.match(renderConnections(),/sem precisar abrir o app/);assert.match(renderConnections(),/Última atualização automática concluída/);
state.polarConnection={status:'ready',configured:true,connected:true,update_mode:'on_open'};assert.doesNotMatch(renderConnections(),/Última atualização automática concluída/);
state.polarConnection={status:'error'};assert.doesNotMatch(renderConnections(),/sem precisar abrir o app/);
console.log('Polar background boundaries passed: private credential, bounded schedule, honest status, revocation, lease and canonical-data preservation.');
