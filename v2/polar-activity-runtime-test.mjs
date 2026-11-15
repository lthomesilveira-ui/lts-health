import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {encryptTokens,decryptTokens,POLAR_SCOPES} from '../supabase/functions/_shared/polar-contract.mjs';

const runtimeUrl=new URL('../supabase/functions/_shared/polar-runtime.mjs',import.meta.url);
let source=readFileSync(runtimeUrl,'utf8').replace(/^import \{createClient\}[^\n]+/m,"const createClient=()=>{throw Error('not used in synthetic test');};");
source=source.replace(/from '(\.\/[^']+)'/g,(_,relative)=>`from '${new URL(relative,runtimeUrl).href}'`);
const {syncPolar,startAuthorization,saveAuthorization}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const owner='synthetic-owner',key=Buffer.alloc(32,7).toString('base64'),config={url:'https://synthetic.invalid',clientId:'synthetic-client',encryptionKey:key};
const baseDate='2001-04-03T08:00:00Z';
async function database(scopes){
 const token={access_token:'synthetic-access',refresh_token:'synthetic-refresh',expires_at:Date.now()+3600000,scopes};
 let row={user_id:owner,revision:'synthetic-revision',scopes,tokens_encrypted:await encryptTokens(token,key,owner),last_sync_at:baseDate,last_attempt_at:baseDate,last_scheduled_sync_at:baseDate,last_scheduled_attempt_at:baseDate,last_sync_trigger:'scheduled',sync_error:'previous-base-error',sync_lease_until:'1970-01-01T00:00:00Z'};
 const updates=[],upserts=[];
 const db={updates,upserts,get row(){return row;},from(table){
  const filters=[];let patch=null;const q={select(){return q;},eq(key,value){filters.push([key,value]);return q;},lte(){return q;},lt(){return q;},delete(){return q;},
   update(value){patch=value;return q;},
   async insert(value){assert.equal(table,'health_polar_oauth_states');return{data:value,error:null};},
   async upsert(value){upserts.push({table,value});if(table==='health_polar_connections')row={...row,...value};return{error:null};},
   result(){if(patch){assert.equal(table,'health_polar_connections');assert.ok(filters.some(([key,value])=>key==='user_id'&&value===owner));updates.push(patch);row={...row,...patch};patch=null;}return{data:table==='health_polar_connections'?row:null,error:null};},
   async maybeSingle(){return q.result();},
   then(resolve,reject){return Promise.resolve(q.result()).then(resolve,reject);}
  };return q;
 }};return db;
}
const oldFetch=globalThis.fetch,info=console.info,logs=[],calls=[];
console.info=(...args)=>logs.push(args.join(' '));
let activityStatus=200;
globalThis.fetch=async(url,options)=>{
 const parsed=new URL(url);assert.equal(parsed.origin,'https://www.polaraccesslink.com');assert.equal(options.headers.Authorization,'Bearer synthetic-access');calls.push(parsed.pathname);
 if(parsed.pathname.endsWith('/activity/list'))return new Response(JSON.stringify({activities:{activityDays:[]}}),{status:activityStatus});
 if(parsed.pathname.endsWith('/training-sessions/list'))return new Response(JSON.stringify({trainingSessions:[]}));
 if(parsed.pathname.endsWith('/sleeps'))return new Response(JSON.stringify({nightSleeps:[]}));
 throw Error('unexpected synthetic provider route');
};
try{
 const old=await database(POLAR_SCOPES),missing=await syncPolar(old,config,owner,{activityOnly:true});
 assert.equal(missing.activity.status,'authorization_required');assert.equal(calls.length,0);assert.equal(old.updates.length,0);
 const authorized=await database([...POLAR_SCOPES,'activity:read']);
 const read=await syncPolar(authorized,config,owner,{activityOnly:true});
 assert.equal(read.activity.read,true);assert.equal(read.activity.status,'empty');assert.equal(authorized.row.last_sync_at,baseDate);assert.equal(authorized.row.last_attempt_at,baseDate);assert.equal(authorized.row.sync_error,'previous-base-error');assert.equal(authorized.upserts.length,0,'an empty provider result cannot create a step record');
 assert.equal(authorized.row.sync_lease_until,'1970-01-01T00:00:00Z');
 activityStatus=503;const failure=await database([...POLAR_SCOPES,'activity:read']);
 const unavailable=await syncPolar(failure,config,owner,{activityOnly:true});assert.equal(unavailable.activity.read,false);assert.equal(failure.row.last_sync_at,baseDate);assert.equal(failure.row.sync_error,'previous-base-error');
 const independent=await database([...POLAR_SCOPES,'activity:read']);const base=await syncPolar(independent,config,owner,{trigger:'scheduled'});
 assert.equal(base.synced,true,'an activity-provider failure cannot disable the existing training/sleep synchronizer');assert.equal(base.activity.read,false);assert.equal(independent.row.sync_error,null);
 assert.ok(!independent.upserts.some(write=>write.table==='health_workouts'||write.table==='health_workout_source_evidence'));
 const saved=await database(POLAR_SCOPES);const token={access_token:'synthetic-new-access',refresh_token:'synthetic-new-refresh',expires_at:Date.now()+3600000,scopes:[...POLAR_SCOPES,'activity:read']};
 await saveAuthorization(saved,config,owner,token);assert.equal(saved.row.last_sync_at,baseDate);assert.equal(saved.row.last_scheduled_sync_at,baseDate);assert.deepEqual((await decryptTokens(saved.row.tokens_encrypted,key,owner)).scopes,token.scopes);
 const authDb=await database(POLAR_SCOPES),url=new URL(await startAuthorization(authDb,config,owner,{activity:true}));assert.equal(url.origin,'https://auth.polar.com');assert.equal(url.pathname,'/oauth/authorize');assert.deepEqual(url.searchParams.get('scope').split(' '),[...POLAR_SCOPES,'activity:read']);assert.equal(url.searchParams.get('redirect_uri'),'https://synthetic.invalid/functions/v1/health-polar-callback');assert.match(url.searchParams.get('state'),/^[A-Za-z0-9_-]{43}$/);
 assert.doesNotMatch(logs.join(' '),/synthetic-access|synthetic-new-access|synthetic-owner|synthetic-refresh|synthetic-device/);
}finally{globalThis.fetch=oldFetch;console.info=info;}
globalThis.location={search:'?fixture=1'};
const {state}=await import('./src/core.js'),{renderConnections}=await import('./src/polar-connection.js');
state.polarConnection={status:'ready',configured:true,connected:true,activity_authorized:false};
assert.match(renderConnections(),/Permitir passos do Polar/);assert.doesNotMatch(renderConnections(),/Conferir passos do Polar/);
state.polarConnection={status:'ready',configured:true,connected:true,activity_authorized:true,activity_observations:[{date:'2001-04-03',observed_steps:0,unit:'count',sample_count:2,source_name:'Polar Flow · aparelho sintético',received_at:baseDate},{date:'2001-04-04',observed_steps:null,unit:'count',sample_count:2}]};
const html=renderConnections();assert.match(html,/Conferir passos do Polar/);assert.match(html,/0 passos nas amostras/);assert.match(html,/não comprovam o total de um dia completo/);assert.doesNotMatch(html,/04\/04\/2001/);
console.log('Polar activity runtime: missing-scope isolation, provider-empty/nonzero distinction, independent legacy sync, preserved success metadata, same-key encryption, explicit optional consent and honest UI passed.');
