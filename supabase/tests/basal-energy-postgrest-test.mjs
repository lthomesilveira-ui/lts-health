import assert from 'node:assert/strict';
import {createHmac,randomUUID} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {pathToFileURL} from 'node:url';
import {receiveHealthExport} from '../functions/_shared/health-auto-export-handler.mjs';
import {KEY_HEADER,randomToken,digest} from '../functions/_shared/health-auto-export-contract.mjs';
import {captureBasalCandidates} from '../functions/_shared/basal-energy-candidates.mjs';
import {buildBasalSyntheticBootstrapSql} from './support/basal-candidates-fixture.mjs';

// End-to-end transport gate: production handler -> pinned supabase-js -> real
// PostgREST -> disposable PostgreSQL 17. No application credentials or records.
assert.equal(process.env.HEALTH_BASAL_SYNTHETIC_TEST,'1');
assert.equal(process.env.PGDATABASE,'health_basal_candidates_test');
assert.equal(process.env.PGHOST,'127.0.0.1');
assert.equal(process.env.PGUSER,'postgres');
assert.equal(process.env.PGPASSWORD,'synthetic-ci-only');
assert.ok(!process.env.PGHOSTADDR&&!process.env.PGSERVICE&&!process.env.PGSERVICEFILE);
assert.match(process.env.PGPORT||'',/^\d{1,5}$/);assert.ok(+process.env.PGPORT>0&&+process.env.PGPORT<65536);
const libdir=process.env.HEALTH_BASAL_TEST_LIBDIR;
const env={PATH:process.env.PATH,LANG:'C.UTF-8',...(libdir?{LD_LIBRARY_PATH:libdir}:{}),PGHOST:'127.0.0.1',PGPORT:process.env.PGPORT,PGDATABASE:'health_basal_candidates_test',PGUSER:'postgres',PGPASSWORD:'synthetic-ci-only',PGSSLMODE:'disable',PGPASSFILE:'/dev/null',PGCONNECT_TIMEOUT:'5'};
function sql(query){const r=spawnSync('psql',['-X','-v','ON_ERROR_STOP=1','-Atq'],{input:query,env,encoding:'utf8',timeout:30000,maxBuffer:4000000});assert.ifError(r.error);assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
const json=query=>JSON.parse(sql(query));
assert.equal(sql("select current_setting('server_version_num')::int/10000"),'17');
assert.equal(sql("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'"),'0','Empty disposable DB required');
assert.equal(sql("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'"),'0');
assert.equal(sql("select count(*) from pg_namespace where nspname in ('health_ingest_private','auth')"),'0','No preexisting auth/private schema allowed');
sql(buildBasalSyntheticBootstrapSql());
const user='11111111-1111-4111-8111-111111111111',token=randomToken(),keyHash=await digest(token);
sql(`insert into public.health_auto_export_connections(user_id,key_hash) values ('${user}','${keyHash}');`);

const clientEntry=process.env.HEALTH_BASAL_SUPABASE_JS_ENTRY;
assert.ok(clientEntry?.startsWith('/'),'Explicit local pinned supabase-js module required');
const clientPackage=JSON.parse(readFileSync(new URL('../package.json',pathToFileURL(clientEntry)),'utf8'));
assert.equal(clientPackage.name,'@supabase/supabase-js');assert.equal(clientPackage.version,'2.117.2');
const {createClient}=await import(pathToFileURL(clientEntry));
const postgrestBin=process.env.HEALTH_BASAL_POSTGREST_BIN;assert.ok(postgrestBin?.startsWith('/'));
const version=spawnSync(postgrestBin,['--version'],{encoding:'utf8'});assert.equal(version.status,0);assert.match(version.stdout,/PostgREST 16\.5/);
const getPort=async()=>{const s=createServer();await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));const p=s.address().port;await new Promise(resolve=>s.close(resolve));return p;};
const restPort=await getPort(),restUrl=`http://127.0.0.1:${restPort}`;
const jwtSecret='local-disposable-basal-integration-test-only-2026';
const jwt=role=>{const h=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),p=Buffer.from(JSON.stringify({role,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');return `${h}.${p}.${createHmac('sha256',jwtSecret).update(`${h}.${p}`).digest('base64url')}`;};
const rest=spawn(postgrestBin,[],{env:{PATH:process.env.PATH,PGRST_DB_URI:`postgresql://postgres:synthetic-ci-only@127.0.0.1:${process.env.PGPORT}/health_basal_candidates_test`,PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',PGRST_DB_CONFIG:'false',PGRST_JWT_SECRET:jwtSecret,PGRST_SERVER_HOST:'127.0.0.1',PGRST_SERVER_PORT:String(restPort),PGRST_LOG_LEVEL:'error'},stdio:['ignore','pipe','pipe']});
let restErrors='';rest.stderr.on('data',d=>restErrors+=d);rest.stdout.on('data',()=>{});
const events=[];let db,groups=0;
const gateway=createServer(async(req,res)=>{
  try{
    if(req.url.startsWith('/rest/v1/')){
      const response=await fetch(restUrl+req.url.slice('/rest/v1'.length),{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{})});
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    const request=new Request(`http://127.0.0.1${req.url}`,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{})});
    const response=await receiveHealthExport(request,db,{emit:e=>events.push(e)});req.resume();res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(500);res.end('synthetic test gateway error');}
});
let gatewayUrl;
const basal={name:'basal_energy_burned',units:'kJ',data:[{qty:7000.125,date:'2026-10-19 00:00:00 -0300',source:'Synthetic basal source'}]};
const food={name:'protein',units:'g',data:[{qty:123,date:'2026-10-19',source:'Synthetic food source'}]};
async function send(metrics,key=token){const r=await fetch(gatewayUrl+'/functions/v1/health-auto-export-receive',{method:'POST',headers:{'content-type':'application/json','connection':'close',[KEY_HEADER]:key,'automation-aggregation':'Day'},body:JSON.stringify({data:{metrics}})});return {status:r.status,body:await r.json()};}
async function rpc(args,role='service_role'){const r=await fetch(restUrl+'/rpc/health_auto_export_ingest_candidates',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${jwt(role)}`},body:JSON.stringify(args)});return {status:r.status,body:await r.json()};}
const count=table=>Number(sql(`select count(*) from ${table}`));
const baseline=()=>json("select jsonb_build_object('nutrition',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.health_daily_nutrition x),'metrics',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.health_source_daily_metrics x))");
async function check(name,fn){try{await fn();groups++;}catch(e){e.message=`${name}: ${e.message}`;throw e;}}
try{
  const deadline=Date.now()+15000;let ready=false;
  while(Date.now()<deadline){try{const r=await fetch(restUrl);if(r.status!==503){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
  assert.ok(ready,`PostgREST did not start: ${restErrors}`);
  await new Promise(resolve=>gateway.listen(0,'127.0.0.1',resolve));gatewayUrl=`http://127.0.0.1:${gateway.address().port}`;
  db=createClient(gatewayUrl,jwt('service_role'),{auth:{persistSession:false,autoRefreshToken:false}});
  await check('real basal-only durable capture without daily projection',async()=>{
    const before=baseline(),r=await send([basal]);assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.body.accepted_basal_candidates,1);assert.equal(r.body.accepted_metrics,0);assert.equal(r.body.coverage_verified,false);assert.deepEqual(baseline(),before);
    const rows=json('select jsonb_agg(to_jsonb(x)) from health_ingest_private.basal_energy_candidates x');assert.equal(rows.length,1);assert.equal(rows[0].quantity,7000.125);assert.equal(rows[0].unit,'kJ');assert.equal(rows[0].metric_date,'2026-10-19');assert.equal(rows[0].source_date,basal.data[0].date);assert.equal(rows[0].original_source,'Synthetic basal source');assert.equal(rows[0].coverage_verified,false);assert.equal(rows[0].receipt_id,r.body.correlation_id);
  });
  await check('real mixed capture preserves legacy nutrition',async()=>{const r=await send([food,basal]);assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.body.accepted_basal_candidates,1);assert.equal(r.body.accepted_metrics,1);assert.equal(Number(sql('select protein_g from public.health_daily_nutrition')),123);assert.equal(count('public.health_source_daily_metrics'),1);});
  await check('repeated HTTP payloads remain distinct unmerged receipts',async()=>{await send([basal]);await send([basal]);assert.equal(count('health_ingest_private.basal_energy_candidates'),4);assert.equal(count('health_ingest_private.ingest_receipts'),4);});
  await check('original source missing stays null',async()=>{const b=structuredClone(basal);delete b.data[0].source;const r=await send([b]);assert.equal(r.status,200);assert.equal(Number(sql(`select count(*) from health_ingest_private.basal_energy_candidates where receipt_id='${r.body.correlation_id}' and original_source is null`)),1);});
  await check('JS accepted Unicode provenance round-trips through SQL',async()=>{
    for(const char of ['\u0085','\u200b','\u2028','\ufeff','😀','é']){
      const b=structuredClone(basal);b.data[0].source=`Synthetic ${char} source`;b.units=`k${char}J`;
      const parsed=captureBasalCandidates({data:{metrics:[b]}});if(!parsed.candidates.length)continue;
      const r=await send([b]);assert.equal(r.status,200,`U+${char.codePointAt(0).toString(16)} ${JSON.stringify(r)}`);
    }
  });
  await check('lone surrogates in formerly ignored basal cannot reject mixed legacy',async()=>{
    for(const bad of ['\ud800','\udfff','a\ud800b','a\udc00b'])for(const field of ['source','units']){
      const b=structuredClone(basal);if(field==='source')b.data[0].source=bad;else b.units=bad;
      const n=count('health_ingest_private.basal_energy_candidates');const r=await send([food,b]);
      assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.body.accepted_metrics,1);assert.equal(r.body.ignored_points,1);assert.equal(count('health_ingest_private.basal_energy_candidates'),n);
    }
  });
  const c=captureBasalCandidates({data:{metrics:[basal]}}).candidates;
  const args={p_key_hash:keyHash,p_metrics:[],p_basal_candidates:c,p_receipt_id:randomUUID()};
  await check('real RPC retry idempotency and collision rejection',async()=>{const first=await rpc(args);assert.equal(first.status,200);const n=count('health_ingest_private.basal_energy_candidates'),rate=Number(sql('select rate_count from public.health_auto_export_connections'));const retry=await rpc(args);assert.equal(retry.status,200);assert.equal(retry.body.already_captured,true);assert.equal(count('health_ingest_private.basal_energy_candidates'),n);assert.equal(Number(sql('select rate_count from public.health_auto_export_connections')),rate);const bad=structuredClone(args);bad.p_basal_candidates[0].quantity++;assert.ok((await rpc(bad)).status>=400);assert.equal(count('health_ingest_private.basal_energy_candidates'),n);});
  await check('anon and authenticated cannot invoke capture',async()=>{const n=count('health_ingest_private.ingest_receipts');for(const role of ['anon','authenticated'])assert.ok((await rpc({...args,p_receipt_id:randomUUID()},role)).status>=400);assert.equal(count('health_ingest_private.ingest_receipts'),n);});
  await check('private storage is not exposed through REST',async()=>{for(const role of ['anon','authenticated','service_role']){let r=await fetch(restUrl+'/basal_energy_candidates',{headers:{authorization:`Bearer ${jwt(role)}`}});assert.equal(r.status,404);r=await fetch(restUrl+'/basal_energy_candidates',{headers:{authorization:`Bearer ${jwt(role)}`,'accept-profile':'health_ingest_private'}});assert.equal(r.status,406);}});
  await check('malformed direct RPC leaves all tables unchanged',async()=>{const before=baseline(),n=count('health_ingest_private.ingest_receipts');const r=await rpc({...args,p_receipt_id:randomUUID(),p_metrics:[{source_family:null}],p_basal_candidates:c});assert.ok(r.status>=400);assert.equal(count('health_ingest_private.ingest_receipts'),n);assert.deepEqual(baseline(),before);});
  await check('revoked connection blocked over complete HTTP path',async()=>{const n=count('health_ingest_private.ingest_receipts');sql(`update public.health_auto_export_connections set active=false where user_id='${user}'`);assert.equal((await send([basal])).status,401);assert.equal(count('health_ingest_private.ingest_receipts'),n);});
  await check('safe private summaries contain counts only',async()=>{const text=JSON.stringify(events);for(const s of [token,keyHash,'Synthetic basal source','7000.125'])assert.ok(!text.includes(s));assert.ok(events.some(e=>e.accepted_basal_candidates===1));});
  console.log(`Basal full integration: ${groups} groups passed; HTTP -> supabase-js 2.117.2 -> PostgREST 16.5 -> PostgreSQL 17; synthetic only.`);
}finally{
  gateway.closeAllConnections();await new Promise(resolve=>gateway.close(resolve));rest.kill('SIGTERM');await new Promise(resolve=>rest.once('exit',resolve));
}
