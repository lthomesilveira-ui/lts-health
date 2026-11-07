import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

// Destructive fixture setup is permitted only in this fresh disposable loopback database.
assert.equal(process.env.GOOGLE_HEALTH_SYNTHETIC_TEST,'1');
assert.equal(process.env.PGDATABASE,'google_health_test');assert.equal(process.env.PGUSER,'postgres');
assert.equal(process.env.PGPASSWORD,'synthetic-ci-only');assert.ok(['127.0.0.1','::1'].includes(process.env.PGHOST));
assert.ok(!process.env.PGHOSTADDR&&!process.env.PGSERVICE&&!process.env.PGSERVICEFILE);
assert.match(process.env.PGPORT||'5432',/^\d{1,5}$/);assert.ok(+(process.env.PGPORT||5432)>0&&+(process.env.PGPORT||5432)<=65535);
const env={PATH:process.env.PATH,LANG:'C.UTF-8',PGHOST:process.env.PGHOST,PGPORT:process.env.PGPORT||'5432',PGDATABASE:'google_health_test',PGUSER:'postgres',PGPASSWORD:'synthetic-ci-only',PGCONNECT_TIMEOUT:'5',PGSSLMODE:'disable',PGPASSFILE:'/dev/null'};
const args=['-X','-v','ON_ERROR_STOP=1','-v','VERBOSITY=terse','-At','-q'];
const prefix="SET timezone='UTC'; SET datestyle='ISO,YMD'; SET statement_timeout='15s';\n";
function run(sql,success=true){const r=spawnSync('psql',args,{input:prefix+sql,env,encoding:'utf8',timeout:20000,maxBuffer:4000000});assert.ifError(r.error);if(success)assert.equal(r.status,0,r.stderr);else{assert.notEqual(r.status,0);assert.doesNotMatch(r.stderr,/syntax error|does not exist|could not connect|connection to server/);}return r;}
const scalar=sql=>run(sql).stdout.trim();
const object=sql=>JSON.parse(scalar(sql));
const lit=s=>"'"+String(s).replaceAll("'","''")+"'";
const json=value=>`convert_from(decode('${Buffer.from(JSON.stringify(value)).toString('base64')}','base64'),'UTF8')::jsonb`;
const service=sql=>'SET ROLE service_role; '+sql;
assert.equal(scalar('select current_database();'),'google_health_test');assert.equal(scalar("select current_setting('server_version_num')::integer/10000;"),'17');
assert.equal(scalar("select not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public') and not exists(select 1 from pg_namespace where nspname='auth');"),'t','Refuse fixture setup over an existing database');
const migration=readFileSync(new URL('../migrations/20261104113832_prepare_google_health_hydration_read.sql',import.meta.url),'utf8');
const serverConfigMigration=readFileSync(new URL('../migrations/20261107203628_google_health_server_vault_configuration.sql',import.meta.url),'utf8');
const scheduleMigration=readFileSync(new URL('../migrations/20261107213824_google_health_background_schedule.sql',import.meta.url),'utf8');
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',scope='https://www.googleapis.com/auth/googlehealth.nutrition.readonly';
run("create role anon;create role authenticated;create role service_role bypassrls;");
function prepare(){
  run(`drop schema if exists auth cascade;drop schema public cascade;create schema public;create schema auth;
    grant usage on schema public to anon,authenticated,service_role;
    alter default privileges in schema public grant all on tables to service_role,anon,authenticated;
    alter default privileges in schema public grant all on sequences to service_role,anon,authenticated;
    alter default privileges in schema public grant all on functions to service_role,anon,authenticated;
    create table auth.users(id uuid primary key);insert into auth.users values('${owner}'),('${other}');
    create table public.health_metrics(marker text);insert into public.health_metrics values('existing-synthetic-health-record');
    ${migration}`);
}
const begin=(hash='a'.repeat(64),user=owner)=>scalar(service(`select public.health_google_begin_authorization('${user}',${lit(hash)},'v1.synthetic-state',clock_timestamp()+interval '10 minutes');`));
const consume=hash=>object(service(`select coalesce(jsonb_agg(x),'[]') from public.health_google_consume_state(${lit(hash)}) x;`));
const row=(user=owner)=>object(service(`select to_jsonb(c) from public.health_google_connections c where user_id='${user}';`));
const save=(generation,hash='a'.repeat(64),user=owner)=>scalar(service(`select public.health_google_save_authorization('${user}','${generation}',${lit(hash)},'synthetic-health-user','v1.synthetic-tokens');`));
function link(user=owner){const hash=(user===owner?'a':'f').repeat(64),g=begin(hash,user);consume(hash);assert.equal(save(g,hash,user),'t');return row(user);}
const lease='33333333-3333-4333-8333-333333333333';
const claim=(r,token=lease)=>scalar(service(`update public.health_google_connections set lease_token='${token}',lease_until=clock_timestamp()+interval '2 minutes' where user_id='${r.user_id}' and generation='${r.generation}' and status='connected' and lease_until<=clock_timestamp() returning user_id;`));
const payload=(extra={})=>({format:'lts-google-health-hydration-read',complete:true,mode:'read_only',canonical_eligible:false,health_user_id:'synthetic-health-user',source_family:'users/me/dataSourceFamilies/all-sources',from:'2030-02-11',to_exclusive:'2030-02-12',pages:1,received_count:1,unique_count:1,status:'observations_unverified',records:[{resource_name:'users/synthetic-health-user/dataTypes/hydration-log/dataPoints/water-0001',health_user_id:'synthetic-health-user',canonical_eligible:false,milliliters:321,raw:{synthetic:true}}],...extra});
const finish=(r,result=payload(),token=lease)=>service(`select public.health_google_finish_read('${r.user_id}','${r.generation}','${token}',${json(result)});`);
const count=()=>+scalar(service('select count(*) from public.health_google_hydration_reads;'));

