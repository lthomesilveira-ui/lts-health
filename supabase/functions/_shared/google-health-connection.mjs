import {randomState,digest,validKey,encryptTokens,decryptTokens} from './polar-contract.mjs';
import {GOOGLE_HEALTH_NUTRITION_SCOPE as scope,hydrationReadParameters,verifyGoogleHealthIdentity,readGoogleHealthHydration} from './google-health-reader.mjs';
export const GOOGLE_HEALTH_APP='https://lthomesilveira-ui.github.io/lts-health/v2/';
const appOrigin=new URL(GOOGLE_HEALTH_APP).origin;
const cors={'Access-Control-Allow-Origin':appOrigin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store','Vary':'Origin'};
const codes=new Set(['configuration_required','unauthorized','origin_not_allowed','method_not_allowed','payload_too_large','invalid_json','invalid_action','invalid_callback','invalid_state','authorization_denied','authorization_expired','authorization_superseded','write_failed','invalid_date_window','invalid_access_token','read_scope_required','invalid_expected_identity','identity_not_verified','account_changed','record_account_mismatch','invalid_hydration_record','invalid_volume','invalid_interval','inconsistent_civil_date','record_outside_window','invalid_source','invalid_response','response_too_large','network_error','permission_denied','rate_limited','provider_unavailable','provider_request_rejected','pagination_limit','record_limit','invalid_pagination','duplicate_identity_conflict']);
const error=code=>{throw Error(code);};
const safeCode=e=>codes.has(e?.code)?e.code:codes.has(e?.message)?e.message:'operation_failed';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
const failResponse=e=>{
  const code=safeCode(e),status=code==='unauthorized'?401:code==='origin_not_allowed'?403:code==='method_not_allowed'?405:code==='payload_too_large'?413:code==='rate_limited'?429:
    ['configuration_required','account_changed','authorization_superseded','read_scope_required'].includes(code)?409:
    ['invalid_json','invalid_action','invalid_callback','invalid_state','invalid_date_window','authorization_denied'].includes(code)?400:502;
  return json({error:code,...(code==='rate_limited'&&Number.isInteger(e.retryAfterSeconds)?{retry_after_seconds:e.retryAfterSeconds}:{})},status);
};
export const googleHealthConfigured=c=>c.enabled===true&&/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(c.url||'')&&
  /^\d+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(c.clientId||'')&&typeof c.clientSecret==='string'&&Boolean(c.clientSecret)&&
  c.clientSecret.length<=8192&&!/[\x00-\x20\x7f]/.test(c.clientSecret)&&validKey(c.encryptionKey);
export const googleHealthCallback=c=>`${c.url}/functions/v1/health-google-callback`;
const tokenDomain=userId=>`google-health:tokens:${userId}`;
const stateDomain=userId=>`google-health:state:${userId}`;
const seal=(value,c,domain)=>encryptTokens(value,c.encryptionKey,domain);
const open=(value,c,domain)=>decryptTokens(value,c.encryptionKey,domain);
async function boundedJson(input,max){
  if(!input.body)error('invalid_json');
  const reader=input.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let size=0,text='';
  try{
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
      if(size>max){try{await reader.cancel();}catch{}error('payload_too_large');}text+=decoder.decode(value,{stream:true});}
    text+=decoder.decode();return JSON.parse(text);
  }catch(e){if(e?.message==='payload_too_large')throw e;error('invalid_json');}finally{reader.releaseLock();}
}
const opaque=value=>typeof value==='string'&&Boolean(value)&&value.length<=8192&&!/[^\x21-\x7e]/.test(value);
async function exchange(c,params,previous,fetcher,now){
  let response;
  try{response=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),
    headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:c.clientId,client_secret:c.clientSecret,...params})});}
  catch{error('network_error');}
  if(!response.ok){try{await response.body?.cancel();}catch{}error('authorization_expired');}
  let body;try{body=await boundedJson(response,32000);}catch{error('authorization_expired');}
  const grant=body?.scope===undefined?previous?.scope:body.scope;
  const scopes=typeof grant==='string'?grant.split(/\s+/).filter(Boolean):[];
  const refresh=body?.refresh_token===undefined?previous?.refresh_token:body.refresh_token;
  if(!opaque(body?.access_token)||!opaque(refresh)||typeof body?.token_type!=='string'||body.token_type.toLowerCase()!=='bearer'||
      !Number.isInteger(body?.expires_in)||body.expires_in<=0||body.expires_in>86400||
      scopes.length!==1||scopes[0]!==scope)error('authorization_expired');
  let refreshExpires=previous?.refresh_expires_at??null;
  if(body.refresh_token_expires_in!==undefined){
    if(!Number.isInteger(body.refresh_token_expires_in)||body.refresh_token_expires_in<=0)error('authorization_expired');
    refreshExpires=now()+body.refresh_token_expires_in*1000;
    if(!Number.isSafeInteger(refreshExpires))error('authorization_expired');
  }
  return {access_token:body.access_token,refresh_token:refresh,scope,expires_at:now()+body.expires_in*1000,refresh_expires_at:refreshExpires};
}
function status(c,row){return {configured:googleHealthConfigured(c),connected:row?.status==='connected',last_read_at:row?.last_read_at??null,last_attempt_at:row?.last_attempt_at??null,last_error:row?.last_error??null,canonical_updated:false};}

