import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { syntheticBaseSql, basalMigrationSql, syntheticConnectionSql, syntheticOwner as user, syntheticOtherOwner as other, syntheticKeyHash as key, syntheticOtherKeyHash as otherKey } from './support/health-basal-synthetic.mjs';

// This test is intentionally destructive ONLY to a disposable synthetic DB.
// It cannot inherit an application URL, remote host, service file or password.
assert.equal(process.env.HEALTH_BASAL_SYNTHETIC_TEST, '1', 'Explicit synthetic-test opt-in required');
assert.equal(process.env.PGDATABASE, 'health_basal_candidates_test', 'Disposable test database required');
assert.ok(['127.0.0.1', '::1'].includes(process.env.PGHOST), 'Literal loopback required');
assert.equal(process.env.PGUSER, 'postgres');
assert.equal(process.env.PGPASSWORD, 'synthetic-ci-only');
assert.ok(!process.env.PGHOSTADDR && !process.env.PGSERVICE && !process.env.PGSERVICEFILE, 'Connection overrides forbidden');
assert.ok(/^\d{1,5}$/.test(process.env.PGPORT ?? '5432') && Number(process.env.PGPORT ?? '5432') >= 1 && Number(process.env.PGPORT ?? '5432') <= 65535);
const env = {
  PATH: process.env.PATH, LANG: 'C.UTF-8',
  // Debian package extraction may require its matching, non-secret libpq path.
  ...(process.env.HEALTH_BASAL_TEST_LIBDIR ? { LD_LIBRARY_PATH: process.env.HEALTH_BASAL_TEST_LIBDIR } : {}),
  PGHOST: process.env.PGHOST, PGPORT: process.env.PGPORT ?? '5432',
  PGDATABASE: 'health_basal_candidates_test', PGUSER: 'postgres', PGPASSWORD: 'synthetic-ci-only',
  PGCONNECT_TIMEOUT: '5', PGSSLMODE: 'disable', PGPASSFILE: '/dev/null', PGAPPNAME: 'synthetic-basal-tests',
};
const args = ['-X', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=terse', '-At', '-q'];
const prefix = "SET timezone='UTC'; SET datestyle='ISO,YMD'; SET statement_timeout='15s';\n";
function run(sql, success=true) {
  const r = spawnSync('psql', args, { input: prefix+sql, env, encoding:'utf8', timeout:20_000, maxBuffer:8_000_000 });
  assert.ifError(r.error);
  if (success) assert.equal(r.status,0,r.stderr);
  else { assert.notEqual(r.status,0,'Expected rejection'); assert.doesNotMatch(r.stderr,/syntax error at|does not exist|could not connect|connection to server/); }
  return r;
}
const json = sql => { const value=run(sql).stdout.trim(); return value==='t'?true:value==='f'?false:JSON.parse(value); };
assert.equal(run("SELECT current_setting('server_version_num')::integer/10000;").stdout.trim(),'17');
assert.equal(run('SELECT current_database();').stdout.trim(),'health_basal_candidates_test');
assert.equal(json(`SELECT NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public')
  AND NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public')
  AND NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname IN ('health_ingest_private','auth'));`),true,
  'Refuse to drop an existing schema: initial database must be empty before this suite owns its fixtures');
const lit = s => `'${String(s).replaceAll("'","''")}'`;
const SQL_NULL=Symbol('SQL NULL');
const sqlJson = value => value===SQL_NULL?'NULL':`convert_from(decode('${Buffer.from(JSON.stringify(value)).toString('base64')}','base64'),'UTF8')::jsonb`;
function candidate(overrides={}) { return { point_index:0, quantity:1234.56789, unit:' kcal ', source_date:'2026-10-19 23:30:00 -0300', metric_date:'2026-10-19', original_source:null, source_start_date:null, source_end_date:null, source_creation_date:null, ...overrides }; }
function metric(type='dietary_energy_kcal',value=1500,source='Apple Saúde · Synthetic Phone') {
  return { source_record_id:`health_auto_export:${JSON.stringify([type,'2026-10-19',source])}`, metric_date:'2026-10-19',metric_type:type,value,unit:type==='dietary_energy_kcal'?'kcal':'g',source_name:source,source_family:'health_auto_export',canonical_status:'canonical',confidence:'authenticated_auto_export',source_payload:{transport:'health_auto_export',export_version:2,aggregation:'day',original_source:'Synthetic Phone',export_metric:'dietary_energy'} };
}
function call({metrics=[],basal=[candidate()],receipt=randomUUID(),hash=key,role='service_role'}={}) {
  return `SET ROLE ${role}; SELECT public.health_auto_export_ingest_candidates(${lit(hash)},${sqlJson(metrics)},${sqlJson(basal)},${receipt===null?'NULL':`${lit(receipt)}::uuid`});`;
}
function prepare() {
  run(syntheticBaseSql);
  const old=run("SELECT pg_get_functiondef('public.health_auto_export_ingest(text,jsonb)'::regprocedure);").stdout;
  run('BEGIN;\n'+basalMigrationSql+'\nCOMMIT;');
  assert.equal(run("SELECT pg_get_functiondef('public.health_auto_export_ingest(text,jsonb)'::regprocedure);").stdout,old,'Legacy function changed');
  run(syntheticConnectionSql);
}
const tables=['public.health_auto_export_connections','public.health_source_daily_metrics','public.health_daily_nutrition','health_ingest_private.ingest_receipts','health_ingest_private.basal_energy_candidates'];
function snapshot() { return Object.fromEntries(tables.map(t=>[t,json(`SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),'[]'::jsonb) FROM ${t} x;`)])); }
function failWithoutChange(sql,pattern=/invalid|receipt collision|permission denied|synthetic failure|violates check/) {
  const before=snapshot(), r=run(sql,false); assert.match(r.stderr,pattern); assert.deepEqual(snapshot(),before,'Rejected transaction changed state');
}
function runAsync(sql,name) {
  return new Promise((resolve,reject)=>{
    const child=spawn('psql',args,{env:{...env,PGAPPNAME:name}}); let stdout='',stderr='';
    child.stdout.on('data',d=>stdout+=d); child.stderr.on('data',d=>stderr+=d); child.on('error',reject);
    child.on('close',status=>status===0?resolve(JSON.parse(stdout.trim())):reject(Error(stderr)));
    child.stdin.end(prefix+sql);
  });
}
function holdSession() {
  const child=spawn('psql',args,{env:{...env,PGAPPNAME:'synthetic-basal-holder'}}); let stdout='',stderr='',pending=null;
  child.stdout.on('data',d=>{stdout+=d; if(pending&&stdout.includes(pending.marker)){const p=pending;pending=null;p.resolve();}});
  child.stderr.on('data',d=>stderr+=d); child.on('error',e=>pending?.reject(e)); child.on('close',c=>{if(pending)pending.reject(Error(`Holder closed ${c}: ${stderr}`));});
  return { abort(){child.kill();}, async send(sql) { const marker=randomUUID(); await new Promise((resolve,reject)=>{pending={marker,resolve,reject};child.stdin.write(`${sql}\nSELECT '${marker}';\n`);}); }, async close(){await this.send('COMMIT;');child.stdin.end();} };
}
async function blocked(name) {
  const deadline=Date.now()+5000;
  while(Date.now()<deadline) {
    if(json(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name=${lit(name)} AND wait_event_type='Lock');`))return;
    await new Promise(r=>setTimeout(r,20));
  }
  assert.fail(`Expected genuine PostgreSQL row-lock wait: ${name}`);
}

test('private schema, invoker/search_path, RLS and minimal grants deny frontend and runtime mutation',()=>{
  prepare();
  const security=json(`SELECT jsonb_build_object('definer',p.prosecdef,'config',p.proconfig,'rls',(SELECT bool_and(relrowsecurity) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='health_ingest_private' AND relkind='r')) FROM pg_proc p WHERE p.oid='public.health_auto_export_ingest_candidates(text,jsonb,jsonb,uuid)'::regprocedure;`);
  assert.equal(security.definer,false); assert.ok(security.config.includes('search_path=""')); assert.equal(security.rls,true);
  for(const role of ['anon','authenticated']) {
    failWithoutChange(call({role}),/permission denied/);
    failWithoutChange(`SET ROLE ${role}; SELECT * FROM health_ingest_private.basal_energy_candidates;`,/permission denied/);
    assert.equal(json(`SELECT has_schema_privilege('${role}','health_ingest_private','USAGE');`),false);
    assert.equal(json(`SELECT has_function_privilege('${role}','public.health_auto_export_ingest_candidates(text,jsonb,jsonb,uuid)','EXECUTE');`),false);
  }
  for(const t of ['ingest_receipts','basal_energy_candidates'])for(const privilege of ['UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'])assert.equal(json(`SELECT has_table_privilege('service_role','health_ingest_private.${t}','${privilege}');`),false);
  run(call());
  failWithoutChange('SET ROLE service_role; UPDATE health_ingest_private.basal_energy_candidates SET coverage_verified=true;',/permission denied/);
  failWithoutChange('SET ROLE service_role; DELETE FROM health_ingest_private.basal_energy_candidates;',/permission denied/);
});

test('basal-only preserves quantity, unit, origin/date evidence without UTC shifts or nutrition/source writes',()=>{
  prepare();run(call({metrics:[metric()],basal:[]}));const before=snapshot();
  const rows=[candidate(),candidate({point_index:1,quantity:42,unit:'kJ',original_source:'  Synthetic Watch  ',source_start_date:'2026-10-19 00:00:00 +1400',source_end_date:'2026-10-19 23:59:59 -1400',source_creation_date:'2026-10-20'}),candidate({point_index:2,quantity:0,unit:'unknown-unit'})];
  const result=json(call({basal:rows}));assert.equal(result.accepted_basal_candidates,3);assert.equal(result.accepted_metrics,0);
  const after=snapshot();
  for(const t of tables.slice(1,3))assert.deepEqual(after[t],before[t]);
  const captured=after[tables[4]].sort((a,b)=>a.point_index-b.point_index);
  captured.forEach((row,i)=>{assert.equal(row.user_id,user);assert.equal(row.coverage_verified,false);for(const field of Object.keys(rows[i]))assert.equal(row[field],rows[i][field]);});
  const prev=before[tables[0]].find(r=>r.user_id===user), next=after[tables[0]].find(r=>r.user_id===user);
  assert.equal(next.rate_count,prev.rate_count+1);assert.equal(next.last_metric_date,prev.last_metric_date);assert.equal(next.last_water_date,prev.last_water_date);assert.equal(next.last_metric_count,0);assert.ok(next.last_received_at);
});

test('mixed request invokes unchanged legacy once and matches nutrition projection exactly',()=>{
  prepare();const metrics=[metric(),metric('dietary_protein_g',90)];
  const r=json(call({metrics}));assert.equal(r.accepted_metrics,2);assert.equal(r.accepted_basal_candidates,1);
  assert.equal(json(`SELECT rate_count FROM public.health_auto_export_connections WHERE user_id='${user}';`),1);
  const projection=json('SELECT to_jsonb(n) FROM public.health_daily_nutrition n;');assert.equal(projection.calories_kcal,1500);assert.equal(projection.protein_g,90);
  const source=snapshot()[tables[1]].map(({id,created_at,updated_at,...r})=>r).sort((a,b)=>a.source_record_id.localeCompare(b.source_record_id));
  prepare();json(`SET ROLE service_role; SELECT public.health_auto_export_ingest('${key}',${sqlJson(metrics)});`);
  const legacyProjection=json('SELECT to_jsonb(n) FROM public.health_daily_nutrition n;');
  for(const k of ['id','created_at']){delete projection[k];delete legacyProjection[k];}
  assert.deepEqual(projection,legacyProjection);assert.deepEqual(snapshot()[tables[1]].map(({id,created_at,updated_at,...r})=>r).sort((a,b)=>a.source_record_id.localeCompare(b.source_record_id)),source);
});

test('same receipt replay is a no-op, new receipts retain repeated snapshots, different users stay isolated',()=>{
  prepare();const receipt=randomUUID(),metrics=[metric()],basal=[candidate()];
  const first=json(call({receipt,metrics,basal})),before=snapshot();
  const again=json(call({receipt,metrics,basal}));assert.deepEqual(again,{...first,already_captured:true});assert.deepEqual(snapshot(),before);
  json(call({metrics,basal}));assert.equal(snapshot()[tables[4]].length,2);
  json(call({receipt,metrics:[],basal,hash:otherKey}));const owners=snapshot()[tables[4]].map(r=>r.user_id);assert.deepEqual(owners.sort(),[user,user,other].sort());
  failWithoutChange(call({receipt,metrics:[metric('dietary_energy_kcal',1600)],basal}),/receipt collision/);
  failWithoutChange(call({receipt,metrics,basal:[candidate({quantity:3})]}),/receipt collision/);
  failWithoutChange(call({receipt,metrics,basal:[]}),/receipt collision/);
});

test('SQL NULL, JSON null, wrong shapes, bounds and unknown fields fail closed with full rollback',()=>{
  prepare();
  for(const args of [{metrics:SQL_NULL},{metrics:null},{metrics:{}},{basal:SQL_NULL},{basal:null},{basal:{}},{receipt:null},{basal:[]},{basal:Array.from({length:2501},(_,i)=>candidate({point_index:i}))},{metrics:Array(2501).fill(metric())}])failWithoutChange(call(args));
  const invalid=[null,3,[],{},candidate({quantity:null}),candidate({quantity:'12'}),candidate({quantity:-1}),candidate({quantity:1000000001}),candidate({point_index:null}),candidate({point_index:1}),candidate({point_index:0.1}),candidate({unit:null}),candidate({unit:''}),candidate({unit:'   '}),candidate({unit:'\u00a0\u2003\ufeff'}),candidate({unit:'a'.repeat(33)}),candidate({unit:'kcal\n'}),candidate({original_source:3}),candidate({original_source:''}),candidate({original_source:'a'.repeat(161)}),candidate({original_source:'x\u007f'}),candidate({user_id:other}),candidate({coverage_verified:true}),candidate({source_date:null}),candidate({metric_date:null}),candidate({metric_date:'2026-10-18'}),candidate({source_start_date:3})];
  for(const row of invalid)failWithoutChange(call({metrics:[metric()],basal:[row]}));
  for(const required of ['point_index','quantity','unit','source_date','metric_date']){const row=candidate();delete row[required];failWithoutChange(call({basal:[row]}));}
  failWithoutChange(call({metrics:[{...metric(),source_family:null}],basal:[]}));
  failWithoutChange(call({metrics:[{...metric(),confidence:null}],basal:[]}));
  failWithoutChange(call({metrics:[{...metric(),value:null}],basal:[]}));
});

test('maximum 2500 candidates and exact numeric/source boundaries are retained without aggregation',()=>{
  prepare();
  const rows=Array.from({length:2500},(_,point_index)=>candidate({point_index,quantity:point_index===0?1000000000:0,unit:'u'.repeat(32),original_source:'s'.repeat(160)}));
  const result=json(call({basal:rows}));assert.equal(result.accepted_basal_candidates,2500);
  assert.equal(json('SELECT count(*) FROM health_ingest_private.basal_energy_candidates;'),2500);
  assert.equal(json('SELECT max(quantity) FROM health_ingest_private.basal_energy_candidates;'),1000000000);
  assert.equal(snapshot()[tables[1]].length,0);assert.equal(snapshot()[tables[2]].length,0);
});

test('calendar validation rejects impossible dates, offset overflow, futures and invented timestamps',()=>{
  prepare();
  const invalid=['2026-10-19\n','2026-10-19 12:00:00 -0300\n','2026-02-30','1999-12-31','0000-01-01','2026-13-01','2026-10-19 24:00:00 -0300','2026-10-19 23:60:00 -0300','2026-10-19 23:00:60 -0300','2026-10-19 12:00:00 +1401','2026-10-19 12:00:00 +1500','2026-10-19T12:00:00Z','9999-12-31'];
  for(const date of invalid){failWithoutChange(call({basal:[candidate({source_date:date,metric_date:date.slice(0,10)})]}));for(const key of ['source_start_date','source_end_date','source_creation_date'])failWithoutChange(call({basal:[candidate({[key]:date})]}));}
  const r=candidate({source_date:'2024-02-29',metric_date:'2024-02-29'});delete r.original_source;delete r.source_start_date;delete r.source_end_date;delete r.source_creation_date;
  json(call({basal:[r]}));const row=snapshot()[tables[4]][0];assert.equal(row.original_source,null);assert.equal(row.source_start_date,null);
});

test('late candidate insert failure rolls back earlier legacy writes and rate increment',()=>{
  prepare();
  run("CREATE FUNCTION public.synthetic_fail_candidate() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic failure'; END $$; CREATE TRIGGER synthetic_fail BEFORE INSERT ON health_ingest_private.basal_energy_candidates FOR EACH ROW EXECUTE FUNCTION public.synthetic_fail_candidate();");
  failWithoutChange(call({metrics:[metric()]}),/synthetic failure/);
});

test('rate cap, expiry and replay at the cap match legacy semantics',()=>{
  prepare();const receipt=randomUUID();json(call({receipt}));
  run(`UPDATE public.health_auto_export_connections SET rate_count=120 WHERE user_id='${user}';`);
  const before=snapshot();assert.deepEqual(json(call()),{error:'rate_limited'});assert.deepEqual(snapshot(),before);
  assert.equal(json(call({receipt})).already_captured,true);assert.deepEqual(snapshot(),before);
  assert.deepEqual(json(call({metrics:[metric()]})),{error:'rate_limited'});assert.deepEqual(snapshot(),before);
  run(`UPDATE public.health_auto_export_connections SET rate_window=now()-interval '2 hours' WHERE user_id='${user}';`);json(call());assert.equal(json(`SELECT rate_count FROM public.health_auto_export_connections WHERE user_id='${user}';`),1);
});

test('concurrent wrapper and legacy requests cannot exceed the shared hourly cap',async()=>{
  prepare();run(`UPDATE public.health_auto_export_connections SET rate_count=119 WHERE user_id='${user}';`);
  const results=await Promise.all(Array.from({length:12},(_,i)=>runAsync(i%2?`SET ROLE service_role; SELECT public.health_auto_export_ingest('${key}',${sqlJson([metric()])});`:call(),`synthetic-basal-cap-${i}`)));
  assert.equal(results.filter(r=>r.received).length,1);assert.equal(results.filter(r=>r.error==='rate_limited').length,11);
  assert.equal(json(`SELECT rate_count FROM public.health_auto_export_connections WHERE user_id='${user}';`),120);
});

test('concurrent identical receipt requests store exactly once and conflicting replay rolls back',async()=>{
  prepare();const receipt=randomUUID();
  const results=await Promise.all(Array.from({length:8},(_,i)=>runAsync(call({receipt,metrics:[metric()]}),`synthetic-basal-replay-${i}`)));
  assert.equal(results.filter(r=>!r.already_captured).length,1);assert.equal(results.filter(r=>r.already_captured).length,7);
  assert.equal(snapshot()[tables[4]].length,1);assert.equal(snapshot()[tables[3]].length,1);assert.equal(json(`SELECT rate_count FROM public.health_auto_export_connections WHERE user_id='${user}';`),1);
  const different=randomUUID();const requests=[call({receipt:different,basal:[candidate({quantity:1})]}),call({receipt:different,basal:[candidate({quantity:2})]})];
  const conflicts=await Promise.allSettled(requests.map((sql,i)=>runAsync(sql,`synthetic-basal-collision-${i}`)));
  assert.equal(conflicts.filter(r=>r.status==='fulfilled').length,1);assert.match(conflicts.find(r=>r.status==='rejected').reason.message,/receipt collision/);assert.equal(snapshot()[tables[4]].length,2);
});

test('revoke and rotate committed before waiting ingest prevent old-key writes',async(t)=>{
  for(const action of ['disconnect','rotate']){
    prepare();const holder=holdSession();t.after(()=>holder.abort());
    await holder.send(`BEGIN; SET LOCAL ROLE service_role; SELECT public.health_auto_export_manage('${user}','${action}',${action==='rotate'?lit('c'.repeat(64)):'NULL'},(SELECT key_revision FROM public.health_auto_export_connections WHERE user_id='${user}'));`);
    const name=`synthetic-basal-${action}-waiter`, pending=runAsync(call(),name);await blocked(name);await holder.close();
    assert.deepEqual(await pending,{error:'unauthorized'});assert.equal(snapshot()[tables[4]].length,0);assert.equal(snapshot()[tables[3]].length,0);assert.equal(snapshot()[tables[1]].length,0);
  }
});

test('ingest holding connection lock completes before waiting revoke, then old key is refused',async(t)=>{
  prepare();const holder=holdSession();t.after(()=>holder.abort());await holder.send(`BEGIN; ${call()}`);
  const name='synthetic-basal-revoke-after-ingest';
  const revocation=runAsync(`SET ROLE service_role; SELECT public.health_auto_export_manage('${user}','disconnect',NULL,(SELECT key_revision FROM public.health_auto_export_connections WHERE user_id='${user}'));`,name);
  await blocked(name);await holder.close();assert.deepEqual(await revocation,{ok:true});assert.equal(snapshot()[tables[4]].length,1);
  const before=snapshot();assert.deepEqual(json(call()),{error:'unauthorized'});assert.deepEqual(snapshot(),before);
});

test('foreign-owner references and verified coverage violate constraints; user erasure can cascade',()=>{
  prepare();const receipt=randomUUID();json(call({receipt}));
  failWithoutChange(`INSERT INTO health_ingest_private.basal_energy_candidates(user_id,receipt_id,point_index,quantity,unit,source_date,metric_date,coverage_verified) VALUES ('${user}','${receipt}',1,1,'kcal','2026-10-19','2026-10-19',true);`,/violates check/);
  failWithoutChange(`INSERT INTO health_ingest_private.basal_energy_candidates(user_id,receipt_id,point_index,quantity,unit,source_date,metric_date) VALUES ('${other}','${receipt}',1,1,'kcal','2026-10-19','2026-10-19');`,/violates foreign key/);
  run(`DELETE FROM auth.users WHERE id='${user}';`);assert.equal(snapshot()[tables[4]].length,0);assert.equal(snapshot()[tables[3]].length,0);
});