test('credential, state and source-read tables have RLS and no frontend or PUBLIC privileges',()=>{
  prepare();
  for(const table of ['health_google_connections','health_google_oauth_states','health_google_hydration_reads']){
    assert.equal(scalar(`select relrowsecurity from pg_class where oid='public.${table}'::regclass;`),'t');
    for(const role of ['anon','authenticated'])for(const privilege of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE'])assert.equal(scalar(`select has_table_privilege('${role}','public.${table}','${privilege}');`),'f');
  }
  for(const signature of ['health_google_begin_authorization(uuid,text,text,timestamptz)','health_google_consume_state(text)','health_google_save_authorization(uuid,uuid,text,text,text)','health_google_disconnect(uuid)','health_google_finish_read(uuid,uuid,uuid,jsonb)']){
    const s=object(`select jsonb_build_object('definer',prosecdef,'config',proconfig) from pg_proc where oid='public.${signature}'::regprocedure;`);
    assert.equal(s.definer,false);assert.ok(s.config.includes('search_path=""'));
    for(const role of ['anon','authenticated'])assert.equal(scalar(`select has_function_privilege('${role}','public.${signature}','EXECUTE');`),'f');
  }
  for(const p of ['UPDATE','DELETE','TRUNCATE'])assert.equal(scalar(`select has_table_privilege('service_role','public.health_google_hydration_reads','${p}');`),'f');
  for(const table of ['health_google_connections','health_google_oauth_states'])for(const p of ['DELETE','TRUNCATE'])assert.equal(scalar(`select has_table_privilege('service_role','public.${table}','${p}');`),'f');
  const denied=run('SET ROLE authenticated; SELECT * FROM public.health_google_connections;',false);assert.match(denied.stderr,/permission denied/);
});
test('only one consume succeeds and the original user/generation stays bound',()=>{
  prepare();const generation=begin(),state=consume('a'.repeat(64));assert.equal(state.length,1);assert.equal(state[0].user_id,owner);assert.equal(state[0].generation,generation);
  assert.deepEqual(consume('a'.repeat(64)),[]);assert.equal(save(generation),'t');assert.equal(save(generation),'f');
  assert.equal(row().status,'connected');assert.deepEqual(row().scopes,[scope]);
});
test('new authorization and disconnect invalidate previously consumed callbacks',()=>{
  prepare();const first=begin();consume('a'.repeat(64));begin('b'.repeat(64));assert.equal(save(first),'f');
  const state=consume('b'.repeat(64))[0];run(service(`select public.health_google_disconnect('${owner}');`));
  assert.equal(save(state.generation,'b'.repeat(64)),'f');assert.equal(row().status,'unlinked');assert.equal(row().tokens_encrypted,null);
});
test('expired state is not consumed and cannot supply callback identity',()=>{
  prepare();begin();run(service(`update public.health_google_connections set pending_state_hash=null where user_id='${owner}';`));
  assert.deepEqual(consume('a'.repeat(64)),[]);
  begin('b'.repeat(64));run(`update public.health_google_oauth_states set expires_at=clock_timestamp()-interval '1 second';`);assert.deepEqual(consume('b'.repeat(64)),[]);
});
test('authorization replaces one bounded slot and disconnect erases the pending encrypted verifier',()=>{
  prepare();begin();const first=begin('b'.repeat(64));
  assert.deepEqual(consume('a'.repeat(64)),[]);
  assert.equal(scalar(service('select count(*) from public.health_google_oauth_states;')),'1');
  const before=row();
  const collision=run(service(`select public.health_google_begin_authorization('${other}','${'b'.repeat(64)}','v1.other-state',clock_timestamp()+interval '10 minutes');`),false);
  assert.match(collision.stderr,/unique constraint/);assert.deepEqual(row(),before);
  assert.equal(scalar(service(`select count(*) from public.health_google_connections where user_id='${other}';`)),'0');
  assert.equal(consume('b'.repeat(64))[0].generation,first);
  assert.notEqual(scalar(service('select consumed_at is null from public.health_google_oauth_states;')),'t');
  begin('c'.repeat(64));assert.equal(consume('c'.repeat(64)).length,1);
  run(service(`select public.health_google_disconnect('${owner}');`));
  const pending=object(service('select to_jsonb(s) from public.health_google_oauth_states s;'));
  assert.equal(pending.payload_encrypted,'');assert.ok(pending.consumed_at);
  assert.equal(scalar(service('select count(*) from public.health_google_oauth_states;')),'1');
  assert.equal(scalar('select marker from public.health_metrics;'),'existing-synthetic-health-record');
});
test('complete private reads are atomic and unchanged pagination/order does not append another snapshot',()=>{
  prepare();const r=link();assert.equal(claim(r),owner);assert.equal(scalar(finish(r)),'stored');assert.equal(count(),1);
  claim(r);assert.equal(scalar(finish(r,payload({pages:2,received_count:2}))),'unchanged');assert.equal(count(),1);
  const changed=payload();changed.records[0].milliliters=322;claim(r);assert.equal(scalar(finish(r,changed)),'stored');assert.equal(count(),2);
  run(service(`select public.health_google_disconnect('${owner}');`));assert.equal(count(),2);
  assert.equal(scalar('select marker from public.health_metrics;'),'existing-synthetic-health-record');
});
test('empty valid read remains distinct from missing or partial input',()=>{
  prepare();const r=link();claim(r);
  assert.equal(scalar(finish(r,payload({records:[],unique_count:0,received_count:0,status:'empty'}))),'stored');
  const stored=object(service('select result from public.health_google_hydration_reads;'));assert.deepEqual(stored.records,[]);assert.equal(Object.hasOwn(stored,'water_ml_total'),false);
});
test('unverified source results cannot become canonical or move to another linked account',()=>{
  prepare();const r=link();
  const bad=[{},payload({complete:false}),payload({canonical_eligible:true}),payload({health_user_id:'wrong-user'}),payload({records:{}}),payload({to_exclusive:'2030-04-01'})];
  const promoted=payload();promoted.records[0].canonical_eligible=true;bad.push(promoted);
  for(const p of bad){claim(r);const rejected=run(finish(r,p),false);assert.match(rejected.stderr,/invalid_|check constraint/);assert.equal(count(),0);}
  run(service(`update public.health_google_connections set scopes=array[${lit(scope)},'https://www.googleapis.com/auth/googlehealth.nutrition.writeonly'] where user_id='${owner}';`),false);
  assert.equal(scalar('select marker from public.health_metrics;'),'existing-synthetic-health-record');
});
test('stale generation, expired lease and another owner cannot commit a source read',()=>{
  prepare();const r=link();claim(r);
  const wrong={...r,generation:'44444444-4444-4444-8444-444444444444'};assert.equal(scalar(finish(wrong)),'stale');assert.equal(count(),0);
  const otherRow=link(other);assert.equal(scalar(finish(otherRow)),'stale');assert.equal(count(),0);
  run(service(`update public.health_google_connections set lease_until=clock_timestamp()-interval '1 second' where user_id='${owner}';`));assert.equal(scalar(finish(r)),'stale');assert.equal(count(),0);
});
function asyncSql(sql){return new Promise((resolve,reject)=>{const child=spawn('psql',args,{env,stdio:['pipe','pipe','pipe']});let out='',err='';child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>err+=x);child.on('error',reject);child.on('close',code=>code===0?resolve(out.trim()):reject(Error(err)));child.stdin.end(prefix+sql);});}
test('two real concurrent state consumers and read claims yield one winner',async()=>{
  prepare();begin();
  const query=service(`select count(*) from public.health_google_consume_state('${'a'.repeat(64)}');`);
  assert.deepEqual((await Promise.all([asyncSql(query),asyncSql(query)])).sort(),['0','1']);
  // First callback still has the current generation; reconnect using a fresh one for the lease test.
  const r=link();
  const claimSql=token=>service(`update public.health_google_connections set lease_token='${token}',lease_until=clock_timestamp()+interval '2 minutes' where user_id='${owner}' and generation='${r.generation}' and status='connected' and lease_until<=clock_timestamp() returning user_id;`);
  const results=await Promise.all([asyncSql(claimSql(lease)),asyncSql(claimSql('55555555-5555-4555-8555-555555555555'))]);
  assert.equal(results.filter(x=>x===owner).length,1);assert.equal(results.filter(x=>x==='').length,1);
});
test('reapplying the same schema preserves encrypted connections and immutable read history',()=>{
  prepare();const r=link();claim(r);assert.equal(scalar(finish(r)),'stored');
  const before=row(),readBefore=object(service('select result from public.health_google_hydration_reads;'));
  run(migration);
  assert.deepEqual(row(),before);assert.equal(count(),1);
  assert.deepEqual(object(service('select result from public.health_google_hydration_reads;')),readBefore);
  assert.equal(scalar("select has_table_privilege('authenticated','public.health_google_hydration_reads','SELECT');"),'f');
  assert.equal(scalar("select has_table_privilege('service_role','public.health_google_hydration_reads','UPDATE');"),'f');
});

