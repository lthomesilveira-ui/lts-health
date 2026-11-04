import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createGoogleHealthHandlers,googleHealthConfigured,googleHealthCallback} from '../supabase/functions/_shared/google-health-connection.mjs';
import {GOOGLE_HEALTH_NUTRITION_SCOPE as scope} from '../supabase/functions/_shared/google-health-reader.mjs';
import {digest,decryptTokens} from '../supabase/functions/_shared/polar-contract.mjs';
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const config={enabled:true,url:'https://abcdefghijklmnopqrst.supabase.co',clientId:'123456-synthetic.apps.googleusercontent.com',clientSecret:'synthetic-secret-only',encryptionKey:btoa('x'.repeat(32))};
const identity={name:'users/me/identity',healthUserId:'synthetic-health-user'};
const response=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json'}});
const point={name:'users/synthetic-health-user/dataTypes/hydration-log/dataPoints/water-0001',dataSource:{platform:'GOOGLE_WEB_API',application:{googleWebClientId:'synthetic-source.apps.googleusercontent.com'}},hydrationLog:{interval:{startTime:'2030-02-11T15:00:00Z',endTime:'2030-02-11T15:00:00Z',startUtcOffset:'-10800s',endUtcOffset:'-10800s'},amountConsumed:{milliliters:321}}};
const token={access_token:'synthetic-access-only',refresh_token:'synthetic-refresh-only',expires_in:3600,scope,token_type:'Bearer'};
class MemoryStore{
  constructor(now){this.now=now;this.rows=new Map();this.states=new Map();this.reads=[];}
  async connection(id){return structuredClone(this.rows.get(id)??null);}
  async begin(id,hash,payload,expires){
    const row=this.rows.get(id)||{user_id:id,status:'unlinked',health_user_id:null};
    row.generation=crypto.randomUUID();row.pending_state_hash=hash;row.lease_token=null;
    this.rows.set(id,row);for(const [key,s] of this.states)if(s.user_id===id)this.states.delete(key);
    this.states.set(hash,{user_id:id,generation:row.generation,payload_encrypted:payload,expires});
  }
  async consume(hash){
    const s=this.states.get(hash);if(!s||Date.parse(s.expires)<=this.now())return null;
    this.states.delete(hash);const row=this.rows.get(s.user_id);
    return row?.generation===s.generation&&row.pending_state_hash===hash?{...s,health_user_id:row.health_user_id}:null;
  }
  async save(id,generation,hash,health,tokens){
    const row=this.rows.get(id);if(!row||row.generation!==generation||row.pending_state_hash!==hash||(row.health_user_id&&row.health_user_id!==health))return false;
    Object.assign(row,{status:'connected',health_user_id:health,tokens_encrypted:tokens,pending_state_hash:null,generation:crypto.randomUUID()});return true;
  }
  async disconnect(id){const row=this.rows.get(id);if(row)Object.assign(row,{status:'unlinked',health_user_id:null,tokens_encrypted:null,generation:crypto.randomUUID(),lease_token:null,pending_state_hash:null});for(const [key,s] of this.states)if(s.user_id===id)this.states.delete(key);}
  async claim(id,generation,lease,now,until){const row=this.rows.get(id);if(row?.status!=='connected'||row.generation!==generation||row.lease_token)return false;Object.assign(row,{lease_token:lease,lease_until:until});return true;}
  async refresh(id,generation,lease,tokens){const row=this.rows.get(id);if(row?.generation!==generation||row.lease_token!==lease)return false;row.tokens_encrypted=tokens;return true;}
  async finish(id,generation,lease,result){
    const row=this.rows.get(id);if(row?.generation!==generation||row.lease_token!==lease)return 'stale';
    const fingerprint=JSON.stringify(result.records);const exists=this.reads.some(r=>r.user_id===id&&r.fingerprint===fingerprint);
    if(!exists)this.reads.push({user_id:id,fingerprint,result:structuredClone(result)});row.lease_token=null;row.last_read_at=new Date(this.now()).toISOString();return exists?'unchanged':'stored';
  }
  async release(id,generation,lease,reason){const row=this.rows.get(id);if(row?.generation===generation&&row.lease_token===lease){row.lease_token=null;row.last_error=reason;}}
}
function fixture({enabled=true,fetcher,authenticate}={}){
  let clock=Date.parse('2030-02-11T16:00:00Z');const now=()=>clock,store=new MemoryStore(now),calls=[];
  const transport=async(url,init)=>{
    calls.push({url:String(url),init});
    if(fetcher)return fetcher(url,init);
    if(String(url)==='https://oauth2.googleapis.com/token')return response(token);
    if(new URL(url).pathname.endsWith('/identity'))return response(identity);
    return response({dataPoints:[point]});
  };
  const auth=authenticate||(async req=>req.headers.get('Authorization')==='Bearer synthetic-owner'?{id:owner,is_anonymous:false}:req.headers.get('Authorization')==='Bearer synthetic-other'?{id:other,is_anonymous:false}:null);
  const handlers=createGoogleHealthHandlers({config:()=>({...config,enabled}),authenticate:auth,storeFactory:()=>store,fetcher:transport,now});
  const post=(body,auth='synthetic-owner',origin='https://lthomesilveira-ui.github.io')=>handlers.connection(new Request(config.url+'/functions/v1/health-google-connection',{method:'POST',headers:{Authorization:`Bearer ${auth}`,Origin:origin},body:typeof body==='string'?body:JSON.stringify(body)}));
  const authorize=async()=>{const r=await post({action:'authorize'});assert.equal(r.status,200);return new URL((await r.json()).authorization_url);};
  const callback=(url,extra='')=>handlers.callback(new Request(googleHealthCallback(config)+'?'+new URLSearchParams({state:url.searchParams.get('state'),code:'synthetic-authorization-code'})+extra));
  return {handlers,store,calls,post,authorize,callback,advance:ms=>{clock+=ms;}};
}
async function connected(f){const url=await f.authorize();const r=await f.callback(url);assert.equal(r.status,302);return url;}

