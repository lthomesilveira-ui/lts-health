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