// Dependencies are injected for invented-fixture HTTP/transaction tests. Production only injects verified Auth and a service-only store.
export function createGoogleHealthHandlers({config,authenticate,storeFactory,resolveConfig=async c=>c,fetcher=fetch,now=()=>Date.now()}){
  async function performRead(c,userId,from,to,trigger='manual'){
    hydrationReadParameters(from,to);
    const store=storeFactory(c,{trigger}),row=await store.connection(userId);
    if(row?.status!=='connected')return {connected:false,read:false,canonical_updated:false};
    const lease=crypto.randomUUID();
    if(!await store.claim(userId,row.generation,lease,new Date(now()).toISOString(),new Date(now()+120000).toISOString()))return {connected:true,read:false,in_progress:true,canonical_updated:false};
    try{
      let token;try{token=await open(row.tokens_encrypted,c,tokenDomain(userId));}catch{error('authorization_expired');}
      if(!opaque(token.access_token)||!opaque(token.refresh_token)||token.scope!==scope||!Number.isFinite(token.expires_at)||
          (token.refresh_expires_at!==null&&token.refresh_expires_at<=now()))error('authorization_expired');
      if(token.expires_at<now()+60000){
        token=await exchange(c,{grant_type:'refresh_token',refresh_token:token.refresh_token},token,fetcher,now);
        if(!await store.refresh(userId,row.generation,lease,await seal(token,c,tokenDomain(userId))))error('authorization_superseded');
      }
      const result=await readGoogleHealthHydration({accessToken:token.access_token,grantedScopes:token.scope,expectedHealthUserId:row.health_user_id,from,to,fetcher});
      const stored=await store.finish(userId,row.generation,lease,result);
      if(stored==='stale')return {connected:false,read:false,superseded:true,canonical_updated:false};
      if(!['stored','unchanged'].includes(stored))error('write_failed');
      return {connected:true,read:true,observations:result.unique_count,empty:result.status==='empty',unchanged:stored==='unchanged',canonical_updated:false};
    }catch(e){await store.release(userId,row.generation,lease,safeCode(e));throw e;}
  }
  // Server dependency only: no public action accepts an owner ID or a schedule trigger.
  async function scheduledReady(){return googleHealthConfigured(await resolveConfig(config()));}
  async function scheduledRead(userId,from,to){
    if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(userId||''))error('unauthorized');
    const c=await resolveConfig(config());
    if(!googleHealthConfigured(c))return {configured:false,read:false,canonical_updated:false};
    return performRead(c,userId,from,to,'scheduled');
  }
  async function connection(request){
    const origin=request.headers.get('Origin');
    if(origin&&origin!==appOrigin)return failResponse(Error('origin_not_allowed'));
    if(request.method==='OPTIONS')return new Response('ok',{headers:cors});
    if(request.method!=='POST')return failResponse(Error('method_not_allowed'));
    try{
      let c=config();const user=await authenticate(request,c);
      if(!user||user.is_anonymous===true)error('unauthorized');
      const body=await boundedJson(request,2048),action=body?.action;
      const allowed=action==='read'?['action','from','to']:['action'];
      if(!body||typeof body!=='object'||Array.isArray(body)||!['status','authorize','read','disconnect'].includes(action)||Object.keys(body).some(k=>!allowed.includes(k)))error('invalid_action');
      if(action==='disconnect'){
        await storeFactory(c).disconnect(user.id);
        try{c=await resolveConfig(c);}catch{c={...c,enabled:false,encryptionKey:null};}
        return json(status(c,null));
      }
      c=await resolveConfig(c);
      if(action==='status'&&!googleHealthConfigured(c))return json(status(c,null));
      if(!googleHealthConfigured(c))error('configuration_required');
      const store=storeFactory(c);
      if(action==='status')return json(status(c,await store.connection(user.id)));
      if(action==='authorize'){
        const state=randomState(),verifier=randomState(),stateHash=await digest(state);
        const challenge=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
        await store.begin(user.id,stateHash,await seal({verifier},c,stateDomain(user.id)),new Date(now()+600000).toISOString());
        const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
        url.search=new URLSearchParams({client_id:c.clientId,redirect_uri:googleHealthCallback(c),response_type:'code',scope,
          access_type:'offline',prompt:'consent',include_granted_scopes:'false',state,code_challenge:challenge,code_challenge_method:'S256'}).toString();
        return json({authorization_url:url.href});
      }
      return json(await performRead(c,user.id,body.from,body.to));
    }catch(e){return failResponse(e);}
  }
  async function callback(request){
    if(request.method!=='GET')return failResponse(Error('method_not_allowed'));
    try{
      const c=await resolveConfig(config());if(!googleHealthConfigured(c))error('configuration_required');
      const params=new URL(request.url).searchParams,state=params.get('state'),code=params.get('code');
      if(params.getAll('state').length!==1||!/^[A-Za-z0-9_-]{43}$/.test(state||'')||
          (!params.has('error')&&(params.getAll('code').length!==1||!opaque(code)||code.length>4096)))error('invalid_callback');
      const stateHash=await digest(state),store=storeFactory(c),saved=await store.consume(stateHash);
      if(!saved)error('invalid_state');
      if(params.has('error'))error('authorization_denied');
      const payload=await open(saved.payload_encrypted,c,stateDomain(saved.user_id));
      if(!/^[A-Za-z0-9_-]{43}$/.test(payload?.verifier||''))error('invalid_state');
      const token=await exchange(c,{grant_type:'authorization_code',code,redirect_uri:googleHealthCallback(c),code_verifier:payload.verifier},null,fetcher,now);
      const identity=await verifyGoogleHealthIdentity({accessToken:token.access_token,grantedScopes:token.scope,expectedHealthUserId:saved.health_user_id??null,fetcher});
      if(!await store.save(saved.user_id,saved.generation,stateHash,identity.healthUserId,await seal(token,c,tokenDomain(saved.user_id))))error('authorization_superseded');
      return new Response(null,{status:302,headers:{Location:GOOGLE_HEALTH_APP+'#dados','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
    }catch(e){return failResponse(e);}
  }
  return {connection,callback,scheduledRead,scheduledReady};
}