test('disabled configuration and unauthenticated requests make no Google request or private storage access',async()=>{
  const f=fixture({enabled:false});
  const status=await f.post({action:'status'});assert.equal(status.status,200);assert.equal((await status.json()).configured,false);
  assert.equal((await f.post({action:'authorize'})).status,409);assert.equal((await f.post({action:'read',from:'2030-02-11',to:'2030-02-12'})).status,409);
  assert.equal((await f.post({action:'status'},'unrecognized')).status,401);assert.equal(f.calls.length,0);assert.equal(f.store.rows.size,0);
  assert.equal(googleHealthConfigured({...config,encryptionKey:''}),false);assert.equal(googleHealthConfigured({...config,url:'https://attacker.test'}),false);
});
test('an anonymous authenticated-role account is refused',async()=>{
  const f=fixture({authenticate:async()=>({id:owner,is_anonymous:true})});assert.equal((await f.post({action:'authorize'})).status,401);assert.equal(f.store.states.size,0);
});
test('authorization is read-only, PKCE-bound, hashed, encrypted and private to the initiating LTS owner',async()=>{
  const f=fixture(),url=await f.authorize(),state=url.searchParams.get('state'),saved=f.store.states.get(await digest(state));
  assert.equal(url.origin,'https://accounts.google.com');assert.equal(url.pathname,'/o/oauth2/v2/auth');assert.equal(url.searchParams.get('scope'),scope);
  assert.equal(url.searchParams.get('access_type'),'offline');assert.equal(url.searchParams.get('code_challenge_method'),'S256');
  assert.equal(url.searchParams.get('redirect_uri'),googleHealthCallback(config));assert.equal(url.searchParams.get('client_secret'),null);
  assert.ok(!JSON.stringify([...f.store.states]).includes(state));assert.equal(f.calls.length,0);
  const payload=await decryptTokens(saved.payload_encrypted,config.encryptionKey,`google-health:state:${owner}`);
  assert.match(payload.verifier,/^[A-Za-z0-9_-]{43}$/);
  const challenge=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(payload.verifier))))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
  assert.equal(challenge,url.searchParams.get('code_challenge'));
  await assert.rejects(()=>decryptTokens(saved.payload_encrypted,config.encryptionKey,`google-health:state:${other}`));
  await assert.rejects(()=>decryptTokens(saved.payload_encrypted,config.encryptionKey,`google-health:tokens:${owner}`));
});
test('callback verifies a Health profile, stores only encrypted tokens and redirects to the fixed app without credentials',async()=>{
  const f=fixture(),url=await f.authorize(),r=await f.callback(url);
  assert.equal(r.status,302);assert.equal(r.headers.get('Location'),'https://lthomesilveira-ui.github.io/lts-health/v2/#dados');
  assert.ok(!f.store.rows.get(owner).tokens_encrypted.includes(token.access_token));assert.equal(f.store.rows.get(owner).status,'connected');
  const exchange=f.calls[0];assert.equal(exchange.url,'https://oauth2.googleapis.com/token');assert.equal(exchange.init.method,'POST');assert.equal(exchange.init.redirect,'error');
  assert.equal(exchange.init.body.get('redirect_uri'),googleHealthCallback(config));assert.match(exchange.init.body.get('code_verifier'),/^[A-Za-z0-9_-]{43}$/);
  assert.equal(f.calls[1].init.method,'GET');assert.equal(new URL(f.calls[1].url).pathname,'/v4/users/me/identity');
  const status=await (await f.post({action:'status'})).json();assert.equal(status.connected,true);
  for(const privateField of ['tokens_encrypted','health_user_id','client_secret','user_id','generation'])assert.equal(Object.hasOwn(status,privateField),false);
});
test('an unverified Health profile cannot turn a valid Google OAuth response into a connected Health account',async()=>{
  const f=fixture({fetcher:async url=>String(url).includes('/token')?response(token):response({name:'users/me/identity'})});
  const r=await f.callback(await f.authorize());assert.equal(r.status,502);assert.equal((await r.json()).error,'identity_not_verified');assert.equal(f.store.rows.get(owner).status,'unlinked');
});
test('expired, replayed, replaced and denied states do not silently authorize an account',async()=>{
  const expired=fixture(),old=await expired.authorize();expired.advance(600001);assert.equal((await expired.callback(old)).status,400);assert.equal(expired.calls.length,0);
  const replay=fixture(),url=await connected(replay),count=replay.calls.length;assert.equal((await replay.callback(url)).status,400);assert.equal(replay.calls.length,count);
  const replaced=fixture(),first=await replaced.authorize();await replaced.authorize();assert.equal((await replaced.callback(first)).status,400);assert.equal(replaced.calls.length,0);
  const denied=fixture(),pending=await denied.authorize();assert.equal((await denied.callback(pending,'&error=access_denied')).status,400);assert.equal(denied.calls.length,0);assert.equal(denied.store.states.size,0);
});
test('owner, action, origin, callback parameter and body boundaries fail before credentials or source reads',async()=>{
  const f=fixture();
  assert.equal((await f.post({action:'status',user_id:other})).status,400);
  assert.equal((await f.post({action:'read',from:'2030-02-11',to:'2030-02-12',trigger:'scheduled'})).status,400);
  assert.equal((await f.post({action:'authorize'},'synthetic-owner','https://unrelated.test')).status,403);
  assert.equal((await f.post('{')).status,400);assert.equal((await f.post(JSON.stringify({action:'status',padding:'x'.repeat(2048)}))).status,413);
  const url=await f.authorize();assert.equal((await f.callback(url,'&state=another')).status,400);assert.equal((await f.callback(url,'&code=another')).status,400);
  assert.equal(f.calls.length,0);
});
test('a second LTS account cannot see the first account connection or cause its hydration read',async()=>{
  const f=fixture();await connected(f);const count=f.calls.length;
  const status=await (await f.post({action:'status'},'synthetic-other')).json();assert.equal(status.connected,false);
  const read=await (await f.post({action:'read',from:'2030-02-11',to:'2030-02-12'},'synthetic-other')).json();
  assert.equal(read.connected,false);assert.equal(f.calls.length,count);assert.equal(f.store.reads.length,0);
});
test('a complete read is stored privately, retained on disconnect, and never returned as canonical water',async()=>{
  const f=fixture();await connected(f);
  const r=await f.post({action:'read',from:'2030-02-11',to:'2030-02-12'}),body=await r.json();
  assert.equal(r.status,200);assert.equal(body.read,true);assert.equal(body.observations,1);assert.equal(body.canonical_updated,false);
  assert.ok(!JSON.stringify(body).includes('321'));assert.ok(!JSON.stringify(body).includes('resource_name'));assert.equal(f.store.reads.length,1);
  assert.equal(f.store.reads[0].result.records[0].canonical_eligible,false);
  const repeated=await (await f.post({action:'read',from:'2030-02-11',to:'2030-02-12'})).json();assert.equal(repeated.unchanged,true);assert.equal(f.store.reads.length,1);
  await f.post({action:'disconnect'});assert.equal(f.store.rows.get(owner).status,'unlinked');assert.equal(f.store.reads.length,1);
});
test('a malformed later page cannot create a partial private read or canonical update',async()=>{
  let list=0;
  const f=fixture({fetcher:async url=>String(url).includes('/token')?response(token):new URL(url).pathname.endsWith('/identity')?response(identity):response(++list===1?{dataPoints:[point],nextPageToken:'two'}:{})});
  await connected(f);const r=await f.post({action:'read',from:'2030-02-11',to:'2030-02-12'});assert.equal(r.status,502);assert.equal(f.store.reads.length,0);assert.equal(f.store.rows.get(owner).lease_token,null);
});
test('refresh is on demand and preserves an unrotated refresh token and read-only scope',async()=>{
  let exchanges=0;
  const f=fixture({fetcher:async (url,init)=>{
    if(String(url).includes('/token')){
      exchanges++;if(exchanges===1)return response({...token,expires_in:1,refresh_token_expires_in:604800});
      assert.equal(init.body.get('grant_type'),'refresh_token');assert.equal(init.body.get('refresh_token'),token.refresh_token);
      return response({access_token:'synthetic-refreshed-access',expires_in:3600,token_type:'Bearer'});
    }return new URL(url).pathname.endsWith('/identity')?response(identity):response({dataPoints:[]});
  }});
  await connected(f);assert.equal(exchanges,1);f.advance(2000);
  const body=await (await f.post({action:'read',from:'2030-02-11',to:'2030-02-12'})).json();assert.equal(body.read,true);assert.equal(body.empty,true);assert.equal(exchanges,2);
  f.advance(604800000);const before=f.calls.length;assert.equal((await f.post({action:'read',from:'2030-02-11',to:'2030-02-12'})).status,502);assert.equal(f.calls.length,before);
});
test('a changed Google Health account cannot replace the linked identity during a read or reconnect',async()=>{
  let changed=false;
  const f=fixture({fetcher:async url=>String(url).includes('/token')?response(token):new URL(url).pathname.endsWith('/identity')?response(changed?{name:'users/me/identity',healthUserId:'different-user'}:identity):response({dataPoints:[point]})});
  await connected(f);changed=true;
  assert.equal((await f.post({action:'read',from:'2030-02-11',to:'2030-02-12'})).status,409);assert.equal(f.store.reads.length,0);
  assert.equal((await f.callback(await f.authorize())).status,409);assert.equal(f.store.rows.get(owner).health_user_id,identity.healthUserId);
});
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
test('disconnect while an authorization is in flight prevents a late callback from relinking',async()=>{
  const entered=deferred(),resume=deferred();
  const f=fixture({fetcher:async url=>{if(String(url).includes('/token')){entered.resolve();await resume.promise;return response(token);}return response(identity);}});
  const pending=f.callback(await f.authorize());await entered.promise;await f.post({action:'disconnect'});resume.resolve();
  const r=await pending;assert.equal(r.status,409);assert.equal(f.store.rows.get(owner).status,'unlinked');assert.equal(f.store.rows.get(owner).tokens_encrypted,null);
});
test('concurrent reads share one lease, and disconnect before commit rejects the stale private write',async()=>{
  const entered=deferred(),resume=deferred();
  const f=fixture({fetcher:async url=>{
    if(String(url).includes('/token'))return response(token);
    if(new URL(url).pathname.endsWith('/identity'))return response(identity);
    entered.resolve();await resume.promise;return response({dataPoints:[point]});
  }});
  await connected(f);const first=f.post({action:'read',from:'2030-02-11',to:'2030-02-12'});await entered.promise;
  const second=await (await f.post({action:'read',from:'2030-02-11',to:'2030-02-12'})).json();assert.equal(second.in_progress,true);
  await f.post({action:'disconnect'});resume.resolve();const result=await (await first).json();assert.equal(result.superseded,true);assert.equal(f.store.reads.length,0);
});
test('provider token bodies and secrets do not cross the error response',async()=>{
  const f=fixture({fetcher:async()=>response({error:config.clientSecret+' '+token.refresh_token},400)});
  const r=await f.callback(await f.authorize()),body=await r.text();assert.equal(r.status,502);
  assert.ok(!body.includes(config.clientSecret));assert.ok(!body.includes(token.refresh_token));assert.equal(f.store.rows.get(owner).status,'unlinked');
});