function prepareServerConfig(){
  prepare();
  // This deliberately plaintext Vault stand-in is disposable synthetic ACL input, not a claim about production encryption.
  run(`drop schema if exists vault cascade;create schema vault;
    revoke all on schema vault from public,anon,authenticated,service_role;
    create table vault.fixture_secrets(name text primary key,decrypted_secret text);
    create view vault.decrypted_secrets as select * from vault.fixture_secrets;
    revoke all on all tables in schema vault from public,anon,authenticated,service_role;
    ${serverConfigMigration}`);
}
const serverConfig=()=>object(service('select coalesce(jsonb_agg(x),\'[]\') from public.health_google_server_configuration() x;'));
const setupKey=btoa('v'.repeat(32));
test('server configuration gives only the privileged server a fixed-purpose Vault read, with no direct Vault grants',()=>{
  prepareServerConfig();
  for(const role of ['anon','authenticated']){
    assert.equal(scalar(`select has_function_privilege('${role}','public.health_google_server_configuration()','EXECUTE');`),'f');
    const denied=run(`set role ${role};select * from public.health_google_server_configuration();`,false);assert.match(denied.stderr,/permission denied/);
  }
  assert.equal(scalar("select has_schema_privilege('service_role','vault','USAGE');"),'f');
  assert.equal(scalar("select has_function_privilege('service_role','public.health_google_server_configuration()','EXECUTE');"),'t');
  const metadata=object("select jsonb_build_object('definer',prosecdef,'args',pronargs,'config',proconfig) from pg_proc where oid='public.health_google_server_configuration()'::regprocedure;");
  assert.equal(metadata.definer,true);assert.equal(metadata.args,0);assert.ok(metadata.config.includes('search_path=""'));
  assert.deepEqual(serverConfig(),[]);
});
test('private activation is explicit, validates a 32-byte Base64 key and never returns an inactive key',()=>{
  prepareServerConfig();
  run(`insert into vault.fixture_secrets values('lts_health_google_token_encryption_key',${lit(setupKey)});`);assert.deepEqual(serverConfig(),[]);
  run("insert into vault.fixture_secrets values('lts_health_google_connection_enabled','false');");assert.deepEqual(serverConfig(),[{enabled:false,token_encryption_key:null}]);
  run("update vault.fixture_secrets set decrypted_secret='true' where name='lts_health_google_connection_enabled';");assert.deepEqual(serverConfig(),[{enabled:true,token_encryption_key:setupKey}]);
  for(const invalid of ['invalid',btoa('short'),btoa('x'.repeat(33))]){
    run(`update vault.fixture_secrets set decrypted_secret=${lit(invalid)} where name='lts_health_google_token_encryption_key';`);
    assert.deepEqual(serverConfig(),[{enabled:false,token_encryption_key:null}]);
  }
  run("delete from vault.fixture_secrets where name='lts_health_google_token_encryption_key';");assert.deepEqual(serverConfig(),[{enabled:false,token_encryption_key:null}]);
});
test('reapplying server configuration does not change Vault values, clinical rows or OAuth state',()=>{
  prepareServerConfig();const linked=link();
  run(`insert into vault.fixture_secrets values('lts_health_google_token_encryption_key',${lit(setupKey)}),('lts_health_google_connection_enabled','true'),('unrelated-purpose','synthetic-unrelated');`);
  const before=row(),keys=object('select jsonb_agg(x order by name) from vault.fixture_secrets x;');
  run(serverConfigMigration);assert.deepEqual(row(),before);assert.deepEqual(object('select jsonb_agg(x order by name) from vault.fixture_secrets x;'),keys);
  assert.deepEqual(serverConfig(),[{enabled:true,token_encryption_key:setupKey}]);assert.equal(count(),0);
  assert.equal(scalar('select marker from public.health_metrics;'),'existing-synthetic-health-record');assert.equal(linked.status,'connected');
});

function prepareSchedule(){
  run('drop schema if exists health_internal cascade;drop schema if exists health_transport cascade;drop schema if exists cron cascade;drop schema if exists net cascade;');
  prepare();
  // Real PostgreSQL/pgcrypto and privileges. Explicit synthetic HTTP/cron stand-ins
  // replace external transport only and can never issue a network request.
  assert.equal(scheduleMigration.split('create extension if not exists http with schema health_transport;').length,2);
  run(`create schema if not exists extensions;create extension if not exists pgcrypto with schema extensions;
    create schema cron;grant usage on schema cron to service_role;
    create table cron.job(jobid bigint generated always as identity primary key,jobname text unique,schedule text,command text,active boolean default true);
    grant select on cron.job to service_role;
    create function cron.schedule(job_name text,schedule text,command text) returns bigint language plpgsql as $$
      declare inserted bigint;begin insert into cron.job(jobname,schedule,command) values($1,$2,$3) returning jobid into inserted;return inserted;end $$;
    create function cron.alter_job(job_id bigint,schedule text default null,command text default null,active boolean default null) returns void language sql as $$
      update cron.job j set schedule=coalesce($2,j.schedule),command=coalesce($3,j.command),active=coalesce($4,j.active) where jobid=$1;$$;
    create schema net;create table net.http_request_queue(marker text);grant usage on schema net to public;grant all on net.http_request_queue to public;
    create schema health_transport;
    create type health_transport.http_method as enum ('POST');
    create type health_transport.http_header as (field varchar,value varchar);
    create type health_transport.http_request as (method health_transport.http_method,uri varchar,headers health_transport.http_header[],content_type varchar,content varchar);
    create type health_transport.http_response as (status integer,content_type varchar,headers health_transport.http_header[],content varchar);
    create table health_transport.fixture_calls(request health_transport.http_request);
    create table health_transport.fixture_options(name text,value text);
    create table health_transport.fixture_reply(status integer,content varchar);
    insert into health_transport.fixture_reply values(200,'{"attempted":0,"completed":0,"skipped":0,"failed":0}');
    create function health_transport.http_set_curlopt(option varchar,value varchar) returns boolean language plpgsql as $$
      begin insert into health_transport.fixture_options values($1,$2);return true;end $$;
    create function health_transport.http_reset_curlopt() returns boolean language plpgsql as $$
      begin insert into health_transport.fixture_options values('reset','true');return true;end $$;
    create function health_transport.http(req health_transport.http_request) returns health_transport.http_response language plpgsql as $$
      declare ticket text;authorized boolean;reply health_transport.fixture_reply%rowtype;
      begin
        insert into health_transport.fixture_calls values(req);
        select h.value into ticket from unnest(req.headers) h where h.field='x-lts-google-scheduler';
        authorized:=public.health_google_scheduler_authorized(encode(extensions.digest(ticket,'sha256'),'hex'));
        if not authorized then return (401,'application/json',null,'{"error":"unauthorized"}')::health_transport.http_response;end if;
        select * into reply from health_transport.fixture_reply;
        return (reply.status,'application/json',null,reply.content)::health_transport.http_response;
      end $$;
    ${syntheticScheduleMigration()}`);
}
const syntheticScheduleMigration=()=>scheduleMigration.replace('create extension if not exists http with schema health_transport;','-- Explicit synthetic external transport installed by the guarded disposable fixture.');
const scheduleRow=()=>object('select to_jsonb(c) from health_internal.google_hydration_schedule_config c;');
const schedulerStatus=()=>object(service('select to_jsonb(s) from public.health_google_scheduler_status() s;'));
const enableSchedule=()=>run("update health_internal.google_hydration_schedule_config set enabled=true,endpoint_url='https://abcdefghijklmnopqrst.supabase.co/functions/v1/health-google-scheduled';select cron.alter_job(jobid,active:=true) from cron.job where jobname in ('lts-health-google-hourly','lts-health-google-ticket-hourly');");
const issue=()=>scalar('select health_internal.prepare_google_hydration_ticket();');
const dispatch=()=>scalar('select health_internal.dispatch_google_hydration();');
const consumeTicket=hash=>scalar(service(`select public.health_google_scheduler_authorized(${lit(hash)});`));
const candidates=()=>object(service("select coalesce(jsonb_agg(jsonb_build_object('user_id',c.user_id)),'[]') from public.health_google_scheduled_candidates() c;"));
const scheduledClaim=(r,token=lease)=>service(`select public.health_google_claim_scheduled_read('${r.user_id}','${r.generation}','${token}');`);
const scheduledFinish=(r,result=payload(),token=lease)=>service(`select public.health_google_finish_scheduled_read('${r.user_id}','${r.generation}','${token}',${json(result)});`);
test('Google agenda installs dormant; browser roles cannot inspect private tickets, transport or service RPCs',()=>{
  prepareSchedule();assert.equal(scheduleRow().enabled,false);assert.equal(schedulerStatus().enabled,false);assert.equal(issue(),'f');assert.equal(dispatch(),'');
  assert.equal(scalar('select count(*) from health_transport.fixture_calls;'),'0');assert.equal(scalar('select count(*) from cron.job where active;'),'0');
  assert.equal(scalar("select relrowsecurity from pg_class where oid='health_internal.google_hydration_schedule_config'::regclass;"),'t');
  for(const role of ['anon','authenticated']){
    for(const schema of ['health_internal','health_transport'])assert.equal(scalar(`select has_schema_privilege('${role}','${schema}','USAGE');`),'f');
    assert.match(run(`set role ${role};select ticket_value from health_internal.google_hydration_schedule_config;`,false).stderr,/permission denied/);
    assert.match(run(`set role ${role};select * from health_transport.fixture_calls;`,false).stderr,/permission denied/);
  }
  for(const signature of ['health_google_scheduler_authorized(text)','health_google_scheduled_candidates()','health_google_claim_scheduled_read(uuid,uuid,uuid)','health_google_finish_scheduled_read(uuid,uuid,uuid,jsonb)','health_google_scheduler_status()']){
    const metadata=object(`select jsonb_build_object('definer',prosecdef,'config',proconfig) from pg_proc where oid='public.${signature}'::regprocedure;`);
    assert.equal(metadata.definer,false);assert.ok(metadata.config.includes('search_path=""'));
    for(const role of ['anon','authenticated'])assert.equal(scalar(`select has_function_privilege('${role}','public.${signature}','EXECUTE');`),'f');
    assert.equal(scalar(`select has_function_privilege('service_role','public.${signature}','EXECUTE');`),'t');
  }
  for(const name of ['prepare_google_hydration_ticket','dispatch_google_hydration'])assert.equal(scalar(`select has_function_privilege('service_role','health_internal.${name}()','EXECUTE');`),'f');
});
test('the service may consume a ticket but cannot read its raw value, issue, enable, extend or redirect it',()=>{
  prepareSchedule();enableSchedule();issue();const before=scheduleRow();
  assert.match(run(service('select ticket_value from health_internal.google_hydration_schedule_config;'),false).stderr,/permission denied/);
  for(const sql of ["enabled=false","key_hash='"+'b'.repeat(64)+"'","ticket_expires_at=clock_timestamp()+interval '5 minutes'","endpoint_url='https://abcdefghijklmnopqrst.supabase.co/functions/v1/health-google-scheduled'"]){
    assert.match(run(service(`update health_internal.google_hydration_schedule_config set ${sql};`),false).stderr,/permission denied/);
  }
  assert.deepEqual(scheduleRow(),before);assert.equal(scalar("select has_column_privilege('service_role','health_internal.google_hydration_schedule_config','ticket_consumed_at','UPDATE');"),'t');
  for(const url of ['https://untrusted.test/endpoint','https://abcdefghijklmnopqrst.supabase.co/functions/v1/health-google-scheduled?redirect=x'])assert.match(run(`update health_internal.google_hydration_schedule_config set endpoint_url=${lit(url)};`,false).stderr,/check constraint/);
});
test('each invocation has a random hashed five-minute single-use ticket; replay and concurrent consumption fail',async()=>{
  prepareSchedule();enableSchedule();assert.equal(issue(),'t');const cfg=scheduleRow(),raw=cfg.ticket_value;assert.match(raw,/^[a-f0-9]{64}$/);assert.notEqual(raw,cfg.key_hash);
  assert.equal(scalar(`select encode(extensions.digest(${lit(raw)},'sha256'),'hex');`),cfg.key_hash);
  assert.equal(Date.parse(cfg.ticket_expires_at)-Date.parse(cfg.ticket_issued_at),300000);assert.equal(issue(),'f');
  const query=service(`select public.health_google_scheduler_authorized('${cfg.key_hash}');`);
  assert.deepEqual((await Promise.all([asyncSql(query),asyncSql(query)])).sort(),['f','t']);assert.equal(consumeTicket(cfg.key_hash),'f');
  assert.ok(scheduleRow().ticket_consumed_at);assert.equal(issue(),'t');assert.notEqual(scheduleRow().key_hash,cfg.key_hash);
  assert.equal(consumeTicket(cfg.key_hash),'f');assert.equal(consumeTicket('invalid'),'f');
  const status=schedulerStatus();assert.equal(status.enabled,true);assert.equal(status.interval_minutes,60);assert.ok(!JSON.stringify(status).includes(raw));assert.ok(!JSON.stringify(status).includes(cfg.key_hash));
});
test('disabled, expired and future tickets are refused without HTTP or an authorized owner read',()=>{
  prepareSchedule();enableSchedule();issue();let cfg=scheduleRow();
  run("with stamp as materialized (select clock_timestamp() as n) update health_internal.google_hydration_schedule_config set ticket_issued_at=stamp.n-interval '6 minutes',ticket_expires_at=stamp.n-interval '1 minute' from stamp;");assert.equal(consumeTicket(cfg.key_hash),'f');assert.equal(dispatch(),'');
  issue();cfg=scheduleRow();run("update health_internal.google_hydration_schedule_config set enabled=false;");assert.equal(consumeTicket(cfg.key_hash),'f');assert.equal(dispatch(),'');
  run("with stamp as materialized (select clock_timestamp() as n) update health_internal.google_hydration_schedule_config set enabled=true,ticket_issued_at=stamp.n+interval '1 minute',ticket_expires_at=stamp.n+interval '5 minutes' from stamp;");assert.equal(consumeTicket(cfg.key_hash),'f');assert.equal(dispatch(),'');
  assert.equal(scalar('select count(*) from health_transport.fixture_calls;'),'0');assert.equal(count(),0);
});
test('a separate committed ticket dispatch uses bounded private transport, clears raw credentials and retains only aggregate counts',()=>{
  prepareSchedule();enableSchedule();issue();const hash=scheduleRow().key_hash;assert.equal(dispatch(),'200');
  const cfg=scheduleRow();assert.equal(cfg.ticket_value,null);assert.ok(cfg.ticket_consumed_at);assert.equal(cfg.last_dispatch_status,200);assert.deepEqual(cfg.last_dispatch_counts,{attempted:0,completed:0,skipped:0,failed:0});
  assert.equal(dispatch(),'');assert.equal(consumeTicket(hash),'f');assert.equal(scalar('select count(*) from net.http_request_queue;'),'0');
  const request=object('select to_jsonb((f.request)) from health_transport.fixture_calls f;');assert.equal(request.method,'POST');assert.equal(request.uri,'https://abcdefghijklmnopqrst.supabase.co/functions/v1/health-google-scheduled');assert.equal(request.content_type,'application/json');assert.deepEqual(JSON.parse(request.content),{action:'tick'});
  const options=object('select jsonb_object_agg(name,value) from health_transport.fixture_options;');assert.equal(options.CURLOPT_TIMEOUT_MS,'120000');assert.equal(options.CURLOPT_CONNECTTIMEOUT_MS,'5000');assert.equal(options.reset,'true');
  run("select cron.alter_job(jobid,active:=false) from cron.job where jobname='lts-health-google-ticket-hourly';");assert.equal(schedulerStatus().enabled,false);
});
test('malformed or sensitive transport results cannot become retained health or error content',()=>{
  prepareSchedule();enableSchedule();issue();run("update health_transport.fixture_reply set content='synthetic-provider-secret';");assert.equal(dispatch(),'599');assert.equal(scheduleRow().last_dispatch_counts,null);assert.equal(scheduleRow().ticket_value,null);assert.equal(count(),0);
  prepareSchedule();enableSchedule();assert.equal(issue(),'t');run("update health_transport.fixture_reply set content='{\"attempted\":0,\"completed\":0,\"skipped\":0,\"failed\":0,\"private\":\"synthetic-secret\"}';");assert.equal(dispatch(),'200');assert.ok(!JSON.stringify(schedulerStatus()).includes('synthetic-secret'));
});
test('scheduled candidates are connected, due, lease-free and bounded; recent manual reads and failed attempts back off',()=>{
  prepareSchedule();const first=link(),second=link(other);assert.equal(candidates().length,2);
  assert.equal(scalar(scheduledClaim(first)),'t');assert.deepEqual(candidates(),[{user_id:other}]);assert.equal(scalar(scheduledClaim(first)),'f');
  run(service(`update public.health_google_connections set lease_token=null,lease_until='1970-01-01' where user_id='${owner}';`));assert.deepEqual(candidates(),[{user_id:other}]);
  claim(second);assert.equal(scalar(finish(second)),'stored');assert.deepEqual(candidates(),[]);assert.equal(scalar(scheduledClaim(second)),'f');
  run(service("update public.health_google_connections set last_scheduled_attempt_at=clock_timestamp()-interval '51 minutes',last_read_at=clock_timestamp()-interval '51 minutes';"));assert.equal(candidates().length,2);
  for(const [id,hash] of [['44444444-4444-4444-8444-444444444444','4'.repeat(64)],['55555555-5555-4555-8555-555555555555','5'.repeat(64)]]){run(`insert into auth.users values('${id}');`);const g=begin(hash,id);consume(hash);assert.equal(save(g,hash,id),'t');}
  assert.equal(candidates().length,2);
});
test('concurrent manual and scheduled claims share one transaction lease and a stale scheduled finish is rejected',async()=>{
  prepareSchedule();const r=link();
  const manual=service(`update public.health_google_connections set lease_token='55555555-5555-4555-8555-555555555555',lease_until=clock_timestamp()+interval '2 minutes' where user_id='${owner}' and generation='${r.generation}' and status='connected' and lease_until<=clock_timestamp() returning 't';`);
  const results=await Promise.all([asyncSql(manual),asyncSql(scheduledClaim(r))]);assert.equal(results.filter(x=>x==='t').length,1);
  run(service(`select public.health_google_disconnect('${owner}');`));assert.equal(scalar(scheduledFinish(r)),'stale');assert.equal(row().last_scheduled_read_at,null);assert.equal(count(),0);
});
test('a complete scheduled result is privately attributable, idempotent and erased only as connection proof on reauthorization',()=>{
  prepareSchedule();const r=link();assert.equal(scalar(scheduledClaim(r)),'t');assert.equal(scalar(scheduledFinish(r)),'stored');assert.ok(row().last_scheduled_read_at);assert.equal(count(),1);
  const stored=object(service('select result from public.health_google_hydration_reads;'));assert.equal(stored.read_trigger,'scheduled');assert.equal(stored.canonical_eligible,false);
  run(service("update public.health_google_connections set last_read_at=clock_timestamp()-interval '51 minutes',last_scheduled_attempt_at=clock_timestamp()-interval '51 minutes';"));
  assert.equal(scalar(scheduledClaim(r)),'t');assert.equal(scalar(scheduledFinish(r,payload({pages:2,received_count:2}))),'unchanged');assert.equal(count(),1);
  begin('c'.repeat(64));assert.equal(row().last_scheduled_read_at,null);assert.equal(row().last_scheduled_attempt_at,null);assert.equal(count(),1);
  assert.equal(scalar('select marker from public.health_metrics;'),'existing-synthetic-health-record');
});
test('reapplying the agenda preserves activation, the current private ticket, encrypted connections and retained reads',()=>{
  prepareSchedule();enableSchedule();const r=link();scalar(scheduledClaim(r));scalar(scheduledFinish(r));issue();
  const before=scheduleRow(),connection=row(),jobs=object('select jsonb_agg(j order by jobname) from cron.job j;');run(syntheticScheduleMigration());
  assert.deepEqual(scheduleRow(),before);assert.deepEqual(row(),connection);assert.deepEqual(object('select jsonb_agg(j order by jobname) from cron.job j;'),jobs);assert.equal(count(),1);
  assert.equal(schedulerStatus().enabled,true);assert.equal(scalar('select count(*) from cron.job;'),'2');
});
